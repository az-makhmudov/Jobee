import type {
  CalendarInfo,
  BusySlot,
  CalendarEventDto,
  CreateCalendarEventRequest,
  UpdateCalendarEventRequest,
} from '@job-agent/shared';

export interface CalendarOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: string;
  scopes?: string[];
  [key: string]: unknown;
}

export interface CalendarTokenExchangeResult {
  tokens: CalendarOAuthTokens;
  emailAddress: string;
  grantedScopes: string[];
  tokenExpiresAt?: Date;
}

export interface CalendarProvider {
  readonly name: 'GOOGLE' | 'FIXTURE';
  readonly isConfigured: boolean;

  getAuthorizationUrl(state: string, scopeLevel: 'AVAILABILITY' | 'EVENT_MANAGEMENT'): string;

  exchangeCodeForTokens(code: string): Promise<CalendarTokenExchangeResult>;

  refreshTokens(
    tokens: CalendarOAuthTokens,
  ): Promise<{ tokens: CalendarOAuthTokens; tokenExpiresAt?: Date }>;

  getCalendars(tokens: CalendarOAuthTokens): Promise<CalendarInfo[]>;

  getAvailability(
    tokens: CalendarOAuthTokens,
    calendarIds: string[],
    timeMin: string,
    timeMax: string,
    timezone: string,
  ): Promise<{ busySlots: BusySlot[]; failedCalendars: string[] }>;

  createEvent(
    tokens: CalendarOAuthTokens,
    calendarId: string,
    event: CreateCalendarEventRequest,
  ): Promise<CalendarEventDto>;

  getEvent(
    tokens: CalendarOAuthTokens,
    calendarId: string,
    eventId: string,
  ): Promise<CalendarEventDto | null>;

  updateEvent(
    tokens: CalendarOAuthTokens,
    calendarId: string,
    eventId: string,
    update: UpdateCalendarEventRequest,
  ): Promise<CalendarEventDto>;

  deleteEvent(tokens: CalendarOAuthTokens, calendarId: string, eventId: string): Promise<void>;
}
