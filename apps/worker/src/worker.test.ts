import { describe, it, expect } from 'vitest';
import { WorkerService } from './worker.js';
import type { AppConfig } from '@job-agent/config';
import { createLogger } from '@job-agent/shared';

const testConfig: AppConfig = {
  NODE_ENV: 'test',
  API_HOST: '127.0.0.1',
  API_PORT: 3000,
  WEB_ORIGIN: 'http://localhost:5173',
  LOG_LEVEL: 'fatal',
  WORKER_POLL_INTERVAL_MS: 10000,
  DATABASE_URL: undefined,
};

describe('WorkerService', () => {
  it('starts and stops gracefully', async () => {
    const logger = createLogger({ service: 'test-worker', level: 'fatal' });
    const worker = new WorkerService(testConfig, logger);

    expect(worker.getStatus().isRunning).toBe(false);

    await worker.start();
    expect(worker.getStatus().isRunning).toBe(true);

    await worker.stop();
    expect(worker.getStatus().isRunning).toBe(false);
  });
});
