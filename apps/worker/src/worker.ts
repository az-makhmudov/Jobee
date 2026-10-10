import type { AppConfig } from '@job-agent/config';
import { Logger, createLogger } from '@job-agent/shared';
import {
  checkDatabaseHealth,
  closeDbPool,
  getDb,
  type Database,
  browserApplicationRuns,
  eq,
} from '@job-agent/database';
import { BrowserRunStatus } from '@job-agent/shared';
import { executePendingBrowserRun } from './services/browser-runner.js';

export class WorkerService {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly logger: Logger;

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
    });

    // Check database connectivity
    const dbHealth = await checkDatabaseHealth(this.config.DATABASE_URL);
    this.logger.info(`Database connectivity check: ${dbHealth.status}`, {
      status: dbHealth.status,
      latencyMs: dbHealth.latencyMs,
      message: dbHealth.message,
    });

    // Start idle heartbeat loop
    this.scheduleNextTick();
    this.logger.info('Worker service started successfully. Running in standby mode.');
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
      } catch (err: any) {
        this.logger.error('Failed to initialize database client in worker', undefined, err);
        return;
      }
    }

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
      } else {
        this.logger.debug('Worker heartbeat tick: 0 pending browser runs');
      }
    } catch (tickErr: any) {
      this.logger.error('Error querying pending runs during worker tick', undefined, tickErr);
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

  public getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }
}
