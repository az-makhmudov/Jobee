import type {
  JobSearchSettings,
  PreparationBatchDto,
  SubmissionAuthorizationTicketDto,
  ApplicationIntentDto,
} from '@job-agent/shared';
import { APPLICATION_INTENT_TERMS } from '@job-agent/shared';
const base = import.meta.env.VITE_API_URL || '/api';
async function request<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.status !== 'ok')
    throw new Error(data.error?.message ?? 'This action could not be completed. Try again.');
  return data.data;
}
export type BatchTicket = SubmissionAuthorizationTicketDto & { itemId: string };
export type QuestionGroup = {
  question: string;
  items: Array<{
    itemId: string;
    packageId: string;
    questionId: string;
    title: string;
    company: string;
  }>;
};
export const jobSearchApi = {
  intentForJob: (jobId: string) =>
    request<ApplicationIntentDto | null>(`/jobs/${jobId}/application-intent`),
  apply: (jobId: string) =>
    request<ApplicationIntentDto>(`/jobs/${jobId}/apply`, {
      termsVersion: APPLICATION_INTENT_TERMS,
    }),
  intent: (id: string) => request<ApplicationIntentDto>(`/application-intents/${id}`),
  cancelIntent: (id: string) =>
    request<ApplicationIntentDto>(`/application-intents/${id}/cancel`, {}),
  resumeIntent: (id: string) =>
    request<ApplicationIntentDto>(`/application-intents/${id}/resume`, {
      termsVersion: APPLICATION_INTENT_TERMS,
    }),
  settings: () => request<JobSearchSettings>('/job-search/settings'),
  saveSettings: (settings: JobSearchSettings) =>
    request<JobSearchSettings>('/job-search/settings', settings, 'PUT'),
  batches: () => request<PreparationBatchDto[]>('/preparation-batches'),
  create: (jobIds: string[], selectedCvId: string | null) =>
    request<PreparationBatchDto>('/preparation-batches', { jobIds, selectedCvId }),
  cancel: (id: string) => request<PreparationBatchDto>(`/preparation-batches/${id}/cancel`, {}),
  retry: (id: string) => request<PreparationBatchDto>(`/preparation-batches/${id}/retry`, {}),
  questions: (id: string) => request<QuestionGroup[]>(`/preparation-batches/${id}/questions`),
  review: (id: string, itemIds: string[]) =>
    request<BatchTicket[]>(`/preparation-batches/${id}/review`, { itemIds }),
  submit: (id: string, items: Array<{ itemId: string; submissionToken: string }>) =>
    request<Array<{ itemId: string; runId: string | null; error: string | null }>>(
      `/preparation-batches/${id}/submit`,
      { items },
    ),
};
