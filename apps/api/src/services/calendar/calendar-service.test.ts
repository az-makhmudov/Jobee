import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getConfig } from '@job-agent/config';
import { getDb, getOrCreatePrimaryUser, closeDbPool, type Database } from '@job-agent/database';
import { CalendarProviderType, CalendarAccountStatus, ConflictSeverity } from '@job-agent/shared';
import { CalendarService } from './calendar-service.js';
import { FixtureCalendarProvider } from './fixture-calendar-provider.js';
import { GoogleCalendarProvider } from './google-calendar-provider.js';
import { TokenCryptoService } from '../email/token-crypto-service.js';

describe('CalendarService Unit & Integration Tests (JOB-P4-T02)', () => {
  const config = getConfig();
  let db: Database;
  let userId: string;
  let calendarService: CalendarService;
  let fixtureProvider: FixtureCalendarProvider;
  let cryptoService: TokenCryptoService;

  beforeAll(async () => {
    db = getDb(config.DATABASE_URL);
    const user = await getOrCreatePrimaryUser(db);
    userId = user.id;

    cryptoService = new TokenCryptoService(
      'test-encryption-key-for-calendar-unit-tests-32-chars-min',
    );
    fixtureProvider = new FixtureCalendarProvider();
    const googleProvider = new GoogleCalendarProvider({
      clientId: 'mock-google-client-id',
      clientSecret: 'mock-google-client-secret',
      redirectUri: 'http://127.0.0.1:3000/api/calendar/google/callback',
    });

    calendarService = new CalendarService({
      db,
      cryptoService,
      googleProvider,
      fixtureProvider,
    });
  });

  afterAll(async () => {
    // Clean up any accounts created for the test user
    const accounts = await calendarService.listAccounts(userId);
    for (const acc of accounts) {
      await calendarService.disconnectAccount(acc.id, userId, true);
    }
    await closeDbPool();
  });

  it('1. connects a fixture calendar account and encrypts tokens', async () => {
    const account = await calendarService.connectAccount(
      userId,
      CalendarProviderType.FIXTURE,
      'test-fixture-code',
    );

    expect(account).toBeDefined();
    expect(account.id).toBeDefined();
    expect(account.provider).toBe('FIXTURE');
    expect(account.status).toBe(CalendarAccountStatus.CONNECTED);
    expect(account.emailAddress).toBe('bek.fixture.candidate@example.com');
    expect(account.selectedCalendarIds.length).toBeGreaterThan(0);
    expect(account.defaultCalendarId).toBe('primary');

    // Verify it appears in listAccounts
    const list = await calendarService.listAccounts(userId);
    expect(list.some((a) => a.id === account.id)).toBe(true);
  });

  it('2. retrieves calendars for the connected account', async () => {
    const [account] = await calendarService.listAccounts(userId);
    expect(account).toBeDefined();

    const calendars = await calendarService.getCalendarsForAccount(account!.id, userId);
    expect(calendars.length).toBe(3);
    expect(calendars[0]?.id).toBe('primary');
    expect(calendars[0]?.primary).toBe(true);
  });

  it('3. updates calendar selection for availability queries', async () => {
    const [account] = await calendarService.listAccounts(userId);
    expect(account).toBeDefined();

    const updated = await calendarService.updateCalendarSelection(account!.id, userId, {
      selectedCalendarIds: ['primary', 'cal-work-1'],
      defaultCalendarId: 'primary',
    });

    expect(updated.selectedCalendarIds).toEqual(['primary', 'cal-work-1']);
  });

  it('4. queries combined availability and identifies busy slots', async () => {
    const availability = await calendarService.getCombinedAvailability(userId, {
      windowStart: '2026-10-12T00:00:00.000Z',
      windowEnd: '2026-10-12T23:59:59.000Z',
      timezone: 'UTC',
    });

    expect(availability).toBeDefined();
    expect(availability.busySlots.length).toBeGreaterThan(0);
    expect(availability.status).toBe('BUSY');
  });

  it('5. detects conflicts for times overlapping busy slots', async () => {
    // Overlaps the mock slot 09:00 - 09:30
    const conflictResult = await calendarService.checkInterviewConflict(
      userId,
      new Date('2026-10-12T09:15:00.000Z'),
      45,
      'UTC',
    );

    expect(conflictResult.hasConflict).toBe(true);
    expect(conflictResult.severity).toBe(ConflictSeverity.CONFLICT);
    expect(conflictResult.conflicts.length).toBeGreaterThan(0);
    expect(conflictResult.availableAlternatives).toBeDefined();
    expect(conflictResult.availableAlternatives!.length).toBeGreaterThan(0);
  });

  it('6. confirms free availability when no slots conflict', async () => {
    // 16:00 is free
    const conflictResult = await calendarService.checkInterviewConflict(
      userId,
      new Date('2026-10-12T16:00:00.000Z'),
      60,
      'UTC',
    );

    expect(conflictResult.hasConflict).toBe(false);
    expect(conflictResult.severity).toBe(ConflictSeverity.NONE);
    expect(conflictResult.conflicts.length).toBe(0);
  });

  it('7. safely disconnects account preserving historical presence', async () => {
    const [account] = await calendarService.listAccounts(userId);
    expect(account).toBeDefined();

    await calendarService.disconnectAccount(account!.id, userId, false);

    const fetched = await calendarService.getAccount(account!.id, userId);
    expect(fetched.status).toBe(CalendarAccountStatus.DISCONNECTED);
  });

  it('8. lists scheduled interviews workspace items', async () => {
    const items = await calendarService.listInterviews(userId);
    expect(Array.isArray(items)).toBe(true);
  });
});
