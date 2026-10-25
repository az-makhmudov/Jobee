import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import {
  getDb,
  users,
  jobs,
  applications,
  applicationInterviews,
  emailAccounts,
  emailMessages,
  emailReviewItems,
  emailThreadLinks,
  calendarAccounts,
  applicationLifecycleEvents,
  eq,
  assertSafeTestDatabase,
  assertSafeTestUser,
} from '@job-agent/database';
import { getConfig } from '@job-agent/config';
import type { NormalizedEmailMessage } from '@job-agent/shared';
import { buildApp } from '../apps/api/src/app.js';
import { EmailSyncService } from '../apps/api/src/services/email/email-sync-service.js';
import { EmailReviewService } from '../apps/api/src/services/email/email-review-service.js';
import { EmailEntityResolver } from '../apps/api/src/services/email/email-entity-resolver.js';
import { FixtureEmailProvider } from '../apps/api/src/services/email/fixture-email-provider.js';
import { TokenCryptoService } from '../apps/api/src/services/email/token-crypto-service.js';
import { OAuthStateService } from '../apps/api/src/services/email/oauth-state-service.js';
import { CalendarService } from '../apps/api/src/services/calendar/calendar-service.js';
import { FixtureCalendarProvider } from '../apps/api/src/services/calendar/fixture-calendar-provider.js';
import { ApplicationCrmService } from '../apps/api/src/services/application-crm-service.js';
import type { ClassificationResult } from '../apps/api/src/services/email/deterministic-email-classifier.js';
const db = getDb(process.env.DATABASE_URL);
const config = getConfig();
const cryptoService = new TokenCryptoService(config.EMAIL_TOKEN_ENCRYPTION_KEY);
let userId: string,
  otherId: string,
  appId: string,
  foreignId: string,
  interviewId: string,
  emailId: string,
  calendarId: string;
let email: EmailSyncService,
  calendar: CalendarService,
  provider: FixtureEmailProvider,
  calProvider: FixtureCalendarProvider;
let classification: ClassificationResult, msg: NormalizedEmailMessage;
let app: ReturnType<typeof buildApp>;
const headers = () => ({ 'x-test-user-id': userId });
const book = () =>
  calendar.createCalendarEventForInterview(userId, appId, interviewId, {
    calendarId: 'primary',
    timezone: 'Europe/Warsaw',
    userConfirmed: true,
  });
