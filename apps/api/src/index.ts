import dns from 'node:dns';
import { getConfig } from '@job-agent/config';
import { createLogger } from '@job-agent/shared';
import { closeDbPool } from '@job-agent/database';
import { buildApp } from './app.js';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore if unsupported in environment
}

async function bootstrap() {
  const config = getConfig();
  const logger = createLogger({
    service: 'api',
    level: config.LOG_LEVEL,
    environment: config.NODE_ENV,
  });

  // Ensure database migrations are up to date before launching in production
  if (
    config.DATABASE_URL &&
    (config.NODE_ENV === 'production' || process.env.AUTO_MIGRATE === 'true')
  ) {
    try {
      logger.info('Verifying database schema migrations...');
      const { runDatabaseMigrations } = await import('@job-agent/database');
      await runDatabaseMigrations(config.DATABASE_URL);
      logger.info('Database schema migrations verified and up to date.');
    } catch (migErr) {
      logger.error('Database migration check encountered an error:', undefined, migErr);
      if (config.NODE_ENV === 'production') {
        throw migErr;
      }
    }
  }

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
