// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DashboardView } from './DashboardView.js';
import { candidateApi } from '../api/candidate-client.js';

vi.mock('../api/candidate-client.js', () => ({
  candidateApi: {
    getOverview: vi.fn(),
    getAuditEvents: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../api/job-client.js', () => ({
  jobApi: {
    getMetrics: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../api/application-package-client.js', () => ({
  applicationPackageClient: {
    getMetrics: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../api/application-crm-client.js', () => ({
  ApplicationCrmClient: {
    getMetrics: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../api/email-client.js', () => ({
  emailClient: {
    getStats: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../api/calendar-client.js', () => ({
  calendarClient: {
    getMetrics: vi.fn().mockResolvedValue({}),
  },
}));

describe('DashboardView — Guest Experience & Authentication Boundaries (UI-02)', () => {
  const onNavigateMock = vi.fn();
  const onOpenAuthMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders guest welcome experience when 401 unauthenticated error occurs', async () => {
    vi.mocked(candidateApi.getOverview).mockRejectedValue(
      new Error('Authentication required to access this resource'),
    );

    render(<DashboardView onNavigate={onNavigateMock} onOpenAuth={onOpenAuthMock} />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to Jobee')).toBeDefined();
    });

    // Verify guest copy is present
    expect(screen.getByText(/Your autonomous, truthful AI job search partner/i)).toBeDefined();

    // Verify Sign In / Join Private Pilot button is present
    const signInBtn = screen.getByRole('button', { name: /Sign In \/ Join Private Pilot/i });
    expect(signInBtn).toBeDefined();

    // Verify private data error banner is NOT rendered
    expect(screen.queryByText('Error Loading Candidate Data')).toBeNull();

    // Verify clicking button triggers onOpenAuth callback
    fireEvent.click(signInBtn);
    expect(onOpenAuthMock).toHaveBeenCalledTimes(1);
  });

  it('renders guest welcome experience when HTTP error 401 is thrown', async () => {
    vi.mocked(candidateApi.getOverview).mockRejectedValue(new Error('HTTP error 401'));

    render(<DashboardView onNavigate={onNavigateMock} onOpenAuth={onOpenAuthMock} />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to Jobee')).toBeDefined();
    });

    expect(screen.queryByText('Error Loading Candidate Data')).toBeNull();
  });

  it('renders error card when genuine server error occurs (e.g. 500 Internal Error)', async () => {
    vi.mocked(candidateApi.getOverview).mockRejectedValue(new Error('Database connection failed'));

    render(<DashboardView onNavigate={onNavigateMock} onOpenAuth={onOpenAuthMock} />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Candidate Data')).toBeDefined();
    });

    expect(screen.getByText('Database connection failed')).toBeDefined();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeDefined();
    expect(screen.queryByText('Welcome to Jobee')).toBeNull();
  });
});
