import type { Database } from '@job-agent/database';
import {
  orchestrationRuns,
  applicationPolicy,
  applications,
  jobs,
  approvalRequests,
  browserApplicationRuns,
  systemNotifications,
  eq,
  and,
  desc,
  sql,
} from '@job-agent/database';
import {
  OrchestrationRunDto,
  TriggerOrchestrationRequest,
  SystemMetricsDto,
  OrchestrationStepLog,
  OrchestrationRunStatuses,
  AppError,
  ErrorCodes,
  Logger,
} from '@job-agent/shared';
import type { AppConfig } from '@job-agent/config';

export class OrchestratorService {
  constructor(
    private readonly db: Database,
    private readonly config: AppConfig,
    private readonly logger?: Logger,
  ) {}

  async triggerRun(
    userId: string,
    request: TriggerOrchestrationRequest = {},
  ): Promise<OrchestrationRunDto> {
    const taskType = request.taskType || 'PIPELINE_CYCLE';

    // Prevent excessive concurrent runs unless forced
    if (!request.force) {
      const activeRun = await this.db.query.orchestrationRuns?.findFirst({
        where: and(
          eq(orchestrationRuns.userId, userId),
          eq(orchestrationRuns.status, OrchestrationRunStatuses.RUNNING),
        ),
      });

      if (activeRun) {
        throw new AppError({
          code: ErrorCodes.CONFLICT,
          message:
            'An orchestration run is already in progress. Please wait for it to finish or pass force=true.',
          statusCode: 409,
        });
      }
    }

    const [created] = await this.db
      .insert(orchestrationRuns)
      .values({
        userId,
        taskType,
        trigger: 'MANUAL',
        status: OrchestrationRunStatuses.PENDING,
        stepLogs: [],
        summary: {},
      })
      .returning();

    if (!created) {
      throw new AppError({
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Failed to queue orchestration run',
        statusCode: 500,
      });
    }

    this.logger?.info(`Queued on-demand orchestration run: ${created.id} (${taskType})`, {
      runId: created.id,
      userId,
      taskType,
    });

    return this.mapToDto(created);
  }

  async listRuns(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ runs: OrchestrationRunDto[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    const [totalRes] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(orchestrationRuns)
      .where(eq(orchestrationRuns.userId, userId));

    const rows = await this.db
      .select()
      .from(orchestrationRuns)
      .where(eq(orchestrationRuns.userId, userId))
      .orderBy(desc(orchestrationRuns.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      runs: rows.map((r) => this.mapToDto(r)),
      total: Number(totalRes?.count || 0),
    };
  }

  async getRun(userId: string, runId: string): Promise<OrchestrationRunDto> {
    const row = await this.db.query.orchestrationRuns?.findFirst({
      where: and(eq(orchestrationRuns.id, runId), eq(orchestrationRuns.userId, userId)),
    });

    if (!row) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: 'Orchestration run not found',
        statusCode: 404,
      });
    }

    return this.mapToDto(row);
  }

  async getMetrics(userId: string): Promise<SystemMetricsDto> {
    // 1. Total jobs discovered & matched
    const [jobsTotal] = await this.db
      .select({
        discovered: sql<number>`count(*) filter (where ${jobs.state} = 'DISCOVERED')`,
        matched: sql<number>`count(*) filter (where ${jobs.state} = 'MATCHED')`,
      })
      .from(jobs)
      .where(eq(jobs.userId, userId));

    // 2. Applications submitted & applications today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [appsTotal] = await this.db
      .select({
        submitted: sql<number>`count(*) filter (where ${applications.status} = 'APPLIED')`,
        todayCount: sql<number>`count(*) filter (where ${applications.status} = 'APPLIED' and ${applications.appliedAt} >= ${today})`,
      })
      .from(applications)
      .where(eq(applications.userId, userId));

    // 3. Application policy
    const policy = await this.db.query.applicationPolicy?.findFirst({
      where: eq(applicationPolicy.userId, userId),
    });

    const maxPerDay = policy?.maxApplicationsPerDay || 5;
    const appliedToday = Number(appsTotal?.todayCount || 0);
    const dailyQuotaRemaining = Math.max(0, maxPerDay - appliedToday);

    // 4. Pending approvals
    const [approvalsCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(approvalRequests)
      .where(and(eq(approvalRequests.userId, userId), eq(approvalRequests.status, 'PENDING')));

    // 5. Unread notifications
    const [notificationsCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(systemNotifications)
      .where(and(eq(systemNotifications.userId, userId), eq(systemNotifications.status, 'UNREAD')));

    // 6. Pending browser runs
    const [browserRunsCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(browserApplicationRuns)
      .where(
        and(
          eq(browserApplicationRuns.userId, userId),
          eq(browserApplicationRuns.status, 'PENDING'),
        ),
      );

    // 7. Last pipeline run
    const lastRun = await this.db.query.orchestrationRuns?.findFirst({
      where: and(
        eq(orchestrationRuns.userId, userId),
        eq(orchestrationRuns.taskType, 'PIPELINE_CYCLE'),
      ),
      orderBy: desc(orchestrationRuns.createdAt),
    });

    return {
      totalJobsDiscovered: Number(jobsTotal?.discovered || 0),
      totalJobsMatched: Number(jobsTotal?.matched || 0),
      totalApplicationsSubmitted: Number(appsTotal?.submitted || 0),
      applicationsToday: appliedToday,
      maxApplicationsPerDay: maxPerDay,
      dailyQuotaRemaining,
      autoApplyEnabled: policy?.autoApplyEnabled ?? false,
      pendingApprovalsCount: Number(approvalsCount?.count || 0),
      unreadNotificationsCount: Number(notificationsCount?.count || 0),
      pendingBrowserRunsCount: Number(browserRunsCount?.count || 0),
      orchestratorRunning: this.config.ORCHESTRATOR_ENABLED,
      lastPipelineRunAt: lastRun?.completedAt ? new Date(lastRun.completedAt).toISOString() : null,
    };
  }

  async getStatus(): Promise<{
    orchestratorEnabled: boolean;
    pollIntervalMs: number;
    discoveryIntervalMinutes: number;
    emailSyncIntervalMinutes: number;
    remindersIntervalMinutes: number;
    dailyLimitDefault: number;
  }> {
    return {
      orchestratorEnabled: this.config.ORCHESTRATOR_ENABLED,
      pollIntervalMs: this.config.ORCHESTRATOR_POLL_INTERVAL_MS,
      discoveryIntervalMinutes: this.config.DISCOVERY_INTERVAL_MINUTES,
      emailSyncIntervalMinutes: this.config.EMAIL_SYNC_INTERVAL_MINUTES,
      remindersIntervalMinutes: this.config.REMINDERS_INTERVAL_MINUTES,
      dailyLimitDefault: this.config.RATE_LIMIT_DAILY_APPLICATIONS_DEFAULT,
    };
  }

  private mapToDto(row: any): OrchestrationRunDto {
    return {
      id: row.id,
      userId: row.userId,
      taskType: row.taskType,
      trigger: row.trigger,
      status: row.status,
      itemsProcessedCount: row.itemsProcessedCount || 0,
      itemsSucceededCount: row.itemsSucceededCount || 0,
      itemsFailedCount: row.itemsFailedCount || 0,
      stepLogs: (row.stepLogs as OrchestrationStepLog[]) || [],
      summary: (row.summary as Record<string, unknown>) || {},
      errorMessage: row.errorMessage || null,
      retryCount: row.retryCount || 0,
      maxRetries: row.maxRetries || 3,
      startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
      completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }
}
