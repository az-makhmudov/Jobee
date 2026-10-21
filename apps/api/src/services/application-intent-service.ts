import { and, eq, desc, inArray, sql } from 'drizzle-orm';
import {
  type Database,
  applicationIntents,
  applications,
  jobs,
  candidateDocuments,
  candidateProfiles,
  browserApplicationRuns,
  computeIntentFingerprint,
  snapshotIntentAnswers,
  assertApplicationIntent,
  BrowserWorkerService,
  assertAutopilotGrant,
  orchestrationRuns,
  systemNotifications,
} from '@job-agent/database';
import {
  APPLICATION_INTENT_TERMS,
  AppError,
  BrowserRunMode,
  type ApplicationIntentDto,
  type AutopilotGrant,
} from '@job-agent/shared';
import type { PreparationBatchService } from './preparation-batch-service.js';
import type { ApplicationPackageService } from './application-package-service.js';
import type { MatchService } from './match-service.js';
import { JobSearchSettingsService } from './job-search-settings-service.js';
import { CvBaseSelector } from './cv-base-selector.js';

const validityMs = 60 * 60_000;
type Intent = typeof applicationIntents.$inferSelect;

export class ApplicationIntentService {
  constructor(
    private readonly db: Database,
    private readonly batches: PreparationBatchService,
    private readonly packages: ApplicationPackageService,
    private readonly match: MatchService,
  ) {}

  private async owned(userId: string, id: string) {
    const [intent] = await this.db
      .select()
      .from(applicationIntents)
      .where(and(eq(applicationIntents.id, id), eq(applicationIntents.userId, userId)));
    if (!intent) throw AppError.notFound('Application attempt not found.');
    return intent;
  }

