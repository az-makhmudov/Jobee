// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { JobPaginationResult, JobSummaryDto } from '@job-agent/shared';
import { JobInboxView } from './JobInboxView.js';
import { jobApi } from '../api/job-client.js';
vi.mock('../api/job-client.js', () => ({
  jobApi: { getJobs: vi.fn(), getMetrics: vi.fn(), discoverJobs: vi.fn() },
}));
vi.mock('./PreparationBatchPanel.js', () => ({ PreparationBatchPanel: () => null }));
vi.mock('./AddJobModal.js', () => ({ AddJobModal: () => null }));
const role = (title: string): JobSummaryDto => ({
  id: title,
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
    totalDiscovered: 5,
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
