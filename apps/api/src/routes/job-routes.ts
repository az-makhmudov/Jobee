import type { FastifyPluginAsync } from 'fastify';
import type { JobService } from '../services/job-service.js';
import {
  ingestTextSchema,
  ingestUrlSchema,
  updateJobSchema,
  jobListQuerySchema,
} from './job-schemas.js';

export function createJobRoutes(service: JobService): FastifyPluginAsync {
  return async (app) => {
    const getUserId = async () => service.getPrimaryUserId();

    // --- Ingestion: Pasted Text ---
    const handleIngestText = async (req: any, reply: any) => {
      const userId = await getUserId();
      const body = ingestTextSchema.parse(req.body);
      const result = await service.ingestText(userId, body);

      reply.status(result.isDuplicate ? 200 : 201);
      return {
        status: 'ok',
        data: {
          job: result.job,
          isDuplicate: result.isDuplicate,
          message: result.message,
        },
        timestamp: new Date().toISOString(),
      };
    };

    app.post('/jobs/ingest/text', handleIngestText);
    app.post('/jobs/text', handleIngestText);

    // --- Ingestion: URL Import ---
    const handleIngestUrl = async (req: any, reply: any) => {
      const userId = await getUserId();
      const body = ingestUrlSchema.parse(req.body);
      const result = await service.ingestUrl(userId, body);

      reply.status(result.isDuplicate ? 200 : 201);
      return {
        status: 'ok',
        data: {
          job: result.job,
          isDuplicate: result.isDuplicate,
          message: result.message,
        },
        timestamp: new Date().toISOString(),
      };
    };

    app.post('/jobs/ingest/url', handleIngestUrl);
    app.post('/jobs/url', handleIngestUrl);

    // --- Dashboard Ingestion Metrics ---
    app.get('/jobs/metrics', async () => {
      const userId = await getUserId();
      const metrics = await service.getDashboardMetrics(userId);
      return { status: 'ok', data: metrics, timestamp: new Date().toISOString() };
    });

    // --- Job Inbox Listing with Filtering & Pagination ---
    app.get('/jobs', async (req) => {
      const userId = await getUserId();
      const query = jobListQuerySchema.parse(req.query);
      const result = await service.getJobs(userId, query);
      return { status: 'ok', data: result, timestamp: new Date().toISOString() };
    });

    // --- Job Detail ---
    app.get<{ Params: { id: string } }>('/jobs/:id', async (req) => {
      const userId = await getUserId();
      const job = await service.getJobById(userId, req.params.id);
      return { status: 'ok', data: job, timestamp: new Date().toISOString() };
    });

    // --- Manual Edit / Correction ---
    app.put<{ Params: { id: string } }>('/jobs/:id', async (req) => {
      const userId = await getUserId();
      const body = updateJobSchema.parse(req.body);
      const updated = await service.updateJob(userId, req.params.id, body);
      return { status: 'ok', data: updated, timestamp: new Date().toISOString() };
    });

    // --- Archive Job ---
    app.post<{ Params: { id: string }; Body?: { reason?: string } }>(
      '/jobs/:id/archive',
      async (req) => {
        const userId = await getUserId();
        const reason = (req.body as any)?.reason;
        const archived = await service.archiveJob(userId, req.params.id, reason);
        return { status: 'ok', data: archived, timestamp: new Date().toISOString() };
      },
    );

    // --- Provenance & Sources ---
    app.get<{ Params: { id: string } }>('/jobs/:id/sources', async (req) => {
      const userId = await getUserId();
      const job = await service.getJobById(userId, req.params.id);
      return { status: 'ok', data: job.sources || [], timestamp: new Date().toISOString() };
    });

    // --- Extracted Requirements ---
    app.get<{ Params: { id: string } }>('/jobs/:id/requirements', async (req) => {
      const userId = await getUserId();
      const job = await service.getJobById(userId, req.params.id);
      return { status: 'ok', data: job.requirements || [], timestamp: new Date().toISOString() };
    });
  };
}
