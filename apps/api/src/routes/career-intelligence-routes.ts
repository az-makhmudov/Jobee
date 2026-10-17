import type { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import type { Database } from '@job-agent/database';
import {
  jobPreferences,
  candidateProfiles,
  candidateFacts,
  candidateExperiences,
  candidateEducation,
  candidateSkills,
  candidateCertifications,
  candidateLanguages,
  candidateProjects,
  candidateAuditEvents,
} from '@job-agent/database';
import { AppError } from '@job-agent/shared';
import { requireCurrentUserId } from '../plugins/auth-plugin.js';
import { CandidateIntelligenceContextBuilder } from '../services/career-intelligence/candidate-intelligence-context-builder.js';
import { CareerIntelligenceEnrichmentService } from '../services/career-intelligence/career-intelligence-enrichment-service.js';
import { CandidateJobFeedbackService } from '../services/career-intelligence/candidate-job-feedback-service.js';
import {
  clarifyIntelligenceSchema,
  runEnrichmentSchema,
  jobFeedbackSchema,
  updateLearnedPreferencesSchema,
} from './career-intelligence-schemas.js';

export function createCareerIntelligenceRoutes(
  db: Database,
  enrichmentService: CareerIntelligenceEnrichmentService,
  feedbackService: CandidateJobFeedbackService,
): FastifyPluginAsync {
  const contextBuilder = new CandidateIntelligenceContextBuilder(db);

  return async (app) => {
    const getUserId = (req?: any) => requireCurrentUserId(req);

    // 1. Get Candidate Intelligence Overview
    app.get('/candidate/intelligence', async (req) => {
      const userId = getUserId(req);
      const context = await contextBuilder.build(userId);
      const pendingSuggestions = await enrichmentService.listSuggestions(userId, 'PENDING');

      // Update aiSuggestedCount with live count
      const summary = {
        ...context.summary,
        aiSuggestedCount: pendingSuggestions.length,
      };

      return {
        summary,
        contextVersion: context.contextVersion,
        candidateStateHash: context.candidateStateHash,
      };
    });

    // 2. Answer a High-Impact Clarification Question
    app.post('/candidate/intelligence/clarify', async (req) => {
      const userId = getUserId(req);
      const parsed = clarifyIntelligenceSchema.safeParse(req.body);
      if (!parsed.success) {
        throw AppError.badRequest('Invalid clarification submission', {
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const { field, value } = parsed.data;

      await db.transaction(async (tx) => {
        if (field === 'workAuthorizationCountries') {
          const countries = Array.isArray(value) ? (value as string[]) : [String(value)];
          const [prefs] = await tx
            .select()
            .from(jobPreferences)
            .where(eq(jobPreferences.userId, userId));
          if (prefs) {
            await tx
              .update(jobPreferences)
              .set({ workAuthorizationCountries: countries, updatedAt: new Date() })
              .where(eq(jobPreferences.id, prefs.id));
          }
        } else if (field === 'needsSponsorship') {
          const needsSponsorship =
            value === true || value === 'true' || String(value).toLowerCase().includes('yes');
          const [prefs] = await tx
            .select()
            .from(jobPreferences)
            .where(eq(jobPreferences.userId, userId));
          if (prefs) {
            await tx
              .update(jobPreferences)
              .set({ needsSponsorship, updatedAt: new Date() })
              .where(eq(jobPreferences.id, prefs.id));
          }
        } else if (field === 'availability') {
          const availStr = String(value);
          await tx
            .update(candidateProfiles)
            .set({ availability: availStr, updatedAt: new Date() })
            .where(eq(candidateProfiles.userId, userId));

          const [prefs] = await tx
            .select()
            .from(jobPreferences)
            .where(eq(jobPreferences.userId, userId));
          if (prefs) {
            await tx
              .update(jobPreferences)
              .set({ availability: availStr, updatedAt: new Date() })
              .where(eq(jobPreferences.id, prefs.id));
          }
        } else if (field === 'minSalary') {
          const minSalary = Number(value);
          if (!isNaN(minSalary)) {
            const [prefs] = await tx
              .select()
              .from(jobPreferences)
              .where(eq(jobPreferences.userId, userId));
            if (prefs) {
              await tx
                .update(jobPreferences)
                .set({ minSalary, updatedAt: new Date() })
                .where(eq(jobPreferences.id, prefs.id));
            }
          }
        } else if (field.startsWith('fact:')) {
          const factId = field.replace('fact:', '');
          const isVerified =
            value === true ||
            value === 'VERIFIED' ||
            String(value).toLowerCase().includes('verify');
          await tx
            .update(candidateFacts)
            .set({
              verificationStatus: isVerified ? 'VERIFIED' : 'REJECTED',
              allowAiUse: isVerified,
              lastConfirmedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(and(eq(candidateFacts.id, factId), eq(candidateFacts.userId, userId)));
        }

        // Record audit event
        await tx.insert(candidateAuditEvents).values({
          userId,
          entityType: 'CLARIFICATION',
          entityId: field,
          action: 'CANDIDATE_CLARIFICATION_ANSWERED',
          actor: 'USER',
          changedFields: [field],
          metadata: { field, value },
        });
      });

      const updatedContext = await contextBuilder.build(userId);
      return {
        success: true,
        summary: updatedContext.summary,
      };
    });

    // 3. Trigger AI Enrichment from Documents
    app.post('/candidate/intelligence/enrich', async (req) => {
      const userId = getUserId(req);
      const parsed = runEnrichmentSchema.safeParse(req.body || {});
      if (!parsed.success) {
        throw AppError.badRequest('Invalid enrichment parameters');
      }

      const result = await enrichmentService.runEnrichment(userId, parsed.data.documentId);
      return result;
    });

    // 4. List Intelligence Suggestions
    app.get('/candidate/intelligence/suggestions', async (req) => {
      const userId = getUserId(req);
      const query = (req.query || {}) as Record<string, string>;
      const status = query.status as any;
      const suggestions = await enrichmentService.listSuggestions(userId, status);
      return { suggestions };
    });

    // 5. Apply a Suggestion
    app.post('/candidate/intelligence/suggestions/:id/apply', async (req) => {
      const userId = getUserId(req);
      const params = req.params as { id: string };
      const applied = await enrichmentService.applySuggestion(userId, params.id);
      return { success: true, suggestion: applied };
    });

    // 6. Dismiss a Suggestion
    app.post('/candidate/intelligence/suggestions/:id/dismiss', async (req) => {
      const userId = getUserId(req);
      const params = req.params as { id: string };
      const dismissed = await enrichmentService.dismissSuggestion(userId, params.id);
      return { success: true, suggestion: dismissed };
    });

    // 7. Record Job Feedback
    app.post('/jobs/:id/feedback', async (req) => {
      const userId = getUserId(req);
      const params = req.params as { id: string };
      const parsed = jobFeedbackSchema.safeParse(req.body);
      if (!parsed.success) {
        throw AppError.badRequest('Invalid job feedback submission', {
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const feedback = await feedbackService.recordFeedback(
        userId,
        params.id,
        parsed.data.feedbackType,
        parsed.data.notes,
      );

      return { success: true, feedback };
    });

    // 8. Get Feedback for Job
    app.get('/jobs/:id/feedback', async (req) => {
      const userId = getUserId(req);
      const params = req.params as { id: string };
      const feedback = await feedbackService.getFeedbackForJob(userId, params.id);
      return { feedback };
    });

    // 9. Get Learned Preferences
    app.get('/candidate/learned-preferences', async (req) => {
      const userId = getUserId(req);
      const learned = await feedbackService.getLearnedPreferences(userId);
      return { learnedPreferences: learned };
    });

    // 10. Update Learned Preferences
    app.put('/candidate/learned-preferences', async (req) => {
      const userId = getUserId(req);
      const parsed = updateLearnedPreferencesSchema.safeParse(req.body);
      if (!parsed.success) {
        throw AppError.badRequest('Invalid learned preferences update');
      }

      const updated = await feedbackService.updateLearnedPreferences(userId, parsed.data);
      return { success: true, learnedPreferences: updated };
    });

    // 11. Reset Learned Preferences
    app.post('/candidate/learned-preferences/reset', async (req) => {
      const userId = getUserId(req);
      const reset = await feedbackService.resetLearnedPreferences(userId);
      return { success: true, learnedPreferences: reset };
    });

    const getTableForEntity = (entityType: string) => {
      switch (entityType.toLowerCase()) {
        case 'experiences':
        case 'experience':
          return candidateExperiences;
        case 'education':
          return candidateEducation;
        case 'skills':
        case 'skill':
          return candidateSkills;
        case 'certifications':
        case 'certification':
          return candidateCertifications;
        case 'languages':
        case 'language':
          return candidateLanguages;
        case 'projects':
        case 'project':
          return candidateProjects;
        case 'facts':
        case 'fact':
          return candidateFacts;
        default:
          return null;
      }
    };

    // 12. Get Candidate Intelligence Records for Review & Authorization
    app.get('/candidate/intelligence/records', async (req) => {
      const userId = getUserId(req);
      const [exps, edus, sks, certs, langs, projs, fcts] = await Promise.all([
        db.select().from(candidateExperiences).where(eq(candidateExperiences.userId, userId)),
        db.select().from(candidateEducation).where(eq(candidateEducation.userId, userId)),
        db.select().from(candidateSkills).where(eq(candidateSkills.userId, userId)),
        db.select().from(candidateCertifications).where(eq(candidateCertifications.userId, userId)),
        db.select().from(candidateLanguages).where(eq(candidateLanguages.userId, userId)),
        db.select().from(candidateProjects).where(eq(candidateProjects.userId, userId)),
        db.select().from(candidateFacts).where(eq(candidateFacts.userId, userId)),
      ]);

      const records = {
        experiences: exps.map((e) => ({
          id: e.id,
          entityType: 'experiences',
          title: `${e.position} at ${e.organization}`,
          subtitle: `${e.startDate} — ${e.isCurrent ? 'Present' : e.endDate || 'N/A'}`,
          verificationStatus: e.verificationStatus,
          allowAiUse: e.allowAiUse,
          sourceReference: e.sourceReference,
          confidence: e.confidence,
          lastConfirmedAt: e.lastConfirmedAt,
        })),
        education: edus.map((ed) => ({
          id: ed.id,
          entityType: 'education',
          title: `${ed.degree || 'Degree'} in ${ed.fieldOfStudy || 'Studies'}`,
          subtitle: `${ed.institution} (${ed.startDate || ''} — ${ed.isCurrent ? 'Present' : ed.endDate || ''})`,
          verificationStatus: ed.verificationStatus,
          allowAiUse: ed.allowAiUse,
          sourceReference: ed.sourceReference,
          confidence: ed.confidence,
          lastConfirmedAt: ed.lastConfirmedAt,
        })),
        skills: sks.map((s) => ({
          id: s.id,
          entityType: 'skills',
          title: s.name,
          subtitle: `${s.category || 'General'} • Proficiency: ${s.proficiency || 'Not specified'}`,
          verificationStatus: s.verificationStatus,
          allowAiUse: s.allowAiUse,
          sourceReference: s.sourceReference,
          confidence: s.confidence,
          lastConfirmedAt: s.lastConfirmedAt,
        })),
        certifications: certs.map((c) => ({
          id: c.id,
          entityType: 'certifications',
          title: c.name,
          subtitle: `${c.issuingOrganization} • ${c.issueDate || 'Date N/A'}`,
          verificationStatus: c.verificationStatus,
          allowAiUse: c.allowAiUse,
          sourceReference: c.sourceReference,
          confidence: c.confidence,
          lastConfirmedAt: c.lastConfirmedAt,
        })),
        languages: langs.map((l) => ({
          id: l.id,
          entityType: 'languages',
          title: l.language,
          subtitle: `Proficiency: ${l.proficiency || 'Not specified'}${l.cefrLevel ? ` (${l.cefrLevel})` : ''}`,
          verificationStatus: l.verificationStatus,
          allowAiUse: l.allowAiUse,
          sourceReference: l.sourceReference,
          confidence: l.confidence,
          lastConfirmedAt: l.lastConfirmedAt,
        })),
        projects: projs.map((p) => ({
          id: p.id,
          entityType: 'projects',
          title: p.name,
          subtitle: p.role || 'Project',
          verificationStatus: p.verificationStatus,
          allowAiUse: p.allowAiUse,
          sourceReference: p.sourceReference,
          confidence: p.confidence,
          lastConfirmedAt: p.lastConfirmedAt,
        })),
        facts: fcts.map((f) => ({
          id: f.id,
          entityType: 'facts',
          title: f.factKey,
          subtitle: f.statement,
          verificationStatus: f.verificationStatus,
          allowAiUse: f.allowAiUse,
          sourceReference: f.sourceType
            ? `${f.sourceType}${f.sourceEntityId ? `:${f.sourceEntityId}` : ''}`
            : null,
          confidence: f.confidence,
          lastConfirmedAt: f.lastConfirmedAt,
        })),
      };

      const allItems = [
        ...records.experiences,
        ...records.education,
        ...records.skills,
        ...records.certifications,
        ...records.languages,
        ...records.projects,
        ...records.facts,
      ];

      return {
        records,
        counts: {
          total: allItems.length,
          verified: allItems.filter((i) => i.verificationStatus === 'VERIFIED').length,
          aiAuthorized: allItems.filter((i) => i.allowAiUse).length,
          unverified: allItems.filter((i) => i.verificationStatus !== 'VERIFIED').length,
        },
      };
    });

    // 13. Update Individual Record Verification & AI-Use Authorization
    app.patch('/candidate/intelligence/records/:entityType/:id', async (req) => {
      const userId = getUserId(req);
      const params = req.params as { entityType: string; id: string };
      const table = getTableForEntity(params.entityType);
      if (!table) {
        throw AppError.badRequest(`Unknown entity type: ${params.entityType}`);
      }

      const body = req.body as { verificationStatus?: string; allowAiUse?: boolean };

      const [existing] = await db
        .select()
        .from(table as any)
        .where(and(eq((table as any).id, params.id), eq((table as any).userId, userId)));

      if (!existing) {
        throw AppError.notFound(`Record ${params.id} not found`);
      }

      const currentStatus = body.verificationStatus ?? existing.verificationStatus;
      let targetAllowAiUse = body.allowAiUse !== undefined ? body.allowAiUse : existing.allowAiUse;

      // Invariant: Unverified or Rejected records CANNOT have allowAiUse = true
      if (currentStatus !== 'VERIFIED' && targetAllowAiUse === true) {
        throw AppError.badRequest(
          'Invariant violation: Records must have verificationStatus=VERIFIED before granting allowAiUse.',
        );
      }

      // If record is unverified or rejected, revoke AI use automatically
      if (currentStatus !== 'VERIFIED') {
        targetAllowAiUse = false;
      }

      const [updated] = await db
        .update(table as any)
        .set({
          ...(body.verificationStatus ? { verificationStatus: body.verificationStatus } : {}),
          allowAiUse: targetAllowAiUse,
          lastConfirmedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq((table as any).id, params.id), eq((table as any).userId, userId)))
        .returning();

      // Log immutable audit event
      await db.insert(candidateAuditEvents).values({
        userId,
        entityType: params.entityType.toUpperCase(),
        entityId: params.id,
        action: 'CANDIDATE_RECORD_AUTHORIZATION_UPDATED',
        actor: 'USER',
        changedFields: Object.keys(body),
        metadata: {
          verificationStatus: currentStatus,
          allowAiUse: targetAllowAiUse,
        },
      });

      return { success: true, record: updated };
    });

    // 14. Batch Update Record Authorizations
    app.post('/candidate/intelligence/records/batch-authorize', async (req) => {
      const userId = getUserId(req);
      const body = req.body as {
        items: Array<{
          entityType: string;
          id: string;
          verificationStatus?: string;
          allowAiUse?: boolean;
        }>;
      };

      if (!body.items || !Array.isArray(body.items)) {
        throw AppError.badRequest('Invalid batch authorization request: items array required');
      }

      let updatedCount = 0;

      await db.transaction(async (tx) => {
        for (const item of body.items) {
          const table = getTableForEntity(item.entityType);
          if (!table) continue;

          const [existing] = await tx
            .select()
            .from(table as any)
            .where(and(eq((table as any).id, item.id), eq((table as any).userId, userId)));

          if (!existing) continue;

          const currentStatus = item.verificationStatus ?? existing.verificationStatus;
          let targetAllowAiUse =
            item.allowAiUse !== undefined ? item.allowAiUse : existing.allowAiUse;

          if (currentStatus !== 'VERIFIED') {
            targetAllowAiUse = false;
          }

          await tx
            .update(table as any)
            .set({
              ...(item.verificationStatus ? { verificationStatus: item.verificationStatus } : {}),
              allowAiUse: targetAllowAiUse,
              lastConfirmedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(and(eq((table as any).id, item.id), eq((table as any).userId, userId)));

          await tx.insert(candidateAuditEvents).values({
            userId,
            entityType: item.entityType.toUpperCase(),
            entityId: item.id,
            action: 'CANDIDATE_RECORD_BATCH_AUTHORIZATION_UPDATED',
            actor: 'USER',
            changedFields: ['verificationStatus', 'allowAiUse'],
            metadata: {
              verificationStatus: currentStatus,
              allowAiUse: targetAllowAiUse,
            },
          });

          updatedCount++;
        }
      });

      return { success: true, updatedCount };
    });
  };
}
