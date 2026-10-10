import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import {
  closeDbPool,
  getDb,
  getOrCreatePrimaryUser,
  jobs,
  jobRequirements,
  applications,
  applicationInterviews,
  calendarAccounts,
  interviewCalendarLinks,
  interviewPreparationBriefs,
  eq,
  type Database,
} from '@job-agent/database';

describe('Calendar and Interview Routes Integration Tests (JOB-P4-T02)', () => {
  const config = getConfig();
  let app: ReturnType<typeof buildApp>;
  let db: Database;
  let userId: string;

  let testJobId: string;
  let testAppId: string;
  let testInterviewId: string;
  let connectedAccountId: string;

  beforeAll(async () => {
    app = buildApp({ config });
    await app.ready();

    db = getDb(config.DATABASE_URL);
    const user = await getOrCreatePrimaryUser(db);
    userId = user.id;

    // Create Job
    const [job] = await db
      .insert(jobs)
      .values({
        userId,
        title: 'Platform Tech Lead',
        company: 'Starlight Engineering',
        description: 'Seeking a Platform Tech Lead with TypeScript, Node.js, and cloud experience.',
        locationText: 'Remote',
        contentHash: 'hash-routes-calendar-test-1',
      })
      .returning();
    testJobId = job!.id;

    // Create Job Requirements
    await db.insert(jobRequirements).values([
      {
        jobId: testJobId,
        userId,
        rawText: 'TypeScript experience',
        normalizedText: 'TypeScript experience',
        requirementStrength: 'MANDATORY',
      },
    ]);

    // Create Application
    const [application] = await db
      .insert(applications)
      .values({
        userId,
        jobId: testJobId,
        status: 'INTERVIEW',
        source: 'MANUAL',
      })
      .returning();
    testAppId = application!.id;

    // Create Interview
    const [interview] = await db
      .insert(applicationInterviews)
      .values({
        applicationId: testAppId,
        userId,
        roundTitle: 'Executive Culture Round',
        interviewType: 'FINAL_ROUND',
        scheduledAt: new Date('2026-10-18T10:00:00.000Z'),
        durationMinutes: 45,
        interviewerName: 'Alex Thorne (COO)',
      })
      .returning();
    testInterviewId = interview!.id;
  });

  afterAll(async () => {
    // Teardown test records
    if (connectedAccountId) {
      await db.delete(calendarAccounts).where(eq(calendarAccounts.id, connectedAccountId));
    }
    if (testInterviewId) {
      await db
        .delete(interviewPreparationBriefs)
        .where(eq(interviewPreparationBriefs.interviewId, testInterviewId));
      await db
        .delete(interviewCalendarLinks)
        .where(eq(interviewCalendarLinks.interviewId, testInterviewId));
      await db.delete(applicationInterviews).where(eq(applicationInterviews.id, testInterviewId));
    }
    if (testAppId) {
      await db.delete(applications).where(eq(applications.id, testAppId));
    }
    if (testJobId) {
      await db.delete(jobRequirements).where(eq(jobRequirements.jobId, testJobId));
      await db.delete(jobs).where(eq(jobs.id, testJobId));
    }

    await app.close();
    await closeDbPool();
  });

  it('1. GET /api/calendar/accounts returns account list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/calendar/accounts',
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('2. POST /api/calendar/accounts/fixture/connect connects fixture account', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/calendar/accounts/fixture/connect',
      payload: {
        emailAddress: 'bek.fixture.candidate@example.com',
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
    expect(json.data.id).toBeDefined();
    expect(json.data.provider).toBe('FIXTURE');
    expect(json.data.status).toBe('CONNECTED');
    connectedAccountId = json.data.id;
  });

  it('3. GET /api/calendar/accounts/:id/calendars lists calendars for connected account', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/calendar/accounts/${connectedAccountId}/calendars`,
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
    expect(json.data.length).toBe(3);
    expect(json.data[0].id).toBe('primary');
  });

  it('4. PATCH /api/calendar/accounts/:id/selection updates selected calendars', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/calendar/accounts/${connectedAccountId}/selection`,
      payload: {
        selectedCalendarIds: ['primary', 'cal-work-1'],
        defaultCalendarId: 'primary',
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
    expect(json.data.selectedCalendarIds).toEqual(['primary', 'cal-work-1']);
  });

  it('5. POST /api/calendar/availability queries combined free/busy slots', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/calendar/availability',
      payload: {
        windowStart: '2026-10-12T00:00:00.000Z',
        windowEnd: '2026-10-12T23:59:59.000Z',
        timezone: 'UTC',
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
    expect(Array.isArray(json.data.busySlots)).toBe(true);
  });

  it('6. POST /api/calendar/check-conflict detects conflict for overlapping slot', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/calendar/check-conflict',
      payload: {
        scheduledAt: '2026-10-12T09:15:00.000Z',
        durationMinutes: 30,
        timezone: 'UTC',
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
    expect(json.data.hasConflict).toBe(true);
    expect(json.data.conflicts.length).toBeGreaterThan(0);
  });

  it('7. GET /api/calendar/metrics returns interview and calendar summary metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/calendar/metrics',
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
    expect(json.data.calendarConnected).toBe(true);
    expect(typeof json.data.upcomingInterviews).toBe('number');
  });

  it('8. POST /api/applications/:appId/interviews/:interviewId/calendar-event books event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/applications/${testAppId}/interviews/${testInterviewId}/calendar-event`,
      payload: {
        calendarId: 'primary',
        timezone: 'UTC',
        includePreparationNotes: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
    expect(json.data.link.interviewId).toBe(testInterviewId);
    expect(json.data.event.externalEventId).toBeDefined();
    expect(json.data.event.meetingUrl).toBeDefined();
  });

  it('9. GET /api/applications/:appId/interviews/:interviewId/calendar-event fetches event link', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/applications/${testAppId}/interviews/${testInterviewId}/calendar-event`,
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
    expect(json.data.link.interviewId).toBe(testInterviewId);
  });

  it('10. POST /api/applications/:appId/interviews/:interviewId/preparation-brief generates brief', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/applications/${testAppId}/interviews/${testInterviewId}/preparation-brief`,
      payload: {
        forceRegenerate: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
    expect(json.data.interviewId).toBe(testInterviewId);
    expect(json.data.roleSummary).toContain('Starlight Engineering');
    expect(json.data.preparationChecklist.length).toBe(6);
  });

  it('11. PATCH /api/applications/:appId/interviews/:interviewId/preparation-brief updates notes', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/applications/${testAppId}/interviews/${testInterviewId}/preparation-brief`,
      payload: {
        humanNotes: 'Emphasize architectural leadership and mentoring experience.',
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
    expect(json.data.humanNotes).toBe(
      'Emphasize architectural leadership and mentoring experience.',
    );
  });

  it('12. PATCH /api/applications/:appId/interviews/:interviewId/checklist updates checklist', async () => {
    const briefRes = await app.inject({
      method: 'GET',
      url: `/api/applications/${testAppId}/interviews/${testInterviewId}/preparation-brief`,
    });
    const currentChecklist = briefRes.json().data.preparationChecklist;
    currentChecklist[0].isCompleted = true;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/applications/${testAppId}/interviews/${testInterviewId}/checklist`,
      payload: {
        checklist: currentChecklist,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
    expect(json.data.preparationChecklist[0].isCompleted).toBe(true);
  });

  it('13. PATCH /api/applications/:appId/interviews/:interviewId/debrief records post-interview debrief', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/applications/${testAppId}/interviews/${testInterviewId}/debrief`,
      payload: {
        questionsAsked: 'Leadership style and handling distributed team synchronization',
        topicsDiscussed: 'Platform migration roadmap and engineering culture',
        candidateObservations: 'Alex was transparent about company direction and growth goals',
        followUpCommitments: 'Send written summary of architecture principles by tomorrow',
        expectedNextStep: 'Written offer letter',
        expectedResponseDate: '2026-10-22T17:00:00.000Z',
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
    expect(json.data.status).toBe('COMPLETED');
  });

  it('14. DELETE /api/applications/:appId/interviews/:interviewId/calendar-event unlinks event', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/applications/${testAppId}/interviews/${testInterviewId}/calendar-event`,
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
  });

  it('15. GET /api/calendar/interviews lists scheduled workspace interviews', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/calendar/interviews',
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
    expect(Array.isArray(json.data)).toBe(true);
    const match = json.data.find((item: any) => item.interview.id === testInterviewId);
    expect(match).toBeDefined();
    expect(match.application.companyName).toBe('Starlight Engineering');
  });
});
