import { MatchService, DisabledAiProvider, type AiProvider } from '@job-agent/database/matching';
import crypto from 'node:crypto';
import type { Database } from '@job-agent/database';
import {
  orchestrationRuns,
  applicationPolicy,
  applications,
  jobs,
  approvalRequests,
  applicationInterviews,
  jobPreferences,
  emailAccounts,
  eq,
  and,
  or,
  inArray,
  sql,
} from '@job-agent/database';
import {
  OrchestrationTaskType,
  OrchestrationTrigger,
  OrchestrationRunStatuses,
  OrchestrationStepLog,
  Logger,
} from '@job-agent/shared';
import { NotificationDispatcher } from '../services/notification-dispatcher.js';

export interface OrchestratorRunOptions {
  runId?: string;
  force?: boolean;
}

export class AutonomousOrchestrator {
  private readonly dispatcher: NotificationDispatcher;
  private readonly match: MatchService;

  constructor(
    private readonly db: Database,
    private readonly logger?: Logger,
    aiProvider: AiProvider = new DisabledAiProvider(),
  ) {
    this.match = new MatchService(db, aiProvider);
    this.dispatcher = new NotificationDispatcher(db, logger);
  }

  /**
   * Exponential backoff calculation with jitter
   */
  public static calculateBackoff(
    retryCount: number,
    baseDelayMs = 2000,
    maxDelayMs = 60000,
  ): number {
    const exponential = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, retryCount));
    const jitter = Math.floor(Math.random() * (exponential * 0.2));
    return exponential + jitter;
  }

  /**
   * Executes a complete autonomous pipeline cycle
   */
  async executePipelineCycle(
    userId: string,
    trigger: OrchestrationTrigger = 'SCHEDULED',
    options: OrchestratorRunOptions = {},
  ): Promise<string> {
    const taskType: OrchestrationTaskType = 'PIPELINE_CYCLE';
    return this.executeRun(userId, taskType, trigger, options);
  }

  /**
   * Executes a specific or full orchestration run with full audit step logs
   */
  async executeRun(
    userId: string,
    taskType: OrchestrationTaskType,
    trigger: OrchestrationTrigger = 'SCHEDULED',
    options: OrchestratorRunOptions = {},
  ): Promise<string> {
    let runId = options.runId;
    const stepLogs: OrchestrationStepLog[] = [];
    let itemsProcessed = 0;
    let itemsSucceeded = 0;
    let itemsFailed = 0;

    const addStep = async (stage: string, message: string, details?: Record<string, unknown>) => {
      const step: OrchestrationStepLog = {
        timestamp: new Date().toISOString(),
        stage,
        message,
        details,
      };
      stepLogs.push(step);
      this.logger?.info(`[Orchestrator][${stage}] ${message}`, details);

      if (runId) {
        await this.db
          .update(orchestrationRuns)
          .set({
            stepLogs,
            updatedAt: new Date(),
          })
          .where(eq(orchestrationRuns.id, runId));
      }
    };

    // Initialize or fetch run record
    if (!runId) {
      const [newRun] = await this.db
        .insert(orchestrationRuns)
        .values({
          userId,
          taskType,
          trigger,
          status: OrchestrationRunStatuses.RUNNING,
          startedAt: new Date(),
          stepLogs: [],
          summary: {},
        })
        .returning({ id: orchestrationRuns.id });

      if (!newRun) {
        throw new Error('Failed to create orchestration run record');
      }
      runId = newRun.id;
    } else {
      await this.db
        .update(orchestrationRuns)
        .set({
          status: OrchestrationRunStatuses.RUNNING,
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orchestrationRuns.id, runId));
    }

    await addStep(
      'START',
      `Beginning autonomous orchestration run (${taskType}, trigger=${trigger})`,
      {
        runId,
        taskType,
        trigger,
      },
    );

    try {
      const summary: Record<string, unknown> = {};

      // Stage 1: Discovery (if PIPELINE_CYCLE or DISCOVERY)
      if (taskType === 'PIPELINE_CYCLE' || taskType === 'DISCOVERY') {
        const discoveryResult = await this.runDiscoveryStage(userId, addStep);
        itemsProcessed += discoveryResult.processed;
        itemsSucceeded += discoveryResult.succeeded;
        itemsFailed += discoveryResult.failed;
        summary.discovery = discoveryResult;
      }

      // Stage 2: Matching & Policy Evaluation (if PIPELINE_CYCLE or MATCHING)
      if (taskType === 'PIPELINE_CYCLE' || taskType === 'MATCHING') {
        const matchingResult = await this.runMatchingStage(userId, addStep);
        itemsProcessed += matchingResult.processed;
        itemsSucceeded += matchingResult.succeeded;
        itemsFailed += matchingResult.failed;
        summary.matching = matchingResult;
      }

      // Stage 3: Preparation (if PIPELINE_CYCLE or PREPARATION)
      if (taskType === 'PIPELINE_CYCLE' || taskType === 'PREPARATION') {
        const prepResult = await this.runPreparationStage(userId, addStep);
        itemsProcessed += prepResult.processed;
        itemsSucceeded += prepResult.succeeded;
        itemsFailed += prepResult.failed;
        summary.preparation = prepResult;
      }

      // Stage 4: Controlled Auto-Apply (if PIPELINE_CYCLE or AUTO_APPLY)
      if (taskType === 'PIPELINE_CYCLE' || taskType === 'AUTO_APPLY') {
        const autoApplyResult = await this.runAutoApplyStage(userId, addStep, trigger);
        itemsProcessed += autoApplyResult.processed;
        itemsSucceeded += autoApplyResult.succeeded;
        itemsFailed += autoApplyResult.failed;
        summary.autoApply = autoApplyResult;
      }

      // Stage 5: Email Sync (if PIPELINE_CYCLE or EMAIL_SYNC)
      if (taskType === 'PIPELINE_CYCLE' || taskType === 'EMAIL_SYNC') {
        const emailResult = await this.runEmailSyncStage(userId, addStep);
        itemsProcessed += emailResult.processed;
        itemsSucceeded += emailResult.succeeded;
        itemsFailed += emailResult.failed;
        summary.emailSync = emailResult;
      }

      // Stage 6: Reminders & Alerts (if PIPELINE_CYCLE or REMINDERS)
      if (taskType === 'PIPELINE_CYCLE' || taskType === 'REMINDERS') {
        const reminderResult = await this.runRemindersStage(userId, addStep);
        itemsProcessed += reminderResult.processed;
        itemsSucceeded += reminderResult.succeeded;
        itemsFailed += reminderResult.failed;
        summary.reminders = reminderResult;
      }

      const finalStatus =
        itemsFailed > 0 && itemsSucceeded > 0
          ? OrchestrationRunStatuses.PARTIAL
          : itemsFailed > 0 && itemsSucceeded === 0
            ? OrchestrationRunStatuses.FAILED
            : OrchestrationRunStatuses.COMPLETED;

      await addStep(
        'FINISH',
        `Orchestration run completed with status ${finalStatus}. Processed: ${itemsProcessed}, Succeeded: ${itemsSucceeded}, Failed: ${itemsFailed}`,
        summary,
      );

      await this.db
        .update(orchestrationRuns)
        .set({
          status: finalStatus,
          itemsProcessedCount: itemsProcessed,
          itemsSucceededCount: itemsSucceeded,
          itemsFailedCount: itemsFailed,
          summary,
          stepLogs,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orchestrationRuns.id, runId));

      return runId;
    } catch (err: any) {
      await addStep('FATAL', `Critical error during orchestration execution: ${err.message}`, {
        error: err.stack,
      });

      await this.db
        .update(orchestrationRuns)
        .set({
          status: OrchestrationRunStatuses.FAILED,
          errorMessage: err.message,
          itemsProcessedCount: itemsProcessed,
          itemsSucceededCount: itemsSucceeded,
          itemsFailedCount: itemsFailed + 1,
          stepLogs,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orchestrationRuns.id, runId));

      throw err;
    }
  }

  // --- STAGE IMPLEMENTATIONS ---

  private async runDiscoveryStage(
    userId: string,
    addStep: (stage: string, message: string, details?: Record<string, unknown>) => Promise<void>,
  ): Promise<{ processed: number; succeeded: number; failed: number; newlyDiscovered: number }> {
    await addStep('DISCOVERY', 'Checking active job opportunities and ingestion sources...');

    let existingDiscovered =
      (await this.db.query.jobs?.findMany({
        where: and(
          eq(jobs.userId, userId),
          or(eq(jobs.state, 'DISCOVERED'), eq(jobs.state, 'INGESTED'), eq(jobs.state, 'NEW')),
        ),
        limit: 20,
      })) || [];

    let newlyIngestedFromFeed = 0;

    // If discovery queue is sparse (< 3 opportunities), attempt polling public Arbeitnow feed
    if (existingDiscovered.length < 3) {
      try {
        const prefs = await this.db.query.jobPreferences?.findFirst({
          where: eq(jobPreferences.userId, userId),
        });
        const targetRoles = (prefs?.targetTitles as string[]) || [];

        const res = await fetch('https://www.arbeitnow.com/api/job-board-api', {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const body = (await res.json()) as {
            data?: Array<{
              title?: string;
              company_name?: string;
              description?: string;
              url?: string;
              location?: string;
              remote?: boolean;
              tags?: string[];
            }>;
          };

          const items = body.data || [];
          const matched = items
            .filter((item) => {
              if (targetRoles.length === 0) return true;
              const text = `${item.title || ''} ${item.tags?.join(' ') || ''}`.toLowerCase();
              return targetRoles.some((kw) => text.includes(kw.toLowerCase()));
            })
            .slice(0, 3);

          for (const item of matched) {
            if (!item.title || !item.company_name || !item.description) continue;
            const plainDesc = item.description
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            const contentHash = crypto
              .createHash('sha256')
              .update(
                `${item.company_name.toLowerCase()}:${item.title.toLowerCase()}:${plainDesc.slice(0, 500)}`,
              )
              .digest('hex');

            const [dup] = await this.db
              .select({ id: jobs.id })
              .from(jobs)
              .where(and(eq(jobs.userId, userId), eq(jobs.contentHash, contentHash)))
              .limit(1);

            if (!dup) {
              await this.db.insert(jobs).values({
                userId,
                title: item.title,
                company: item.company_name,
                description: plainDesc,
                locationText: item.location || (item.remote ? 'Remote' : 'Unspecified'),
                workplaceType: item.remote ? 'REMOTE' : 'UNKNOWN',
                originalUrl: item.url || null,
                canonicalUrl: item.url || null,
                provider: 'ARBEITNOW',
                state: 'NEW',
                contentHash,
              });
              newlyIngestedFromFeed++;
            }
          }

          if (newlyIngestedFromFeed > 0) {
            await addStep(
              'DISCOVERY',
              `Discovered and ingested ${newlyIngestedFromFeed} opportunity(ies) from public Arbeitnow feed.`,
              { newlyIngestedFromFeed },
            );
            // Refresh discovered jobs
            existingDiscovered =
              (await this.db.query.jobs?.findMany({
                where: and(
                  eq(jobs.userId, userId),
                  or(
                    eq(jobs.state, 'DISCOVERED'),
                    eq(jobs.state, 'INGESTED'),
                    eq(jobs.state, 'NEW'),
                  ),
                ),
                limit: 20,
              })) || [];
          }
        }
      } catch (feedErr: any) {
        this.logger?.debug(`Public feed discovery skipped or offline: ${feedErr.message}`);
      }
    }

    await addStep(
      'DISCOVERY',
      `Found ${existingDiscovered.length} active job(s) in discovery queue (${newlyIngestedFromFeed} newly ingested).`,
      { count: existingDiscovered.length, newlyIngestedFromFeed },
    );

    return {
      processed: existingDiscovered.length,
      succeeded: existingDiscovered.length,
      failed: 0,
      newlyDiscovered: existingDiscovered.length,
    };
  }

  private async runMatchingStage(
    userId: string,
    addStep: (stage: string, message: string, details?: Record<string, unknown>) => Promise<void>,
  ): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    matched: number;
    skipped: number;
  }> {
    await addStep(
      'MATCHING',
      'Evaluating current candidate evidence, requirements and deterministic eligibility through the shared matching service',
    );
    const result = await this.match.batchAnalyzeJobs(userId, { limit: 10 });
    const matched = result.results.filter(
      (item) => item.success && item.decision === 'MATCH',
    ).length;
    const skipped = result.results.filter(
      (item) => item.success && item.decision === 'SKIP',
    ).length;
    await addStep('MATCHING', 'Grounded evaluation completed; ingestion states are preserved', {
      matched,
      skipped,
      review: result.results.filter((item) => item.decision === 'REVIEW').length,
      failed: result.failed,
    });
    return {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      matched,
      skipped,
    };
  }

  private async runPreparationStage(
    userId: string,
    addStep: (stage: string, message: string, details?: Record<string, unknown>) => Promise<void>,
  ): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    prepared: number;
    requestedJobIds: string[];
    status: 'PENDING';
  }> {
    const matched = await this.match.findMatchedJobs(userId, 10);
    const requestedJobIds: string[] = [];
    for (const job of matched) {
      const existing = await this.db.query.applications.findFirst({
        where: and(eq(applications.jobId, job.id), eq(applications.userId, userId)),
      });
      if (!existing) requestedJobIds.push(job.id);
    }
    await addStep(
      'PREPARATION',
      'Requested the shared durable preparation queue. No submission permission is created.',
      { requestedCount: requestedJobIds.length },
    );
    return {
      processed: requestedJobIds.length,
      succeeded: 0,
      failed: 0,
      prepared: 0,
      requestedJobIds,
      status: 'PENDING',
    };
  }

  private async runAutoApplyStage(
    userId: string,
    addStep: (stage: string, message: string, details?: Record<string, unknown>) => Promise<void>,
    trigger: OrchestrationTrigger,
  ): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    submitted: number;
    blocked: number;
  }> {
    // Legacy scheduling is a trigger only; it cannot manufacture employer-submit authority.
    const policy = await this.db.query.applicationPolicy.findFirst({
      where: eq(applicationPolicy.userId, userId),
    });
    if (policy?.autoApplyEnabled && policy.autopilotGrant) {
      if (trigger === 'MANUAL')
        await this.db
          .update(applicationPolicy)
          .set({ autopilotNextRunAt: new Date() })
          .where(
            and(
              eq(applicationPolicy.userId, userId),
              eq(applicationPolicy.autopilotVersion, policy.autopilotVersion),
              eq(applicationPolicy.autoApplyEnabled, true),
            ),
          );
      await addStep(
        'AUTO_APPLY',
        'Requested the shared intent pipeline under the accepted versioned policy. No employer submission occurred in the legacy stage.',
      );
    } else
      await addStep(
        'AUTO_APPLY',
        'Autopilot is off. An explicit versioned policy is required; legacy flags do not authorize submission.',
      );
    return { processed: 0, succeeded: 0, failed: 0, submitted: 0, blocked: 0 };
  }

  private async runEmailSyncStage(
    userId: string,
    addStep: (stage: string, message: string, details?: Record<string, unknown>) => Promise<void>,
  ): Promise<{ processed: number; succeeded: number; failed: number }> {
    await addStep(
      'EMAIL_SYNC',
      'Checking configured email accounts for background message sync...',
    );

    const accounts = await this.db
      .select()
      .from(emailAccounts)
      .where(and(eq(emailAccounts.userId, userId), eq(emailAccounts.status, 'CONNECTED')));

    const activeCount = accounts.length;
    await addStep('EMAIL_SYNC', `Active connected email accounts found: ${activeCount}`);

    return {
      processed: activeCount,
      succeeded: activeCount,
      failed: 0,
    };
  }

  private async runRemindersStage(
    userId: string,
    addStep: (stage: string, message: string, details?: Record<string, unknown>) => Promise<void>,
  ): Promise<{ processed: number; succeeded: number; failed: number; remindersSent: number }> {
    await addStep('REMINDERS', 'Checking pending human reviews and upcoming interview briefs...');

    let remindersSent = 0;

    // 1. Pending Approvals
    const pendingApprovals = await this.db.query.approvalRequests.findMany({
      where: and(
        eq(approvalRequests.userId, userId),
        inArray(approvalRequests.status, ['PENDING', 'NEEDS_USER_RECONFIRMATION']),
      ),
    });

    if (pendingApprovals.length > 0) {
      await this.dispatcher.dispatch({
        userId,
        type: 'APPROVAL_REMINDER',
        title: `${pendingApprovals.length} Pending Approval Request(s)`,
        message: `You have ${pendingApprovals.length} sensitive question or application material approval(s) requiring your review.`,
        severity: 'WARNING',
        targetType: 'APPROVAL_REQUEST',
        actionUrl: `/approvals`,
      });
      remindersSent++;
      await addStep(
        'REMINDERS',
        `Dispatched approval reminder for ${pendingApprovals.length} pending request(s).`,
      );
    }

    // 2. Upcoming Interviews
    const now = new Date();
    const in48Hours = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const upcomingInterviews = await this.db.query.applicationInterviews.findMany({
      where: and(
        eq(applicationInterviews.userId, userId),
        sql`${applicationInterviews.scheduledAt} >= ${now} AND ${applicationInterviews.scheduledAt} <= ${in48Hours}`,
      ),
    });

    for (const interview of upcomingInterviews) {
      await this.dispatcher.dispatch({
        userId,
        type: 'INTERVIEW_UPCOMING',
        title: `Upcoming Interview: ${interview.roundTitle || 'Interview'}`,
        message: `Scheduled for ${new Date(interview.scheduledAt).toLocaleString()}. Ensure preparation brief is reviewed.`,
        severity: 'INFO',
        targetType: 'INTERVIEW',
        targetId: interview.id,
        actionUrl: `/interviews`,
      });
      remindersSent++;
      await addStep(
        'REMINDERS',
        `Dispatched upcoming interview reminder for ${interview.roundTitle || 'Interview'} (${interview.id})`,
      );
    }

    return {
      processed: pendingApprovals.length + upcomingInterviews.length,
      succeeded: remindersSent,
      failed: 0,
      remindersSent,
    };
  }
}
