import type { FastifyPluginAsync } from 'fastify';
import type { ApplicationPackageService } from '../services/application-package-service.js';
import type { CandidateService } from '../services/candidate-service.js';
import {
  createPackageSchema,
  regeneratePackageSchema,
  updateCvSchema,
  updateCoverLetterSchema,
  addQuestionSchema,
  answerQuestionSchema,
  approveRequestSchema,
  overrideBlockerSchema,
} from './application-package-schemas.js';
import { AppError } from '@job-agent/shared';

import { getCurrentUserId } from '../plugins/auth-plugin.js';

export function createApplicationPackageRoutes(
  service: ApplicationPackageService,
  candidateService: CandidateService,
): FastifyPluginAsync {
  return async (app) => {
    const getUserId = async () => getCurrentUserId() ?? (await candidateService.getPrimaryUserId());

    // 1. Create Package from Job
    app.post('/jobs/:jobId/application-package', async (req: any, reply) => {
      const userId = await getUserId();
      const { jobId } = req.params;
      const body = createPackageSchema.parse(req.body || {});

      const result = await service.createPackage(userId, jobId, body.manualBaseDocumentId);
      reply.status(201);
      return {
        status: 'ok',
        data: result,
        timestamp: new Date().toISOString(),
      };
    });

    // 2. Metrics
    app.get('/application-packages/metrics', async () => {
      const userId = await getUserId();
      const metrics = await service.getMetrics(userId);
      return {
        status: 'ok',
        data: metrics,
        timestamp: new Date().toISOString(),
      };
    });

    // 3. List Packages
    app.get('/application-packages', async (req: any) => {
      const userId = await getUserId();
      const { status, jobId } = req.query as { status?: string; jobId?: string };
      const packages = await service.listPackages(userId, { status, jobId });
      return {
        status: 'ok',
        data: packages,
        timestamp: new Date().toISOString(),
      };
    });

    // 4. Get Package Details
    app.get('/application-packages/:id', async (req: any) => {
      const userId = await getUserId();
      const { id } = req.params;
      const result = await service.getPackage(id, userId);
      return {
        status: 'ok',
        data: result,
        timestamp: new Date().toISOString(),
      };
    });

    // 5. List Versions
    app.get('/application-packages/:id/versions', async (req: any) => {
      const userId = await getUserId();
      const { id } = req.params;
      const versions = await service.listVersions(id, userId);
      return {
        status: 'ok',
        data: versions,
        timestamp: new Date().toISOString(),
      };
    });

    // 6. Regenerate Package (create new version)
    app.post('/application-packages/:id/regenerate', async (req: any) => {
      const userId = await getUserId();
      const { id } = req.params;
      const body = regeneratePackageSchema.parse(req.body || {});
      const result = await service.regeneratePackage(id, userId, body.manualBaseDocumentId);
      return {
        status: 'ok',
        data: result,
        timestamp: new Date().toISOString(),
      };
    });

    // 7. Update CV Summary
    app.put('/application-packages/:id/cv', async (req: any) => {
      const userId = await getUserId();
      const { id } = req.params;
      const body = updateCvSchema.parse(req.body);
      const updatedVersion = await service.updateCv(id, userId, body.summary);
      return {
        status: 'ok',
        data: updatedVersion,
        timestamp: new Date().toISOString(),
      };
    });

    // 8. Update Cover Letter
    app.put('/application-packages/:id/cover-letter', async (req: any) => {
      const userId = await getUserId();
      const { id } = req.params;
      const body = updateCoverLetterSchema.parse(req.body);
      const updatedVersion = await service.updateCoverLetter(id, userId, body.content);
      return {
        status: 'ok',
        data: updatedVersion,
        timestamp: new Date().toISOString(),
      };
    });

    // 9. Add Question
    app.post('/application-packages/:id/questions', async (req: any, reply) => {
      const userId = await getUserId();
      const { id } = req.params;
      const body = addQuestionSchema.parse(req.body);
      const newQuestion = await service.addQuestion(id, userId, body);
      reply.status(201);
      return {
        status: 'ok',
        data: newQuestion,
        timestamp: new Date().toISOString(),
      };
    });

    // 10. Answer/Edit Question
    app.put('/application-packages/:id/questions/:questionId', async (req: any) => {
      const userId = await getUserId();
      const { id, questionId } = req.params;
      const body = answerQuestionSchema.parse(req.body);
      const updatedQuestion = await service.answerQuestion(id, questionId, userId, body.answerText);
      return {
        status: 'ok',
        data: updatedQuestion,
        timestamp: new Date().toISOString(),
      };
    });

    // 11. Override Policy Blocker
    app.post('/application-packages/:id/override-blocker', async (req: any) => {
      const userId = await getUserId();
      const { id } = req.params;
      const body = overrideBlockerSchema.parse(req.body);
      const updatedPkg = await service.overrideBlocker(id, userId, body.reason);
      return {
        status: 'ok',
        data: updatedPkg,
        timestamp: new Date().toISOString(),
      };
    });

    // 12. Download Artifact
    app.get('/application-packages/:id/artifacts/:artifactId/download', async (req: any, reply) => {
      const userId = await getUserId();
      const { id, artifactId } = req.params;
      const fileData = await service.getArtifactFile(id, artifactId, userId);

      reply.header('Content-Type', fileData.artifact.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${fileData.artifact.filename}"`);
      reply.header('Content-Length', fileData.buffer.length);
      return reply.send(fileData.buffer);
    });

    // 13. List Global Approvals
    app.get('/approvals', async (req: any) => {
      const userId = await getUserId();
      const { status } = req.query as { status?: string };
      const approvals = await service.listApprovals(userId, { status });
      return {
        status: 'ok',
        data: approvals,
        timestamp: new Date().toISOString(),
      };
    });

    // 14. Approve Request
    app.post('/approvals/:id/approve', async (req: any) => {
      const userId = await getUserId();
      const { id } = req.params;

      // Reject automated agent / script bypasses
      const isAutomation =
        req.headers['x-automation-agent'] === 'true' || req.headers['x-script-runner'] === 'true';

      if (isAutomation && !req.headers['x-human-confirmation']) {
        throw AppError.forbidden(
          'Consequential approval requests cannot be approved by automated agents or background scripts. Explicit candidate authorization is required.',
        );
      }

      const body = approveRequestSchema.parse(req.body || {});
      const result = await service.approveRequest(id, userId, body.userEditedValue);
      return {
        status: 'ok',
        data: result,
        timestamp: new Date().toISOString(),
      };
    });

    // 15. Reject Request
    app.post('/approvals/:id/reject', async (req: any) => {
      const userId = await getUserId();
      const { id } = req.params;
      const result = await service.rejectRequest(id, userId);
      return {
        status: 'ok',
        data: result,
        timestamp: new Date().toISOString(),
      };
    });
  };
}
