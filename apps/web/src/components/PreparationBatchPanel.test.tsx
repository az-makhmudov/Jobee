// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DEFAULT_SEARCH_SETTINGS, type PreparationBatchDto } from '@job-agent/shared';
import { PreparationBatchPanel } from './PreparationBatchPanel.js';
import { jobSearchApi } from '../api/job-search-client.js';
import { candidateApi } from '../api/candidate-client.js';
vi.mock('../api/job-search-client.js', () => ({
  jobSearchApi: {
    settings: vi.fn(),
    batches: vi.fn(),
    create: vi.fn(),
    review: vi.fn(),
    submit: vi.fn(),
    questions: vi.fn(),
    cancel: vi.fn(),
    retry: vi.fn(),
  },
}));
vi.mock('../api/candidate-client.js', () => ({ candidateApi: { getDocuments: vi.fn() } }));
const batch: PreparationBatchDto = {
  id: 'batch-fixture',
  createdAt: '2026-10-20T00:00:00Z',
  cancelledAt: null,
  items: [
    {
      id: 'item-fixture',
      jobId: 'job-fixture',
      title: 'Project Intern',
      company: 'Fixture Company',
      status: 'READY',
      packageId: 'package-fixture',
      applicationId: 'application-fixture',
      error: null,
      versionNumber: 2,
      outstandingQuestions: 0,
      method: 'AUTOMATIC_FORM',
      methodNote: 'Checked during execution',
      runStatus: null,
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(jobSearchApi.settings).mockResolvedValue(DEFAULT_SEARCH_SETTINGS);
  vi.mocked(candidateApi.getDocuments).mockResolvedValue([]);
  vi.mocked(jobSearchApi.batches).mockResolvedValue([batch]);
  vi.mocked(jobSearchApi.create).mockResolvedValue(batch);
  vi.mocked(jobSearchApi.review).mockResolvedValue([
    {
      itemId: 'item-fixture',
      submissionToken: 'signed-fixture-ticket',
      manifestChecksum: 'fixture-checksum',
      packageVersionId: 'version-fixture',
      expiresAt: '2026-10-20T00:15:00Z',
      applicationId: 'application-fixture',
      jobTitle: 'Project Intern',
      company: 'Fixture Company',
      artifacts: { cvArtifactId: 'cv-fixture' },
      answersCount: 6,
    },
  ]);
  vi.mocked(jobSearchApi.submit).mockResolvedValue([
    { itemId: 'item-fixture', runId: 'run-fixture', error: null },
  ]);
});
afterEach(cleanup);
it('prepares selected jobs without requesting or sending submission authorization', async () => {
  const prepared = vi.fn();
  render(
    <PreparationBatchPanel
      selectedJobIds={['job-fixture']}
      onPrepared={prepared}
      onOpenPackage={vi.fn()}
    />,
  );
  const button = screen.getByRole('button', { name: 'Prepare selected (1)' });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(button);
  await waitFor(() => expect(prepared).toHaveBeenCalledTimes(1));
  expect(jobSearchApi.create).toHaveBeenCalledWith(['job-fixture'], null);
  expect(jobSearchApi.review).not.toHaveBeenCalled();
  expect(jobSearchApi.submit).not.toHaveBeenCalled();
});
it('enumerates actual versions and requires deliberate confirmation before dispatch', async () => {
  render(
    <PreparationBatchPanel selectedJobIds={[]} onPrepared={vi.fn()} onOpenPackage={vi.fn()} />,
  );
  fireEvent.click(
    await screen.findByRole('checkbox', {
      name: 'Select Project Intern at Fixture Company for final review',
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Apply reviewed selections' }));
  await screen.findByRole('dialog');
  expect(screen.getByText('Version 2 · 6 reviewed answers')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'View CV' }).getAttribute('href')).toContain(
    'cv-fixture/download',
  );
  const dispatch = screen.getByRole('button', {
    name: 'Authorize & apply to 1 roles',
  }) as HTMLButtonElement;
  expect(dispatch.disabled).toBe(true);
  expect(jobSearchApi.submit).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('checkbox', {
      name: 'I reviewed these materials and authorize sending these applications.',
    }),
  );
  expect(dispatch.disabled).toBe(false);
  fireEvent.click(dispatch);
  await waitFor(() =>
    expect(jobSearchApi.submit).toHaveBeenCalledWith('batch-fixture', [
      { itemId: 'item-fixture', submissionToken: 'signed-fixture-ticket' },
    ]),
  );
});
it('keeps uncertain attempts unselectable and cancellation does not submit', async () => {
  vi.mocked(jobSearchApi.batches).mockResolvedValue([
    { ...batch, items: [{ ...batch.items[0]!, runStatus: 'SUBMISSION_UNCERTAIN' }] },
  ]);
  render(
    <PreparationBatchPanel selectedJobIds={[]} onPrepared={vi.fn()} onOpenPackage={vi.fn()} />,
  );
  const select = await screen.findByRole('checkbox', {
    name: 'Select Project Intern at Fixture Company for final review',
  });
  expect((select as HTMLInputElement).disabled).toBe(true);
  expect(screen.getByText('Confirmation needed · Document version 2')).toBeTruthy();
  expect(jobSearchApi.review).not.toHaveBeenCalled();
  expect(jobSearchApi.submit).not.toHaveBeenCalled();
});
