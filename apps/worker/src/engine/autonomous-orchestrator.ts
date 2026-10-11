import type { Database } from '@job-agent/database';
import {
  orchestrationRuns,
  applicationPolicy,
  applications,
  applicationPackages,
  jobs,
  approvalRequests,
  browserApplicationRuns,
  applicationInterviews,
  jobPreferences,
  emailAccounts,
  eq,
  and,
  inArray,
  sql,
} from '@job-agent/database';
import {
  OrchestrationTaskType,
  OrchestrationTrigger,
  OrchestrationRunStatuses,
  OrchestrationStepLog,
  Logger,
  BrowserRunMode,
  BrowserRunStatus,
} from '@job-agent/shared';
import { NotificationDispatcher } from '../services/notification-dispatcher.js';
import { executePendingBrowserRun } from '../services/browser-runner.js';

export interface OrchestratorRunOptions {
  runId?: string;
  force?: boolean;
}

export class AutonomousOrchestrator {
  private readonly dispatcher: NotificationDispatcher;

  constructor(
    private readonly db: Database,
    private readonly logger?: Logger,
  ) {
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
        const autoApplyResult = await this.runAutoApplyStage(userId, addStep);
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

    const existingDiscovered = await this.db.query.jobs.findMany({
      where: and(eq(jobs.userId, userId), eq(jobs.state, 'DISCOVERED')),
      limit: 20,
    });

    await addStep(
      'DISCOVERY',
      `Found ${existingDiscovered.length} active job(s) in DISCOVERED queue.`,
      { count: existingDiscovered.length },
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
      'Evaluating jobs in DISCOVERED status against candidate policy and brain...',
    );

    const discoveredJobs = await this.db.query.jobs.findMany({
      where: and(eq(jobs.userId, userId), eq(jobs.state, 'DISCOVERED')),
      limit: 10,
    });

    if (discoveredJobs.length === 0) {
      await addStep('MATCHING', 'No unanalyzed jobs in queue. Matching up to date.');
      return { processed: 0, succeeded: 0, failed: 0, matched: 0, skipped: 0 };
    }

    const prefs = await this.db.query.jobPreferences.findFirst({
      where: eq(jobPreferences.userId, userId),
    });

    let matched = 0;
    let skipped = 0;

    for (const job of discoveredJobs) {
      const excludedCompanies = (prefs?.excludedCompanies as string[]) || [];
      const isExcludedCompany =
        job.company &&
        excludedCompanies.some((c) => job.company.toLowerCase().includes(c.toLowerCase()));

      const excludedKeywords = (prefs?.excludedKeywords as string[]) || [];
      const hasExcludedKeyword =
        job.title &&
        excludedKeywords.some((k) => job.title.toLowerCase().includes(k.toLowerCase()));

      if (isExcludedCompany || hasExcludedKeyword) {
        await this.db
          .update(jobs)
          .set({ state: 'SKIPPED', updatedAt: new Date() })
          .where(eq(jobs.id, job.id));

        skipped++;
        await addStep(
          'MATCHING',
          `Job ${job.title} at ${job.company} skipped by hard policy exclusion`,
          {
            jobId: job.id,
            reason: isExcludedCompany ? 'excluded_company' : 'excluded_keyword',
          },
        );
      } else {
        await this.db
          .update(jobs)
          .set({ state: 'MATCHED', updatedAt: new Date() })
          .where(eq(jobs.id, job.id));

        matched++;
        await addStep(
          'MATCHING',
          `Job ${job.title} at ${job.company} passed policy checks -> MATCHED`,
          {
            jobId: job.id,
          },
        );
      }
    }

    return {
      processed: discoveredJobs.length,
      succeeded: discoveredJobs.length,
      failed: 0,
      matched,
      skipped,
    };
  }

