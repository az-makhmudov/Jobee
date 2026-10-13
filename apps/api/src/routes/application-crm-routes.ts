import type { FastifyPluginAsync } from 'fastify';
import type { CandidateService } from '../services/candidate-service.js';
import { ApplicationCrmService } from '../services/application-crm-service.js';
import {
  createApplicationSchema,
  markAppliedSchema,
  transitionStatusSchema,
  updateNextActionSchema,
  addNoteSchema,
  createContactSchema,
  updateContactSchema,
  createAssessmentSchema,
  updateAssessmentSchema,
  createInterviewSchema,
  updateInterviewSchema,
  updateOfferSchema,
  listApplicationsQuerySchema,
} from './application-crm-schemas.js';
import { requireCurrentUserId } from '../plugins/auth-plugin.js';

export function createApplicationCrmRoutes(
  _candidateService?: CandidateService,
): FastifyPluginAsync {
  return async (app) => {
    const getUserId = async (req?: any) => requireCurrentUserId(req);

    // 1. Create or get application
    app.post('/applications', async (req: any, reply) => {
      const userId = await getUserId();
      const body = createApplicationSchema.parse(req.body);

      const result = await ApplicationCrmService.createOrGetApplication(userId, body);
      reply.status(result.isExisting ? 200 : 201);
      return {
        status: 'ok',
        data: result,
        timestamp: new Date().toISOString(),
      };
    });

    // 2. Metrics summary
    app.get('/applications/metrics', async () => {
      const userId = await getUserId();
      const metrics = await ApplicationCrmService.getMetrics(userId);
      return {
        status: 'ok',
        data: metrics,
        timestamp: new Date().toISOString(),
      };
    });

    // 3. Analytics (Funnel, Conversions, Time to Stage, Sources)
    app.get('/applications/analytics', async () => {
      const userId = await getUserId();
      const analytics = await ApplicationCrmService.getAnalytics(userId);
      return {
        status: 'ok',
        data: analytics,
        timestamp: new Date().toISOString(),
      };
    });

    // 4. List applications
    app.get('/applications', async (req: any) => {
      const userId = await getUserId();
      const query = listApplicationsQuerySchema.parse(req.query);

      const result = await ApplicationCrmService.listApplications(userId, query);
      return {
        status: 'ok',
        data: result.items,
        pagination: {
          total: result.total,
          limit: query.limit || 50,
          offset: query.offset || 0,
        },
        timestamp: new Date().toISOString(),
      };
    });

    // 5. Get application for specific job ID (helper for JobDetail / Studio)
    app.get('/jobs/:jobId/application', async (req: any) => {
      const userId = await getUserId();
      const { jobId } = req.params;

      const list = await ApplicationCrmService.listApplications(userId, { limit: 1 });
      const found = list.items.find((item) => item.jobId === jobId);

      return {
        status: 'ok',
        data: found || null,
        timestamp: new Date().toISOString(),
      };
    });

    // 6. Get single application detail
    app.get('/applications/:id', async (req: any) => {
      const userId = await getUserId();
      const { id } = req.params;

      const detail = await ApplicationCrmService.getApplicationDetail(userId, id);
      return {
        status: 'ok',
        data: detail,
        timestamp: new Date().toISOString(),
      };
    });

    // 7. Transition status
    app.post('/applications/:id/transition', async (req: any) => {
      const userId = await getUserId();
      const { id } = req.params;
      const body = transitionStatusSchema.parse(req.body);

      const updated = await ApplicationCrmService.transitionStatus(userId, id, body);
      return {
        status: 'ok',
        data: updated,
        timestamp: new Date().toISOString(),
      };
    });

    // 8. Mark as applied
    app.post('/applications/:id/mark-applied', async (req: any) => {
      const userId = await getUserId();
      const { id } = req.params;
      const body = markAppliedSchema.parse(req.body || {});

      const updated = await ApplicationCrmService.markApplied(userId, id, body);
      return {
        status: 'ok',
        data: updated,
        timestamp: new Date().toISOString(),
      };
    });

    // 9. Update next action & follow-up
    app.put('/applications/:id/next-action', async (req: any) => {
      const userId = await getUserId();
      const { id } = req.params;
      const body = updateNextActionSchema.parse(req.body);

      const updated = await ApplicationCrmService.updateNextAction(userId, id, body);
      return {
        status: 'ok',
        data: updated,
        timestamp: new Date().toISOString(),
      };
    });

    // 9b. Archive application (soft-hide from pipeline)
    app.post('/applications/:id/archive', async (req: any) => {
      const userId = await getUserId();
      const { id } = req.params;

      const updated = await ApplicationCrmService.archiveApplication(userId, id);
      return {
        status: 'ok',
        data: updated,
        timestamp: new Date().toISOString(),
      };
    });

    // 9c. Unarchive application (restore to pipeline)
    app.post('/applications/:id/unarchive', async (req: any) => {
      const userId = await getUserId();
      const { id } = req.params;

      const updated = await ApplicationCrmService.unarchiveApplication(userId, id);
      return {
        status: 'ok',
        data: updated,
        timestamp: new Date().toISOString(),
      };
    });

    // 9d. Purge application (deliberate privacy/cleanup hard delete)
    app.delete('/applications/:id/purge', async (req: any) => {
      const userId = await getUserId();
      const { id } = req.params;

      const result = await ApplicationCrmService.purgeApplication(userId, id);
      return {
        status: 'ok',
        data: result,
        timestamp: new Date().toISOString(),
      };
    });

    // 10. Notes: Add note
    app.post('/applications/:id/notes', async (req: any, reply) => {
      const userId = await getUserId();
      const { id } = req.params;
      const body = addNoteSchema.parse(req.body);

      const note = await ApplicationCrmService.addNote(userId, id, body);
      reply.status(201);
      return {
        status: 'ok',
        data: note,
        timestamp: new Date().toISOString(),
      };
    });

    // 11. Notes: Delete note
    app.delete('/applications/:id/notes/:noteId', async (req: any) => {
      const userId = await getUserId();
      const { id, noteId } = req.params;

      await ApplicationCrmService.deleteNote(userId, id, noteId);
      return {
        status: 'ok',
        data: { id: noteId, deleted: true },
        timestamp: new Date().toISOString(),
      };
    });

    // 12. Contacts: Add contact
    app.post('/applications/:id/contacts', async (req: any, reply) => {
      const userId = await getUserId();
      const { id } = req.params;
      const body = createContactSchema.parse(req.body);

      const contact = await ApplicationCrmService.addContact(userId, id, body);
      reply.status(201);
      return {
        status: 'ok',
        data: contact,
        timestamp: new Date().toISOString(),
      };
    });

    // 13. Contacts: Update contact
    app.put('/applications/:id/contacts/:contactId', async (req: any) => {
      const userId = await getUserId();
      const { id, contactId } = req.params;
      const body = updateContactSchema.parse(req.body);

      const contact = await ApplicationCrmService.updateContact(userId, id, contactId, body);
      return {
        status: 'ok',
        data: contact,
        timestamp: new Date().toISOString(),
      };
    });

    // 14. Contacts: Delete contact
    app.delete('/applications/:id/contacts/:contactId', async (req: any) => {
      const userId = await getUserId();
      const { id, contactId } = req.params;

      await ApplicationCrmService.deleteContact(userId, id, contactId);
      return {
        status: 'ok',
        data: { id: contactId, deleted: true },
        timestamp: new Date().toISOString(),
      };
    });

    // 15. Assessments: Add assessment
    app.post('/applications/:id/assessments', async (req: any, reply) => {
      const userId = await getUserId();
      const { id } = req.params;
      const body = createAssessmentSchema.parse(req.body);

      const assessment = await ApplicationCrmService.addAssessment(userId, id, body);
      reply.status(201);
      return {
        status: 'ok',
        data: assessment,
        timestamp: new Date().toISOString(),
      };
    });

    // 16. Assessments: Update assessment
    app.put('/applications/:id/assessments/:assessmentId', async (req: any) => {
      const userId = await getUserId();
      const { id, assessmentId } = req.params;
      const body = updateAssessmentSchema.parse(req.body);

      const assessment = await ApplicationCrmService.updateAssessment(
        userId,
        id,
        assessmentId,
        body,
      );
      return {
        status: 'ok',
        data: assessment,
        timestamp: new Date().toISOString(),
      };
    });

    // 17. Assessments: Delete assessment
    app.delete('/applications/:id/assessments/:assessmentId', async (req: any) => {
      const userId = await getUserId();
      const { id, assessmentId } = req.params;

      await ApplicationCrmService.deleteAssessment(userId, id, assessmentId);
      return {
        status: 'ok',
        data: { id: assessmentId, deleted: true },
        timestamp: new Date().toISOString(),
      };
    });

    // 18. Interviews: Add interview
    app.post('/applications/:id/interviews', async (req: any, reply) => {
      const userId = await getUserId();
      const { id } = req.params;
      const body = createInterviewSchema.parse(req.body);

      const interview = await ApplicationCrmService.addInterview(userId, id, body);
      reply.status(201);
      return {
        status: 'ok',
        data: interview,
        timestamp: new Date().toISOString(),
      };
    });

    // 19. Interviews: Update interview
    app.put('/applications/:id/interviews/:interviewId', async (req: any) => {
      const userId = await getUserId();
      const { id, interviewId } = req.params;
      const body = updateInterviewSchema.parse(req.body);

      const interview = await ApplicationCrmService.updateInterview(userId, id, interviewId, body);
      return {
        status: 'ok',
        data: interview,
        timestamp: new Date().toISOString(),
      };
    });

    // 20. Interviews: Delete interview
    app.delete('/applications/:id/interviews/:interviewId', async (req: any) => {
      const userId = await getUserId();
      const { id, interviewId } = req.params;

      await ApplicationCrmService.deleteInterview(userId, id, interviewId);
      return {
        status: 'ok',
        data: { id: interviewId, deleted: true },
        timestamp: new Date().toISOString(),
      };
    });

    // 21. Offers: Update offer
    app.put('/applications/:id/offer', async (req: any) => {
      const userId = await getUserId();
      const { id } = req.params;
      const body = updateOfferSchema.parse(req.body);

      const offer = await ApplicationCrmService.updateOffer(userId, id, body);
      return {
        status: 'ok',
        data: offer,
        timestamp: new Date().toISOString(),
      };
    });
  };
}
