import type { FastifyPluginAsync } from 'fastify';
import type { HealthResponse } from '@job-agent/shared';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  const getHealth = async () => ({
    status: 'ok' as const,
    service: 'api' as const,
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });

  app.get<{ Reply: HealthResponse }>('/health', getHealth);
  app.get<{ Reply: HealthResponse }>('/health/live', getHealth);
};
