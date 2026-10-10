import type {
  CalendarAccountDto,
  CalendarInfo,
  AvailabilityResult,
  ConflictResult,
  InterviewCalendarLinkDto,
  CalendarEventDto,
  PreparationBriefDto,
  InterviewDashboardMetrics,
  AvailabilityQueryRequest,
  CreateCalendarEventForInterviewRequest,
  CalendarAccountSelectionRequest,
  ChecklistItem,
  UpdateInterviewDebriefRequest,
  ApplicationInterviewDto,
  ScheduledInterviewWorkspaceItemDto,
} from '@job-agent/shared';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface ApiResponse<T> {
  status: 'ok' | 'error';
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(options?.headers);

  if (options?.body && !(options.body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || payload.status === 'error') {
    const errorMsg = payload.error?.message || `HTTP ${response.status}: Request failed`;
    throw new Error(errorMsg);
  }

  return payload.data;
}

export const calendarClient = {
  async getAccounts(): Promise<CalendarAccountDto[]> {
    return request<CalendarAccountDto[]>('/calendar/accounts');
  },

  async connectFixtureAccount(emailAddress?: string): Promise<CalendarAccountDto> {
    return request<CalendarAccountDto[]>('/calendar/accounts/fixture/connect', {
      method: 'POST',
      body: JSON.stringify({ emailAddress }),
    }) as unknown as Promise<CalendarAccountDto>;
  },

  async getGoogleAuthUrl(
    scopeLevel: 'AVAILABILITY' | 'EVENT_MANAGEMENT' = 'EVENT_MANAGEMENT',
  ): Promise<{ authUrl: string; state: string }> {
    return request<{ authUrl: string; state: string }>(
      `/calendar/google/auth-url?scopeLevel=${scopeLevel}`,
    );
  },

  async disconnectAccount(id: string, purge = false): Promise<void> {
    await request<void>(`/calendar/accounts/${id}${purge ? '?purge=true' : ''}`, {
      method: 'DELETE',
    });
  },

  async getCalendars(accountId: string): Promise<CalendarInfo[]> {
    return request<CalendarInfo[]>(`/calendar/accounts/${accountId}/calendars`);
  },

  async updateCalendarSelection(
    accountId: string,
    req: CalendarAccountSelectionRequest,
  ): Promise<CalendarAccountDto> {
    return request<CalendarAccountDto>(`/calendar/accounts/${accountId}/selection`, {
      method: 'PATCH',
      body: JSON.stringify(req),
    });
  },

  async getAvailability(req: AvailabilityQueryRequest): Promise<AvailabilityResult> {
    return request<AvailabilityResult>('/calendar/availability', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  async checkConflict(params: {
    scheduledAt: string;
    durationMinutes?: number;
    timezone?: string;
    excludeInterviewId?: string;
  }): Promise<ConflictResult> {
    return request<ConflictResult>('/calendar/check-conflict', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async getMetrics(): Promise<InterviewDashboardMetrics> {
    return request<InterviewDashboardMetrics>('/calendar/metrics');
  },

  async listInterviews(): Promise<ScheduledInterviewWorkspaceItemDto[]> {
    return request<ScheduledInterviewWorkspaceItemDto[]>('/calendar/interviews');
  },

  // ─── Interview Calendar Event Booking ──────────────────────────────────

  async createCalendarEvent(
    applicationId: string,
    interviewId: string,
    req: CreateCalendarEventForInterviewRequest,
  ): Promise<{ link: InterviewCalendarLinkDto; event: CalendarEventDto }> {
    return request<{ link: InterviewCalendarLinkDto; event: CalendarEventDto }>(
      `/applications/${applicationId}/interviews/${interviewId}/calendar-event`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
    );
  },

  async getCalendarEvent(
    applicationId: string,
    interviewId: string,
  ): Promise<{ link: InterviewCalendarLinkDto; event: CalendarEventDto }> {
    return request<{ link: InterviewCalendarLinkDto; event: CalendarEventDto }>(
      `/applications/${applicationId}/interviews/${interviewId}/calendar-event`,
    );
  },

  async deleteCalendarEvent(applicationId: string, interviewId: string): Promise<void> {
    await request<void>(`/applications/${applicationId}/interviews/${interviewId}/calendar-event`, {
      method: 'DELETE',
    });
  },

  // ─── Preparation Briefs ────────────────────────────────────────────────

  async generatePreparationBrief(
    applicationId: string,
    interviewId: string,
    forceRegenerate = false,
  ): Promise<PreparationBriefDto> {
    return request<PreparationBriefDto>(
      `/applications/${applicationId}/interviews/${interviewId}/preparation-brief`,
      {
        method: 'POST',
        body: JSON.stringify({ forceRegenerate }),
      },
    );
  },

  async getPreparationBrief(
    applicationId: string,
    interviewId: string,
  ): Promise<PreparationBriefDto> {
    return request<PreparationBriefDto>(
      `/applications/${applicationId}/interviews/${interviewId}/preparation-brief`,
    );
  },

  async updateHumanNotes(
    applicationId: string,
    interviewId: string,
    humanNotes: string,
  ): Promise<PreparationBriefDto> {
    return request<PreparationBriefDto>(
      `/applications/${applicationId}/interviews/${interviewId}/preparation-brief`,
      {
        method: 'PATCH',
        body: JSON.stringify({ humanNotes }),
      },
    );
  },

  async updateChecklist(
    applicationId: string,
    interviewId: string,
    checklist: ChecklistItem[],
  ): Promise<PreparationBriefDto> {
    return request<PreparationBriefDto>(
      `/applications/${applicationId}/interviews/${interviewId}/checklist`,
      {
        method: 'PATCH',
        body: JSON.stringify({ checklist }),
      },
    );
  },

  async updateDebrief(
    applicationId: string,
    interviewId: string,
    input: UpdateInterviewDebriefRequest,
  ): Promise<ApplicationInterviewDto> {
    return request<ApplicationInterviewDto>(
      `/applications/${applicationId}/interviews/${interviewId}/debrief`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
    );
  },
};
