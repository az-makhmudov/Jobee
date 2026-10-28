import { and, eq, lte, sql, desc } from 'drizzle-orm';
import {
  applicationPolicy,
  jobPreferences,
  jobs,
  applicationIntents,
  orchestrationRuns,
  systemNotifications,
  autopilotCandidateFingerprint,
  assertAutopilotGrant,
  autopilotJobInScope,
  type Database,
} from '@job-agent/database';
import {
  AUTOPILOT_TERMS,
  AppError,
  type AutopilotGrant,
  type AutopilotStateDto,
} from '@job-agent/shared';
import type { ApplicationIntentService } from './application-intent-service.js';
import type { MatchService } from './match-service.js';

function policyPreferences(
  prefs: typeof jobPreferences.$inferSelect,
): AutopilotGrant['preferences'] {
  const {
    targetTitles,
    preferredLocations,
    workModes,
    employmentTypes,
    minSalary,
    currency,
    salaryPayPeriod,
    excludedCompanies,
    excludedKeywords,
    needsSponsorship,
    workAuthorizationCountries,
    internshipEligible,
    acceptUnpaid,
  } = prefs;
  return {
    targetTitles,
    preferredLocations,
    workModes,
    employmentTypes,
    minSalary,
    currency,
    salaryPayPeriod: salaryPayPeriod as AutopilotGrant['preferences']['salaryPayPeriod'],
    excludedCompanies,
    excludedKeywords,
    needsSponsorship,
    workAuthorizationCountries,
    internshipEligible,
    acceptUnpaid,
  };
}
export class AutopilotService {
  constructor(
    private readonly db: Database,
    private readonly intents: ApplicationIntentService,
    private readonly match: MatchService,
    private readonly enabled: boolean,
  ) {}
  async state(userId: string): Promise<AutopilotStateDto> {
    return this.db.transaction(
      async (tx) => {
        const db = tx as unknown as Database;
        const [p] = await tx
          .select()
          .from(applicationPolicy)
          .where(eq(applicationPolicy.userId, userId));
        const [prefs] = await tx
          .select()
          .from(jobPreferences)
          .where(eq(jobPreferences.userId, userId));
        let current = false;
        if (this.enabled && p?.autopilotGrant)
          try {
            await assertAutopilotGrant(db, userId, p.autopilotGrant);
            current = true;
          } catch {
            /* permission is no longer effective */
          }
        const fingerprint = await autopilotCandidateFingerprint(db, userId);
        return {
          candidateFingerprint: fingerprint,
          preview: prefs ? policyPreferences(prefs) : null,
          available: this.enabled,
          enabled: this.enabled && !!p?.autoApplyEnabled && !!p.autopilotGrant,
          current,
          grant: p?.autopilotGrant ?? null,
          nextRunAt: p?.autopilotNextRunAt?.toISOString() ?? null,
          message: current
            ? 'Autopilot uses your accepted policy. Missing facts and consent always pause an application.'
            : 'Autopilot is off or needs a new policy approval. Daily preparation does not authorize submission.',
        };
      },
      { isolationLevel: 'repeatable read' },
    );
  }

