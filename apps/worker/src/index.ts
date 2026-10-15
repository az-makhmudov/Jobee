import dns from 'node:dns';
import { getConfig } from '@job-agent/config';
import { createLogger } from '@job-agent/shared';
import { WorkerService } from './worker.js';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore if unsupported in environment
}

async function bootstrap() {
  const config = getConfig();
  const logger = createLogger({
    service: 'worker',
    level: config.LOG_LEVEL,
    environment: config.NODE_ENV,
  });

  const worker = new WorkerService(config, logger);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down worker...`);
    try {
      await worker.stop();
      process.exit(0);
    } catch (err) {
      logger.error('Error during worker shutdown', undefined, err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await worker.start();
  } catch (err) {
    logger.fatal('Failed to start worker service', undefined, err);
    process.exit(1);
  }
}

void bootstrap();
