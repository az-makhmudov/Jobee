import type { FastifyPluginAsync } from 'fastify';
import type { ReadinessResponse } from '@job-agent/shared';
import { checkDatabaseHealth } from '@job-agent/database';
import type { AppConfig } from '@job-agent/config';

export function createReadyRoutes(config: AppConfig): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Reply: ReadinessResponse }>('/ready', async (_req, reply) => {
      const dbHealth = await checkDatabaseHealth(config.DATABASE_URL);

      let overallStatus: 'ready' | 'degraded' | 'unhealthy' = 'ready';
      let statusCode = 200;

      if (dbHealth.status === 'disconnected') {
        overallStatus = 'unhealthy';
        statusCode = 503;
      } else if (dbHealth.status === 'unconfigured') {
        // In development/test, unconfigured DB is considered degraded
        overallStatus = config.NODE_ENV === 'production' ? 'unhealthy' : 'degraded';
        statusCode = config.NODE_ENV === 'production' ? 503 : 200;
      }

      reply.status(statusCode);
      return {
        status: overallStatus,
        service: 'api',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbHealth,
        },
      };
    });
  };
}
