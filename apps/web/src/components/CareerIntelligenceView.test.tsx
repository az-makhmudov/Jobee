// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CareerIntelligenceView } from './CareerIntelligenceView.js';
import { careerIntelligenceApi } from '../api/career-intelligence-client.js';

vi.mock('../api/career-intelligence-client.js', () => ({
  careerIntelligenceApi: {
    getIntelligenceOverview: vi.fn(),
    listSuggestions: vi.fn(),
    getLearnedPreferences: vi.fn(),
    getRecords: vi.fn(),
    updateRecordAuthorization: vi.fn(),
    batchAuthorizeRecords: vi.fn(),
    applySuggestion: vi.fn(),
    dismissSuggestion: vi.fn(),
    submitClarification: vi.fn(),
    runEnrichment: vi.fn(),
    updateLearnedPreferences: vi.fn(),
    resetLearnedPreferences: vi.fn(),
  },
}));

describe('CareerIntelligenceView — Verification & AI Authorization Controls', () => {
  const mockOverview = {
    summary: {
      completenessScore: 82,
      verifiedFactsCount: 5,
      unverifiedFactsCount: 1,
      aiAuthorizedCount: 4,
      aiSuggestedCount: 2,
      lastConfirmedAt: '2026-10-17T10:00:00.000Z',
      highImpactQuestions: [
        {
          field: 'needsSponsorship',
          question: 'Do you require visa sponsorship?',
          context: 'Required for eligibility filtering',
          inputType: 'BOOLEAN' as const,
        },
      ],
      careerTrajectory: {
        primaryTargetTitle: 'Operations Assistant',
        adjacentRoles: ['Junior Scrum Master'],
        preferredIndustries: ['Banking', 'Fintech'],
      },
    },
    contextVersion: 1,
    candidateStateHash: 'abc123statehash',
  };

  const mockSuggestions = [
    {
      id: 'sugg-01',
      userId: 'user-01',
      suggestionType: 'MISSING_DETAIL' as const,
      title: 'Add Language: Polish',
      description: 'Mention of Polish found in uploaded CV',
      payload: { type: 'LANGUAGE', language: 'Polish', proficiency: 'INTERMEDIATE' },
      evidence: 'Found citation in CV',
      sourceDocumentId: 'doc-01',
      confidence: 95,
      status: 'PENDING' as const,
      appliedAt: null,
      createdAt: '2026-10-17T10:00:00.000Z',
      updatedAt: '2026-10-17T10:00:00.000Z',
    },
  ];

  const mockLearnedPrefs = {
    downvotedIndustries: ['Gambling'],
    downvotedCompanies: [],
    downvotedLocations: [],
    feedbackCounts: { NOT_INTERESTED: 1 },
  };

  const mockRecords = {
    records: {
      experiences: [
        {
          id: 'exp-01',
          entityType: 'experiences',
          title: 'Operations Assistant at Asia Alliance Bank',
          subtitle: 'May 2023 — Aug 2023',
          verificationStatus: 'VERIFIED',
          allowAiUse: true,
          sourceReference: 'MASTER_CV',
          confidence: 100,
          lastConfirmedAt: '2026-10-17T10:00:00.000Z',
        },
      ],
      education: [
        {
          id: 'edu-01',
          entityType: 'education',
          title: 'Bachelor in Management',
          subtitle: 'Vistula University (Oct 2023 — Present)',
          verificationStatus: 'VERIFIED',
          allowAiUse: false,
          sourceReference: 'MASTER_CV',
          confidence: 95,
          lastConfirmedAt: '2026-10-17T10:00:00.000Z',
        },
      ],
      skills: [
        {
          id: 'skill-01',
          entityType: 'skills',
          title: 'Agile & Scrum',
          subtitle: 'Methodology • Proficiency: ADVANCED',
          verificationStatus: 'UNVERIFIED',
          allowAiUse: false,
          sourceReference: 'AI_EXTRACTION',
          confidence: 80,
          lastConfirmedAt: null,
        },
      ],
      certifications: [],
      languages: [],
      projects: [],
      facts: [],
    },
    counts: {
      total: 3,
      verified: 2,
      aiAuthorized: 1,
      unverified: 1,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(careerIntelligenceApi.getIntelligenceOverview).mockResolvedValue(mockOverview as any);
    vi.mocked(careerIntelligenceApi.listSuggestions).mockResolvedValue({
      suggestions: mockSuggestions,
    });
    vi.mocked(careerIntelligenceApi.getLearnedPreferences).mockResolvedValue({
      learnedPreferences: mockLearnedPrefs as any,
    });
    vi.mocked(careerIntelligenceApi.getRecords).mockResolvedValue(mockRecords as any);
  });

  it('renders Section 3 with verification badges and AI-use authorization controls', async () => {
    render(<CareerIntelligenceView />);

    await waitFor(() => {
      expect(screen.getByText(/Candidate Records: Verification & AI Authorization/i)).toBeDefined();
    });

    // Check statistics badges
    expect(screen.getByText(/Total: 3/i)).toBeDefined();
    expect(screen.getByText(/Verified: 2/i)).toBeDefined();
    expect(screen.getByText(/In AI Prompt: 1/i)).toBeDefined();
    expect(screen.getByText(/AI-Gated: 1/i)).toBeDefined();

    // Check individual items and their badges
    expect(screen.getByText('Operations Assistant at Asia Alliance Bank')).toBeDefined();
    expect(screen.getByText('Bachelor in Management')).toBeDefined();
    expect(screen.getByText('Agile & Scrum')).toBeDefined();

    // Invariant check in badges
    expect(screen.getByText(/In AI Context/i)).toBeDefined();
    expect(screen.getAllByText(/Excluded from AI/i).length).toBeGreaterThan(0);
  });

  it('allows separate explicit verification without silently authorizing AI use', async () => {
    vi.mocked(careerIntelligenceApi.updateRecordAuthorization).mockResolvedValue({
      success: true,
      record: {},
    });

    render(<CareerIntelligenceView />);

    await waitFor(() => {
      expect(screen.getByText('Agile & Scrum')).toBeDefined();
    });

    // Find the "Verify" button for Agile & Scrum
    const verifyButtons = screen.getAllByRole('button', { name: /^Verify$/i });
    expect(verifyButtons.length).toBeGreaterThan(0);

    fireEvent.click(verifyButtons[0]!);

    await waitFor(() => {
      expect(careerIntelligenceApi.updateRecordAuthorization).toHaveBeenCalledWith(
        'skills',
        'skill-01',
        { verificationStatus: 'VERIFIED' },
      );
    });
  });

  it('allows authorizing AI use for verified records', async () => {
    vi.mocked(careerIntelligenceApi.updateRecordAuthorization).mockResolvedValue({
      success: true,
      record: {},
    });

    render(<CareerIntelligenceView />);

    await waitFor(() => {
      expect(screen.getByText('Bachelor in Management')).toBeDefined();
    });

    // edu-01 is verified, so button is "Allow AI"
    const allowAiButton = screen.getByRole('button', {
      name: /^Allow AI$/i,
    });
    expect(allowAiButton).toBeDefined();

    fireEvent.click(allowAiButton);

    await waitFor(() => {
      expect(careerIntelligenceApi.updateRecordAuthorization).toHaveBeenCalledWith(
        'education',
        'edu-01',
        { allowAiUse: true },
      );
    });
  });

  it('supports batch selection and batch verification', async () => {
    vi.mocked(careerIntelligenceApi.batchAuthorizeRecords).mockResolvedValue({
      success: true,
      updatedCount: 2,
    });

    render(<CareerIntelligenceView />);

    await waitFor(() => {
      expect(screen.getByText('Agile & Scrum')).toBeDefined();
    });

    // Select all items using header checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(1);

    // Select the first record checkbox
    fireEvent.click(checkboxes[1]!);

    // Check that batch action bar appears
    await waitFor(() => {
      expect(screen.getByText(/Selected: 1 record/i)).toBeDefined();
    });

    // Click "Verify Selected"
    const batchVerifyBtn = screen.getByRole('button', { name: /Verify Selected/i });
    fireEvent.click(batchVerifyBtn);

    await waitFor(() => {
      expect(careerIntelligenceApi.batchAuthorizeRecords).toHaveBeenCalled();
    });
  });

  it('handles AI enrichment execution and displays created suggestions count', async () => {
    vi.mocked(careerIntelligenceApi.runEnrichment).mockResolvedValue({
      suggestionsCreated: 4,
      suggestionsCount: 4,
      suggestions: [],
    });

    render(<CareerIntelligenceView />);

    await waitFor(() => {
      expect(screen.getByText('Review & suggestions')).toBeDefined();
    });

    const enrichButton = screen.getByRole('button', { name: /Run AI Enrichment/i });
    fireEvent.click(enrichButton);

    await waitFor(() => {
      expect(careerIntelligenceApi.runEnrichment).toHaveBeenCalled();
      expect(
        screen.getByText(/AI Enrichment complete! Created 4 suggestions for human review./i),
      ).toBeDefined();
    });
  });

  it('handles AI enrichment with zero new suggestions gracefully', async () => {
    vi.mocked(careerIntelligenceApi.runEnrichment).mockResolvedValue({
      suggestionsCreated: 0,
      suggestionsCount: 5,
      suggestions: [],
    });

    render(<CareerIntelligenceView />);

    await waitFor(() => {
      expect(screen.getByText('Review & suggestions')).toBeDefined();
    });

    const enrichButton = screen.getByRole('button', { name: /Run AI Enrichment/i });
    fireEvent.click(enrichButton);

    await waitFor(() => {
      expect(careerIntelligenceApi.runEnrichment).toHaveBeenCalled();
      expect(screen.getByText(/All profile suggestions are already up to date./i)).toBeDefined();
    });
  });

  it('renders actionable error banner and retry button when initial load fails', async () => {
    vi.mocked(careerIntelligenceApi.getIntelligenceOverview).mockRejectedValueOnce(
      new Error('Failed to connect to Career Intelligence API'),
    );

    render(<CareerIntelligenceView />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load your profile review/i)).toBeDefined();
      expect(screen.getByText(/Failed to connect to Career Intelligence API/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /^Retry$/i })).toBeDefined();
    });
  });
});
