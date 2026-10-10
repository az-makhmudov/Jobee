import {
  CalendarProviderType,
  type CalendarInfo,
  type BusySlot,
  type CalendarEventDto,
  type CreateCalendarEventRequest,
  type UpdateCalendarEventRequest,
} from '@job-agent/shared';
import type {
  CalendarProvider,
  CalendarOAuthTokens,
  CalendarTokenExchangeResult,
} from './calendar-provider.js';

export interface FixtureCalendarConfig {
  emailAddress?: string;
  defaultTimezone?: string;
}

export class FixtureCalendarProvider implements CalendarProvider {
  public readonly name = 'FIXTURE' as const;
  public readonly isConfigured = true;

  private emailAddress: string;
  private defaultTimezone: string;
  private events: Map<string, CalendarEventDto> = new Map();
  private mockBusySlots: BusySlot[] = [];

  constructor(config: FixtureCalendarConfig = {}) {
    this.emailAddress = config.emailAddress || 'bek.fixture.candidate@example.com';
    this.defaultTimezone = config.defaultTimezone || 'UTC';
    this.resetFixtures();
  }

  public resetFixtures(): void {
    this.events.clear();
    // Default preset busy slots for realistic availability tests (e.g. daily standup 09:00-09:30 UTC)
    this.mockBusySlots = [
      {
        start: '2026-10-12T09:00:00.000Z',
        end: '2026-10-12T09:30:00.000Z',
        calendarId: 'cal-work-1',
      },
      {
        start: '2026-10-12T13:00:00.000Z',
        end: '2026-10-12T14:00:00.000Z',
        calendarId: 'primary',
      },
    ];
  }

  public addMockBusySlot(slot: BusySlot): void {
    this.mockBusySlots.push(slot);
  }

  public getAuthorizationUrl(
    state: string,
    scopeLevel: 'AVAILABILITY' | 'EVENT_MANAGEMENT',
  ): string {
    return `http://127.0.0.1:3000/api/calendar/fixture/callback?code=fixture-auth-code&state=${encodeURIComponent(state)}&scopeLevel=${scopeLevel}`;
  }

