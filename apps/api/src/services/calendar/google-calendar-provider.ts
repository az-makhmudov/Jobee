import { AppError } from '@job-agent/shared';
import type {
  CalendarInfo,
  BusySlot,
  CalendarEventDto,
  CreateCalendarEventRequest,
  UpdateCalendarEventRequest,
} from '@job-agent/shared';
import type {
  CalendarProvider,
  CalendarOAuthTokens,
  CalendarTokenExchangeResult,
} from './calendar-provider.js';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// Least-privilege scopes
const SCOPES = {
  AVAILABILITY: [
    'https://www.googleapis.com/auth/calendar.freebusy',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  EVENT_MANAGEMENT: [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.freebusy',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
};

export interface GoogleCalendarProviderConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri: string;
}

export class GoogleCalendarProvider implements CalendarProvider {
  public readonly name = 'GOOGLE' as const;
  private clientId?: string;
  private clientSecret?: string;
  private redirectUri: string;

  constructor(config: GoogleCalendarProviderConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
  }

  public get isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  public getAuthorizationUrl(
    state: string,
    scopeLevel: 'AVAILABILITY' | 'EVENT_MANAGEMENT',
  ): string {
    if (!this.clientId) {
      throw AppError.badRequest('GOOGLE_CALENDAR_CLIENT_ID is not configured');
    }

    const scopes = SCOPES[scopeLevel];
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  public async exchangeCodeForTokens(code: string): Promise<CalendarTokenExchangeResult> {
    if (!this.clientId || !this.clientSecret) {
      throw AppError.badRequest('Google Calendar OAuth credentials are not configured');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw AppError.badRequest(`Failed to exchange calendar authorization code: ${errText}`);
    }

    const data = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
    const grantedScopes = data.scope ? data.scope.split(' ') : [];

    // Fetch user email
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });

    if (!userRes.ok) {
      throw AppError.badRequest('Failed to fetch user email from Google');
    }

    const userData = (await userRes.json()) as { email: string };

    return {
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenType: data.token_type,
        expiresAt: tokenExpiresAt.toISOString(),
        scopes: grantedScopes,
      },
      emailAddress: userData.email.toLowerCase(),
      grantedScopes,
      tokenExpiresAt,
    };
  }

  public async refreshTokens(
    tokens: CalendarOAuthTokens,
  ): Promise<{ tokens: CalendarOAuthTokens; tokenExpiresAt?: Date }> {
    if (!this.clientId || !this.clientSecret) {
      throw AppError.badRequest('Google Calendar OAuth credentials are not configured');
    }
    if (!tokens.refreshToken) {
      throw AppError.badRequest('No refresh token available for calendar token refresh');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw AppError.badRequest(`Failed to refresh calendar token: ${errText}`);
    }

    const data = (await tokenRes.json()) as {
      access_token: string;
      expires_in: number;
      token_type: string;
    };

    const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    return {
      tokens: {
        ...tokens,
        accessToken: data.access_token,
        expiresAt: tokenExpiresAt.toISOString(),
      },
      tokenExpiresAt,
    };
  }

  public async getCalendars(tokens: CalendarOAuthTokens): Promise<CalendarInfo[]> {
    const res = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw AppError.badRequest(`Failed to list calendars: ${errText}`);
    }

    const data = (await res.json()) as {
      items?: Array<{
        id: string;
        summary: string;
        description?: string;
        primary?: boolean;
        accessRole: string;
        backgroundColor?: string;
        timeZone?: string;
      }>;
    };

    return (data.items || []).map((cal) => ({
      id: cal.id,
      summary: cal.summary,
      description: cal.description,
      primary: cal.primary || false,
      accessRole: cal.accessRole,
      backgroundColor: cal.backgroundColor,
      timeZone: cal.timeZone,
    }));
  }

  public async getAvailability(
    tokens: CalendarOAuthTokens,
    calendarIds: string[],
    timeMin: string,
    timeMax: string,
    _timezone: string,
  ): Promise<{ busySlots: BusySlot[]; failedCalendars: string[] }> {
    const res = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: calendarIds.map((id) => ({ id })),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw AppError.badRequest(`Failed to query free/busy: ${errText}`);
    }

    const data = (await res.json()) as {
      calendars: Record<
        string,
        {
          busy?: Array<{ start: string; end: string }>;
          errors?: Array<{ domain: string; reason: string }>;
        }
      >;
    };

    const busySlots: BusySlot[] = [];
    const failedCalendars: string[] = [];

    for (const calId of calendarIds) {
      const cal = data.calendars[calId];
      if (!cal) {
        failedCalendars.push(calId);
        continue;
      }
      if (cal.errors && cal.errors.length > 0) {
        failedCalendars.push(calId);
        continue;
      }
      if (cal.busy) {
        for (const slot of cal.busy) {
          busySlots.push({
            start: slot.start,
            end: slot.end,
            calendarId: calId,
          });
        }
      }
    }

    return { busySlots, failedCalendars };
  }

  public async createEvent(
    tokens: CalendarOAuthTokens,
    calendarId: string,
    event: CreateCalendarEventRequest,
  ): Promise<CalendarEventDto> {
    const body: Record<string, unknown> = {
      summary: event.summary,
      description: event.description || '',
      start: {
        dateTime: event.start,
        timeZone: event.timezone,
      },
      end: {
        dateTime: event.end,
        timeZone: event.timezone,
      },
      visibility: 'private',
    };

    if (event.location) {
      body.location = event.location;
    }

    // Preserve existing meeting URL — do not replace with Google Meet
    if (event.meetingUrl) {
      body.description = `${body.description}\n\nMeeting Link: ${event.meetingUrl}`.trim();
    } else if (event.createConference) {
      body.conferenceData = {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const params = new URLSearchParams();
    if (event.createConference) {
      params.set('conferenceDataVersion', '1');
    }

    const paramStr = params.toString();
    const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events${paramStr ? `?${paramStr}` : ''}`;

    const res = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw AppError.badRequest(`Failed to create calendar event: ${errText}`);
    }

    const created = (await res.json()) as GoogleEventResource;
    return this.toCalendarEventDto(created, calendarId);
  }

  public async getEvent(
    tokens: CalendarOAuthTokens,
    calendarId: string,
    eventId: string,
  ): Promise<CalendarEventDto | null> {
    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      },
    );

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw AppError.badRequest(`Failed to get calendar event: ${errText}`);
    }

    const event = (await res.json()) as GoogleEventResource;
    return this.toCalendarEventDto(event, calendarId);
  }

  public async updateEvent(
    tokens: CalendarOAuthTokens,
    calendarId: string,
    eventId: string,
    update: UpdateCalendarEventRequest,
  ): Promise<CalendarEventDto> {
    const body: Record<string, unknown> = {};

    if (update.summary !== undefined) body.summary = update.summary;
    if (update.description !== undefined) body.description = update.description;
    if (update.location !== undefined) body.location = update.location;
    if (update.start && update.timezone) {
      body.start = { dateTime: update.start, timeZone: update.timezone };
    }
    if (update.end && update.timezone) {
      body.end = { dateTime: update.end, timeZone: update.timezone };
    }

    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      throw AppError.badRequest(`Failed to update calendar event: ${errText}`);
    }

    const updated = (await res.json()) as GoogleEventResource;
    return this.toCalendarEventDto(updated, calendarId);
  }

  public async deleteEvent(
    tokens: CalendarOAuthTokens,
    calendarId: string,
    eventId: string,
  ): Promise<void> {
    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      },
    );

    if (!res.ok && res.status !== 410) {
      const errText = await res.text();
      throw AppError.badRequest(`Failed to delete calendar event: ${errText}`);
    }
  }

  private toCalendarEventDto(event: GoogleEventResource, calendarId: string): CalendarEventDto {
    return {
      provider: 'GOOGLE',
      calendarId,
      externalEventId: event.id,
      eventUrl: event.htmlLink,
      summary: event.summary || '',
      description: event.description || '',
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || '',
      timezone: event.start?.timeZone || 'UTC',
      location: event.location,
      meetingUrl: event.hangoutLink,
      status: event.status || 'confirmed',
      etag: event.etag,
      syncedAt: new Date().toISOString(),
    };
  }
}

interface GoogleEventResource {
  id: string;
  htmlLink?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  hangoutLink?: string;
  status?: string;
  etag?: string;
}
