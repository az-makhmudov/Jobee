import type { FastifyPluginAsync } from 'fastify';
import { getOrCreatePrimaryUser, type Database } from '@job-agent/database';
import type { AppConfig } from '@job-agent/config';
import { OrchestratorService } from '../services/orchestrator/orchestrator-service.js';
import {
  triggerOrchestrationSchema,
  listOrchestrationsQuerySchema,
  orchestrationParamsSchema,
} from './orchestrator-schemas.js';

export interface OrchestratorRoutesOptions {
  db: Database;
  config: AppConfig;
}

export const orchestratorRoutes: FastifyPluginAsync<OrchestratorRoutesOptions> = async (
  fastify,
  opts,
) => {
  const service = new OrchestratorService(opts.db, opts.config, fastify.log as any);
  const { getCurrentUserId } = await import('../plugins/auth-plugin.js');

  const getUserId = async (request: any): Promise<string> => {
    return getCurrentUserId() ?? request.userId ?? (await getOrCreatePrimaryUser(opts.db)).id;
  };

  // POST /api/orchestrator/runs - Enqueue an on-demand orchestration run
  fastify.post('/runs', async (request, reply) => {
    const userId = await getUserId(request);
    const body = triggerOrchestrationSchema.parse(request.body || {});
    const run = await service.triggerRun(userId, body);

    return reply.status(202).send({
      status: 'ok',
      data: run,
    });
  });

  // GET /api/orchestrator/runs - List recent orchestration runs
  fastify.get('/runs', async (request, reply) => {
    const userId = await getUserId(request);
    const query = listOrchestrationsQuerySchema.parse(request.query);
    const result = await service.listRuns(userId, query);

    return reply.status(200).send({
      status: 'ok',
      data: result,
    });
  });

  // GET /api/orchestrator/runs/:id - Get specific orchestration run details and step logs
  fastify.get('/runs/:id', async (request, reply) => {
    const userId = await getUserId(request);
    const params = orchestrationParamsSchema.parse(request.params);
    const run = await service.getRun(userId, params.id);

    return reply.status(200).send({
      status: 'ok',
      data: run,
    });
  });

  // GET /api/orchestrator/metrics - Aggregate system metrics & autonomous quotas
  fastify.get('/metrics', async (request, reply) => {
    const userId = await getUserId(request);
    const metrics = await service.getMetrics(userId);

    return reply.status(200).send({
      status: 'ok',
      data: metrics,
    });
  });

  // GET /api/orchestrator/status - Get scheduler engine configuration and status
  fastify.get('/status', async (_request, reply) => {
    const status = await service.getStatus();

    return reply.status(200).send({
      status: 'ok',
      data: status,
    });
  });
};
