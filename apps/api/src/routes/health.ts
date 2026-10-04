import type { FastifyPluginAsync } from 'fastify';
import type { HealthResponse } from '@job-agent/shared';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: HealthResponse }>('/health', async () => {
    return {
      status: 'ok',
      service: 'api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  });
};
