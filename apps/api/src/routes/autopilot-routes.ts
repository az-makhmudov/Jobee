import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AUTOPILOT_TERMS, AppError } from '@job-agent/shared';
import type { AutopilotService } from '../services/autopilot-service.js';
import { requireCurrentUserId } from '../plugins/auth-plugin.js';
const consent = z
  .object({
    expectedCandidateFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    termsVersion: z.literal(AUTOPILOT_TERMS),
    intervalHours: z.number().int().min(1).max(168),
    maxPerDay: z.number().int().min(1).max(20),
    minScore: z.number().int().min(90).max(100),
    reviewMode: z.literal('PAUSE'),
  })
  .strict();
export const createAutopilotRoutes =
  (service: AutopilotService): FastifyPluginAsync =>
  async (app) => {
    const ok = (data: unknown) => ({ status: 'ok', data });
    app.get('/autopilot', async (req) => ok(await service.state(requireCurrentUserId(req))));
    app.post('/autopilot/authorize', async (req) => {
      if (
        (req.headers['x-automation-agent'] === 'true' ||
          req.headers['x-script-runner'] === 'true') &&
        !req.headers['x-human-confirmation']
      )
        throw AppError.forbidden('Autopilot permission requires candidate interaction.');
      return ok(await service.authorize(requireCurrentUserId(req), consent.parse(req.body)));
    });
    app.post('/autopilot/pause', async (req) => ok(await service.pause(requireCurrentUserId(req))));
    app.post('/autopilot/run', async (req) => ok(await service.run(requireCurrentUserId(req))));
  };
