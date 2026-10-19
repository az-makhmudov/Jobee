// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ApplicationDetailDto } from '@job-agent/shared';
import { ApplicationWorkspaceView } from './ApplicationWorkspaceView.js';
import { ApplicationCrmClient } from '../api/application-crm-client.js';
import {
  applicationPackageClient,
  type PackageDetailResponse,
} from '../api/application-package-client.js';
vi.mock('../api/application-crm-client.js', () => ({
  ApplicationCrmClient: { getApplicationDetail: vi.fn(), getApplicationForJob: vi.fn() },
}));
vi.mock('../api/application-package-client.js', () => ({
  applicationPackageClient: { getPackage: vi.fn(), listPackages: vi.fn() },
}));
vi.mock('./ApplicationStudioView.js', () => ({
  ApplicationStudioView: ({
    onPackageChange,
  }: {
    onPackageChange: (data: PackageDetailResponse) => void;
  }) => (
    <div>
      <input aria-label="Unsaved document draft" defaultValue="Original" />
      <button
        onClick={() =>
          onPackageChange({ ...materials, readiness: { ...materials.readiness, isReady: true } })
        }
      >
        Resolve reviewed items
      </button>
    </div>
  ),
}));
vi.mock('./ApplicationDetailView.js', () => ({
  ApplicationDetailView: () => (
    <input aria-label="Unsaved progress draft" defaultValue="Original" />
  ),
}));
const materials: PackageDetailResponse = {
  package: {
    id: 'package-one',
    jobId: 'job-one',
    jobTitle: 'Intern',
    jobCompany: 'Northstar',
    userId: 'synthetic-user',
    status: 'NEEDS_REVIEW',
    currentVersionNumber: 0,
    hasPolicyBlocker: false,
    blockerOverridden: false,
    isStale: false,
    createdAt: '2026-10-19T10:00:00Z',
    updatedAt: '2026-10-19T10:00:00Z',
  },
  artifacts: [],
  questions: [],
  approvals: [],
  currentVersion: null,
  readiness: {
    status: 'NEEDS_REVIEW',
    isReady: false,
    reasons: [],
    blockingIssues: ['Synthetic unresolved item'],
    pendingApprovalsCount: 1,
    unresolvedQuestionsCount: 1,
  },
};
const detail = {
  application: { id: 'application-one', applicationUrl: 'https://example.test/apply' },
  job: { id: 'job-one', title: 'Intern', company: 'Northstar' },
  currentPackage: { packageId: 'package-one' },
} as ApplicationDetailDto;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ApplicationCrmClient.getApplicationDetail).mockResolvedValue(detail);
  vi.mocked(ApplicationCrmClient.getApplicationForJob).mockResolvedValue(detail.application);
  vi.mocked(applicationPackageClient.getPackage).mockResolvedValue(materials);
  vi.mocked(applicationPackageClient.listPackages).mockResolvedValue([]);
});
afterEach(cleanup);
function show(props = {}) {
  return render(
    <ApplicationWorkspaceView
      applicationId="application-one"
      packageId={null}
      onBack={vi.fn()}
      onNavigateToJob={vi.fn()}
      onNavigateToProfile={vi.fn()}
      {...props}
    />,
  );
}
it('keeps the linked record, progress and document drafts while moving through the workspace', async () => {
  show();
  await screen.findByRole('heading', { name: 'Intern · Northstar' });
  fireEvent.change(screen.getByLabelText('Unsaved progress draft'), {
    target: { value: 'Keep my follow-up' },
  });
  fireEvent.click(screen.getByRole('tab', { name: 'Documents' }));
  fireEvent.change(screen.getByLabelText('Unsaved document draft'), {
    target: { value: 'Keep my document' },
  });
  fireEvent.click(screen.getByRole('tab', { name: 'Questions' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Progress & details' }));
  expect(screen.getByLabelText('Unsaved progress draft')).toHaveProperty(
    'value',
    'Keep my follow-up',
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Documents' }));
  expect(screen.getByLabelText('Unsaved document draft')).toHaveProperty(
    'value',
    'Keep my document',
  );
  expect(ApplicationCrmClient.getApplicationDetail).toHaveBeenCalledWith('application-one');
  expect(applicationPackageClient.getPackage).toHaveBeenCalledWith('package-one');
});
it('keeps final review disabled until the server readiness result changes, without treating navigation as approval', async () => {
  show({ applicationId: null, packageId: 'package-one' });
  await screen.findByRole('heading', { name: 'Intern · Northstar' });
  expect(screen.getByRole('tab', { name: 'Final review' })).toHaveProperty('disabled', true);
  expect(screen.queryByText('Continue on employer website')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Resolve reviewed items' }));
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: 'Final review' })).toHaveProperty('disabled', false),
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Final review' }));
  expect(
    screen.getByRole('link', { name: 'Continue on employer website' }).getAttribute('href'),
  ).toBe('https://example.test/apply');
});
it('shows an explicit recovery state when linked data cannot be retrieved', async () => {
  vi.mocked(applicationPackageClient.getPackage).mockRejectedValueOnce(new Error('Access denied'));
  show();
  await screen.findByRole('alert');
  expect(screen.getByText('Access denied')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByRole('heading', { name: 'Intern · Northstar' });
});
it('retains manual applications with no linked package without creating data on tab changes', async () => {
  vi.mocked(ApplicationCrmClient.getApplicationDetail).mockResolvedValue({
    ...detail,
    currentPackage: null,
  });
  const onJob = vi.fn();
  show({ onNavigateToJob: onJob });
  await screen.findByRole('heading', { name: 'Intern · Northstar' });
  fireEvent.click(screen.getByRole('tab', { name: 'Documents' }));
  fireEvent.click(screen.getByRole('button', { name: 'View job & prepare documents' }));
  expect(onJob).toHaveBeenCalledWith('job-one');
  expect(applicationPackageClient.getPackage).not.toHaveBeenCalled();
  expect(screen.getByRole('tab', { name: 'Final review' })).toHaveProperty('disabled', true);
});

it('finds existing documents for a manually tracked job without creating or relinking records', async () => {
  vi.mocked(ApplicationCrmClient.getApplicationDetail).mockResolvedValue({
    ...detail,
    currentPackage: null,
  });
  vi.mocked(applicationPackageClient.listPackages).mockResolvedValue([materials.package]);
  show();
  await screen.findByRole('heading', { name: 'Intern · Northstar' });
  expect(applicationPackageClient.listPackages).toHaveBeenCalledWith({ jobId: 'job-one' });
  expect(applicationPackageClient.getPackage).toHaveBeenCalledWith('package-one');
  fireEvent.click(screen.getByRole('tab', { name: 'Documents' }));
  expect(screen.getByLabelText('Unsaved document draft')).toBeTruthy();
});