beforeEach(async () => {
  assertSafeTestDatabase();
  const created = await db
    .insert(users)
    .values([
      { name: 'Connected fixture', email: `connected-${crypto.randomUUID()}@example.test` },
      {
        name: 'Other connected fixture',
        email: `connected-other-${crypto.randomUUID()}@example.test`,
      },
    ])
    .returning();
  userId = created[0]!.id;
  otherId = created[1]!.id;
  assertSafeTestUser(userId);
  assertSafeTestUser(otherId);
  const fixtures = await db
    .insert(jobs)
    .values([
      {
        userId,
        title: 'Software Engineer',
        company: 'Fixture Labs',
        description: 'Synthetic engineering vacancy',
        contentHash: crypto.randomUUID(),
      },
      {
        userId: otherId,
        title: 'Other Engineer',
        company: 'Other Fixture',
        description: 'Synthetic other vacancy',
        contentHash: crypto.randomUUID(),
      },
    ])
    .returning();
  const apps = await db
    .insert(applications)
    .values([
      {
        userId,
        jobId: fixtures[0]!.id,
        status: 'APPLIED',
        appliedAt: new Date(),
        externalReferenceId: 'FIXTURE-REF-12345',
      },
      { userId: otherId, jobId: fixtures[1]!.id, status: 'APPLIED' },
    ])
    .returning();
  appId = apps[0]!.id;
  foreignId = apps[1]!.id;
  const [interview] = await db
    .insert(applicationInterviews)
    .values({
      userId,
      applicationId: appId,
      roundTitle: 'Fixture interview',
      interviewType: 'TECHNICAL',
      status: 'SCHEDULED',
      scheduledAt: new Date('2026-11-01T12:00:00Z'),
      timezone: 'Europe/Warsaw',
      durationMinutes: 45,
      notes: 'Private candidate notes',
    })
    .returning();
  interviewId = interview!.id;
  msg = {
    externalId: crypto.randomUUID(),
    externalThreadId: crypto.randomUUID(),
    from: { name: 'Fixture recruiter', email: 'recruiter@fixture.example' },
    to: ['candidate@example.test'],
    subject: 'Application update',
    plainText: 'Synthetic employer message',
    receivedAt: new Date(),
    provider: 'FIXTURE',
  };
  classification = {
    classification: 'APPLICATION_CONFIRMATION',
    confidence: 0.9,
    reason: 'Fixture classification',
    extractedDetails: { externalReferenceId: 'FIXTURE-REF-12345' },
  };
  provider = new FixtureEmailProvider([msg]);
  email = new EmailSyncService(
    { ...config, AI_PROVIDER: 'disabled' },
    {
      db,
      fixtureProvider: provider,
      classificationEngine: { classifyMessage: async () => classification },
    },
  );
  const [account] = await db
    .insert(emailAccounts)
    .values({
      userId,
      provider: 'FIXTURE',
      emailAddress: `mail-${crypto.randomUUID()}@example.test`,
      encryptedTokens: cryptoService.encrypt({ accessToken: 'fixture-only' }),
      grantedScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    })
    .returning();
  emailId = account!.id;
  calProvider = new FixtureCalendarProvider({
    emailAddress: `calendar-${crypto.randomUUID()}@example.test`,
  });
  calendar = new CalendarService({
    db,
    cryptoService,
    googleProvider: calProvider,
    fixtureProvider: calProvider,
  });
  calendarId = (await calendar.connectAccount(userId, 'FIXTURE', 'fixture', 'EVENT_MANAGEMENT')).id;
  app = buildApp({
    config: { ...config, NODE_ENV: 'test', AI_PROVIDER: 'disabled' },
    db,
    emailSyncService: email,
    calendarService: calendar,
    fixtureCalendarProvider: calProvider,
  });
  await app.ready();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await app?.close();
  for (const id of [userId, otherId])
    if (id) {
      assertSafeTestUser(id);
      await db.delete(users).where(eq(users.id, id));
    }
});
it.each([0.85, 0.89, 0.8999])(
  'routes confirmation confidence %s to review rather than changing lifecycle',
  async (confidence) => {
    classification.confidence = confidence;
    const result = await email.syncAccount(userId, emailId);
    expect(result.autoSyncedCount).toBe(0);
    expect(result.reviewItemsCreated).toBe(1);
    expect(
      (await db.select().from(applications).where(eq(applications.id, appId)))[0]!.status,
    ).toBe('APPLIED');
  },
);
it('accepts exactly .90 with an owned exact reference and replays without duplicate events', async () => {
  expect((await email.syncAccount(userId, emailId)).autoSyncedCount).toBe(1);
  expect((await email.syncAccount(userId, emailId)).messagesIngested).toBe(0);
  expect(
    await db
      .select()
      .from(applicationLifecycleEvents)
      .where(eq(applicationLifecycleEvents.applicationId, appId)),
  ).toHaveLength(1);
});
it.each([
  'ASSESSMENT_REQUEST',
  'INTERVIEW_REQUEST',
  'INTERVIEW_CONFIRMATION',
  'SCREENING_REQUEST',
] as const)('keeps %s below .90 in review', async (type) => {
  classification.classification = type;
  classification.confidence = 0.89;
  expect((await email.syncAccount(userId, emailId)).reviewItemsCreated).toBe(1);
});
it('does not promote fuzzy company hints into trusted thread memory', async () => {
  classification.extractedDetails = { company: 'Fixture' };
  classification.confidence = 0.99;
  expect((await email.syncAccount(userId, emailId)).reviewItemsCreated).toBe(1);
  expect(
    await db.select().from(emailThreadLinks).where(eq(emailThreadLinks.accountId, emailId)),
  ).toHaveLength(0);
});
it('requires an unambiguous exact company/role before automatic lifecycle enrichment', async () => {
  classification.extractedDetails = { company: 'Fixture Labs', role: 'Software Engineer' };
  expect((await email.syncAccount(userId, emailId)).autoSyncedCount).toBe(1);
});
it('does not trust legacy automatic thread guesses or attach another owner through thread memory', async () => {
  await db.insert(emailThreadLinks).values({
    userId,
    accountId: emailId,
    providerThreadId: msg.externalThreadId!,
    applicationId: foreignId,
    confirmedBy: 'AUTO',
  });
  classification.extractedDetails = {};
  expect(
    (
      await EmailEntityResolver.resolve({
        userId,
        accountId: emailId,
        message: msg,
        classification,
        db,
      })
    ).applicationId,
  ).not.toBe(foreignId);
  expect((await email.syncAccount(userId, emailId)).reviewItemsCreated).toBe(1);
});
it.each([
  ['APPLICATION_REJECTION', 0.94],
  ['OFFER_RELATED', 1],
  ['RECRUITER_OUTREACH', 1],
] as const)('retains conservative review for %s', async (type, confidence) => {
  classification.classification = type;
  classification.confidence = confidence;
  expect((await email.syncAccount(userId, emailId)).autoSyncedCount).toBe(0);
});
it('allows a .95 exact-reference rejection with its audit source', async () => {
  classification.classification = 'APPLICATION_REJECTION';
  classification.confidence = 0.95;
  expect((await email.syncAccount(userId, emailId)).autoSyncedCount).toBe(1);
  expect((await db.select().from(applications).where(eq(applications.id, appId)))[0]!.status).toBe(
    'REJECTED',
  );
});
it('rolls lifecycle changes back with message persistence on a partial processing failure', async () => {
  const transition = ApplicationCrmService.transitionStatus.bind(ApplicationCrmService);
  vi.spyOn(ApplicationCrmService, 'transitionStatus').mockImplementationOnce(async (...args) => {
    await transition(...args);
    throw Error('fixture interrupted transaction');
  });
  await expect(email.syncAccount(userId, emailId)).rejects.toThrow();
  expect((await db.select().from(applications).where(eq(applications.id, appId)))[0]!.status).toBe(
    'APPLIED',
  );
  expect(
    await db.select().from(emailMessages).where(eq(emailMessages.userId, userId)),
  ).toHaveLength(0);
  expect((await email.syncAccount(userId, emailId)).autoSyncedCount).toBe(1);
});
it('cannot resurrect a disconnected account or ingest messages after an in-flight fetch returns', async () => {
  vi.spyOn(provider, 'fetchMessages').mockImplementationOnce(async () => {
    await db
      .update(emailAccounts)
      .set({
        status: 'DISCONNECTED',
        isSyncing: false,
        syncLockedAt: null,
        encryptedTokens: cryptoService.encrypt({ revoked: true }),
      })
      .where(eq(emailAccounts.id, emailId));
    return { messages: [msg], hasMore: false };
  });
  await expect(email.syncAccount(userId, emailId)).rejects.toThrow('permission changed');
  expect(
    (await db.select().from(emailAccounts).where(eq(emailAccounts.id, emailId)))[0]!.status,
  ).toBe('DISCONNECTED');
  expect(
    await db.select().from(emailMessages).where(eq(emailMessages.userId, userId)),
  ).toHaveLength(0);
});
it('serializes review resolution, rejects foreign overrides and never links a dismissed item', async () => {
  classification.confidence = 0.89;
  await email.syncAccount(userId, emailId);
  const [review] = await db
    .select()
    .from(emailReviewItems)
    .where(eq(emailReviewItems.userId, userId));
  const service = new EmailReviewService(db);
  await expect(
    service.resolveReviewItem(userId, review!.id, 'APPROVED', { overrideApplicationId: foreignId }),
  ).rejects.toThrow('not found');
  const results = await Promise.allSettled([
    service.resolveReviewItem(userId, review!.id, 'DISMISSED', { overrideApplicationId: appId }),
    service.resolveReviewItem(userId, review!.id, 'DISMISSED'),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(
    await db.select().from(emailThreadLinks).where(eq(emailThreadLinks.accountId, emailId)),
  ).toHaveLength(0);
});
it('returns the exact resolved review and updates only its owned application', async () => {
  classification.confidence = 0.89;
  await email.syncAccount(userId, emailId);
  const [review] = await db
    .select()
    .from(emailReviewItems)
    .where(eq(emailReviewItems.userId, userId));
  const result = await new EmailReviewService(db).resolveReviewItem(userId, review!.id, 'APPROVED');
  expect(result.id).toBe(review!.id);
  expect((await db.select().from(applications).where(eq(applications.id, appId)))[0]!.status).toBe(
    'CONFIRMATION_RECEIVED',
  );
});
it('filters application messages/review/interviews on the server and enforces the parent application', async () => {
  classification.confidence = 0.89;
  await email.syncAccount(userId, emailId);
  expect(
    (
      await app.inject({
        url: `/api/email/messages?linkedApplicationId=${appId}`,
        headers: headers(),
      })
    ).json().data,
  ).toHaveLength(1);
  expect(
    (
      await app.inject({
        url: `/api/email/review-queue?applicationId=${foreignId}`,
        headers: headers(),
      })
    ).json().data,
  ).toHaveLength(0);
  expect(
    (
      await app.inject({
        url: `/api/calendar/interviews?applicationId=${appId}`,
        headers: headers(),
      })
    ).json().data,
  ).toHaveLength(1);
  expect(
    (
      await app.inject({
        url: `/api/applications/${foreignId}/interviews/${interviewId}/preparation-brief`,
        headers: headers(),
      })
    ).statusCode,
  ).toBe(404);
});
it('rejects calendar creation without explicit confirmation or event-management permission', async () => {
  const create = vi.spyOn(calProvider, 'createEvent');
  await expect(
    calendar.createCalendarEventForInterview(userId, appId, interviewId, {
      calendarId: 'primary',
      timezone: 'UTC',
      userConfirmed: false,
    }),
  ).rejects.toThrow('Confirm');
  await db
    .update(calendarAccounts)
    .set({ scopeLevel: 'AVAILABILITY' })
    .where(eq(calendarAccounts.id, calendarId));
  await expect(book()).rejects.toThrow();
  expect(create).not.toHaveBeenCalled();
});
it('books only once under concurrency and does not include private notes or invent a meeting URL', async () => {
  const create = vi.spyOn(calProvider, 'createEvent');
  const results = await Promise.allSettled([book(), book()]);
  expect(create).toHaveBeenCalledTimes(1);
  expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
  const saved = results.find((r) => r.status === 'fulfilled');
  if (saved?.status === 'fulfilled') {
    expect(saved.value.event.description).not.toContain('Private candidate notes');
    expect(saved.value.event.meetingUrl).toBeUndefined();
  }
});
it('persists an uncertain calendar creation and requires human reconciliation before retry', async () => {
  vi.spyOn(calProvider, 'createEvent').mockRejectedValueOnce(Error('fixture connection lost'));
  await expect(book()).rejects.toThrow('may have occurred');
  await expect(book()).rejects.toThrow('verification');
  expect(
    (
      await db.select().from(applicationInterviews).where(eq(applicationInterviews.id, interviewId))
    )[0]!.schedulingStatus,
  ).toBe('EVENT_UNCERTAIN');
  await calendar.reconcileCalendarCreation(
    userId,
    appId,
    interviewId,
    'Checked the synthetic provider: no event was created.',
  );
  expect((await book()).event.externalEventId).toBeTruthy();
});
it('does not overwrite disconnect when a calendar token refresh completes later', async () => {
  await db
    .update(calendarAccounts)
    .set({ tokenExpiresAt: new Date(0) })
    .where(eq(calendarAccounts.id, calendarId));
  const neutral = cryptoService.encrypt({ disconnected: true });
  vi.spyOn(calProvider, 'refreshTokens').mockImplementationOnce(async () => {
    await db
      .update(calendarAccounts)
      .set({ status: 'DISCONNECTED', encryptedTokens: neutral })
      .where(eq(calendarAccounts.id, calendarId));
    return {
      tokens: { accessToken: 'fixture-refreshed' },
      tokenExpiresAt: new Date(Date.now() + 60000),
    };
  });
  await expect(calendar.getCalendarsForAccount(calendarId, userId)).rejects.toThrow(
    're-authentication',
  );
  const [account] = await db
    .select()
    .from(calendarAccounts)
    .where(eq(calendarAccounts.id, calendarId));
  expect(account!.status).toBe('DISCONNECTED');
  expect(account!.encryptedTokens).toBe(neutral);
});
it('binds OAuth scope selection to signed, one-time state across service instances', async () => {
  const states = new OAuthStateService(config.BETTER_AUTH_SECRET, db);
  const token = await states.generateState(userId, 'CALENDAR_OAUTH', 60_000, 'AVAILABILITY');
  const verified = await new OAuthStateService(config.BETTER_AUTH_SECRET, db).verifyAndConsumeState(
    token,
    'CALENDAR_OAUTH',
  );
  expect(verified.scopeLevel).toBe('AVAILABILITY');
  await expect(states.verifyAndConsumeState(token, 'CALENDAR_OAUTH')).rejects.toThrow('consumed');
});
it('validates timezone, bounded availability windows and calendar write confirmation at the route boundary', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/applications/${appId}/interviews/${interviewId}/calendar-event`,
    headers: headers(),
    payload: { calendarId: 'primary', timezone: 'invalid/zone' },
  });
  expect(response.statusCode).toBe(400);
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/calendar/availability',
        headers: headers(),
        payload: {
          windowStart: '2026-11-02T12:00:00Z',
          windowEnd: '2026-11-01T12:00:00Z',
          timezone: 'UTC',
        },
      })
    ).statusCode,
  ).toBe(400);
});

it('routes a terminal rejection conflict to review without losing the message', async () => {
  await db.update(applications).set({ status: 'WITHDRAWN' }).where(eq(applications.id, appId));
  classification.classification = 'APPLICATION_REJECTION';
  classification.confidence = 0.99;
  const result = await email.syncAccount(userId, emailId);
  expect(result.reviewItemsCreated).toBe(1);
  expect(result.messagesIngested).toBe(1);
  expect((await db.select().from(applications).where(eq(applications.id, appId)))[0]!.status).toBe(
    'WITHDRAWN',
  );
});
it('creates a conference only after explicit opt-in and preserves an existing employer URL', async () => {
  const spy = vi.spyOn(calProvider, 'createEvent');
  await db
    .update(applicationInterviews)
    .set({ meetingUrl: 'https://employer.example/interview' })
    .where(eq(applicationInterviews.id, interviewId));
  await calendar.createCalendarEventForInterview(userId, appId, interviewId, {
    calendarId: 'primary',
    timezone: 'Europe/Warsaw',
    userConfirmed: true,
    createConference: true,
  });
  expect(spy.mock.calls[0]![2].createConference).toBe(false);
  expect(spy.mock.calls[0]![2].meetingUrl).toBe('https://employer.example/interview');
});
it('permits a new conference when explicitly selected without an employer URL', async () => {
  const spy = vi.spyOn(calProvider, 'createEvent');
  await calendar.createCalendarEventForInterview(userId, appId, interviewId, {
    calendarId: 'primary',
    timezone: 'Europe/Warsaw',
    userConfirmed: true,
    createConference: true,
  });
  expect(spy.mock.calls[0]![2].createConference).toBe(true);
});
it('uses the primary alias without expanding Google grants or calling an unauthorized calendar-list API', async () => {
  const list = vi.spyOn(calProvider, 'getCalendars');
  const connected = await calendar.connectAccount(
    userId,
    'GOOGLE',
    'fixture-only',
    'EVENT_MANAGEMENT',
  );
  expect(connected.defaultCalendarId).toBe('primary');
  expect(connected.selectedCalendarIds).toEqual(['primary']);
  expect(list).not.toHaveBeenCalled();
  await expect(calendar.getCalendarsForAccount(connected.id, userId)).rejects.toThrow(
    'Calendar-list access was not granted',
  );
  expect(list).not.toHaveBeenCalled();
});

it('does not expose raw provider diagnostics through a failed synchronization', async () => {
  vi.spyOn(provider, 'fetchMessages').mockRejectedValue(
    new Error('provider response contains synthetic-secret-123'),
  );
  await expect(email.syncAccount(userId, emailId)).rejects.toThrow('Email synchronization failed');
  const [account] = await db.select().from(emailAccounts).where(eq(emailAccounts.id, emailId));
  expect(account!.errorMessage).not.toContain('synthetic-secret-123');
});

it('reviews recruiter outreach without pretending to create a vacancy or contact', async () => {
  classification.classification = 'RECRUITER_OUTREACH';
  await email.syncAccount(userId, emailId);
  const [item] = await db
    .select()
    .from(emailReviewItems)
    .where(eq(emailReviewItems.userId, userId));
  expect(item!.proposedAction).toBe('NONE');
  await new EmailReviewService(db).resolveReviewItem(userId, item!.id, 'APPROVED');
  expect(await db.select().from(jobs).where(eq(jobs.userId, userId))).toHaveLength(1);
});

it('returns successful calendar consent to Jobee without exposing the account payload', async () => {
  const state = await new OAuthStateService(config.EMAIL_TOKEN_ENCRYPTION_KEY, db).generateState(
    userId,
    'CALENDAR_OAUTH',
    900000,
    'AVAILABILITY',
  );
  const response = await app.inject({
    method: 'GET',
    url: '/api/calendar/google/callback?code=fixture-only&state=' + encodeURIComponent(state),
  });
  expect(response.statusCode).toBe(302);
  const target = new URL(response.headers.location!);
  expect(target.origin).toBe(new URL(config.WEB_ORIGIN).origin);
  expect(target.searchParams.get('connected')).toBe('true');
  expect(response.body).not.toContain('encryptedTokens');
  expect(
    (
      await app.inject({
        method: 'GET',
        url: '/api/calendar/google/callback?code=fixture-only&state=' + encodeURIComponent(state),
      })
    ).statusCode,
  ).toBe(400);
});
it('returns declined calendar consent to a recoverable app screen without making a provider call', async () => {
  const exchange = vi.spyOn(calProvider, 'exchangeCodeForTokens');
  const state = await new OAuthStateService(config.EMAIL_TOKEN_ENCRYPTION_KEY, db).generateState(
    userId,
    'CALENDAR_OAUTH',
    900000,
    'AVAILABILITY',
  );
  const response = await app.inject({
    method: 'GET',
    url: '/api/calendar/google/callback?error=access_denied&state=' + encodeURIComponent(state),
  });
  expect(response.statusCode).toBe(302);
  expect(new URL(response.headers.location!).searchParams.get('connectionError')).toBe(
    'calendar_denied',
  );
  expect(exchange).not.toHaveBeenCalled();
});
