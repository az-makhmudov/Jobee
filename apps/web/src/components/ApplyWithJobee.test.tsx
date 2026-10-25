// @vitest-environment happy-dom
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ApplicationIntentDto } from '@job-agent/shared';
import { ApplyWithJobee } from './ApplyWithJobee.js';
import { jobSearchApi } from '../api/job-search-client.js';
vi.mock('../api/job-search-client.js', () => ({
  jobSearchApi: {
    intentForJob: vi.fn(),
    apply: vi.fn(),
    cancelIntent: vi.fn(),
    resumeIntent: vi.fn(),
    intent: vi.fn(),
  },
}));
const intent: ApplicationIntentDto = {
  id: 'intent',
  jobId: 'job',
  applicationId: 'application',
  packageId: null,
  runId: null,
  status: 'QUEUED',
  message: 'Preparing your application in the background.',
  expiresAt: '2026-10-20T14:00:00Z',
  canCancel: true,
  canResume: false,
  events: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(jobSearchApi.intentForJob).mockResolvedValue(null);
  vi.mocked(jobSearchApi.apply).mockResolvedValue(intent);
});
afterEach(cleanup);
it('authorizes once without navigating to a studio and explains permission before the action', async () => {
  const open = vi.fn();
  render(<ApplyWithJobee jobId="job" onOpenPackage={open} />);
  expect(screen.getByText(/you authorize one application/)).toBeTruthy();
  const button = screen.getByRole('button', { name: 'Apply with Jobee' });
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
  fireEvent.click(button);
  await screen.findByText('Preparing your application in the background.');
  expect(jobSearchApi.apply).toHaveBeenCalledTimes(1);
  expect(open).not.toHaveBeenCalled();
  expect(screen.queryByText('Application submitted')).toBeNull();
});
it('restores a paused application and opens only its material questions before deliberate resume', async () => {
  vi.mocked(jobSearchApi.intentForJob).mockResolvedValue({
    ...intent,
    packageId: 'package',
    status: 'NEEDS_USER_ACTION',
    message: 'Confirm the employer question.',
    canResume: true,
  });
  vi.mocked(jobSearchApi.resumeIntent).mockResolvedValue(intent);
  const open = vi.fn();
  render(<ApplyWithJobee jobId="job" onOpenPackage={open} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Resolve application questions' }));
  expect(open).toHaveBeenCalledWith('package');
  expect(jobSearchApi.resumeIntent).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Authorize and resume' }));
  await waitFor(() => expect(jobSearchApi.resumeIntent).toHaveBeenCalledWith('intent'));
});
it('does not offer duplicate retry for an uncertain submission', async () => {
  vi.mocked(jobSearchApi.intentForJob).mockResolvedValue({
    ...intent,
    status: 'UNKNOWN_RESULT',
    message: 'Check the employer website before retrying.',
    canCancel: false,
    canResume: false,
  });
  render(<ApplyWithJobee jobId="job" employerUrl="https://employer.example.test/apply" />);
  await screen.findByText('Submission confirmation needed');
  expect(screen.queryByRole('button', { name: 'Authorize and resume' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Open employer website' }).getAttribute('rel')).toContain(
    'noopener',
  );
});
it('keeps apply disabled after status load failure and allows a read-only refresh', async () => {
  vi.mocked(jobSearchApi.intentForJob).mockRejectedValueOnce(new Error('Status unavailable'));
  render(<ApplyWithJobee jobId="job" />);
  await screen.findByText('Status unavailable');
  expect(screen.getByRole('button', { name: 'Apply with Jobee' }).hasAttribute('disabled')).toBe(
    true,
  );
  vi.mocked(jobSearchApi.intentForJob).mockResolvedValue(null);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh application status' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Apply with Jobee' }).hasAttribute('disabled')).toBe(
      false,
    ),
  );
});

it('offers an immediate manual handoff for Oracle without authorizing an automated attempt', async () => {
  const url =
    'https://ibqbjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Honeywell/job/159335';
  render(<ApplyWithJobee jobId="oracle-job" employerUrl={url} />);
  const link = await screen.findByRole('link', { name: 'Apply on employer website' });
  expect(link.getAttribute('href')).toBe(url);
  expect(link.getAttribute('rel')).toContain('noopener');
  expect(screen.queryByRole('button', { name: 'Apply with Jobee' })).toBeNull();
  expect(jobSearchApi.apply).not.toHaveBeenCalled();
});
it('preserves an existing attempt and its uncertainty controls even on a manual destination', async () => {
  vi.mocked(jobSearchApi.intentForJob).mockResolvedValue({
    ...intent,
    status: 'UNKNOWN_RESULT',
    message: 'Verify the employer result.',
    canCancel: false,
  });
  render(<ApplyWithJobee jobId="job" employerUrl="https://employer.example.test/apply" />);
  await screen.findByText('Submission confirmation needed');
  expect(screen.queryByRole('link', { name: 'Apply on employer website' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Open employer website' })).toBeTruthy();
});

it('withholds the manual handoff until existing-attempt lookup succeeds', async () => {
  vi.mocked(jobSearchApi.intentForJob).mockRejectedValueOnce(new Error('Status unavailable'));
  render(<ApplyWithJobee jobId="job" employerUrl="https://employer.example.test/apply" />);
  await screen.findByText('Status unavailable');
  expect(screen.queryByRole('link', { name: 'Apply on employer website' })).toBeNull();
  expect(jobSearchApi.apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh application status' }));
  await screen.findByRole('link', { name: 'Apply on employer website' });
});
