import type {
  CandidateProfileDto,
  CandidateExperienceDto,
  CandidateEducationDto,
  CandidateProjectDto,
  CandidateSkillDto,
  CandidateLanguageDto,
  CandidateCertificationDto,
  CandidateLinkDto,
  CandidateFactDto,
  CandidateDocumentDto,
  AnswerLibraryEntryDto,
  JobPreferencesDto,
  ApplicationPolicyDto,
  CandidateOverviewDto,
  CandidateAuditEventDto,
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

  // If body is not FormData, default to application/json
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
  return json.data;
}

export const candidateApi = {
  // Overview & Audit
  getOverview: () => request<CandidateOverviewDto>('/candidate/overview'),
  getAuditEvents: () => request<CandidateAuditEventDto[]>('/candidate/audit-events'),

  // Profile
  getProfile: () => request<CandidateProfileDto | null>('/candidate/profile'),
  updateProfile: (data: Partial<CandidateProfileDto>) =>
    request<CandidateProfileDto>('/candidate/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Experiences
  getExperiences: () => request<CandidateExperienceDto[]>('/candidate/experiences'),
  createExperience: (data: Partial<CandidateExperienceDto>) =>
    request<CandidateExperienceDto>('/candidate/experiences', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateExperience: (id: string, data: Partial<CandidateExperienceDto>) =>
    request<CandidateExperienceDto>(`/candidate/experiences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteExperience: (id: string) =>
    request<{ deleted: boolean }>(`/candidate/experiences/${id}`, {
      method: 'DELETE',
    }),

  // Education
  getEducation: () => request<CandidateEducationDto[]>('/candidate/education'),
  createEducation: (data: Partial<CandidateEducationDto>) =>
    request<CandidateEducationDto>('/candidate/education', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateEducation: (id: string, data: Partial<CandidateEducationDto>) =>
    request<CandidateEducationDto>(`/candidate/education/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteEducation: (id: string) =>
    request<{ deleted: boolean }>(`/candidate/education/${id}`, {
      method: 'DELETE',
    }),

  // Projects
  getProjects: () => request<CandidateProjectDto[]>('/candidate/projects'),
  createProject: (data: Partial<CandidateProjectDto>) =>
    request<CandidateProjectDto>('/candidate/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProject: (id: string, data: Partial<CandidateProjectDto>) =>
    request<CandidateProjectDto>(`/candidate/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteProject: (id: string) =>
    request<{ deleted: boolean }>(`/candidate/projects/${id}`, {
      method: 'DELETE',
    }),

  // Skills
  getSkills: () => request<CandidateSkillDto[]>('/candidate/skills'),
  createSkill: (data: Partial<CandidateSkillDto>) =>
    request<CandidateSkillDto>('/candidate/skills', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSkill: (id: string, data: Partial<CandidateSkillDto>) =>
    request<CandidateSkillDto>(`/candidate/skills/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteSkill: (id: string) =>
    request<{ deleted: boolean }>(`/candidate/skills/${id}`, {
      method: 'DELETE',
    }),

  // Languages
  getLanguages: () => request<CandidateLanguageDto[]>('/candidate/languages'),
  createLanguage: (data: Partial<CandidateLanguageDto>) =>
    request<CandidateLanguageDto>('/candidate/languages', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateLanguage: (id: string, data: Partial<CandidateLanguageDto>) =>
    request<CandidateLanguageDto>(`/candidate/languages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteLanguage: (id: string) =>
    request<{ deleted: boolean }>(`/candidate/languages/${id}`, {
      method: 'DELETE',
    }),

  // Certifications
  getCertifications: () => request<CandidateCertificationDto[]>('/candidate/certifications'),
  createCertification: (data: Partial<CandidateCertificationDto>) =>
    request<CandidateCertificationDto>('/candidate/certifications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCertification: (id: string, data: Partial<CandidateCertificationDto>) =>
    request<CandidateCertificationDto>(`/candidate/certifications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteCertification: (id: string) =>
    request<{ deleted: boolean }>(`/candidate/certifications/${id}`, {
      method: 'DELETE',
    }),

  // Links
  getLinks: () => request<CandidateLinkDto[]>('/candidate/links'),
  createLink: (data: Partial<CandidateLinkDto>) =>
    request<CandidateLinkDto>('/candidate/links', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateLink: (id: string, data: Partial<CandidateLinkDto>) =>
    request<CandidateLinkDto>(`/candidate/links/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteLink: (id: string) =>
    request<{ deleted: boolean }>(`/candidate/links/${id}`, {
      method: 'DELETE',
    }),

  // Facts
  getFacts: (filters?: { verificationStatus?: string; allowAiUseOnly?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.verificationStatus) params.set('verificationStatus', filters.verificationStatus);
    if (filters?.allowAiUseOnly !== undefined)
      params.set('allowAiUseOnly', String(filters.allowAiUseOnly));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<CandidateFactDto[]>(`/candidate/facts${qs}`);
  },
  createFact: (data: Partial<CandidateFactDto>) =>
    request<CandidateFactDto>('/candidate/facts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateFact: (id: string, data: Partial<CandidateFactDto>) =>
    request<CandidateFactDto>(`/candidate/facts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteFact: (id: string) =>
    request<{ deleted: boolean }>(`/candidate/facts/${id}`, {
      method: 'DELETE',
    }),

  // Documents
  getDocuments: () => request<CandidateDocumentDto[]>('/candidate/documents'),
  uploadDocument: (formData: FormData) =>
    request<CandidateDocumentDto>('/candidate/documents', {
      method: 'POST',
      body: formData,
    }),
  deleteDocument: (id: string) =>
    request<{ deleted: boolean }>(`/candidate/documents/${id}`, {
      method: 'DELETE',
    }),
  getDocumentBlob: async (id: string, signal?: AbortSignal): Promise<Blob> => {
    const response = await fetch(
      `${API_BASE}/candidate/documents/${encodeURIComponent(id)}/download`,
      { credentials: 'include', signal },
    );
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? 'Please sign in again to view this document.'
          : response.status === 403 || response.status === 404
            ? 'This document is unavailable or you do not have access.'
            : 'Could not load the document. Please retry.',
      );
    return response.blob();
  },

  getDocumentDownloadUrl: (id: string) => `${API_BASE}/candidate/documents/${id}/download`,

  // Answer Library
  getAnswers: () => request<AnswerLibraryEntryDto[]>('/candidate/answers'),
  createAnswer: (data: Partial<AnswerLibraryEntryDto>) =>
    request<AnswerLibraryEntryDto>('/candidate/answers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAnswer: (id: string, data: Partial<AnswerLibraryEntryDto>) =>
    request<AnswerLibraryEntryDto>(`/candidate/answers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteAnswer: (id: string) =>
    request<{ deleted: boolean }>(`/candidate/answers/${id}`, {
      method: 'DELETE',
    }),

  // Preferences
  getPreferences: () => request<JobPreferencesDto | null>('/candidate/preferences'),
  updatePreferences: (data: Partial<JobPreferencesDto>) =>
    request<JobPreferencesDto>('/candidate/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Policy
  getPolicy: () => request<ApplicationPolicyDto>('/candidate/policy'),
  updatePolicy: (data: Partial<ApplicationPolicyDto>) =>
    request<ApplicationPolicyDto>('/candidate/policy', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
