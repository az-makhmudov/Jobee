// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AutopilotSettings } from './AutopilotSettings.js';
const state = {
  candidateFingerprint: 'a'.repeat(64),
  available: true,
  enabled: false,
  current: false,
  grant: null,
  nextRunAt: null,
  message: 'Autopilot is off.',
  preview: {
    targetTitles: ['Software Engineer'],
    preferredLocations: ['Berlin'],
    workModes: ['remote'],
    employmentTypes: ['full-time'],
    minSalary: null,
    currency: 'EUR',
    salaryPayPeriod: null,
    excludedCompanies: [],
    excludedKeywords: [],
    needsSponsorship: null,
    workAuthorizationCountries: [],
    internshipEligible: null,
    acceptUnpaid: false,
  },
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('requires deliberate consent to the visible scope before accepting a policy', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: state }) });
  vi.stubGlobal('fetch', fetcher);
  render(<AutopilotSettings />);
  await screen.findByText(/Roles: Software Engineer/);
  const authorize = screen.getByRole('button', {
    name: 'Authorize new policy',
  }) as HTMLButtonElement;
  expect(authorize.disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  expect(authorize.disabled).toBe(false);
  fireEvent.click(authorize);
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith(
      '/api/autopilot/authorize',
      expect.objectContaining({ method: 'POST' }),
    ),
  );
  const payload = JSON.parse(
    fetcher.mock.calls.find((call) => call[0] === '/api/autopilot/authorize')![1].body,
  );
  expect(payload).toMatchObject({
    termsVersion: 'jobee-autopilot-v1',
    expectedCandidateFingerprint: state.candidateFingerprint,
    maxPerDay: 5,
    minScore: 90,
    reviewMode: 'PAUSE',
  });
});
it('keeps load failures visible and cannot authorize a default policy', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Synthetic unavailable policy')));
  render(<AutopilotSettings />);
  expect((await screen.findByRole('alert')).textContent).toContain('Synthetic unavailable');
  expect(screen.queryByRole('button', { name: 'Authorize new policy' })).toBeNull();
});
it('does not enable unavailable rollout even with a checked consent', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ...state, available: false } }),
    }),
  );
  render(<AutopilotSettings />);
  await screen.findByText(/Roles: Software Engineer/);
  fireEvent.click(screen.getByRole('checkbox'));
  expect(
    (screen.getByRole('button', { name: 'Authorize new policy' }) as HTMLButtonElement).disabled,
  ).toBe(true);
});
