import type { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import type { Database } from '@job-agent/database';
import {
  jobPreferences,
  candidateProfiles,
  candidateFacts,
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
            value === true ||
            value === 'true' ||
            String(value).toLowerCase().includes('yes');
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
  };
}
