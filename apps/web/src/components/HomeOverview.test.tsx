// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import type {
  CandidateOverviewDto,
  ApplicationStudioMetricsDto,
  InterviewDashboardMetrics,
} from '@job-agent/shared';
import { HomeOverview } from './HomeOverview.js';
import { careerIntelligenceApi } from '../api/career-intelligence-client.js';
vi.mock('../api/application-crm-client.js', () => ({
  ApplicationCrmClient: { listApplications: vi.fn().mockResolvedValue({ items: [] }) },
}));
vi.mock('../api/career-intelligence-client.js', () => ({
  careerIntelligenceApi: { listSuggestions: vi.fn() },
}));
const overview = {
  profile: { fullName: 'Alex Morgan' },
  factCount: 0,
  verifiedFactCount: 0,
  hasActiveMasterCv: true,
  completeness: {
    score: 100,
    categories: [
      { category: 'profile', completed: true },
      { category: 'master_cv', completed: true },
      { category: 'preferences', completed: true },
    ],
    missingItems: [],
  },
} as unknown as CandidateOverviewDto;
const interviews = {
  preparationNeeded: 0,
  schedulingConflicts: 0,
  pendingConfirmations: 0,
} as InterviewDashboardMetrics;
const materials = { pendingApprovals: 0 } as ApplicationStudioMetricsDto;
const onNavigate = vi.fn();
function show(overrides: Partial<React.ComponentProps<typeof HomeOverview>> = {}) {
  return render(
    <HomeOverview
      overview={overview}
      jobs={null}
      materials={materials}
      interviews={interviews}
      onNavigate={onNavigate}
      onImport={vi.fn()}
      onProgress={vi.fn()}
      {...overrides}
    />,
  );
}
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(careerIntelligenceApi.listSuggestions).mockResolvedValue({ suggestions: [] });
});
describe('Student Home next steps', () => {
  it('does not manufacture work for a completed profile with empty queues', async () => {
    show();
    await screen.findByText(
      'No pending application reviews, profile suggestions or interview preparation found.',
    );
    expect(screen.queryByRole('button', { name: 'Review approvals' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Prepare' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue setup' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View profile' }));
    expect(onNavigate).toHaveBeenCalledWith('profile');
  });
  it('allows a student to start without a CV while retaining an explicit optional upload path', async () => {
    show({
      overview: {
        ...overview,
        hasActiveMasterCv: false,
        completeness: {
          ...overview.completeness,
          categories: overview.completeness.categories.map((item) =>
            item.category === 'master_cv' ? { ...item, completed: false } : item,
          ),
        },
      },
    });
    await screen.findByText(
      'No pending application reviews, profile suggestions or interview preparation found.',
    );
    expect(screen.queryByRole('button', { name: 'Continue setup' })).toBeNull();
    expect(screen.getByRole('button', { name: 'View profile' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add CV' })).toBeTruthy();
    expect(
      screen.getByText(
        'Your basic details and job preferences are saved. Adding a CV is optional.',
      ),
    ).toBeTruthy();
  });
  it('keeps absent work experience optional without changing the completeness score', async () => {
    show({
      overview: {
        ...overview,
        completeness: {
          score: 80,
          categories: [
            ...overview.completeness.categories,
            {
              category: 'experience',
              label: 'Professional Experience',
              completed: false,
              weight: 20,
            },
          ],
          missingItems: ['Add experience'],
        },
      },
    });
    await screen.findByText(
      'No pending application reviews, profile suggestions or interview preparation found.',
    );
    expect(screen.queryByRole('button', { name: 'Continue setup' })).toBeNull();
    expect(screen.getByText(/80% of profile details/)).toBeDefined();
  });
  it('leads with actual pending decisions and caps the task list at three', async () => {
    vi.mocked(careerIntelligenceApi.listSuggestions).mockResolvedValue({
      suggestions: [{ id: 'a' }, { id: 'b' }] as never,
    });
    show({
      materials: { ...materials, pendingApprovals: 2 },
      interviews: { ...interviews, preparationNeeded: 1 },
      overview: { ...overview, factCount: 2 },
    });
    await screen.findByText('2 profile suggestions to review');
    expect(screen.getByText('2 application items to review')).toBeDefined();
    expect(screen.getByText('Prepare for your interview')).toBeDefined();
    expect(screen.queryByText('Confirm your saved details')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Review suggestions' }));
    expect(onNavigate).toHaveBeenCalledWith('career-intelligence');
  });
  it('does not report all clear when a required lookup fails, and can retry', async () => {
    vi.mocked(careerIntelligenceApi.listSuggestions).mockRejectedValueOnce(
      new Error('unavailable'),
    );
    show();
    await screen.findByRole('button', { name: 'Retry profile suggestions' });
    expect(
      screen.queryByText(
        'No pending application reviews, profile suggestions or interview preparation found.',
      ),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry profile suggestions' }));
    await screen.findByText(
      'No pending application reviews, profile suggestions or interview preparation found.',
    );
    expect(careerIntelligenceApi.listSuggestions).toHaveBeenCalledTimes(2);
  });
  it('shows checking rather than a false empty state while suggestions are pending', async () => {
    let finish!: (value: { suggestions: [] }) => void;
    vi.mocked(careerIntelligenceApi.listSuggestions).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    show();
    expect(screen.getByText('Checking your next steps…')).toBeDefined();
    expect(screen.queryByText(/could not be confirmed/)).toBeNull();
    finish({ suggestions: [] });
    await waitFor(() =>
      expect(
        screen.getByText(
          'No pending application reviews, profile suggestions or interview preparation found.',
        ),
      ).toBeDefined(),
    );
  });
});
