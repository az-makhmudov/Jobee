import type { FastifyPluginAsync } from 'fastify';
import { AppError } from '@job-agent/shared';
import type { SmartProfileImportService } from '../services/import/smart-profile-import-service.js';
import {
  extractProfileImportSchema,
  updateProfileImportItemSchema,
  bulkUpdateProfileImportItemsSchema,
  commitProfileImportSchema,
} from './candidate-import-schemas.js';
import { requireCurrentUserId } from '../plugins/auth-plugin.js';

export function createCandidateImportRoutes(
  service: SmartProfileImportService,
  linkedInConfig?: { clientId?: string; configured: boolean },
): FastifyPluginAsync {
  return async (app) => {
    const getUserId = (req?: any) => requireCurrentUserId(req);

    // --- Upload Document & Create Import Session ---
    app.post('/candidate/import/upload', async (req, reply) => {
      const userId = getUserId(req);
      const data = await req.file();
      if (!data) {
        throw AppError.badRequest('No document file uploaded');
      }

      const buffer = await data.toBuffer();
      if (buffer.length === 0) {
        throw AppError.badRequest('Uploaded file is empty');
      }

      // Max size 25MB
      if (buffer.length > 25 * 1024 * 1024) {
        throw AppError.badRequest('File size exceeds the 25MB limit');
      }

      const fields = (data.fields || {}) as Record<string, { value: unknown }>;
      const query = (req.query || {}) as Record<string, string>;

      const rawSourceType = (fields.sourceType?.value as string) || query.sourceType || 'CV';

      const validSources = ['CV', 'LINKEDIN_PDF', 'LINKEDIN_ARCHIVE'];
      const sourceType = validSources.includes(rawSourceType.toUpperCase())
        ? (rawSourceType.toUpperCase() as 'CV' | 'LINKEDIN_PDF' | 'LINKEDIN_ARCHIVE')
        : 'CV';

      const rawReplace =
        (fields.replaceMasterCv?.value as string | boolean | undefined) ?? query.replaceMasterCv;
      const replaceMasterCv = rawReplace === true || rawReplace === 'true';

      const session = await service.createSession(
        userId,
        buffer,
        {
          originalFilename: data.filename,
          mimeType: data.mimetype,
        },
        sourceType,
        { replaceMasterCv },
      );

      reply.status(201);
      return { status: 'ok', data: session, timestamp: new Date().toISOString() };
    });

    // --- Trigger Information Extraction & Comparison ---
    app.post<{ Params: { sessionId: string } }>(
      '/candidate/import/:sessionId/extract',
      async (req) => {
        const userId = getUserId(req);
        const body = extractProfileImportSchema.parse(req.body || {});
        const session = await service.extractAndCompare(userId, req.params.sessionId, {
          aiConsent: body.aiConsent,
        });
        return { status: 'ok', data: session, timestamp: new Date().toISOString() };
      },
    );

    // --- Get Session Details & Review Items ---
    app.get<{ Params: { sessionId: string } }>('/candidate/import/:sessionId', async (req) => {
      const userId = getUserId(req);
      const session = await service.getSession(userId, req.params.sessionId);
      return { status: 'ok', data: session, timestamp: new Date().toISOString() };
    });

    // --- List Recent Sessions ---
    app.get('/candidate/import', async (req) => {
      const userId = getUserId(req);
      const sessions = await service.listSessions(userId);
      return { status: 'ok', data: sessions, timestamp: new Date().toISOString() };
    });

    // --- Update Single Review Item (Approve, Reject, Edit) ---
    app.patch<{ Params: { sessionId: string; itemId: string } }>(
      '/candidate/import/:sessionId/items/:itemId',
      async (req) => {
        const userId = getUserId(req);
        const body = updateProfileImportItemSchema.parse(req.body);
        const item = await service.updateItem(
          userId,
          req.params.sessionId,
          req.params.itemId,
          body.action,
          body.userEditedPayload,
        );
        return { status: 'ok', data: item, timestamp: new Date().toISOString() };
      },
    );

    // --- Bulk Update Items ---
    app.post<{ Params: { sessionId: string } }>(
      '/candidate/import/:sessionId/items/bulk',
      async (req) => {
        const userId = getUserId(req);
        const body = bulkUpdateProfileImportItemsSchema.parse(req.body);
        const result = await service.bulkUpdateItems(userId, req.params.sessionId, body.action);
        return { status: 'ok', data: result, timestamp: new Date().toISOString() };
      },
    );

    // --- Commit Approved Items to Candidate Brain ---
    app.post<{ Params: { sessionId: string } }>(
      '/candidate/import/:sessionId/commit',
      async (req) => {
        const userId = getUserId(req);
        const body = commitProfileImportSchema.parse(req.body || {});
        const result = await service.commitSession(userId, req.params.sessionId, {
          verifyOnCommit: body.verifyOnCommit,
          allowAiOnCommit: body.allowAiOnCommit,
        });
        return { status: 'ok', data: result, timestamp: new Date().toISOString() };
      },
    );

    // --- Discard Session ---
    app.post<{ Params: { sessionId: string } }>(
      '/candidate/import/:sessionId/discard',
      async (req) => {
        const userId = getUserId(req);
        await service.discardSession(userId, req.params.sessionId);
        return { status: 'ok', data: { discarded: true }, timestamp: new Date().toISOString() };
      },
    );

    // --- LinkedIn Integration Status & Official Guidance ---
    app.get('/candidate/linkedin/status', async () => {
      const isConfigured = Boolean(linkedInConfig?.configured);
      return {
        status: 'ok',
        data: {
          configured: isConfigured,
          oauthAvailable: isConfigured,
          recommendedMethod: 'PDF_EXPORT',
          instructions:
            'LinkedIn profile export PDF is the recommended, zero-risk method to import your full work experience, skills, and certifications into Jobee without third-party scraping or enterprise API restrictions.',
          howToExport: [
            '1. Open your profile on LinkedIn (web browser)',
            '2. Click "More" (next to "Add profile section")',
            '3. Click "Save to PDF"',
            '4. Upload the generated PDF directly into Jobee Smart Profile Import',
          ],
        },
        timestamp: new Date().toISOString(),
      };
    });
  };
}
