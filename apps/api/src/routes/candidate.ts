import type { FastifyPluginAsync } from 'fastify';
import { AppError } from '@job-agent/shared';
import type { CandidateService } from '../services/candidate-service.js';
import {
  upsertProfileSchema,
  createExperienceSchema,
  updateExperienceSchema,
  createEducationSchema,
  updateEducationSchema,
  createProjectSchema,
  updateProjectSchema,
  createSkillSchema,
  updateSkillSchema,
  createLanguageSchema,
  updateLanguageSchema,
  createCertificationSchema,
  updateCertificationSchema,
  createLinkSchema,
  updateLinkSchema,
  createFactSchema,
  updateFactSchema,
  createAnswerSchema,
  updateAnswerSchema,
  upsertPreferencesSchema,
  updatePolicySchema,
} from './candidate-schemas.js';

export function createCandidateRoutes(service: CandidateService): FastifyPluginAsync {
  return async (app) => {
    // Helper to get deterministic primary user
    const getUserId = async () => service.getPrimaryUserId();

    // --- Overview & Dashboard ---
    app.get('/candidate/overview', async () => {
      const userId = await getUserId();
      const overview = await service.getOverview(userId);
      return { status: 'ok', data: overview, timestamp: new Date().toISOString() };
    });

    app.get('/candidate/audit-events', async () => {
      const userId = await getUserId();
      const events = await service.getAuditEvents(userId);
      return { status: 'ok', data: events, timestamp: new Date().toISOString() };
    });

    // --- Profile ---
    app.get('/candidate/profile', async () => {
      const userId = await getUserId();
      const profile = await service.getProfile(userId);
      return { status: 'ok', data: profile, timestamp: new Date().toISOString() };
    });

    app.put('/candidate/profile', async (req) => {
      const userId = await getUserId();
      const body = upsertProfileSchema.parse(req.body);
      const profile = await service.upsertProfile(userId, body);
      return { status: 'ok', data: profile, timestamp: new Date().toISOString() };
    });

    // --- Experience ---
    app.get('/candidate/experiences', async () => {
      const userId = await getUserId();
      const items = await service.getExperiences(userId);
      return { status: 'ok', data: items, timestamp: new Date().toISOString() };
    });

    app.post('/candidate/experiences', async (req, reply) => {
      const userId = await getUserId();
      const body = createExperienceSchema.parse(req.body);
      const created = await service.createExperience(userId, body);
      reply.status(201);
      return { status: 'ok', data: created, timestamp: new Date().toISOString() };
    });

    app.put<{ Params: { id: string } }>('/candidate/experiences/:id', async (req) => {
      const userId = await getUserId();
      const body = updateExperienceSchema.parse(req.body);
      const updated = await service.updateExperience(userId, req.params.id, body);
      return { status: 'ok', data: updated, timestamp: new Date().toISOString() };
    });

    app.delete<{ Params: { id: string } }>('/candidate/experiences/:id', async (req) => {
      const userId = await getUserId();
      await service.deleteExperience(userId, req.params.id);
      return { status: 'ok', data: { deleted: true }, timestamp: new Date().toISOString() };
    });

    // --- Education ---
    app.get('/candidate/education', async () => {
      const userId = await getUserId();
      const items = await service.getEducation(userId);
      return { status: 'ok', data: items, timestamp: new Date().toISOString() };
    });

    app.post('/candidate/education', async (req, reply) => {
      const userId = await getUserId();
      const body = createEducationSchema.parse(req.body);
      const created = await service.createEducation(userId, body);
      reply.status(201);
      return { status: 'ok', data: created, timestamp: new Date().toISOString() };
    });

    app.put<{ Params: { id: string } }>('/candidate/education/:id', async (req) => {
      const userId = await getUserId();
      const body = updateEducationSchema.parse(req.body);
      const updated = await service.updateEducation(userId, req.params.id, body);
      return { status: 'ok', data: updated, timestamp: new Date().toISOString() };
    });

    app.delete<{ Params: { id: string } }>('/candidate/education/:id', async (req) => {
      const userId = await getUserId();
      await service.deleteEducation(userId, req.params.id);
      return { status: 'ok', data: { deleted: true }, timestamp: new Date().toISOString() };
    });

    // --- Projects ---
    app.get('/candidate/projects', async () => {
      const userId = await getUserId();
      const items = await service.getProjects(userId);
      return { status: 'ok', data: items, timestamp: new Date().toISOString() };
    });

    app.post('/candidate/projects', async (req, reply) => {
      const userId = await getUserId();
      const body = createProjectSchema.parse(req.body);
      const created = await service.createProject(userId, body);
      reply.status(201);
      return { status: 'ok', data: created, timestamp: new Date().toISOString() };
    });

    app.put<{ Params: { id: string } }>('/candidate/projects/:id', async (req) => {
      const userId = await getUserId();
      const body = updateProjectSchema.parse(req.body);
      const updated = await service.updateProject(userId, req.params.id, body);
      return { status: 'ok', data: updated, timestamp: new Date().toISOString() };
    });

    app.delete<{ Params: { id: string } }>('/candidate/projects/:id', async (req) => {
      const userId = await getUserId();
      await service.deleteProject(userId, req.params.id);
      return { status: 'ok', data: { deleted: true }, timestamp: new Date().toISOString() };
    });

    // --- Skills ---
    app.get('/candidate/skills', async () => {
      const userId = await getUserId();
      const items = await service.getSkills(userId);
      return { status: 'ok', data: items, timestamp: new Date().toISOString() };
    });

    app.post('/candidate/skills', async (req, reply) => {
      const userId = await getUserId();
      const body = createSkillSchema.parse(req.body);
      const created = await service.createSkill(userId, body);
      reply.status(201);
      return { status: 'ok', data: created, timestamp: new Date().toISOString() };
    });

    app.put<{ Params: { id: string } }>('/candidate/skills/:id', async (req) => {
      const userId = await getUserId();
      const body = updateSkillSchema.parse(req.body);
      const updated = await service.updateSkill(userId, req.params.id, body);
      return { status: 'ok', data: updated, timestamp: new Date().toISOString() };
    });

    app.delete<{ Params: { id: string } }>('/candidate/skills/:id', async (req) => {
      const userId = await getUserId();
      await service.deleteSkill(userId, req.params.id);
      return { status: 'ok', data: { deleted: true }, timestamp: new Date().toISOString() };
    });

    // --- Languages ---
    app.get('/candidate/languages', async () => {
      const userId = await getUserId();
      const items = await service.getLanguages(userId);
      return { status: 'ok', data: items, timestamp: new Date().toISOString() };
    });

    app.post('/candidate/languages', async (req, reply) => {
      const userId = await getUserId();
      const body = createLanguageSchema.parse(req.body);
      const created = await service.createLanguage(userId, body);
      reply.status(201);
      return { status: 'ok', data: created, timestamp: new Date().toISOString() };
    });

    app.put<{ Params: { id: string } }>('/candidate/languages/:id', async (req) => {
      const userId = await getUserId();
      const body = updateLanguageSchema.parse(req.body);
      const updated = await service.updateLanguage(userId, req.params.id, body);
      return { status: 'ok', data: updated, timestamp: new Date().toISOString() };
    });

    app.delete<{ Params: { id: string } }>('/candidate/languages/:id', async (req) => {
      const userId = await getUserId();
      await service.deleteLanguage(userId, req.params.id);
      return { status: 'ok', data: { deleted: true }, timestamp: new Date().toISOString() };
    });

    // --- Certifications ---
    app.get('/candidate/certifications', async () => {
      const userId = await getUserId();
      const items = await service.getCertifications(userId);
      return { status: 'ok', data: items, timestamp: new Date().toISOString() };
    });

    app.post('/candidate/certifications', async (req, reply) => {
      const userId = await getUserId();
      const body = createCertificationSchema.parse(req.body);
      const created = await service.createCertification(userId, body);
      reply.status(201);
      return { status: 'ok', data: created, timestamp: new Date().toISOString() };
    });

    app.put<{ Params: { id: string } }>('/candidate/certifications/:id', async (req) => {
      const userId = await getUserId();
      const body = updateCertificationSchema.parse(req.body);
      const updated = await service.updateCertification(userId, req.params.id, body);
      return { status: 'ok', data: updated, timestamp: new Date().toISOString() };
    });

    app.delete<{ Params: { id: string } }>('/candidate/certifications/:id', async (req) => {
      const userId = await getUserId();
      await service.deleteCertification(userId, req.params.id);
      return { status: 'ok', data: { deleted: true }, timestamp: new Date().toISOString() };
    });

    // --- Links ---
    app.get('/candidate/links', async () => {
      const userId = await getUserId();
      const items = await service.getLinks(userId);
      return { status: 'ok', data: items, timestamp: new Date().toISOString() };
    });

    app.post('/candidate/links', async (req, reply) => {
      const userId = await getUserId();
      const body = createLinkSchema.parse(req.body);
      const created = await service.createLink(userId, body);
      reply.status(201);
      return { status: 'ok', data: created, timestamp: new Date().toISOString() };
    });

    app.put<{ Params: { id: string } }>('/candidate/links/:id', async (req) => {
      const userId = await getUserId();
      const body = updateLinkSchema.parse(req.body);
      const updated = await service.updateLink(userId, req.params.id, body);
      return { status: 'ok', data: updated, timestamp: new Date().toISOString() };
    });

    app.delete<{ Params: { id: string } }>('/candidate/links/:id', async (req) => {
      const userId = await getUserId();
      await service.deleteLink(userId, req.params.id);
      return { status: 'ok', data: { deleted: true }, timestamp: new Date().toISOString() };
    });

    // --- Candidate Facts ---
    app.get<{
      Querystring: {
        verificationStatus?: string;
        allowAiUseOnly?: string | boolean;
      };
    }>('/candidate/facts', async (req) => {
      const userId = await getUserId();
      const { verificationStatus, allowAiUseOnly } = req.query;
      const items = await service.getFacts(userId, {
        verificationStatus: verificationStatus?.trim() || undefined,
        allowAiUseOnly: allowAiUseOnly === true || allowAiUseOnly === 'true',
      });
      return { status: 'ok', data: items, timestamp: new Date().toISOString() };
    });

    app.post('/candidate/facts', async (req, reply) => {
      const userId = await getUserId();
      const body = createFactSchema.parse(req.body);
      const created = await service.createFact(userId, body);
      reply.status(201);
      return { status: 'ok', data: created, timestamp: new Date().toISOString() };
    });

    app.put<{ Params: { id: string } }>('/candidate/facts/:id', async (req) => {
      const userId = await getUserId();
      const body = updateFactSchema.parse(req.body);
      const updated = await service.updateFact(userId, req.params.id, body);
      return { status: 'ok', data: updated, timestamp: new Date().toISOString() };
    });

    app.delete<{ Params: { id: string } }>('/candidate/facts/:id', async (req) => {
      const userId = await getUserId();
      await service.deleteFact(userId, req.params.id);
      return { status: 'ok', data: { deleted: true }, timestamp: new Date().toISOString() };
    });

    // --- Documents ---
    app.get('/candidate/documents', async () => {
      const userId = await getUserId();
      const items = await service.getDocuments(userId);
      return { status: 'ok', data: items, timestamp: new Date().toISOString() };
    });

    app.post('/candidate/documents', async (req, reply) => {
      const userId = await getUserId();
      const data = await req.file();
      if (!data) {
        throw AppError.badRequest('No document file uploaded');
      }

      const buffer = await data.toBuffer();
      const fields = data.fields as Record<string, { value: unknown }>;

      const documentType = (fields.documentType?.value as string) || 'OTHER';
      const displayName = fields.displayName?.value as string | undefined;
      const roleFocus = fields.roleFocus?.value as string | undefined;
      const version = (fields.version?.value as string) || '1.0';
      const isMaster = fields.isMaster?.value === 'true' || documentType === 'MASTER_CV';

      const created = await service.uploadDocument(
        userId,
        buffer,
        {
          originalFilename: data.filename,
          mimeType: data.mimetype,
        },
        {
          documentType,
          displayName,
          roleFocus,
          version,
          isMaster,
        },
      );

      reply.status(201);
      return { status: 'ok', data: created, timestamp: new Date().toISOString() };
    });

    app.get<{ Params: { id: string } }>('/candidate/documents/:id/download', async (req, reply) => {
      const userId = await getUserId();
      const { doc, buffer } = await service.getDocumentById(userId, req.params.id);

      reply
        .header('Content-Type', doc.mimeType)
        .header(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(doc.originalFilename)}"`,
        )
        .header('Content-Length', buffer.length)
        .send(buffer);
    });

    app.delete<{ Params: { id: string } }>('/candidate/documents/:id', async (req) => {
      const userId = await getUserId();
      await service.deleteDocument(userId, req.params.id);
      return { status: 'ok', data: { deleted: true }, timestamp: new Date().toISOString() };
    });

    // --- Answer Library ---
    app.get('/candidate/answers', async () => {
      const userId = await getUserId();
      const items = await service.getAnswers(userId);
      return { status: 'ok', data: items, timestamp: new Date().toISOString() };
    });

    app.post('/candidate/answers', async (req, reply) => {
      const userId = await getUserId();
      const body = createAnswerSchema.parse(req.body);
      const created = await service.createAnswer(userId, body);
      reply.status(201);
      return { status: 'ok', data: created, timestamp: new Date().toISOString() };
    });

    app.put<{ Params: { id: string } }>('/candidate/answers/:id', async (req) => {
      const userId = await getUserId();
      const body = updateAnswerSchema.parse(req.body);
      const updated = await service.updateAnswer(userId, req.params.id, body);
      return { status: 'ok', data: updated, timestamp: new Date().toISOString() };
    });

    app.delete<{ Params: { id: string } }>('/candidate/answers/:id', async (req) => {
      const userId = await getUserId();
      await service.deleteAnswer(userId, req.params.id);
      return { status: 'ok', data: { deleted: true }, timestamp: new Date().toISOString() };
    });

    // --- Preferences ---
    app.get('/candidate/preferences', async () => {
      const userId = await getUserId();
      const prefs = await service.getPreferences(userId);
      return { status: 'ok', data: prefs, timestamp: new Date().toISOString() };
    });

    app.put('/candidate/preferences', async (req) => {
      const userId = await getUserId();
      const body = upsertPreferencesSchema.parse(req.body);
      const prefs = await service.upsertPreferences(userId, body);
      return { status: 'ok', data: prefs, timestamp: new Date().toISOString() };
    });

    // --- Application Policy ---
    app.get('/candidate/policy', async () => {
      const userId = await getUserId();
      const policy = await service.getPolicy(userId);
      return { status: 'ok', data: policy, timestamp: new Date().toISOString() };
    });

    app.put('/candidate/policy', async (req) => {
      const userId = await getUserId();
      const body = updatePolicySchema.parse(req.body);
      const policy = await service.updatePolicy(userId, body);
      return { status: 'ok', data: policy, timestamp: new Date().toISOString() };
    });
  };
}
