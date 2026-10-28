import crypto from 'node:crypto';
import { and, desc, eq, notInArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../client.js';
import { jobs, orchestrationRuns, users } from '../schema/index.js';
import { AppError, type RecommendationStatusDto } from '@job-agent/shared';
import { currentMatchingInputs, matchingFingerprint } from './matching-inputs.js';
import { relevanceIssues, matchesPreferredLocation, preferredLevels } from './job-relevance.js';
import { HardPolicyEngine } from './hard-policy-engine.js';

export const RECOMMENDATION_TASK = 'EXPLORE_MATCHING';
const work = z.object({
  inputFingerprint: z.string(),
  jobIds: z.array(z.string().uuid()),
  processed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});
/** Durable recommendation-only work. It never prepares or authorizes an application. */
export class RecommendationService {
  constructor(
    private readonly db: Database,
    private readonly match: { analyzeJob(jobId: string, userId: string): Promise<unknown> },
  ) {}

  private async snapshot(userId: string, db = this.db) {
    const saved = await db
      .select()
      .from(jobs)
      .where(
        and(eq(jobs.userId, userId), notInArray(jobs.state, ['ARCHIVED', 'INVALID', 'DUPLICATE'])),
      )
      .orderBy(desc(jobs.discoveredDate));
    const inputs = await currentMatchingInputs(db, userId, saved);
    const policy = new HardPolicyEngine();
    const eligible = saved.filter(
      (job) =>
        !job.isDuplicate &&
        (!job.expirationDate || job.expirationDate > new Date()) &&
        !relevanceIssues(job, inputs.context.preferences, inputs.context.candidateProfile).length &&
        matchesPreferredLocation(job, inputs.context.preferences) &&
        !policy.evaluate(job, inputs.context).hasBlockers,
    );
    const pending = eligible.filter(
      (job) => !inputs.analysesByJob.get(job.id) || inputs.analysesByJob.get(job.id)!.isStale,
    );
    const fingerprint = crypto
      .createHash('sha256')
      .update(
        JSON.stringify(
          eligible
            .map((job) => [
              job.id,
              matchingFingerprint(
                job,
                inputs.requirementsByJob.get(job.id) ?? [],
                inputs.context.candidateStateHash,
              ),
            ])
            .sort((a, b) => a[0]!.localeCompare(b[0]!)),
        ),
      )
      .digest('hex');
    return { saved, eligible, pending, fingerprint, inputs };
  }

  private async latest(userId: string, db = this.db) {
    return (
      await db
        .select()
        .from(orchestrationRuns)
        .where(
          and(
            eq(orchestrationRuns.userId, userId),
            eq(orchestrationRuns.taskType, RECOMMENDATION_TASK),
          ),
        )
        .orderBy(desc(orchestrationRuns.createdAt))
        .limit(1)
    )[0];
  }

  async status(userId: string): Promise<RecommendationStatusDto> {
    const snapshot = await this.snapshot(userId);
    const latest = await this.latest(userId);
    const parsed = work.safeParse(latest?.summary);
    const sameInput = parsed.success && parsed.data.inputFingerprint === snapshot.fingerprint;
    const active = latest && ['PENDING', 'RUNNING'].includes(latest.status);
    const failed =
      snapshot.pending.length > 0 &&
      sameInput &&
      latest &&
      ['FAILED', 'PARTIAL'].includes(latest.status);
    const ready = snapshot.eligible.filter((job) => {
      const analysis = snapshot.inputs.analysesByJob.get(job.id);
      return analysis && !analysis.isStale && analysis.decision === 'MATCH';
    }).length;
    return {
      state: failed
        ? 'FAILED'
        : active
          ? latest.status === 'RUNNING'
            ? 'ANALYZING'
            : 'QUEUED'
          : 'IDLE',
      pending: snapshot.pending.length,
      ready,
      excluded: snapshot.saved.length - snapshot.eligible.length,
      evaluated: snapshot.eligible.length - snapshot.pending.length,
      processed: active && parsed.success ? parsed.data.processed : 0,
      batchSize: active && parsed.success ? parsed.data.jobIds.length : 0,
      locations: snapshot.inputs.context.preferences?.preferredLocations ?? [],
      levels: preferredLevels(
        snapshot.inputs.context.preferences,
        snapshot.inputs.context.candidateProfile,
      ),
      message: failed
        ? 'Some job analyses could not finish. Retry analysis to continue.'
        : active
          ? 'Checking jobs against your profile. Only completed matches appear below.'
          : snapshot.pending.length
            ? 'Preparing to check new or changed jobs.'
            : ready
              ? 'Recommendations are based on completed, current match analyses.'
              : snapshot.eligible.length
                ? 'Analysis complete. No jobs currently have a MATCH result for your profile and preferences.'
                : 'No saved jobs meet your location and level preferences. Find more jobs or review your preferences.',
    };
  }

  async request(userId: string, retry = false) {
    await this.db.transaction(async (tx) => {
      const [owner] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .for('update');
      if (!owner) throw AppError.notFound('Account not found.');
      const db = tx as unknown as Database;
      const latest = await this.latest(userId, db);
      if (latest && ['PENDING', 'RUNNING'].includes(latest.status)) return;
      const snapshot = await this.snapshot(userId, db);
      if (!snapshot.pending.length) return;
      const previous = work.safeParse(latest?.summary);
      if (
        !retry &&
        previous.success &&
        previous.data.inputFingerprint === snapshot.fingerprint &&
        latest &&
        ['FAILED', 'PARTIAL'].includes(latest.status)
      )
        return;
      await tx.insert(orchestrationRuns).values({
        userId,
        taskType: RECOMMENDATION_TASK,
        trigger: 'EVENT',
        status: 'PENDING',
        maxRetries: 0,
        summary: {
          inputFingerprint: snapshot.fingerprint,
          jobIds: snapshot.pending.slice(0, 10).map((job) => job.id),
          processed: 0,
          failed: 0,
        },
      });
    });
    return this.status(userId);
  }

  /** One job per claim keeps application execution responsive and concurrent workers fenced. */
  async processOne(userId?: string) {
    const claimAt = new Date();
    const run = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(orchestrationRuns)
        .where(
          and(
            eq(orchestrationRuns.taskType, RECOMMENDATION_TASK),
            userId ? eq(orchestrationRuns.userId, userId) : undefined,
            eq(orchestrationRuns.status, 'PENDING'),
          ),
        )
        .orderBy(orchestrationRuns.createdAt)
        .limit(1)
        .for('update', { skipLocked: true });
      if (!row) return null;
      await tx
        .update(orchestrationRuns)
        .set({ status: 'RUNNING', startedAt: row.startedAt ?? claimAt, updatedAt: claimAt })
        .where(eq(orchestrationRuns.id, row.id));
      return row;
    });
    if (!run) return false;
    const condition = and(
      eq(orchestrationRuns.id, run.id),
      eq(orchestrationRuns.userId, run.userId),
      eq(orchestrationRuns.status, 'RUNNING'),
      eq(orchestrationRuns.updatedAt, claimAt),
    );
    const parsed = work.safeParse(run.summary);
    if (!parsed.success) {
      await this.db
        .update(orchestrationRuns)
        .set({
          status: 'FAILED',
          errorMessage: 'Recommendation queue data is invalid.',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(condition);
      return true;
    }
    const summary = parsed.data;
    const snapshot = await this.snapshot(run.userId);
    if (snapshot.fingerprint !== summary.inputFingerprint) {
      await this.db
        .update(orchestrationRuns)
        .set({
          status: 'CANCELLED',
          errorMessage: 'Profile or job inputs changed; recommendations need a fresh check.',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(condition);
      return true;
    }
    const jobId = summary.jobIds[summary.processed];
    let failed = false;
    try {
      if (!jobId) throw new Error('Missing queued job');
      await this.match.analyzeJob(jobId, run.userId);
    } catch {
      failed = true;
    }
    summary.processed++;
    if (failed) summary.failed++;
    const complete = summary.processed >= summary.jobIds.length;
    await this.db
      .update(orchestrationRuns)
      .set({
        summary,
        status: complete ? (summary.failed ? 'PARTIAL' : 'COMPLETED') : 'PENDING',
        itemsProcessedCount: summary.processed,
        itemsSucceededCount: summary.processed - summary.failed,
        itemsFailedCount: summary.failed,
        errorMessage: summary.failed ? 'Some job analyses could not finish.' : null,
        completedAt: complete ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(condition);
    return true;
  }
}
