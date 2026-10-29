// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { JobPaginationResult, JobSummaryDto } from '@job-agent/shared';
import { JobInboxView } from './JobInboxView.js';
import { jobApi } from '../api/job-client.js';
vi.mock('../api/job-client.js', () => ({
  jobApi: {
    getJobs: vi.fn(),
    getMetrics: vi.fn(),
    discoverJobs: vi.fn(),
    refreshRecommendations: vi.fn(),
    recommendationStatus: vi.fn(),
  },
}));
vi.mock('./PreparationBatchPanel.js', () => ({ PreparationBatchPanel: () => null }));
vi.mock('./AddJobModal.js', () => ({ AddJobModal: () => null }));
const role = (title: string): JobSummaryDto => ({
  id: title,
  matchSummary: {
    overallScore: 80,
    confidenceScore: 90,
    decision: 'MATCH',
    isStale: false,
    analysisMode: 'DETERMINISTIC_ONLY',
    analyzedAt: '2026-10-20T00:00:00Z',
  },
  title,
  company: 'Fixture Company',
  state: 'INGESTED',
  locationText: null,
  city: null,
  country: null,
  workplaceType: 'REMOTE',
  employmentType: 'FULL_TIME',
  seniority: 'UNKNOWN',
  provider: 'ARBEITNOW',
  minSalary: null,
  maxSalary: null,
  currency: null,
  payPeriod: null,
  originalUrl: null,
  discoveredDate: '2026-10-20T00:00:00Z',
  isDuplicate: false,
  hasManualEdits: false,
  requirementCount: 0,
});
const result = (title: string): JobPaginationResult<JobSummaryDto> => ({
  items: [role(title)],
  page: 1,
  limit: 10,
  total: 12,
  totalPages: 2,
});
const props = {
  onSelectJob: vi.fn(),
  onOpenPackage: vi.fn(),
  selectedJobId: null,
  refreshKey: 0,
  detail: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(jobApi.refreshRecommendations).mockResolvedValue({
    state: 'IDLE',
    ready: 1,
    pending: 0,
    excluded: 0,
    evaluated: 1,
    processed: 0,
    batchSize: 0,
    locations: ['Warsaw'],
    levels: ['ENTRY'],
    message: 'Recommendations ready.',
  });
  vi.mocked(jobApi.getMetrics).mockResolvedValue(
    {} as Awaited<ReturnType<typeof jobApi.getMetrics>>,
  );
  vi.mocked(jobApi.getJobs).mockResolvedValue(result('Current role'));
});
afterEach(cleanup);
it('submits a search from a later page once at page one and keeps the search while reading a role', async () => {
  const view = render(<JobInboxView {...props} />);
  await screen.findByText('Current role');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() =>
    expect(jobApi.getJobs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
  );
  vi.mocked(jobApi.getJobs).mockClear();
  fireEvent.change(screen.getByLabelText('Search jobs'), { target: { value: 'Engineer' } });
  fireEvent.submit(screen.getByRole('button', { name: /^Search$/ }).closest('form')!);
  await waitFor(() => expect(jobApi.getJobs).toHaveBeenCalledTimes(1));
  expect(jobApi.getJobs).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 1, search: 'Engineer' }),
  );
  view.rerender(
    <JobInboxView {...props} selectedJobId="Current role" detail={<div>Role details</div>} />,
  );
  expect((screen.getByLabelText('Search jobs') as HTMLInputElement).value).toBe('Engineer');
  expect(screen.getByText('Current role')).toBeTruthy();
  expect(screen.getByText('Role details')).toBeTruthy();
});
it('ignores an older response after a filter changes and still shows jobs if optional metrics fail', async () => {
  let finishOld!: (value: JobPaginationResult<JobSummaryDto>) => void;
  vi.mocked(jobApi.getJobs).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishOld = resolve;
      }),
  );
  vi.mocked(jobApi.getMetrics).mockRejectedValue(new Error('Metrics unavailable'));
  render(<JobInboxView {...props} />);
  fireEvent.change(screen.getByLabelText('Workplace'), { target: { value: 'REMOTE' } });
  await screen.findByText('Current role');
  finishOld(result('Old result'));
  await waitFor(() => expect(screen.queryByText('Old result')).toBeNull());
  expect(screen.queryByRole('alert')).toBeNull();
  expect(jobApi.getJobs).toHaveBeenLastCalledWith(
    expect.objectContaining({ workplaceType: 'REMOTE' }),
  );
});
it('reports partial source failures with the imported result rather than claiming full discovery success', async () => {
  vi.mocked(jobApi.discoverJobs).mockResolvedValue({
    newJobsIngested: 1,
    totalDiscovered: 1653,
    postingsExamined: 200,
    duplicatesSkipped: 2,
    sourcesSummary: [
      {
        source: 'GREENHOUSE',
        totalFound: 0,
        newJobsIngested: 0,
        duplicatesSkipped: 0,
        errors: ['Source unavailable'],
      },
    ],
  });
  render(<JobInboxView {...props} />);
  await screen.findByText('Current role');
  fireEvent.click(screen.getByRole('button', { name: 'Find jobs' }));
  await screen.findByText('GREENHOUSE: Source unavailable');
  expect(screen.getByRole('status').textContent).toContain('1 new job');
  expect(screen.getByRole('status').textContent).toContain('200 checked from 1653 available');
  expect(screen.getByRole('status').textContent).not.toContain('1653 scanned');
  expect(screen.getByRole('status').textContent).toContain('Results may be incomplete');
});
it('shows a retryable load failure without presenting it as an empty collection', async () => {
  vi.mocked(jobApi.getJobs).mockRejectedValueOnce(new Error('Jobs temporarily unavailable'));
  render(<JobInboxView {...props} />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading jobs' }));
  await screen.findByText('Current role');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('refreshes the current filters when a discovery action finishes after the user changes the query', async () => {
  let finish!: (value: Awaited<ReturnType<typeof jobApi.discoverJobs>>) => void;
  vi.mocked(jobApi.discoverJobs).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<JobInboxView {...props} />);
  await screen.findByText('Current role');
  fireEvent.click(screen.getByRole('button', { name: 'Find jobs' }));
  fireEvent.change(screen.getByLabelText('Workplace'), { target: { value: 'REMOTE' } });
  await waitFor(() =>
    expect(jobApi.getJobs).toHaveBeenLastCalledWith(
      expect.objectContaining({ workplaceType: 'REMOTE' }),
    ),
  );
  const count = vi.mocked(jobApi.getJobs).mock.calls.length;
  finish({ newJobsIngested: 0, totalDiscovered: 0, duplicatesSkipped: 0, sourcesSummary: [] });
  await waitFor(() => expect(jobApi.getJobs).toHaveBeenCalledTimes(count + 1));
  expect(jobApi.getJobs).toHaveBeenLastCalledWith(
    expect.objectContaining({ workplaceType: 'REMOTE' }),
  );
});

it('automatically requests analysis and withholds unanalysed, stale and REVIEW cards', async () => {
  const match = role('Completed match');
  const raw = { ...role('Unanalysed role'), matchSummary: null };
  const review = {
    ...role('Review role'),
    matchSummary: { ...match.matchSummary!, decision: 'REVIEW' as const },
  };
  const stale = { ...role('Stale match'), matchSummary: { ...match.matchSummary!, isStale: true } };
  vi.mocked(jobApi.getJobs).mockResolvedValue({
    ...result('unused'),
    items: [raw, review, stale, match],
    total: 4,
  });
  render(<JobInboxView {...props} />);
  await screen.findByText('Completed match');
  expect(jobApi.refreshRecommendations).toHaveBeenCalled();
  expect(jobApi.getJobs).toHaveBeenCalledWith(
    expect.objectContaining({ recommendationsOnly: true }),
  );
  for (const title of ['Unanalysed role', 'Review role', 'Stale match'])
    expect(screen.queryByText(title)).toBeNull();
  fireEvent.click(screen.getByText('More tools'));
  fireEvent.click(screen.getByLabelText('Show all saved jobs'));
  await screen.findByText('Unanalysed role');
  expect(screen.getByText(/These are not recommendations/)).toBeTruthy();
  fireEvent.change(screen.getByTitle('Filter by match policy decision'), {
    target: { value: 'REVIEW' },
  });
  fireEvent.click(screen.getByLabelText('Show all saved jobs'));
  await waitFor(() =>
    expect(jobApi.getJobs).toHaveBeenLastCalledWith(
      expect.objectContaining({ recommendationsOnly: true, decision: undefined }),
    ),
  );
});
it('shows automatic-analysis failures and retries only when requested', async () => {
  vi.mocked(jobApi.refreshRecommendations).mockRejectedValueOnce(
    new Error('Recommendation worker unavailable'),
  );
  render(<JobInboxView {...props} />);
  await screen.findByText('Recommendation worker unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Retry automatic analysis' }));
  await waitFor(() => expect(jobApi.refreshRecommendations).toHaveBeenLastCalledWith(true));
});

