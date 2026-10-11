import type { FastifyPluginAsync } from 'fastify';
import type { JobService } from '../services/job-service.js';
import type { MatchService } from '../services/match-service.js';
import type { JobDiscoveryService } from '../services/job-discovery-service.js';
import { AppError } from '@job-agent/shared';
import {
  ingestTextSchema,
  ingestUrlSchema,
  updateJobSchema,
  jobListQuerySchema,
  analyzeJobSchema,
  batchAnalyzeSchema,
} from './job-schemas.js';
import { getCurrentUserId } from '../plugins/auth-plugin.js';

export function createJobRoutes(
  service: JobService,
  matchService?: MatchService,
  discoveryService?: JobDiscoveryService,
): FastifyPluginAsync {
  return async (app) => {
    const getUserId = async () => getCurrentUserId() ?? (await service.getPrimaryUserId());

    // --- On-Demand Public Discovery ---
    app.post('/jobs/discover', async (req) => {
      if (!discoveryService) throw AppError.internal('Discovery service is not initialized');
      const userId = await getUserId();
      const options = (req.body as any) || {};
      const result = await discoveryService.discoverForCandidate(userId, options);
      return { status: 'ok', data: result, timestamp: new Date().toISOString() };
    });

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

    // --- Dashboard Ingestion & Matching Metrics ---
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

    // --- Batch Analyze Jobs ---
    app.post<{ Body?: unknown }>('/jobs/analyze', async (req) => {
      if (!matchService) throw AppError.internal('Match service is not initialized');
      const userId = await getUserId();
      const body = batchAnalyzeSchema.parse(req.body ?? {});
      const result = await matchService.batchAnalyzeJobs(userId, body);
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

    // --- Match Intelligence: Analyze Single Job ---
    app.post<{ Params: { id: string }; Body?: { force?: boolean } }>(
      '/jobs/:id/analyze',
      async (req) => {
        if (!matchService) throw AppError.internal('Match service is not initialized');
        const userId = await getUserId();
        const body = analyzeJobSchema.parse(req.body ?? {});
        const analysis = await matchService.analyzeJob(req.params.id, userId, {
          force: body.force,
        });
        return { status: 'ok', data: analysis, timestamp: new Date().toISOString() };
      },
    );

    // --- Match Intelligence: Get Latest Job Analysis ---
    app.get<{ Params: { id: string } }>('/jobs/:id/analysis', async (req) => {
      if (!matchService) throw AppError.internal('Match service is not initialized');
      const userId = await getUserId();
      const analysis = await matchService.getJobAnalysis(req.params.id, userId);
      if (!analysis) {
        throw AppError.notFound(`No match analysis found for job ${req.params.id}`);
      }
      return { status: 'ok', data: analysis, timestamp: new Date().toISOString() };
    });

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
