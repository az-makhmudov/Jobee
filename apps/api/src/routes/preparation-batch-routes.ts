import { getDb } from '@job-agent/database';
import { preparationMetrics } from '../services/preparation-metrics.js';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import type { PreparationBatchService } from '../services/preparation-batch-service.js';
import type { JobSearchSettingsService } from '../services/job-search-settings-service.js';
import { requireCurrentUserId } from '../plugins/auth-plugin.js';
import { AppError } from '@job-agent/shared';
const params = z.object({ id: z.string().uuid() });
const selected = z.object({ itemIds: z.array(z.string().uuid()).min(1).max(10) }).strict();
export function createPreparationBatchRoutes(
  service: PreparationBatchService,
  settings: JobSearchSettingsService,
  selectedSubmissions: boolean,
): FastifyPluginAsync {
  return async (app) => {
    const ok = (data: unknown) => ({ status: 'ok', data, timestamp: new Date().toISOString() });
    app.get('/job-search/metrics', async (req) =>
      ok(await preparationMetrics(getDb(), requireCurrentUserId(req))),
    );
    app.get('/job-search/settings', async (req) =>
      ok(await settings.get(requireCurrentUserId(req))),
    );
    app.put('/job-search/settings', async (req) =>
      ok(await settings.save(requireCurrentUserId(req), req.body)),
    );
    app.get('/preparation-batches', async (req) =>
      ok(await service.list(requireCurrentUserId(req))),
    );
    app.post('/preparation-batches', async (req, reply) => {
      const body = z
        .object({
          jobIds: z.array(z.string().uuid()).min(1).max(10),
          selectedCvId: z.string().uuid().nullable().optional(),
        })
        .strict()
        .parse(req.body);
      const result = await service.create(
        requireCurrentUserId(req),
        body.jobIds,
        body.selectedCvId,
      );
      reply.code(202);
      return ok(result);
    });
    app.get('/preparation-batches/:id', async (req) =>
      ok(await service.get(requireCurrentUserId(req), params.parse(req.params).id)),
    );
    app.post('/preparation-batches/:id/cancel', async (req) =>
      ok(await service.cancel(requireCurrentUserId(req), params.parse(req.params).id)),
    );
    app.post('/preparation-batches/:id/retry', async (req) =>
      ok(await service.retry(requireCurrentUserId(req), params.parse(req.params).id)),
    );
    app.get('/preparation-batches/:id/questions', async (req) =>
      ok(await service.reviewQuestions(requireCurrentUserId(req), params.parse(req.params).id)),
    );
    app.post('/preparation-batches/:id/review', async (req) => {
      if (!selectedSubmissions)
        throw AppError.forbidden(
          'Selected submission is temporarily paused. Your prepared materials remain available.',
        );
      if (
        (req.headers['x-automation-agent'] === 'true' ||
          req.headers['x-script-runner'] === 'true') &&
        !req.headers['x-human-confirmation']
      )
        throw AppError.forbidden('Submission authorization requires candidate interaction.');
      const body = selected.parse(req.body);
      return ok(
        await service.reviewTickets(
          requireCurrentUserId(req),
          params.parse(req.params).id,
          body.itemIds,
        ),
      );
    });
    app.post('/preparation-batches/:id/submit', async (req) => {
      if (!selectedSubmissions)
        throw AppError.forbidden('Selected submission is temporarily paused.');
      const body = z
        .object({
          items: z
            .array(
              z
                .object({
                  itemId: z.string().uuid(),
                  submissionToken: z.string().min(20).max(5000),
                })
                .strict(),
            )
            .min(1)
            .max(10),
        })
        .strict()
        .parse(req.body);
      return ok(
        await service.submit(requireCurrentUserId(req), params.parse(req.params).id, body.items),
      );
    });
  };
}