it('shows a current profile MATCH with an explicit unknown-details label', async () => {
  const matched = role('Strong profile fit');
  matched.matchSummary = {
    ...matched.matchSummary!,
    summaryExplanation:
      'Profile match (84%): Professional fit meets your recommendation threshold.',
    unknowns: ['Salary was not published'],
  };
  vi.mocked(jobApi.getJobs).mockResolvedValue({ ...result('unused'), items: [matched] });
  render(<JobInboxView {...props} />);
  await screen.findByText('Strong profile fit');
  expect(screen.getByText(/Details to confirm: Salary was not published/)).toBeTruthy();
});

it('reloads completed recommendations on return to a tab without starting new discovery', async () => {
  render(<JobInboxView {...props} />);
  await screen.findByText('Current role');
  vi.mocked(jobApi.getJobs).mockResolvedValue(result('New completed role'));
  vi.mocked(jobApi.recommendationStatus).mockResolvedValue({
    state: 'IDLE',
    ready: 1,
    pending: 0,
    excluded: 0,
    evaluated: 1,
    processed: 0,
    batchSize: 0,
    locations: ['Warsaw'],
    levels: ['ENTRY'],
    message: 'Ready',
  });
  fireEvent(window, new Event('focus'));
  await screen.findByText('New completed role');
  expect(jobApi.discoverJobs).not.toHaveBeenCalled();
});

