import { getConfig } from '@job-agent/config';
import { createLogger } from '@job-agent/shared';
import { closeDbPool } from '@job-agent/database';
import { buildApp } from './app.js';

async function bootstrap() {
  const config = getConfig();
  const logger = createLogger({
    service: 'api',
    level: config.LOG_LEVEL,
    environment: config.NODE_ENV,
  });

  const app = buildApp({ config, logger });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down API server gracefully...`);
    try {
      await app.close();
      await closeDbPool();
      logger.info('API server closed successfully.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during graceful shutdown', undefined, err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    const address = await app.listen({
      port: config.API_PORT,
      host: config.API_HOST,
    });
    logger.info(`Jobee API listening at ${address}`, {
      host: config.API_HOST,
      port: config.API_PORT,
      env: config.NODE_ENV,
    });
  } catch (err) {
    logger.fatal('Failed to start API server', undefined, err);
    process.exit(1);
  }
}

void bootstrap();
