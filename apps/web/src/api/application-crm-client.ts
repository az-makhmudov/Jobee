import type {
  ApplicationSummaryDto,
  ApplicationDetailDto,
  ApplicationNoteDto,
  ApplicationContactDto,
  ApplicationAssessmentDto,
  ApplicationInterviewDto,
  ApplicationOfferDto,
  ApplicationCrmMetricsDto,
  ApplicationCrmAnalyticsDto,
  CreateApplicationRequest,
  MarkAppliedRequest,
  TransitionStatusRequest,
  UpdateNextActionRequest,
  AddNoteRequest,
  CreateContactRequest,
  UpdateContactRequest,
  CreateAssessmentRequest,
  UpdateAssessmentRequest,
  CreateInterviewRequest,
  UpdateInterviewRequest,
  UpdateOfferRequest,
  ListApplicationsQuery,
} from '@job-agent/shared';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `Request failed with status ${res.status}`);
  }
  return json.data;
}

export const ApplicationCrmClient = {
  async createApplication(
    data: CreateApplicationRequest,
  ): Promise<{ application: ApplicationSummaryDto; isExisting: boolean }> {
    return fetchJson(`${API_BASE}/applications`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listApplications(
    query?: ListApplicationsQuery,
  ): Promise<{ items: ApplicationSummaryDto[]; total: number }> {
    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);
    if (query?.search) params.set('search', query.search);
    if (query?.company) params.set('company', query.company);
    if (query?.source) params.set('source', query.source);
    if (query?.isArchived !== undefined) params.set('isArchived', String(query.isArchived));
    if (query?.needsAttention !== undefined)
      params.set('needsAttention', String(query.needsAttention));
    if (query?.hasFollowUp !== undefined) params.set('hasFollowUp', String(query.hasFollowUp));
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.offset) params.set('offset', String(query.offset));
    if (query?.sortBy) params.set('sortBy', query.sortBy);
    if (query?.sortOrder) params.set('sortOrder', query.sortOrder);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/applications${queryString}`);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error?.message || 'Failed to list applications');
    }
    return {
      items: json.data,
      total: json.pagination?.total ?? json.data.length,
    };
  },

  async getApplicationDetail(id: string): Promise<ApplicationDetailDto> {
    return fetchJson(`${API_BASE}/applications/${id}`);
  },

  async getApplicationForJob(jobId: string): Promise<ApplicationSummaryDto | null> {
    return fetchJson(`${API_BASE}/jobs/${jobId}/application`);
  },

  async markApplied(id: string, data: MarkAppliedRequest): Promise<ApplicationSummaryDto> {
    return fetchJson(`${API_BASE}/applications/${id}/mark-applied`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async transitionStatus(
    id: string,
    data: TransitionStatusRequest,
  ): Promise<ApplicationSummaryDto> {
    return fetchJson(`${API_BASE}/applications/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateNextAction(
    id: string,
    data: UpdateNextActionRequest,
  ): Promise<ApplicationSummaryDto> {
    return fetchJson(`${API_BASE}/applications/${id}/next-action`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async addNote(id: string, data: AddNoteRequest): Promise<ApplicationNoteDto> {
    return fetchJson(`${API_BASE}/applications/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteNote(id: string, noteId: string): Promise<void> {
    return fetchJson(`${API_BASE}/applications/${id}/notes/${noteId}`, {
      method: 'DELETE',
    });
  },

  async addContact(id: string, data: CreateContactRequest): Promise<ApplicationContactDto> {
    return fetchJson(`${API_BASE}/applications/${id}/contacts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateContact(
    id: string,
    contactId: string,
    data: UpdateContactRequest,
  ): Promise<ApplicationContactDto> {
    return fetchJson(`${API_BASE}/applications/${id}/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteContact(id: string, contactId: string): Promise<void> {
    return fetchJson(`${API_BASE}/applications/${id}/contacts/${contactId}`, {
      method: 'DELETE',
    });
  },

  async addAssessment(
    id: string,
    data: CreateAssessmentRequest,
  ): Promise<ApplicationAssessmentDto> {
    return fetchJson(`${API_BASE}/applications/${id}/assessments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAssessment(
    id: string,
    assessmentId: string,
    data: UpdateAssessmentRequest,
  ): Promise<ApplicationAssessmentDto> {
    return fetchJson(`${API_BASE}/applications/${id}/assessments/${assessmentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteAssessment(id: string, assessmentId: string): Promise<void> {
    return fetchJson(`${API_BASE}/applications/${id}/assessments/${assessmentId}`, {
      method: 'DELETE',
    });
  },

  async addInterview(id: string, data: CreateInterviewRequest): Promise<ApplicationInterviewDto> {
    return fetchJson(`${API_BASE}/applications/${id}/interviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateInterview(
    id: string,
    interviewId: string,
    data: UpdateInterviewRequest,
  ): Promise<ApplicationInterviewDto> {
    return fetchJson(`${API_BASE}/applications/${id}/interviews/${interviewId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteInterview(id: string, interviewId: string): Promise<void> {
    return fetchJson(`${API_BASE}/applications/${id}/interviews/${interviewId}`, {
      method: 'DELETE',
    });
  },

  async updateOffer(id: string, data: UpdateOfferRequest): Promise<ApplicationOfferDto> {
    return fetchJson(`${API_BASE}/applications/${id}/offer`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getMetrics(): Promise<ApplicationCrmMetricsDto> {
    return fetchJson(`${API_BASE}/applications/metrics`);
  },

  async getAnalytics(): Promise<ApplicationCrmAnalyticsDto> {
    return fetchJson(`${API_BASE}/applications/analytics`);
  },

  async archiveApplication(id: string): Promise<ApplicationSummaryDto> {
    return fetchJson(`${API_BASE}/applications/${id}/archive`, {
      method: 'POST',
    });
  },

  async unarchiveApplication(id: string): Promise<ApplicationSummaryDto> {
    return fetchJson(`${API_BASE}/applications/${id}/unarchive`, {
      method: 'POST',
    });
  },

  async purgeApplication(id: string): Promise<{ id: string; purged: boolean }> {
    return fetchJson(`${API_BASE}/applications/${id}/purge`, {
      method: 'DELETE',
    });
  },
};
