import type { AppConfig } from '@job-agent/config';
import { Logger, createLogger } from '@job-agent/shared';
import { checkDatabaseHealth, closeDbPool } from '@job-agent/database';

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

  private async tick(): Promise<void> {
    this.logger.debug('Worker heartbeat tick: idle, ready for future job queues');
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
