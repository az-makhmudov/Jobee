// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { JobDto } from '@job-agent/shared';
import { AddJobModal } from './AddJobModal.js';
import { jobApi } from '../api/job-client.js';
vi.mock('../api/job-client.js', () => ({
  jobApi: { ingestUrl: vi.fn(), ingestText: vi.fn(), updateJob: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('keeps a page-shell import open and completes the same record from pasted vacancy text', async () => {
  const shell = {
    id: 'fixture-job',
    title: 'Careers',
    description: 'Enable JavaScript.',
    state: 'NEEDS_REVIEW',
  } as JobDto;
  const description =
    'Title: Project Management Intern\nCompany: Synthetic employer\nLocation: Warsaw, Poland\nAssist with project coordination and stakeholder reporting in this deterministic fixture.';
  vi.mocked(jobApi.ingestUrl).mockResolvedValue({ job: shell, isDuplicate: false });
  const complete = {
    ...shell,
    title: 'Project Management Intern',
    description,
    state: 'INGESTED',
  } as JobDto;
  vi.mocked(jobApi.updateJob).mockResolvedValue(complete);
  const onClose = vi.fn(),
    onJobCreated = vi.fn();
  render(<AddJobModal isOpen onClose={onClose} onJobCreated={onJobCreated} />);
  fireEvent.change(screen.getByLabelText('Job Posting Public URL'), {
    target: { value: 'https://example.test/vacancy' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Import Job' }));
  await screen.findByText(/did not expose the vacancy details/);
  expect(onClose).not.toHaveBeenCalled();
  expect(onJobCreated).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Pasted Job Description *'), {
    target: { value: description },
  });
  fireEvent.submit(screen.getByLabelText('Pasted Job Description *').closest('form')!);
  await vi.waitFor(() => expect(onJobCreated).toHaveBeenCalledWith(complete));
  expect(jobApi.updateJob).toHaveBeenCalledWith(shell.id, { description });
  expect(jobApi.ingestText).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledOnce();
});

it('does not reuse a cancelled incomplete-import target when adding another job', async () => {
  const shell = { id: 'cancelled-fixture', description: 'Enable JavaScript.' } as JobDto;
  const description =
    'A separate complete synthetic job description for an unrelated new vacancy. This text is deliberately long enough for import validation.';
  const created = { id: 'new-fixture', description } as JobDto;
  vi.mocked(jobApi.ingestUrl).mockResolvedValue({ job: shell, isDuplicate: false });
  vi.mocked(jobApi.ingestText).mockResolvedValue({ job: created, isDuplicate: false });
  const props = { onClose: vi.fn(), onJobCreated: vi.fn() };
  const view = render(<AddJobModal isOpen {...props} />);
  fireEvent.change(screen.getByLabelText('Job Posting Public URL'), {
    target: { value: 'https://example.test/vacancy' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Import Job' }));
  await screen.findByText(/did not expose the vacancy details/);
  view.rerender(<AddJobModal isOpen={false} {...props} />);
  view.rerender(<AddJobModal isOpen {...props} />);
  expect((screen.getByLabelText('Job Posting Public URL') as HTMLInputElement).value).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'Paste Job Text' }));
  fireEvent.change(screen.getByLabelText('Pasted Job Description *'), {
    target: { value: description },
  });
  fireEvent.submit(screen.getByLabelText('Pasted Job Description *').closest('form')!);
  await vi.waitFor(() => expect(props.onJobCreated).toHaveBeenCalledWith(created));
  expect(jobApi.ingestText).toHaveBeenCalled();
  expect(jobApi.updateJob).not.toHaveBeenCalled();
});
