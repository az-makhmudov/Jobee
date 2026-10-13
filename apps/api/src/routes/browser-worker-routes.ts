import type { FastifyPluginAsync } from 'fastify';
import type { CandidateService } from '../services/candidate-service.js';
import { BrowserWorkerService } from '../services/browser-worker/browser-worker-service.js';
import { SubmissionAuthorizationService } from '../services/browser-worker/submission-authorization-service.js';
import { AppError } from '@job-agent/shared';
import {
  startBrowserRunSchema,
  applicationRunParamsSchema,
  browserRunParamsSchema,
} from './browser-worker-schemas.js';
import { requireCurrentUserId } from '../plugins/auth-plugin.js';

export function createBrowserWorkerRoutes(
  _candidateService?: CandidateService,
): FastifyPluginAsync {
  return async (app) => {
    const getUserId = async (req?: any) => requireCurrentUserId(req);

    // 1. Queue or trigger browser run for an application
    app.post('/applications/:id/browser-runs', async (req: any, reply) => {
      const userId = await getUserId();
      const params = applicationRunParamsSchema.parse(req.params);
      const body = startBrowserRunSchema.parse(req.body ?? {});

      const run = await BrowserWorkerService.createBrowserRun(userId, params.id, body);
      reply.status(201);
      return {
        status: 'ok',
        data: run,
        timestamp: new Date().toISOString(),
      };
    });

    // 2. List browser runs for an application
    app.get('/applications/:id/browser-runs', async (req: any) => {
      const userId = await getUserId();
      const params = applicationRunParamsSchema.parse(req.params);

      const runs = await BrowserWorkerService.listBrowserRuns(userId, params.id);
      return {
        status: 'ok',
        data: runs,
        timestamp: new Date().toISOString(),
      };
    });

    // 3. Get specific browser run details and step logs
    app.get('/browser-runs/:runId', async (req: any) => {
      const userId = await getUserId();
      const params = browserRunParamsSchema.parse(req.params);

      const run = await BrowserWorkerService.getBrowserRun(userId, params.runId);
      return {
        status: 'ok',
        data: run,
        timestamp: new Date().toISOString(),
      };
    });

    // 4. Request cryptographic submission authorization ticket
    app.post('/applications/:id/submission-authorization', async (req: any) => {
      const userId = await getUserId();
      const params = applicationRunParamsSchema.parse(req.params);

      const isAutomation =
        req.headers['x-automation-agent'] === 'true' || req.headers['x-script-runner'] === 'true';
      if (isAutomation && !req.headers['x-human-confirmation']) {
        throw AppError.forbidden(
          'Automated agents cannot request submission authorization. Explicit candidate interaction is required.',
        );
      }

      const ticket = await SubmissionAuthorizationService.createSubmissionAuthorizationTicket(
        userId,
        params.id,
      );
      return {
        status: 'ok',
        data: ticket,
        timestamp: new Date().toISOString(),
      };
    });
  };
}