  private async runPreparationStage(
    userId: string,
    addStep: (stage: string, message: string, details?: Record<string, unknown>) => Promise<void>,
  ): Promise<{ processed: number; succeeded: number; failed: number; prepared: number }> {
    await addStep('PREPARATION', 'Inspecting matched jobs without CRM applications...');

    const matchedJobs = await this.db.query.jobs.findMany({
      where: and(eq(jobs.userId, userId), eq(jobs.state, 'MATCHED')),
      limit: 10,
    });

    let prepared = 0;

    for (const job of matchedJobs) {
      const existingApp = await this.db.query.applications.findFirst({
        where: and(eq(applications.jobId, job.id), eq(applications.userId, userId)),
      });

      if (!existingApp) {
        const [newApp] = await this.db
          .insert(applications)
          .values({
            jobId: job.id,
            userId,
            status: 'NEEDS_REVIEW',
            notes:
              'Automatically prepared by Autonomous Orchestrator. Requires material tailoring and human approval before applying.',
          })
          .returning({ id: applications.id });

        if (newApp) {
          prepared++;
          await addStep(
            'PREPARATION',
            `Prepared application record for ${job.title} at ${job.company}`,
            {
              jobId: job.id,
              applicationId: newApp.id,
            },
          );
        }
      }
    }

    return {
      processed: matchedJobs.length,
      succeeded: matchedJobs.length,
      failed: 0,
      prepared,
    };
  }