  public async exchangeCodeForTokens(_code: string): Promise<CalendarTokenExchangeResult> {
    const expiresAt = new Date(Date.now() + 86400 * 1000);
    return {
      tokens: {
        accessToken: 'fixture-cal-access-token-xyz',
        refreshToken: 'fixture-cal-refresh-token-abc',
        tokenType: 'Bearer',
        expiresAt: expiresAt.toISOString(),
        scopes: [
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/calendar.freebusy',
        ],
      },
      emailAddress: this.emailAddress,
      grantedScopes: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.freebusy',
      ],
      tokenExpiresAt: expiresAt,
    };
  }

  public async refreshTokens(
    tokens: CalendarOAuthTokens,
  ): Promise<{ tokens: CalendarOAuthTokens; tokenExpiresAt?: Date }> {
    const expiresAt = new Date(Date.now() + 86400 * 1000);
    return {
      tokens: {
        ...tokens,
        accessToken: 'fixture-cal-refreshed-token-xyz',
        expiresAt: expiresAt.toISOString(),
      },
      tokenExpiresAt: expiresAt,
    };
  }

  public async getCalendars(_tokens: CalendarOAuthTokens): Promise<CalendarInfo[]> {
    return [
      {
        id: 'primary',
        summary: 'Primary Interviews & Job Search',
        description: 'Default candidate calendar for job applications',
        primary: true,
        accessRole: 'owner',
        timeZone: this.defaultTimezone,
        backgroundColor: '#0284c7',
      },
      {
        id: 'cal-work-1',
        summary: 'Current Work & Conflicts',
        description: 'Existing employment commitments',
        primary: false,
        accessRole: 'owner',
        timeZone: this.defaultTimezone,
        backgroundColor: '#e11d48',
      },
      {
        id: 'cal-personal-1',
        summary: 'Personal Life',
        description: 'Personal commitments and doctor appointments',
        primary: false,
        accessRole: 'owner',
        timeZone: this.defaultTimezone,
        backgroundColor: '#10b981',
      },
    ];
  }

  public async getAvailability(
    _tokens: CalendarOAuthTokens,
    calendarIds: string[],
    timeMin: string,
    timeMax: string,
    _timezone: string,
  ): Promise<{ busySlots: BusySlot[]; failedCalendars: string[] }> {
    const minMs = new Date(timeMin).getTime();
    const maxMs = new Date(timeMax).getTime();

    // 1. Collect all preset mock slots that overlap the query window
    const activeCalendarIds = new Set(calendarIds.length > 0 ? calendarIds : ['primary']);
    const overlappingBusySlots: BusySlot[] = [];

    for (const slot of this.mockBusySlots) {
      if (slot.calendarId && !activeCalendarIds.has(slot.calendarId)) {
        continue;
      }
      const slotStartMs = new Date(slot.start).getTime();
      const slotEndMs = new Date(slot.end).getTime();
      if (slotStartMs < maxMs && slotEndMs > minMs) {
        overlappingBusySlots.push(slot);
      }
    }

    // 2. Also include any in-memory scheduled events that overlap
    for (const event of this.events.values()) {
      if (!activeCalendarIds.has(event.calendarId)) {
        continue;
      }
      const evStartMs = new Date(event.start).getTime();
      const evEndMs = new Date(event.end).getTime();
      if (evStartMs < maxMs && evEndMs > minMs) {
        overlappingBusySlots.push({
          start: event.start,
          end: event.end,
          calendarId: event.calendarId,
        });
      }
    }

    return {
      busySlots: overlappingBusySlots,
      failedCalendars: [],
    };
  }

  public async createEvent(
    _tokens: CalendarOAuthTokens,
    calendarId: string,
    eventReq: CreateCalendarEventRequest,
  ): Promise<CalendarEventDto> {
    const externalId = `fixture-evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const eventDto: CalendarEventDto = {
      provider: CalendarProviderType.FIXTURE,
      calendarId,
      externalEventId: externalId,
      eventUrl: `https://calendar.google.com/calendar/event?eid=${externalId}`,
      summary: eventReq.summary,
      description: eventReq.description,
      start: eventReq.start,
      end: eventReq.end,
      timezone: eventReq.timezone || this.defaultTimezone,
      location: eventReq.location,
      meetingUrl:
        eventReq.meetingUrl ||
        (eventReq.createConference
          ? `https://meet.google.com/fix-${Math.random().toString(36).substring(2, 6)}`
          : undefined),
      status: 'confirmed',
      etag: `"fixture-etag-${Date.now()}"`,
      syncedAt: new Date().toISOString(),
    };

    this.events.set(externalId, eventDto);
    return eventDto;
  }

  public async getEvent(
    _tokens: CalendarOAuthTokens,
    _calendarId: string,
    eventId: string,
  ): Promise<CalendarEventDto | null> {
    return this.events.get(eventId) || null;
  }

  public async updateEvent(
    _tokens: CalendarOAuthTokens,
    calendarId: string,
    eventId: string,
    update: UpdateCalendarEventRequest,
  ): Promise<CalendarEventDto> {
    const existing = this.events.get(eventId);
    if (!existing) {
      const created: CalendarEventDto = {
        provider: CalendarProviderType.FIXTURE,
        calendarId,
        externalEventId: eventId,
        summary: update.summary || 'Interview',
        description: update.description,
        start: update.start || new Date().toISOString(),
        end: update.end || new Date(Date.now() + 3600000).toISOString(),
        timezone: update.timezone || this.defaultTimezone,
        location: update.location,
        meetingUrl: update.meetingUrl,
        status: 'confirmed',
        etag: `"fixture-etag-${Date.now()}"`,
        syncedAt: new Date().toISOString(),
      };
      this.events.set(eventId, created);
      return created;
    }

    const updated: CalendarEventDto = {
      ...existing,
      summary: update.summary !== undefined ? update.summary : existing.summary,
      description: update.description !== undefined ? update.description : existing.description,
      start: update.start !== undefined ? update.start : existing.start,
      end: update.end !== undefined ? update.end : existing.end,
      timezone: update.timezone !== undefined ? update.timezone : existing.timezone,
      location: update.location !== undefined ? update.location : existing.location,
      meetingUrl: update.meetingUrl !== undefined ? update.meetingUrl : existing.meetingUrl,
      etag: `"fixture-etag-${Date.now()}"`,
      syncedAt: new Date().toISOString(),
    };

    this.events.set(eventId, updated);
    return updated;
  }

  public async deleteEvent(
    _tokens: CalendarOAuthTokens,
    _calendarId: string,
    eventId: string,
  ): Promise<void> {
    this.events.delete(eventId);
  }
}
