import type { FastifyPluginAsync } from 'fastify';
import type { CandidateService } from '../services/candidate-service.js';
import { BrowserWorkerService } from '../services/browser-worker/browser-worker-service.js';
import { SubmissionAuthorizationService } from '../services/browser-worker/submission-authorization-service.js';
import { getConfig } from '@job-agent/config';
import { createStorageProvider } from '../storage/index.js';
import { z } from 'zod';
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
    // 1. Queue or trigger browser run for an application
    app.post('/applications/:id/browser-runs', async (req: any, reply) => {
      const userId = requireCurrentUserId(req);
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
      const userId = requireCurrentUserId(req);
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
      const userId = requireCurrentUserId(req);
      const params = browserRunParamsSchema.parse(req.params);

      const run = await BrowserWorkerService.getBrowserRun(userId, params.runId);
      return {
        status: 'ok',
        data: run,
        timestamp: new Date().toISOString(),
      };
    });

    app.post('/browser-runs/:runId/reconcile-not-sent', async (req) => {
      const { runId } = browserRunParamsSchema.parse(req.params);
      const body = z
        .object({
          checkedEmployerWebsite: z.literal(true),
          note: z.string().trim().min(10).max(1000),
        })
        .strict()
        .parse(req.body);
      const run = await BrowserWorkerService.reconcileNotSent(
        requireCurrentUserId(req),
        runId,
        body.note,
      );
      return { status: 'ok', data: run, timestamp: new Date().toISOString() };
    });

    app.get('/browser-runs/:runId/evidence/:index', async (req, reply) => {
      const input = z
        .object({ runId: z.string().uuid(), index: z.coerce.number().int().min(0).max(20) })
        .parse(req.params);
      const run = await BrowserWorkerService.getBrowserRun(requireCurrentUserId(req), input.runId);
      if (Date.now() - new Date(run.createdAt).getTime() > 30 * 24 * 60 * 60_000)
        throw AppError.notFound('Evidence retention period has ended.');
      const key = run.screenshotPaths[input.index];
      if (!key) throw AppError.notFound('Evidence is unavailable.');
      const storage = createStorageProvider(getConfig());
      if (!(await storage.exists(key))) throw AppError.notFound('Evidence is unavailable.');
      const file = await storage.getFile(key);
      return reply
        .header('Cache-Control', 'private, no-store')
        .header('X-Content-Type-Options', 'nosniff')
        .type('image/png')
        .send(file.buffer);
    });

    // 4. Request cryptographic submission authorization ticket
    app.post('/applications/:id/submission-authorization', async (req: any) => {
      const userId = requireCurrentUserId(req);
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
