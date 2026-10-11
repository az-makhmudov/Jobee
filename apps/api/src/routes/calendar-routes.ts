import type { FastifyPluginAsync } from 'fastify';
import { CalendarProviderType, AppError } from '@job-agent/shared';
import type { CandidateService } from '../services/candidate-service.js';
import type { CalendarService } from '../services/calendar/calendar-service.js';
import type { InterviewPreparationService } from '../services/calendar/interview-preparation-service.js';
import type { OAuthStateService } from '../services/email/oauth-state-service.js';
import {
  googleAuthUrlSchema,
  googleCallbackSchema,
  fixtureConnectSchema,
  calendarSelectionSchema,
  availabilityQuerySchema,
  checkConflictSchema,
  createCalendarEventSchema,
  generatePreparationSchema,
  updateHumanNotesSchema,
  updateChecklistSchema,
  updateDebriefSchema,
} from './calendar-schemas.js';
import { getCurrentUserId } from '../plugins/auth-plugin.js';

export interface CalendarRoutesOptions {
  candidateService: CandidateService;
  calendarService: CalendarService;
  prepService: InterviewPreparationService;
  oauthStateService: OAuthStateService;
}

export function createCalendarRoutes(options: CalendarRoutesOptions): FastifyPluginAsync {
  const { candidateService, calendarService, prepService, oauthStateService } = options;

  return async (app) => {
    const getUserId = async () => getCurrentUserId() ?? (await candidateService.getPrimaryUserId());

    // ─── Calendar Accounts ───────────────────────────────────────────────

    // 1. List connected calendar accounts
    app.get('/calendar/accounts', async () => {
      const userId = await getUserId();
      const accounts = await calendarService.listAccounts(userId);
      return { status: 'ok', data: accounts };
    });

    // 2. Connect fixture account (offline dev and test)
    app.post('/calendar/accounts/fixture/connect', async (req) => {
      const userId = await getUserId();
      fixtureConnectSchema.parse(req.body);
      const account = await calendarService.connectAccount(
        userId,
        CalendarProviderType.FIXTURE,
        'fixture-auth-code',
      );
      return { status: 'ok', data: account };
    });

    // 3. Generate Google Calendar OAuth URL
    app.get('/calendar/google/auth-url', async (req) => {
      const userId = await getUserId();
      const query = googleAuthUrlSchema.parse(req.query);
      const state = await oauthStateService.generateState(userId, 'CALENDAR_OAUTH');
      const authUrl = calendarService.getAuthorizationUrl(
        CalendarProviderType.GOOGLE,
        state,
        query.scopeLevel,
      );
      return { status: 'ok', data: { authUrl, state } };
    });

    // 4. Handle Google Calendar OAuth callback
    app.get('/calendar/google/callback', async (req, reply) => {
      const query = googleCallbackSchema.parse(req.query);
      const { userId: verifiedUserId } = await oauthStateService.verifyAndConsumeState(
        query.state,
        'CALENDAR_OAUTH',
      );

      const account = await calendarService.connectAccount(
        verifiedUserId,
        CalendarProviderType.GOOGLE,
        query.code,
      );

      return reply.send({
        status: 'ok',
        message: 'Google Calendar successfully connected',
        data: account,
      });
    });

    // 5. Get calendar account details
    app.get('/calendar/accounts/:id', async (req) => {
      const userId = await getUserId();
      const { id } = req.params as { id: string };
      const account = await calendarService.getAccount(id, userId);
      return { status: 'ok', data: account };
    });

    // 6. Disconnect or delete calendar account
    app.delete('/calendar/accounts/:id', async (req) => {
      const userId = await getUserId();
      const { id } = req.params as { id: string };
      const { purge } = req.query as { purge?: string };
      await calendarService.disconnectAccount(id, userId, purge === 'true');
      return { status: 'ok', message: 'Calendar account disconnected' };
    });

    // 7. List calendars for account
    app.get('/calendar/accounts/:id/calendars', async (req) => {
      const userId = await getUserId();
      const { id } = req.params as { id: string };
      const calendars = await calendarService.getCalendarsForAccount(id, userId);
      return { status: 'ok', data: calendars };
    });

    // 8. Update calendar selection
    app.patch('/calendar/accounts/:id/selection', async (req) => {
      const userId = await getUserId();
      const { id } = req.params as { id: string };
      const body = calendarSelectionSchema.parse(req.body);
      const updated = await calendarService.updateCalendarSelection(id, userId, body);
      return { status: 'ok', data: updated };
    });

    // ─── Availability & Conflict Checks ──────────────────────────────────

    // 9. Query combined availability across active calendars
    app.post('/calendar/availability', async (req) => {
      const userId = await getUserId();
      const body = availabilityQuerySchema.parse(req.body);
      const result = await calendarService.getCombinedAvailability(userId, body);
      return { status: 'ok', data: result };
    });

    // 10. Check interview scheduling conflicts
    app.post('/calendar/check-conflict', async (req) => {
      const userId = await getUserId();
      const body = checkConflictSchema.parse(req.body);
      const result = await calendarService.checkInterviewConflict(
        userId,
        new Date(body.scheduledAt),
        body.durationMinutes,
        body.timezone,
        body.excludeInterviewId,
      );
      return { status: 'ok', data: result };
    });

    // 11. Interview and calendar metrics
    app.get('/calendar/metrics', async () => {
      const userId = await getUserId();
      const metrics = await calendarService.getDashboardMetrics(userId);
      return { status: 'ok', data: metrics };
    });

    // 11b. List all scheduled interviews with calendar and brief status
    app.get('/calendar/interviews', async () => {
      const userId = await getUserId();
      const items = await calendarService.listInterviews(userId);
      return { status: 'ok', data: items };
    });

    // ─── Interview Calendar Event Booking ────────────────────────────────

    // 12. Book/link calendar event for an interview
    app.post('/applications/:applicationId/interviews/:interviewId/calendar-event', async (req) => {
      const userId = await getUserId();
      const { applicationId, interviewId } = req.params as {
        applicationId: string;
        interviewId: string;
      };
      const body = createCalendarEventSchema.parse(req.body);
      const result = await calendarService.createCalendarEventForInterview(
        userId,
        applicationId,
        interviewId,
        body,
      );
      return { status: 'ok', data: result };
    });

    // 13. Get linked calendar event
    app.get('/applications/:applicationId/interviews/:interviewId/calendar-event', async (req) => {
      const userId = await getUserId();
      const { interviewId } = req.params as { interviewId: string };
      const result = await calendarService.getInterviewCalendarLink(interviewId, userId);
      if (!result) {
        throw AppError.notFound(`No calendar event linked to interview ${interviewId}`);
      }
      return { status: 'ok', data: result };
    });

    // 14. Delete/unlink calendar event
    app.delete(
      '/applications/:applicationId/interviews/:interviewId/calendar-event',
      async (req) => {
        const userId = await getUserId();
        const { interviewId } = req.params as { interviewId: string };
        await calendarService.deleteInterviewCalendarEvent(interviewId, userId);
        return { status: 'ok', message: 'Calendar event unlinked and deleted' };
      },
    );

    // ─── Interview Preparation Briefs ────────────────────────────────────

    // 15. Generate / regenerate interview preparation brief
    app.post(
      '/applications/:applicationId/interviews/:interviewId/preparation-brief',
      async (req) => {
        const userId = await getUserId();
        const { interviewId } = req.params as { interviewId: string };
        const body = generatePreparationSchema.parse(req.body);
        const brief = await prepService.generatePreparationBrief(
          interviewId,
          userId,
          body?.forceRegenerate,
        );
        return { status: 'ok', data: brief };
      },
    );

    // 16. Get interview preparation brief
    app.get(
      '/applications/:applicationId/interviews/:interviewId/preparation-brief',
      async (req) => {
        const userId = await getUserId();
        const { interviewId } = req.params as { interviewId: string };
        const brief = await prepService.getPreparationBrief(interviewId, userId);
        if (!brief) {
          throw AppError.notFound(`No preparation brief found for interview ${interviewId}`);
        }
        return { status: 'ok', data: brief };
      },
    );

    // 17. Update human notes in preparation brief
    app.patch(
      '/applications/:applicationId/interviews/:interviewId/preparation-brief',
      async (req) => {
        const userId = await getUserId();
        const { interviewId } = req.params as { interviewId: string };
        const body = updateHumanNotesSchema.parse(req.body);
        const brief = await prepService.updateHumanNotes(interviewId, userId, body.humanNotes);
        return { status: 'ok', data: brief };
      },
    );

    // 18. Update checklist items
    app.patch('/applications/:applicationId/interviews/:interviewId/checklist', async (req) => {
      const userId = await getUserId();
      const { interviewId } = req.params as { interviewId: string };
      const body = updateChecklistSchema.parse(req.body);
      const brief = await prepService.updateChecklist(interviewId, userId, body.checklist);
      return { status: 'ok', data: brief };
    });

    // 19. Record post-interview debrief
    app.patch('/applications/:applicationId/interviews/:interviewId/debrief', async (req) => {
      const userId = await getUserId();
      const { interviewId } = req.params as { interviewId: string };
      const body = updateDebriefSchema.parse(req.body);
      const interview = await prepService.updateDebrief(interviewId, userId, body);
      return { status: 'ok', data: interview };
    });
  };
}