  private async runAutoApplyStage(
    userId: string,
    addStep: (stage: string, message: string, details?: Record<string, unknown>) => Promise<void>,
  ): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    submitted: number;
    blocked: number;
  }> {
    await addStep(
      'AUTO_APPLY',
      'Evaluating autonomous application policy boundaries and quotas...',
    );

    const policy = await this.db.query.applicationPolicy.findFirst({
      where: eq(applicationPolicy.userId, userId),
    });

    // Invariant 1: Circuit breaker check
    if (!policy || !policy.autoApplyEnabled) {
      await addStep(
        'AUTO_APPLY',
        'Auto-apply circuit breaker is OFF (auto_apply_enabled=false). Human authorization required for submissions.',
        { autoApplyEnabled: false },
      );
      return { processed: 0, succeeded: 0, failed: 0, submitted: 0, blocked: 0 };
    }

    // Invariant 2: Rate limit / Daily quota check
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const applicationsToday = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(applications)
      .where(
        and(
          eq(applications.userId, userId),
          eq(applications.status, 'APPLIED'),
          sql`${applications.appliedAt} >= ${today}`,
        ),
      );

    const submittedCountToday = Number(applicationsToday[0]?.count || 0);
    const maxPerDay = policy.maxApplicationsPerDay || 5;

    await addStep(
      'AUTO_APPLY',
      `Quota check: ${submittedCountToday}/${maxPerDay} applications submitted today.`,
      { submittedCountToday, maxPerDay },
    );

    if (submittedCountToday >= maxPerDay) {
      await addStep(
        'AUTO_APPLY',
        `Daily application quota reached (${submittedCountToday}/${maxPerDay}). Pausing auto-apply until tomorrow.`,
      );
      await this.dispatcher.dispatch({
        userId,
        type: 'RATE_LIMIT_EXCEEDED',
        title: 'Daily Application Quota Reached',
        message: `Your configured daily application limit of ${maxPerDay} has been reached. Autonomous submissions are paused.`,
        severity: 'WARNING',
      });
      return { processed: 0, succeeded: 0, failed: 0, submitted: 0, blocked: 1 };
    }

    // Invariant 3 & 4: Find eligible applications in READY_TO_APPLY
    const eligibleApps = await this.db.query.applications.findMany({
      where: and(eq(applications.userId, userId), eq(applications.status, 'READY_TO_APPLY')),
      limit: Math.max(1, maxPerDay - submittedCountToday),
    });

    if (eligibleApps.length === 0) {
      await addStep('AUTO_APPLY', 'No eligible applications in READY_TO_APPLY state.');
      return { processed: 0, succeeded: 0, failed: 0, submitted: 0, blocked: 0 };
    }

    let submitted = 0;
    let blocked = 0;

    for (const app of eligibleApps) {
      const job = await this.db.query.jobs.findFirst({
        where: eq(jobs.id, app.jobId),
      });

      const roleTitle = job?.title || 'Unknown Role';
      const company = job?.company || 'Unknown Company';

      // Invariant: If a prior run was SUBMISSION_UNCERTAIN or SUCCESS, block submission to prevent duplicates
      const existingRuns = await this.db.query.browserApplicationRuns.findMany({
        where: eq(browserApplicationRuns.applicationId, app.id),
      });

      const uncertainRun = existingRuns.find(
        (r) => r.status === BrowserRunStatus.SUBMISSION_UNCERTAIN,
      );
      if (uncertainRun) {
        await addStep(
          'AUTO_APPLY',
          `Application ${app.id} blocked: Prior run ${uncertainRun.id} is SUBMISSION_UNCERTAIN. Human review required to avoid duplicate submission.`,
          { applicationId: app.id, runId: uncertainRun.id },
        );
        blocked++;
        continue;
      }

      // Invariant: Verify associated Application Package exists and is human-approved & ready
      const pkg = app.currentPackageId
        ? await this.db.query.applicationPackages.findFirst({
            where: eq(applicationPackages.id, app.currentPackageId),
          })
        : await this.db.query.applicationPackages.findFirst({
            where: and(
              eq(applicationPackages.jobId, app.jobId),
              eq(applicationPackages.userId, userId),
            ),
          });

      if (!pkg || pkg.status !== 'READY') {
        await addStep(
          'AUTO_APPLY',
          `Application ${app.id} blocked: Application package is not ready (status: ${pkg?.status ?? 'MISSING'}). Human preparation and review required.`,
          { applicationId: app.id, packageId: pkg?.id, packageStatus: pkg?.status },
        );
        blocked++;
        continue;
      }

      if (pkg.hasPolicyBlocker && !pkg.blockerOverridden) {
        await addStep(
          'AUTO_APPLY',
          `Application ${app.id} blocked: Job matching has active hard policy blocker not overridden by candidate.`,
          { applicationId: app.id, packageId: pkg.id },
        );
        blocked++;
        continue;
      }

      // Invariant: Verify all approvals for this package have been explicitly resolved by human candidate
      const packageApprovals = await this.db.query.approvalRequests.findMany({
        where: and(eq(approvalRequests.packageId, pkg.id), eq(approvalRequests.userId, userId)),
      });

      const unverifiedApprovals = packageApprovals.filter(
        (a) =>
          a.status === 'PENDING' ||
          a.status === 'NEEDS_USER_RECONFIRMATION' ||
          ((a.status === 'APPROVED' || a.status === 'RESOLVED') && a.resolvedBy !== 'USER'),
      );

      if (unverifiedApprovals.length > 0) {
        await addStep(
          'AUTO_APPLY',
          `Application ${app.id} blocked: Package has ${unverifiedApprovals.length} approval request(s) requiring human authorization or reconfirmation.`,
          { applicationId: app.id, unverifiedApprovalsCount: unverifiedApprovals.length },
        );
        blocked++;
        continue;
      }

      // Check global pending approvals across user
      const pendingApprovals = await this.db.query.approvalRequests.findMany({
        where: and(
          eq(approvalRequests.userId, userId),
          inArray(approvalRequests.status, ['PENDING', 'NEEDS_USER_RECONFIRMATION']),
        ),
      });

      if (pendingApprovals.length > 0 && policy.blockOnUnresolvedReview) {
        await addStep(
          'AUTO_APPLY',
          `Application blocked: candidate has ${pendingApprovals.length} unresolved approval request(s).`,
          { applicationId: app.id, pendingApprovalsCount: pendingApprovals.length },
        );
        blocked++;
        continue;
      }

      const targetUrl = job?.applicationUrl || job?.originalUrl || 'https://jobs.example.com/apply';

      const [run] = await this.db
        .insert(browserApplicationRuns)
        .values({
          applicationId: app.id,
          userId,
          atsProvider: 'GREENHOUSE',
          targetUrl,
          mode: BrowserRunMode.SUBMIT,
          status: BrowserRunStatus.PENDING,
        })
        .returning({ id: browserApplicationRuns.id });

      if (!run) {
        blocked++;
        continue;
      }

      await addStep(
        'AUTO_APPLY',
        `Queued browser application run ${run.id} in SUBMIT mode for ${roleTitle} at ${company}`,
        { applicationId: app.id, runId: run.id, targetUrl },
      );

      try {
        const completedRun = await executePendingBrowserRun(this.db, run.id);

        if (completedRun.status === BrowserRunStatus.SUCCESS) {
          submitted++;
          await this.db
            .update(applications)
            .set({
              status: 'APPLIED',
              appliedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(applications.id, app.id));

          await this.dispatcher.dispatch({
            userId,
            type: 'AUTO_APPLY_SUCCESS',
            title: `Application Submitted: ${roleTitle}`,
            message: `Successfully submitted application to ${company} via autonomous worker.`,
            severity: 'INFO',
            targetType: 'APPLICATION',
            targetId: app.id,
            actionUrl: `/applications`,
          });
        } else if (completedRun.status === BrowserRunStatus.STOPPED_CAPTCHA) {
          blocked++;
          await this.db
            .update(applications)
            .set({
              status: 'NEEDS_REVIEW',
              updatedAt: new Date(),
            })
            .where(eq(applications.id, app.id));

          await this.dispatcher.dispatch({
            userId,
            type: 'CAPTCHA_HALT',
            title: `CAPTCHA Challenge Detected at ${company}`,
            message: `Browser worker paused safely due to bot challenge. Human completion required.`,
            severity: 'CRITICAL',
            targetType: 'APPLICATION',
            targetId: app.id,
            actionUrl: `/applications`,
          });
        } else if (completedRun.status === BrowserRunStatus.STOPPED_MANUAL_REVIEW) {
          blocked++;
          await this.db
            .update(applications)
            .set({
              status: 'NEEDS_REVIEW',
              updatedAt: new Date(),
            })
            .where(eq(applications.id, app.id));

          await this.dispatcher.dispatch({
            userId,
            type: 'MANUAL_REVIEW_REQUIRED',
            title: `Manual Review Required: ${company}`,
            message: `Required application fields lack verified candidate facts. Answer required before submission.`,
            severity: 'WARNING',
            targetType: 'APPLICATION',
            targetId: app.id,
            actionUrl: `/applications`,
          });
        } else if (completedRun.status === BrowserRunStatus.SUBMISSION_UNCERTAIN) {
          blocked++;
          await this.db
            .update(applications)
            .set({
              status: 'NEEDS_REVIEW',
              updatedAt: new Date(),
            })
            .where(eq(applications.id, app.id));

          await this.dispatcher.dispatch({
            userId,
            type: 'MANUAL_REVIEW_REQUIRED',
            title: `Submission Uncertain: ${company}`,
            message: `Submission status is uncertain for ${roleTitle} at ${company}. Application marked Needs Review to prevent duplicate submissions. Please verify with employer portal.`,
            severity: 'CRITICAL',
            targetType: 'APPLICATION',
            targetId: app.id,
            actionUrl: `/applications`,
          });
        } else {
          blocked++;
          await this.dispatcher.dispatch({
            userId,
            type: 'AUTO_APPLY_FAILED',
            title: `Submission Run ${completedRun.status}: ${company}`,
            message:
              completedRun.errorMessage ||
              `Browser application run ended with status ${completedRun.status}.`,
            severity: 'WARNING',
            targetType: 'APPLICATION',
            targetId: app.id,
          });
        }
      } catch (runErr: any) {
        blocked++;
        // If error thrown during execution of a SUBMIT run, set application to NEEDS_REVIEW to prevent retry
        await this.db
          .update(applications)
          .set({ status: 'NEEDS_REVIEW', updatedAt: new Date() })
          .where(eq(applications.id, app.id));

        await addStep(
          'AUTO_APPLY',
          `Error executing browser run for ${roleTitle}: ${runErr.message}. Set application to NEEDS_REVIEW to prevent duplicate submission retry.`,
          { error: runErr.message },
        );
      }
    }

    return {
      processed: eligibleApps.length,
      succeeded: submitted,
      failed: 0,
      submitted,
      blocked,
    };
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