it('recovers the first page when the recommendation set shrinks on a later page', async () => {
  vi.mocked(jobApi.getJobs).mockImplementation(async (query) =>
    query?.page === 2
      ? { ...result('Unused'), items: [], total: 1, totalPages: 1, page: 2 }
      : { ...result('Remaining recommendation'), total: 1, totalPages: 2 },
  );
  render(<JobInboxView {...props} />);
  await screen.findByText('Remaining recommendation');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() =>
    expect(jobApi.getJobs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })),
  );
  expect(screen.getByText('Remaining recommendation')).toBeTruthy();
});
it('explains that active filters hide recommendations that are available', async () => {
  vi.mocked(jobApi.getJobs).mockImplementation(async (query) =>
    query?.workplaceType
      ? { ...result('Unused'), items: [], total: 0, totalPages: 0 }
      : result('Current role'),
  );
  render(<JobInboxView {...props} />);
  await screen.findByText('Current role');
  fireEvent.change(screen.getByLabelText('Workplace'), { target: { value: 'REMOTE' } });
  await screen.findByText(
    '1 recommended job is available. Clear the filters to see all matching roles.',
  );
});

it('shows one preparation module until analysis settles, then publishes analyzed jobs and stops polling', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const queued = {
    state: 'ANALYZING' as const,
    ready: 1,
    pending: 1,
    excluded: 0,
    evaluated: 1,
    processed: 0,
    batchSize: 1,
    locations: ['Warsaw'],
    levels: ['ENTRY'],
    message: 'Analyzing',
  };
  vi.mocked(jobApi.refreshRecommendations).mockResolvedValue(queued);
  vi.mocked(jobApi.recommendationStatus)
    .mockResolvedValueOnce(queued)
    .mockResolvedValue({ ...queued, state: 'IDLE', pending: 0 });
  try {
    render(<JobInboxView {...props} />);
    await screen.findByRole('heading', { name: 'Analyzing jobs for your profile' });
    expect(screen.queryByText('Current role')).toBeNull();
    const calls = vi.mocked(jobApi.getJobs).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(vi.mocked(jobApi.getJobs).mock.calls.length).toBe(calls);
    expect(screen.queryByText('Current role')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    await screen.findByText('Current role');
    expect(screen.queryByRole('heading', { name: 'Analyzing jobs for your profile' })).toBeNull();
    const settled = vi.mocked(jobApi.getJobs).mock.calls.length;
    const statuses = vi.mocked(jobApi.recommendationStatus).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(jobApi.getJobs).toHaveBeenCalledTimes(settled);
    expect(jobApi.recommendationStatus).toHaveBeenCalledTimes(statuses);
  } finally {
    cleanup();
    vi.useRealTimers();
  }
});
it('keeps the same job card and selected detail visible during a slow background focus refresh', async () => {
  render(
    <JobInboxView
      {...props}
      selectedJobId="Current role"
      detail={<div>Selected details stay here</div>}
    />,
  );
  await screen.findByText('Current role');
  const card = screen.getByText('Current role').closest('.job-card');
  let finish!: (value: JobPaginationResult<JobSummaryDto>) => void;
  vi.mocked(jobApi.getJobs).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  vi.mocked(jobApi.recommendationStatus).mockResolvedValue({
    state: 'IDLE',
    ready: 1,
    pending: 0,
    excluded: 0,
    evaluated: 1,
    processed: 0,
    batchSize: 0,
    locations: [],
    levels: [],
    message: 'Ready',
  });
  fireEvent(window, new Event('focus'));
  await waitFor(() => expect(finish).toBeDefined());
  expect(screen.getByText('Current role').closest('.job-card')).toBe(card);
  expect(screen.getByText('Selected details stay here')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Loading your jobs' })).toBeNull();
  finish(result('Current role'));
  await waitFor(() => expect(screen.getByText('Current role').closest('.job-card')).toBe(card));
});
it('exits preparation on analysis failure and allows retry without an endless loader', async () => {
  const failed = {
    state: 'FAILED' as const,
    ready: 1,
    pending: 1,
    excluded: 0,
    evaluated: 1,
    processed: 0,
    batchSize: 1,
    locations: [],
    levels: [],
    message: 'Analysis unavailable',
  };
  vi.mocked(jobApi.refreshRecommendations).mockResolvedValue(failed);
  render(<JobInboxView {...props} />);
  await screen.findByText('Current role');
  expect(screen.getByRole('button', { name: 'Retry automatic analysis' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Analyzing jobs for your profile' })).toBeNull();
});
