import type {
  CandidateIntelligenceSummaryDto,
  CandidateIntelligenceSuggestionDto,
  CandidateJobFeedbackDto,
  CandidateJobFeedbackType,
  LearnedPreferencesDto,
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

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.error?.message) {
        errorMessage = errJson.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  const json: ApiResponse<T> = await response.json();
  return json.data;
}

export interface CareerIntelligenceOverviewDto {
  summary: CandidateIntelligenceSummaryDto;
  contextVersion: number;
  candidateStateHash: string;
}

export const careerIntelligenceApi = {
  // 1. Get Candidate Intelligence Overview
  getIntelligenceOverview: () => request<CareerIntelligenceOverviewDto>('/candidate/intelligence'),

  // 2. Answer a high-impact clarification question
  submitClarification: (field: string, value: unknown) =>
    request<{ success: boolean; summary: CandidateIntelligenceSummaryDto }>(
      '/candidate/intelligence/clarify',
      {
        method: 'POST',
        body: JSON.stringify({ field, value }),
      },
    ),

  // 3. Trigger AI profile enrichment
  runEnrichment: (documentId?: string) =>
    request<{
      suggestionsCreated: number;
      suggestions: CandidateIntelligenceSuggestionDto[];
    }>('/candidate/intelligence/enrich', {
      method: 'POST',
      body: JSON.stringify({ documentId }),
    }),

  // 4. List Suggestions
  listSuggestions: (status?: string) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<{ suggestions: CandidateIntelligenceSuggestionDto[] }>(
      `/candidate/intelligence/suggestions${query}`,
    );
  },

  // 5. Apply a Suggestion (Approve)
  applySuggestion: (id: string) =>
    request<{ success: boolean; suggestion: CandidateIntelligenceSuggestionDto }>(
      `/candidate/intelligence/suggestions/${id}/apply`,
      { method: 'POST' },
    ),

  // 6. Dismiss a Suggestion
  dismissSuggestion: (id: string) =>
    request<{ success: boolean; suggestion: CandidateIntelligenceSuggestionDto }>(
      `/candidate/intelligence/suggestions/${id}/dismiss`,
      { method: 'POST' },
    ),

  // 7. Record Job Feedback
  recordJobFeedback: (jobId: string, feedbackType: CandidateJobFeedbackType, notes?: string) =>
    request<{ success: boolean; feedback: CandidateJobFeedbackDto }>(`/jobs/${jobId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ feedbackType, notes }),
    }),

  // 8. Get Feedback for Job
  getJobFeedback: (jobId: string) =>
    request<{ feedback: CandidateJobFeedbackDto | null }>(`/jobs/${jobId}/feedback`),

  // 9. Get Learned Preferences
  getLearnedPreferences: () =>
    request<{ learnedPreferences: LearnedPreferencesDto }>('/candidate/learned-preferences'),

  // 10. Update Learned Preferences
  updateLearnedPreferences: (updates: Partial<LearnedPreferencesDto>) =>
    request<{ success: boolean; learnedPreferences: LearnedPreferencesDto }>(
      '/candidate/learned-preferences',
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      },
    ),

  // 11. Reset Learned Preferences
  resetLearnedPreferences: () =>
    request<{ success: boolean; learnedPreferences: LearnedPreferencesDto }>(
      '/candidate/learned-preferences/reset',
      { method: 'POST' },
    ),

  // 12. Get All Candidate Records for Verification & AI-Use Authorization
  getRecords: () => request<CandidateRecordsResponseDto>('/candidate/intelligence/records'),

  // 13. Update Individual Record Authorization
  updateRecordAuthorization: (
    entityType: string,
    id: string,
    payload: { verificationStatus?: string; allowAiUse?: boolean },
  ) =>
    request<{ success: boolean; record: any }>(
      `/candidate/intelligence/records/${entityType}/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    ),

  // 14. Batch Update Record Authorizations
  batchAuthorizeRecords: (
    items: Array<{
      entityType: string;
      id: string;
      verificationStatus?: string;
      allowAiUse?: boolean;
    }>,
  ) =>
    request<{ success: boolean; updatedCount: number }>(
      '/candidate/intelligence/records/batch-authorize',
      {
        method: 'POST',
        body: JSON.stringify({ items }),
      },
    ),
};

export interface CandidateRecordItemDto {
  id: string;
  entityType:
    'experiences' | 'education' | 'skills' | 'certifications' | 'languages' | 'projects' | 'facts';
  title: string;
  subtitle: string;
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'REJECTED';
  allowAiUse: boolean;
  sourceReference: string | null;
  confidence: number | null;
  lastConfirmedAt: string | null;
}

export interface CandidateRecordsResponseDto {
  records: {
    experiences: CandidateRecordItemDto[];
    education: CandidateRecordItemDto[];
    skills: CandidateRecordItemDto[];
    certifications: CandidateRecordItemDto[];
    languages: CandidateRecordItemDto[];
    projects: CandidateRecordItemDto[];
    facts: CandidateRecordItemDto[];
  };
  counts: {
    total: number;
    verified: number;
    aiAuthorized: number;
    unverified: number;
  };
}
