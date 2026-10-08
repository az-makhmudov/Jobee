import type {
  EmailAccountDto,
  EmailMessageDto,
  EmailReviewItemDto,
  EmailSyncStatsDto,
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

export const emailClient = {
  async getAccounts(): Promise<EmailAccountDto[]> {
    return request<EmailAccountDto[]>('/email/accounts');
  },

  async getConnectUrl(
    provider: 'GMAIL' | 'FIXTURE' = 'GMAIL',
  ): Promise<{ authorizationUrl: string; state: string }> {
    return request<{ authorizationUrl: string; state: string }>('/email/accounts/connect-url', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    });
  },

  async connectFixtureAccount(emailAddress?: string): Promise<EmailAccountDto> {
    return request<EmailAccountDto>('/email/accounts/fixture-connect', {
      method: 'POST',
      body: JSON.stringify({ emailAddress }),
    });
  },

  async syncAccount(
    accountId: string,
    options?: { lookbackDays?: number },
  ): Promise<{
    syncRunId: string;
    messagesFound: number;
    messagesIngested: number;
    autoSyncedCount: number;
    reviewItemsCreated: number;
    jobsDiscoveredCount: number;
  }> {
    return request(`/email/accounts/${accountId}/sync`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  },

  async disconnectAccount(accountId: string): Promise<{ id: string; emailAddress: string }> {
    return request<{ id: string; emailAddress: string }>(`/email/accounts/${accountId}`, {
      method: 'DELETE',
    });
  },

  async getStats(): Promise<EmailSyncStatsDto> {
    return request<EmailSyncStatsDto>('/email/stats');
  },

  async getMessages(params?: Record<string, string | number>): Promise<EmailMessageDto[]> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.set(key, String(val));
        }
      });
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<EmailMessageDto[]>(`/email/messages${query}`);
  },

  async getReviewQueue(status?: string): Promise<EmailReviewItemDto[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<EmailReviewItemDto[]>(`/email/review-queue${query}`);
  },

  async resolveReviewItem(
    id: string,
    req: {
      resolution: 'APPROVED' | 'DISMISSED' | 'REJECTED';
      resolutionNote?: string;
      overrideTargetStatus?: string;
      overrideApplicationId?: string;
    },
  ): Promise<EmailReviewItemDto> {
    return request<EmailReviewItemDto>(`/email/review-queue/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },
};