  async create(
    userId: string,
    jobId: string,
    autopilotGrant?: AutopilotGrant,
    schedulingRunId?: string,
  ): Promise<ApplicationIntentDto> {
    const id = await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM users WHERE id=${userId} FOR UPDATE`);
      const [job] = await tx
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)));
      if (!job) throw AppError.notFound('Job not found.');
      if (autopilotGrant)
        await assertAutopilotGrant(tx as unknown as Database, userId, autopilotGrant, job);
      if (schedulingRunId) {
        const [lease] = await tx
          .select()
          .from(orchestrationRuns)
          .where(
            and(
              eq(orchestrationRuns.id, schedulingRunId),
              eq(orchestrationRuns.userId, userId),
              eq(orchestrationRuns.taskType, 'AUTO_APPLY'),
              eq(orchestrationRuns.status, 'RUNNING'),
            ),
          );
        if (!lease?.startedAt || lease.startedAt.getTime() <= Date.now() - 15 * 60_000)
          throw AppError.conflict('Autopilot scheduling lease expired.');
      }
      if (
        ['ARCHIVED', 'INVALID'].includes(job.state) ||
        (job.expirationDate && job.expirationDate < new Date())
      )
        throw AppError.badRequest('This vacancy is no longer available.');
      const existing = await tx
        .select({ app: applications, job: jobs })
        .from(applications)
        .innerJoin(jobs, eq(applications.jobId, jobs.id))
        .where(eq(applications.userId, userId));
      const same = existing.find((r) => r.job.id === jobId);
      const duplicate = existing.find(
        (r) =>
          r.job.id !== jobId &&
          (r.job.id === job.duplicateOfId ||
            r.job.contentHash === job.contentHash ||
            (job.applicationUrl && r.job.applicationUrl === job.applicationUrl) ||
            (job.canonicalUrl && r.job.canonicalUrl === job.canonicalUrl) ||
            (job.sourceExternalId &&
              r.job.sourceExternalId === job.sourceExternalId &&
              r.job.provider === job.provider)),
      );
      if (duplicate)
        throw AppError.badRequest(
          'This vacancy already has an application record. Open it in Applications before trying again.',
        );
      if (same) {
        const [current] = await tx
          .select()
          .from(applicationIntents)
          .where(
            and(
              eq(applicationIntents.applicationId, same.app.id),
              eq(applicationIntents.userId, userId),
            ),
          )
          .orderBy(desc(applicationIntents.createdAt))
          .limit(1);
        if (current) return current.id; // A repeated click never renews permission or starts another run.
        const prior = await tx
          .select()
          .from(browserApplicationRuns)
          .where(
            and(
              eq(browserApplicationRuns.applicationId, same.app.id),
              eq(browserApplicationRuns.mode, 'SUBMIT'),
            ),
          );
        if (
          same.app.appliedAt ||
          !['READY_TO_APPLY', 'NEEDS_REVIEW'].includes(same.app.status) ||
          prior.some((r) =>
            ['PENDING', 'RUNNING', 'SUCCESS', 'SUBMISSION_UNCERTAIN'].includes(r.status),
          )
        )
          throw AppError.badRequest(
            'An application attempt already exists. Check its progress in Applications.',
          );
      }
      const docs = await tx
        .select()
        .from(candidateDocuments)
        .where(eq(candidateDocuments.userId, userId));
      const settings = await new JobSearchSettingsService(tx as unknown as Database).get(userId);
      if (
        settings.selectedCvId &&
        !docs.some(
          (d) =>
            d.id === settings.selectedCvId &&
            d.isActive &&
            ['MASTER_CV', 'ROLE_CV'].includes(d.documentType),
        )
      )
        throw AppError.badRequest(
          'The selected CV is unavailable. Choose an active CV in Profile.',
        );
      const cvId = CvBaseSelector.selectBase(
        docs.filter((d) => d.isActive && ['MASTER_CV', 'ROLE_CV'].includes(d.documentType)),
        job,
        settings.selectedCvId,
      ).selectedDocumentId;
      const app =
        same?.app ??
        (
          await tx
            .insert(applications)
            .values({
              userId,
              jobId,
              status: 'NEEDS_REVIEW',
              nextAction: 'Preparing your application',
              nextActionType: 'PREPARATION',
            })
            .returning()
        )[0]!;
      const now = new Date();
      const [intent] = await tx
        .insert(applicationIntents)
        .values({
          userId,
          jobId,
          applicationId: app.id,
          selectedCvId: cvId,
          autopilotGrant,
          termsVersion: APPLICATION_INTENT_TERMS,
          targetUrl:
            app.applicationUrl || job.applicationUrl || job.originalUrl || job.canonicalUrl || '',
          inputFingerprint: await computeIntentFingerprint(
            tx as unknown as Database,
            userId,
            jobId,
            cvId,
          ),
          expiresAt: new Date(now.getTime() + validityMs),
          events: [
            {
              type: 'AUTHORIZED',
              ...(autopilotGrant ? { autopilotGrant } : {}),
              at: now.toISOString(),
              answerSources: await snapshotIntentAnswers(tx as unknown as Database, userId),
            },
          ],
        })
        .returning();
      return intent!.id;
    });
    return this.get(userId, id);
  }

  async forJob(userId: string, jobId: string) {
    const [job] = await this.db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)));
    if (!job) throw AppError.notFound('Job not found.');
    const [intent] = await this.db
      .select()
      .from(applicationIntents)
      .where(and(eq(applicationIntents.jobId, jobId), eq(applicationIntents.userId, userId)))
      .orderBy(desc(applicationIntents.createdAt))
      .limit(1);
    return intent ? this.get(userId, intent.id) : null;
  }

  async get(userId: string, id: string): Promise<ApplicationIntentDto> {
    const intent = await this.owned(userId, id);
    const [app] = await this.db
      .select()
      .from(applications)
      .where(and(eq(applications.id, intent.applicationId), eq(applications.userId, userId)));
    const [run] = intent.runId
      ? await this.db
          .select()
          .from(browserApplicationRuns)
          .where(
            and(
              eq(browserApplicationRuns.id, intent.runId),
              eq(browserApplicationRuns.userId, userId),
            ),
          )
      : [];
    const expired = intent.expiresAt.getTime() <= Date.now();
    let status: ApplicationIntentDto['status'] =
      intent.status === 'CANCELLED'
        ? 'CANCELLED'
        : intent.status === 'NEEDS_USER_ACTION' || expired
          ? 'NEEDS_USER_ACTION'
          : intent.status === 'PREPARING'
            ? 'PREPARING'
            : 'QUEUED';
    let message = intent.revokedAt
      ? 'Application cancelled before dispatch.'
      : expired
        ? 'Permission expired. Review and resume to authorize another attempt.'
        : intent.message;
    if (run) {
      if (run.status === 'SUCCESS') {
        status = 'SUCCEEDED';
        message = 'The employer confirmed your application was submitted.';
      } else if (run.status === 'SUBMISSION_UNCERTAIN') {
        status = 'UNKNOWN_RESULT';
        message =
          'Submission may have occurred. Check the employer website and reconcile the result before retrying.';
      } else if (run.status === 'RUNNING') {
        status = 'RUNNING';
        message = 'Completing the employer application. Submission is not yet confirmed.';
      } else if (run.status !== 'PENDING') {
        status = intent.revokedAt ? 'CANCELLED' : 'NEEDS_USER_ACTION';
        message = intent.revokedAt
          ? 'Application cancelled before dispatch.'
          : run.errorMessage || 'The employer form needs your attention.';
      }
    }
    const safeRetry =
      !run || !['PENDING', 'RUNNING', 'SUCCESS', 'SUBMISSION_UNCERTAIN'].includes(run.status);
    return {
      id,
      applicationId: intent.applicationId,
      jobId: intent.jobId,
      packageId: app?.currentPackageId ?? null,
      runId: intent.runId,
      status,
      message,
      expiresAt: intent.expiresAt.toISOString(),
      canCancel:
        !intent.revokedAt &&
        !intent.dispatchStartedAt &&
        !['SUCCEEDED', 'UNKNOWN_RESULT'].includes(status),
      canResume: safeRetry && ['NEEDS_USER_ACTION', 'FAILED', 'CANCELLED'].includes(status),
      events: intent.events.map(({ type, at, runId }) => ({
        type,
        at,
        ...(runId ? { runId } : {}),
      })),
    };
  }

  async cancel(userId: string, id: string) {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM users WHERE id=${userId} FOR UPDATE`);
      const [intent] = await tx
        .select()
        .from(applicationIntents)
        .where(and(eq(applicationIntents.id, id), eq(applicationIntents.userId, userId)))
        .for('update');
      if (!intent) throw AppError.notFound('Application attempt not found.');
      if (intent.dispatchStartedAt)
        throw AppError.badRequest(
          'Submission dispatch has started. It cannot be recalled; wait for confirmation or reconciliation.',
        );
      if (intent.revokedAt) return;
      await tx
        .update(applications)
        .set({
          status: 'NEEDS_REVIEW',
          nextAction: 'Application cancelled before dispatch',
          nextActionType: 'CANCELLED',
          updatedAt: new Date(),
        })
        .where(and(eq(applications.id, intent.applicationId), eq(applications.userId, userId)));
      await tx
        .update(applicationIntents)
        .set({
          revokedAt: new Date(),
          status: 'CANCELLED',
          message: 'Application cancelled before dispatch.',
          updatedAt: new Date(),
          events: [...intent.events, { type: 'CANCELLED', at: new Date().toISOString() }],
        })
        .where(eq(applicationIntents.id, id));
      if (intent.runId)
        await tx
          .update(browserApplicationRuns)
          .set({
            status: 'FAILED',
            errorMessage: 'Candidate cancelled before dispatch.',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(browserApplicationRuns.id, intent.runId),
              eq(browserApplicationRuns.status, 'PENDING'),
            ),
          );
    });
    return this.get(userId, id);
  }

  async resume(userId: string, id: string) {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM users WHERE id=${userId} FOR UPDATE`);
      const intent = await this.owned(userId, id);
      const [run] = intent.runId
        ? await tx
            .select()
            .from(browserApplicationRuns)
            .where(eq(browserApplicationRuns.id, intent.runId))
        : [];
      if (run && ['PENDING', 'RUNNING', 'SUCCESS', 'SUBMISSION_UNCERTAIN'].includes(run.status))
        throw AppError.badRequest(
          'Resolve the current attempt before starting another. Uncertain submissions must be reconciled first.',
        );
      if (
        !['NEEDS_USER_ACTION', 'CANCELLED'].includes(intent.status) &&
        !run &&
        intent.expiresAt > new Date()
      )
        throw AppError.badRequest('This application is already in progress.');
      const [job] = await tx
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, intent.jobId), eq(jobs.userId, userId)));
      const [app] = await tx
        .select()
        .from(applications)
        .where(eq(applications.id, intent.applicationId));
      if (
        !job ||
        app?.appliedAt ||
        ['ARCHIVED', 'INVALID'].includes(job.state) ||
        (job.expirationDate && job.expirationDate < new Date())
      )
        throw AppError.badRequest('The application is already sent or the vacancy is unavailable.');
      const now = new Date();
      await tx
        .update(applicationIntents)
        .set({
          status: 'AUTHORIZED',
          autopilotGrant: null,
          revokedAt: null,
          dispatchStartedAt: null,
          runId: null,
          batchId: null,
          manifestChecksum: null,
          authorizedAt: now,
          expiresAt: new Date(now.getTime() + validityMs),
          inputFingerprint: await computeIntentFingerprint(
            tx as unknown as Database,
            userId,
            intent.jobId,
            intent.selectedCvId,
          ),
          targetUrl:
            app?.applicationUrl || job.applicationUrl || job.originalUrl || job.canonicalUrl || '',
          updatedAt: now,
          message: 'Resuming with your current verified information.',
          events: [
            ...intent.events,
            {
              type: 'REAUTHORIZED',
              at: now.toISOString(),
              ...(run ? { runId: run.id } : {}),
              answerSources: await snapshotIntentAnswers(tx as unknown as Database, userId),
            },
          ],
        })
        .where(eq(applicationIntents.id, id));
    });
    return this.get(userId, id);
  }

  private async pause(intent: Intent, message: string) {
    // Never overwrite cancellation or an atomically queued run.
    const changed = await this.db
      .update(applicationIntents)
      .set({
        status: 'NEEDS_USER_ACTION',
        message,
        updatedAt: new Date(),
        events: sql`${applicationIntents.events} || ${JSON.stringify([{ type: 'NEEDS_USER_ACTION', at: new Date().toISOString() }])}::jsonb`,
      })
      .where(
        and(
          eq(applicationIntents.id, intent.id),
          inArray(applicationIntents.status, ['AUTHORIZED', 'PREPARING']),
        ),
      )
      .returning({ id: applicationIntents.id });
    if (intent.autopilotGrant && changed.length)
      await this.db.insert(systemNotifications).values({
        userId: intent.userId,
        type: 'MANUAL_REVIEW_REQUIRED',
        title: 'Application needs your review',
        message:
          'An Autopilot application paused before submission. Open it to resolve the missing information or permission.',
        severity: 'WARNING',
        targetType: 'APPLICATION',
        targetId: intent.applicationId,
        actionUrl: '/applications',
      });
  }

  /** Called by the API preparation runner; all external form work remains in the worker. */
  async processPending() {
    const pending = await this.db
      .select()
      .from(applicationIntents)
      .where(inArray(applicationIntents.status, ['AUTHORIZED', 'PREPARING']))
      .orderBy(applicationIntents.createdAt)
      .limit(10);
    for (const intent of pending) {
      try {
        await assertApplicationIntent(this.db, intent.userId, intent.applicationId, intent.id);
        if (
          !['GREENHOUSE', 'LEVER', 'ASHBY'].includes(
            BrowserWorkerService.inferAtsProvider(intent.targetUrl),
          )
        ) {
          await this.pause(
            intent,
            'This provider requires manual application on the employer website.',
          );
          continue;
        }
        const [profile] = await this.db
          .select()
          .from(candidateProfiles)
          .where(eq(candidateProfiles.userId, intent.userId));
        if (!profile?.fullName?.trim() || !profile.email?.trim()) {
          await this.pause(intent, 'Add your name and email in Profile, then resume.');
          continue;
        }
        if (intent.selectedCvId) {
          const [cv] = await this.db
            .select()
            .from(candidateDocuments)
            .where(
              and(
                eq(candidateDocuments.id, intent.selectedCvId),
                eq(candidateDocuments.userId, intent.userId),
              ),
            );
          if (!cv?.isActive || !['MASTER_CV', 'ROLE_CV'].includes(cv.documentType)) {
            await this.pause(
              intent,
              'Your selected CV is unavailable. Review your documents before resuming.',
            );
            continue;
          }
        }
        const analysis = await this.match.analyzeJob(intent.jobId, intent.userId);
        if (
          analysis.hardBlockers.length ||
          analysis.reasonCodes.some((code) =>
            [
              'POLICY_INFORMATION_MISSING',
              'UNKNOWN_SENSITIVE_FACTS',
              'UNMET_MANDATORY_REQUIREMENTS',
            ].includes(code),
          )
        ) {
          await this.pause(
            intent,
            analysis.hardBlockers.length
              ? 'Eligibility checks found a blocker. Review this job and your preferences.'
              : 'Eligibility or fit needs your review before this application can continue.',
          );
          continue;
        }
        if (
          intent.autopilotGrant &&
          (analysis.decision !== 'MATCH' || analysis.overallScore < intent.autopilotGrant.minScore)
        ) {
          await this.pause(
            intent,
            'This match no longer meets your accepted Autopilot policy. Review it manually.',
          );
          continue;
        }
        let batch = intent.batchId ? await this.batches.get(intent.userId, intent.batchId) : null;
        let item = batch?.items.find((i) => i.jobId === intent.jobId);
        if (item && (batch?.cancelledAt || ['FAILED', 'CANCELLED'].includes(item.status))) {
          await this.pause(
            intent,
            item.error || 'Preparation stopped. Resume when you are ready to retry.',
          );
          continue;
        }
        if (!item) {
          batch = await this.batches.create(intent.userId, [intent.jobId], intent.selectedCvId);
          await this.db
            .update(applicationIntents)
            .set({ batchId: batch.id, status: 'PREPARING', updatedAt: new Date() })
            .where(
              and(
                eq(applicationIntents.id, intent.id),
                inArray(applicationIntents.status, ['AUTHORIZED', 'PREPARING']),
              ),
            );
          item = batch.items.find((i) => i.jobId === intent.jobId);
        }
        if (!item || ['QUEUED', 'PREPARING'].includes(item.status)) continue;
        if (!item.packageId) {
          await this.pause(intent, 'Application preparation was interrupted. Resume to retry.');
          continue;
        }
        const detail = await this.packages.getPackage(item.packageId, intent.userId);
        if (
          detail.package.isStale ||
          !detail.currentVersion ||
          detail.currentVersion.baseDocumentId !== intent.selectedCvId
        ) {
          // A renewed permission may reuse the existing batch, but never stale materials.
          await this.batches
            .create(intent.userId, [intent.jobId], intent.selectedCvId)
            .then(async (fresh) => {
              await this.db
                .update(applicationIntents)
                .set({ batchId: fresh.id, status: 'PREPARING', updatedAt: new Date() })
                .where(
                  and(
                    eq(applicationIntents.id, intent.id),
                    inArray(applicationIntents.status, ['AUTHORIZED', 'PREPARING']),
                  ),
                );
            });
          continue;
        }
        const readiness = await this.packages.refreshPackageReadiness(
          detail.package.id,
          detail.currentVersion.id,
        );
        if (!readiness.isReady) {
          await this.pause(intent, readiness.blockingIssues.join(' '));
          continue;
        }
        await BrowserWorkerService.createBrowserRun(
          intent.userId,
          intent.applicationId,
          { mode: BrowserRunMode.SUBMIT },
          intent.id,
          this.db,
        );
      } catch (error) {
        await this.pause(
          intent,
          error instanceof AppError
            ? error.message
            : 'Application preparation was interrupted. Review and resume to retry.',
        );
      }
    }
  }
}
