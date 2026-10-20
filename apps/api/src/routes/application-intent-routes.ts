import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { APPLICATION_INTENT_TERMS, AppError } from '@job-agent/shared';
import { requireCurrentUserId } from '../plugins/auth-plugin.js';
import type { ApplicationIntentService } from '../services/application-intent-service.js';

const jobParams = z.object({ id: z.string().uuid() });
const consent = z.object({ termsVersion: z.literal(APPLICATION_INTENT_TERMS) }).strict();
export function createApplicationIntentRoutes(
  service: ApplicationIntentService,
  enabled: boolean,
): FastifyPluginAsync {
  return async (app) => {
    const ok = (data: unknown) => ({ status: 'ok', data, timestamp: new Date().toISOString() });
    app.get('/jobs/:id/application-intent', async (req) =>
      ok(await service.forJob(requireCurrentUserId(req), jobParams.parse(req.params).id)),
    );
    app.get('/application-intents/:id', async (req) =>
      ok(await service.get(requireCurrentUserId(req), jobParams.parse(req.params).id)),
    );
    app.post('/jobs/:id/apply', async (req, reply) => {
      if (!enabled) throw AppError.forbidden('Applications are temporarily paused.');
      if (
        (req.headers['x-automation-agent'] === 'true' ||
          req.headers['x-script-runner'] === 'true') &&
        !req.headers['x-human-confirmation']
      )
        throw AppError.forbidden('Application permission requires candidate interaction.');
      consent.parse(req.body);
      const result = await service.create(
        requireCurrentUserId(req),
        jobParams.parse(req.params).id,
      );
      reply.code(202);
      return ok(result);
    });
    app.post('/application-intents/:id/cancel', async (req) =>
      ok(await service.cancel(requireCurrentUserId(req), jobParams.parse(req.params).id)),
    );
    app.post('/application-intents/:id/resume', async (req) => {
      if (!enabled) throw AppError.forbidden('Applications are temporarily paused.');
      if (
        (req.headers['x-automation-agent'] === 'true' ||
          req.headers['x-script-runner'] === 'true') &&
        !req.headers['x-human-confirmation']
      )
        throw AppError.forbidden('Application permission requires candidate interaction.');
      consent.parse(req.body);
      return ok(await service.resume(requireCurrentUserId(req), jobParams.parse(req.params).id));
    });
  };
}
