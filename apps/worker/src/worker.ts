import type { AppConfig } from '@job-agent/config';
import { Logger, createLogger } from '@job-agent/shared';
import {
  checkDatabaseHealth,
  closeDbPool,
  getDb,
  type Database,
  browserApplicationRuns,
  orchestrationRuns,
  users,
  eq,
} from '@job-agent/database';
import { BrowserRunStatus, OrchestrationRunStatuses } from '@job-agent/shared';
import { executePendingBrowserRun } from './services/browser-runner.js';
import { AutonomousOrchestrator } from './engine/autonomous-orchestrator.js';

export class WorkerService {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly logger: Logger;
  private lastScheduledRunTime = 0;
  private orchestrator: AutonomousOrchestrator | null = null;

  constructor(
    private readonly config: AppConfig,
    logger?: Logger,
  ) {
    this.logger =
      logger ??
      createLogger({
        service: 'worker',
        level: config.LOG_LEVEL,
        environment: config.NODE_ENV,
      });
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Worker is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Initializing background worker service...', {
      environment: this.config.NODE_ENV,
      pollIntervalMs: this.config.WORKER_POLL_INTERVAL_MS,
      orchestratorEnabled: this.config.ORCHESTRATOR_ENABLED,
    });

    // Check database connectivity
    const dbHealth = await checkDatabaseHealth(this.config.DATABASE_URL);
    this.logger.info(`Database connectivity check: ${dbHealth.status}`, {
      status: dbHealth.status,
      latencyMs: dbHealth.latencyMs,
      message: dbHealth.message,
    });

    // Reconcile orphaned runs from previous abnormal shutdown/crash
    await this.recoverOrphanedRuns();

    // Start heartbeat loop
    this.scheduleNextTick();
    this.logger.info('Worker service started successfully. Running in standby mode.');
  }

  private async recoverOrphanedRuns(): Promise<void> {
    try {
      const db = getDb(this.config.DATABASE_URL);

      const orphanedBrowserRuns = await db
        .update(browserApplicationRuns)
        .set({
          status: BrowserRunStatus.FAILED,
          errorMessage: 'Interrupted by worker process restart/crash',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(browserApplicationRuns.status, BrowserRunStatus.RUNNING))
        .returning();

      if (orphanedBrowserRuns.length > 0) {
        this.logger.warn(
          `Reconciled ${orphanedBrowserRuns.length} orphaned browser run(s) from previous shutdown`,
          { count: orphanedBrowserRuns.length },
        );
      }

      const orphanedOrchRuns = await db
        .update(orchestrationRuns)
        .set({
          status: OrchestrationRunStatuses.FAILED,
          errorMessage: 'Interrupted by worker process restart/crash',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orchestrationRuns.status, OrchestrationRunStatuses.RUNNING))
        .returning();

      if (orphanedOrchRuns.length > 0) {
        this.logger.warn(
          `Reconciled ${orphanedOrchRuns.length} orphaned orchestration run(s) from previous shutdown`,
          { count: orphanedOrchRuns.length },
        );
      }
    } catch (err: any) {
      this.logger.error('Failed to reconcile orphaned runs during startup', undefined, err);
    }
  }

  private scheduleNextTick(): void {
    if (!this.isRunning) return;

    this.timer = setTimeout(async () => {
      try {
        await this.tick();
      } catch (err) {
        this.logger.error('Error during worker tick execution', undefined, err);
      } finally {
        if (this.isRunning) {
          this.scheduleNextTick();
        }
      }
    }, this.config.WORKER_POLL_INTERVAL_MS);
  }

  private db: Database | null = null;

  private async tick(): Promise<void> {
    if (!this.db) {
      try {
        this.db = getDb(this.config.DATABASE_URL);
        this.orchestrator = new AutonomousOrchestrator(this.db, this.logger);
      } catch (err: any) {
        this.logger.error('Failed to initialize database client in worker', undefined, err);
        return;
      }
    }

    // 1. Process pending browser application runs
    try {
      const pendingRuns = await this.db
        .select()
        .from(browserApplicationRuns)
        .where(eq(browserApplicationRuns.status, BrowserRunStatus.PENDING))
        .limit(5);

      if (pendingRuns.length > 0) {
        this.logger.info(
          `Discovered ${pendingRuns.length} pending browser application run(s). Processing...`,
        );
        for (const run of pendingRuns) {
          try {
            await executePendingBrowserRun(this.db, run.id);
            this.logger.info(`Successfully completed browser run ${run.id} (${run.mode})`);
          } catch (runErr: any) {
            this.logger.error(
              `Error processing browser run ${run.id}: ${runErr.message}`,
              undefined,
              runErr,
            );
          }
        }
      }
    } catch (tickErr: any) {
      this.logger.error(
        'Error querying pending browser runs during worker tick',
        undefined,
        tickErr,
      );
    }

    // 2. Process pending on-demand orchestration runs
    try {
      const pendingOrchestrations = await this.db
        .select()
        .from(orchestrationRuns)
        .where(eq(orchestrationRuns.status, OrchestrationRunStatuses.PENDING))
        .limit(3);

      if (pendingOrchestrations.length > 0 && this.orchestrator) {
        this.logger.info(
          `Discovered ${pendingOrchestrations.length} pending orchestration run(s). Processing...`,
        );
        for (const oRun of pendingOrchestrations) {
          try {
            await this.orchestrator.executeRun(
              oRun.userId,
              oRun.taskType as any,
              oRun.trigger as any,
              { runId: oRun.id },
            );
            this.logger.info(`Completed orchestration run ${oRun.id} (${oRun.taskType})`);
          } catch (oErr: any) {
            this.logger.error(
              `Error executing orchestration run ${oRun.id}: ${oErr.message}`,
              undefined,
              oErr,
            );
          }
        }
      }
    } catch (oQueryErr: any) {
      this.logger.error('Error querying pending orchestration runs', undefined, oQueryErr);
    }

    // 3. Scheduled periodic pipeline trigger
    const now = Date.now();
    const scheduledInterval = this.config.ORCHESTRATOR_POLL_INTERVAL_MS * 6; // e.g. every 90s
    if (
      this.config.ORCHESTRATOR_ENABLED &&
      this.orchestrator &&
      now - this.lastScheduledRunTime >= scheduledInterval
    ) {
      this.lastScheduledRunTime = now;
      try {
        const activeUsers = await this.db.select({ id: users.id }).from(users).limit(1);
        if (activeUsers.length > 0 && activeUsers[0]) {
          this.logger.debug('Triggering periodic autonomous pipeline run for primary user...');
          await this.orchestrator.executePipelineCycle(activeUsers[0].id, 'SCHEDULED');
        }
      } catch (schedErr: any) {
        this.logger.error('Error during scheduled pipeline run', undefined, schedErr);
      }
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.info('Stopping background worker service...');
    this.isRunning = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    await closeDbPool();
    this.logger.info('Background worker service stopped gracefully.');
  }

  public getStatus(): { isRunning: boolean; lastScheduledRunTime: number } {
    return {
      isRunning: this.isRunning,
      lastScheduledRunTime: this.lastScheduledRunTime,
    };
  }
}
