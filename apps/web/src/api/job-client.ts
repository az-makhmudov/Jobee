import type {
  RecommendationStatusDto,
  JobDto,
  JobSummaryDto,
  JobListQuery,
  JobPaginationResult,
  IngestJobTextRequest,
  IngestJobUrlRequest,
  UpdateJobRequest,
  JobDashboardMetricsDto,
  JobMatchAnalysisDto,
  BatchAnalysisRequest,
  BatchAnalysisResultDto,
  DiscoverySource,
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

interface IngestResult {
  job: JobDto;
  isDuplicate: boolean;
  message?: string;
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
      // ignore json parse error
    }
    throw new Error(errorMessage);
  }

  const json: ApiResponse<T> = await response.json();
  if (json.status === 'error') {
    throw new Error(json.error?.message || 'API request failed');
  }

  return json.data;
}

export const jobApi = {
  recommendationStatus: () => request<RecommendationStatusDto>('/jobs/recommendations'),
  refreshRecommendations: (retry = false) =>
    request<RecommendationStatusDto>('/jobs/recommendations', {
      method: 'POST',
      body: JSON.stringify({ retry }),
    }),
  // Ingest job via pasted text
  ingestText: async (data: IngestJobTextRequest): Promise<IngestResult> => {
    return request<IngestResult>('/jobs/text', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Ingest job via URL
  ingestUrl: async (data: IngestJobUrlRequest): Promise<IngestResult> => {
    return request<IngestResult>('/jobs/url', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get job list with filtering and pagination
  getJobs: async (query?: JobListQuery): Promise<JobPaginationResult<JobSummaryDto>> => {
    const params = new URLSearchParams();
    if (query?.page) params.append('page', String(query.page));
    if (query?.limit) params.append('limit', String(query.limit));
    if (query?.state) params.append('state', query.state);
    if (query?.provider) params.append('provider', query.provider);
    if (query?.applicationMethod) params.append('applicationMethod', query.applicationMethod);
    if (query?.workplaceType) params.append('workplaceType', query.workplaceType);
    if (query?.employmentType) params.append('employmentType', query.employmentType);
    if (query?.company) params.append('company', query.company);
    if (query?.search) params.append('search', query.search);
    if (query?.includeArchived) params.append('includeArchived', 'true');
    if (query?.relevantOnly !== undefined)
      params.append('relevantOnly', String(query.relevantOnly));
    if (query?.recommendationsOnly !== undefined)
      params.append('recommendationsOnly', String(query.recommendationsOnly));
    if (query?.decision) params.append('decision', query.decision);
    if (query?.minScore !== undefined) params.append('minScore', String(query.minScore));
    if (query?.maxScore !== undefined) params.append('maxScore', String(query.maxScore));
    if (query?.minConfidence !== undefined)
      params.append('minConfidence', String(query.minConfidence));
    if (query?.isStale !== undefined) params.append('isStale', String(query.isStale));
    if (query?.sortBy) params.append('sortBy', query.sortBy);
    if (query?.sortOrder) params.append('sortOrder', query.sortOrder);

    const qs = params.toString();
    const endpoint = `/jobs${qs ? `?${qs}` : ''}`;
    return request<JobPaginationResult<JobSummaryDto>>(endpoint);
  },

  // Get full job details by ID
  getJobById: async (id: string): Promise<JobDto> => {
    return request<JobDto>(`/jobs/${id}`);
  },

  // Update normalized job fields
  updateJob: async (id: string, data: UpdateJobRequest): Promise<JobDto> => {
    return request<JobDto>(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Archive job
  archiveJob: async (id: string, reason?: string): Promise<JobDto> => {
    return request<JobDto>(`/jobs/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Get dashboard ingestion metrics
  getMetrics: async (): Promise<JobDashboardMetricsDto> => {
    return request<JobDashboardMetricsDto>('/jobs/metrics');
  },

  // Run match analysis for a job
  analyzeJob: async (id: string, force?: boolean): Promise<JobMatchAnalysisDto> => {
    return request<JobMatchAnalysisDto>(`/jobs/${id}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    });
  },

  // Get match analysis for a job
  getJobAnalysis: async (id: string): Promise<JobMatchAnalysisDto> => {
    return request<JobMatchAnalysisDto>(`/jobs/${id}/analysis`);
  },

  // Batch analyze jobs
  batchAnalyzeJobs: async (data: BatchAnalysisRequest): Promise<BatchAnalysisResultDto> => {
    return request<BatchAnalysisResultDto>('/jobs/analyze', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Discover opportunities from configured public sources
  discoverJobs: async (options?: {
    limit?: number;
    sources?: DiscoverySource[];
    companies?: string[];
    queryKeywords?: string[];
  }): Promise<{
    sourcesSummary: Array<{
      source: string;
      totalFound: number;
      newJobsIngested: number;
      duplicatesSkipped: number;
      errors: string[];
    }>;
    totalDiscovered: number;
    postingsExamined?: number;
    newJobsIngested: number;
    duplicatesSkipped: number;
  }> => {
    return request('/jobs/discover', {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  },
};