  async authorize(
    userId: string,
    input: {
      intervalHours: number;
      maxPerDay: number;
      minScore: number;
      expectedCandidateFingerprint: string;
    },
  ) {
    if (!this.enabled) throw AppError.forbidden('Autopilot is unavailable in this environment.');
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM users WHERE id=${userId} FOR UPDATE`);
      const db = tx as unknown as Database;
      const [prefs] = await tx
        .select()
        .from(jobPreferences)
        .where(eq(jobPreferences.userId, userId));
      if (!prefs?.targetTitles.length)
        throw AppError.badRequest('Save at least one target role in your job preferences first.');
      const fingerprint = await autopilotCandidateFingerprint(db, userId);
      if (fingerprint !== input.expectedCandidateFingerprint)
        throw AppError.conflict(
          'Your profile or preferences changed. Reload the policy preview before authorizing.',
        );
      const [previous] = await tx
        .select()
        .from(applicationPolicy)
        .where(eq(applicationPolicy.userId, userId));
      const grant: AutopilotGrant = {
        version: (previous?.autopilotVersion ?? 0) + 1,
        termsVersion: AUTOPILOT_TERMS,
        acceptedAt: new Date().toISOString(),
        candidateFingerprint: fingerprint,
        intervalHours: input.intervalHours,
        maxPerDay: input.maxPerDay,
        minScore: input.minScore,
        reviewMode: 'PAUSE',
        preferences: policyPreferences(prefs),
      };
      const values = {
        autoApplyEnabled: true,
        autopilotVersion: grant.version,
        autopilotGrant: grant,
        autopilotNextRunAt: new Date(),
        maxApplicationsPerDay: input.maxPerDay,
        autoApplyMinScore: input.minScore,
        blockOnUnresolvedReview: true,
        blockOnManual: true,
        blockOnUnknownSensitive: true,
        updatedAt: new Date(),
      };
      await tx
        .insert(applicationPolicy)
        .values({ userId, ...values })
        .onConflictDoUpdate({ target: applicationPolicy.userId, set: values });
      await tx.insert(orchestrationRuns).values({
        userId,
        taskType: 'AUTO_APPLY',
        trigger: 'MANUAL',
        status: 'COMPLETED',
        completedAt: new Date(),
        summary: { event: 'POLICY_ACCEPTED', policy: grant },
      });
    });
    return this.state(userId);
  }
  async pause(userId: string) {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM users WHERE id=${userId} FOR UPDATE`);
      await tx
        .update(applicationPolicy)
        .set({
          autoApplyEnabled: false,
          autopilotNextRunAt: null,
          autopilotVersion: sql`${applicationPolicy.autopilotVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(applicationPolicy.userId, userId));
      await tx.insert(orchestrationRuns).values({
        userId,
        taskType: 'AUTO_APPLY',
        trigger: 'MANUAL',
        status: 'COMPLETED',
        completedAt: new Date(),
        summary: { event: 'POLICY_PAUSED' },
      });
    });
    return this.state(userId);
  }
  async runDue() {
    if (!this.enabled) return;
    const due = await this.db
      .select()
      .from(applicationPolicy)
      .where(
        and(
          eq(applicationPolicy.autoApplyEnabled, true),
          lte(applicationPolicy.autopilotNextRunAt, new Date()),
        ),
      )
      .limit(20);
    for (const policy of due) await this.run(policy.userId, 'SCHEDULED');
  }
  async run(userId: string, trigger: 'MANUAL' | 'SCHEDULED' = 'MANUAL') {
    if (!this.enabled) throw AppError.forbidden('Autopilot is unavailable in this environment.');
    // Durable, bounded claim. A restart can retry after the lease; existing intents make replay idempotent.
    const claim = await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM users WHERE id=${userId} FOR UPDATE`);
      const db = tx as unknown as Database;
      const [policy] = await tx
        .select()
        .from(applicationPolicy)
        .where(eq(applicationPolicy.userId, userId));
      if (!policy?.autopilotGrant) return null;
      try {
        await assertAutopilotGrant(db, userId, policy.autopilotGrant);
      } catch {
        await tx
          .update(applicationPolicy)
          .set({
            autoApplyEnabled: false,
            autopilotNextRunAt: null,
            autopilotVersion: sql`${applicationPolicy.autopilotVersion} + 1`,
          })
          .where(eq(applicationPolicy.userId, userId));
        await tx.insert(systemNotifications).values({
          userId,
          type: 'MANUAL_REVIEW_REQUIRED',
          title: 'Autopilot policy needs review',
          message:
            'Your policy or candidate inputs changed. Review the current scope in Profile and authorize a new policy to resume.',
          severity: 'WARNING',
          targetType: 'SYSTEM',
          actionUrl: '/profile',
        });
        return null;
      }
      if (
        trigger === 'SCHEDULED' &&
        (!policy.autopilotNextRunAt || policy.autopilotNextRunAt > new Date())
      )
        return null;
      const [active] = await tx
        .select()
        .from(orchestrationRuns)
        .where(
          and(
            eq(orchestrationRuns.userId, userId),
            eq(orchestrationRuns.taskType, 'AUTO_APPLY'),
            eq(orchestrationRuns.status, 'RUNNING'),
          ),
        )
        .orderBy(desc(orchestrationRuns.createdAt))
        .limit(1);
      if (active && active.startedAt && active.startedAt > new Date(Date.now() - 15 * 60_000))
        return null;
      if (active)
        await tx
          .update(orchestrationRuns)
          .set({
            status: 'PARTIAL',
            completedAt: new Date(),
            errorMessage: 'Lease expired; replay uses existing application intents.',
          })
          .where(eq(orchestrationRuns.id, active.id));
      const [run] = await tx
        .insert(orchestrationRuns)
        .values({
          userId,
          taskType: 'AUTO_APPLY',
          trigger,
          status: 'RUNNING',
          startedAt: new Date(),
          summary: { policyVersion: policy.autopilotGrant.version },
        })
        .returning();
      await tx
        .update(applicationPolicy)
        .set({ autopilotNextRunAt: new Date(Date.now() + 15 * 60_000) })
        .where(eq(applicationPolicy.userId, userId));
      return { run: run!, grant: policy.autopilotGrant };
    });
    if (!claim) return { started: false, prepared: 0, blocked: 0 };
    let prepared = 0,
      blocked = 0;
    try {
      const candidates = await this.db
        .select()
        .from(jobs)
        .where(eq(jobs.userId, userId))
        .orderBy(desc(jobs.discoveredDate))
        .limit(100);
      for (const job of candidates) {
        const [lease] = await this.db
          .select({ status: orchestrationRuns.status })
          .from(orchestrationRuns)
          .where(eq(orchestrationRuns.id, claim.run.id));
        if (
          lease?.status !== 'RUNNING' ||
          claim.run.startedAt! < new Date(Date.now() - 15 * 60_000)
        ) {
          blocked++;
          break;
        }
        await assertAutopilotGrant(this.db, userId, claim.grant);
        if (!autopilotJobInScope(claim.grant, job)) continue;
        const [prior] = await this.db
          .select({ id: applicationIntents.id })
          .from(applicationIntents)
          .where(and(eq(applicationIntents.userId, userId), eq(applicationIntents.jobId, job.id)))
          .limit(1);
        if (prior) continue; // Never renew, retry a stopped application or consume a manual grant automatically.
        const analysis = await this.match.analyzeJob(job.id, userId);
        if (
          analysis.decision !== 'MATCH' ||
          analysis.confidenceScore < 60 ||
          analysis.overallScore < claim.grant.minScore ||
          analysis.hardBlockers.length ||
          analysis.reasonCodes.some((c) =>
            [
              'POLICY_INFORMATION_MISSING',
              'UNKNOWN_SENSITIVE_FACTS',
              'UNMET_MANDATORY_REQUIREMENTS',
              'APPLICATION_SCORE_BELOW_THRESHOLD',
            ].includes(c),
          )
        ) {
          blocked++;
          continue;
        }
        try {
          await this.intents.create(userId, job.id, claim.grant, claim.run.id);
          prepared++;
        } catch {
          blocked++;
        }
        if (prepared >= claim.grant.maxPerDay) break;
      }
    } catch {
      blocked++;
    }
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM users WHERE id=${userId} FOR UPDATE`);
      const finished = await tx
        .update(orchestrationRuns)
        .set({
          status: blocked ? 'PARTIAL' : 'COMPLETED',
          completedAt: new Date(),
          itemsProcessedCount: prepared + blocked,
          itemsSucceededCount: prepared,
          itemsFailedCount: blocked,
          summary: {
            policyVersion: claim.grant.version,
            prepared,
            blocked,
            submissionConfirmed: false,
          },
        })
        .where(and(eq(orchestrationRuns.id, claim.run.id), eq(orchestrationRuns.status, 'RUNNING')))
        .returning({ id: orchestrationRuns.id });
      if (finished.length)
        await tx
          .update(applicationPolicy)
          .set({
            autopilotNextRunAt: new Date(Date.now() + claim.grant.intervalHours * 60 * 60_000),
          })
          .where(
            and(
              eq(applicationPolicy.userId, userId),
              eq(applicationPolicy.autopilotVersion, claim.grant.version),
              eq(applicationPolicy.autoApplyEnabled, true),
            ),
          );
    });
    if (blocked)
      await this.db.insert(systemNotifications).values({
        userId,
        type: 'MANUAL_REVIEW_REQUIRED',
        title: 'Autopilot needs review',
        message:
          'Some applications or policy inputs need your attention. Review Applications or authorize your current preferences in Profile.',
        severity: 'WARNING',
        targetType: 'APPLICATION',
        actionUrl: '/applications',
        metadata: { runId: claim.run.id },
      });
    return { started: true, prepared, blocked };
  }
}
