// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SmartProfileImportModal } from './SmartProfileImportModal.js';
import { candidateImportApi } from '../api/candidate-import-client.js';
import type { ProfileImportItemDto, ProfileImportSessionDto } from '@job-agent/shared';

vi.mock('../api/candidate-import-client.js', () => ({
  candidateImportApi: {
    upload: vi.fn(),
    extractAndCompare: vi.fn(),
    getSession: vi.fn(),
    updateItem: vi.fn(),
    bulkUpdateItems: vi.fn(),
    commitSession: vi.fn(),
    discardSession: vi.fn(),
  },
}));

describe('SmartProfileImportModal — Review Approval Safety', () => {
  const mockSession: ProfileImportSessionDto = {
    id: 'session-qa-01',
    userId: 'user-01',
    sourceType: 'CV',
    status: 'REVIEW_READY',
    originalFilename: 'resume.pdf',
    mimeType: 'application/pdf',
    storageKey: 'uploads/resume.pdf',
    documentId: null,
    aiConsentGiven: true,
    extractorUsed: 'GEMINI_AI',
    rawTextSnippet: 'Software Developer at TechCorp',
    errorMessage: null,
    itemCounts: {
      total: 2,
      approved: 0,
      rejected: 0,
      pending: 2,
      byClassification: {
        NEW: 2,
        DUPLICATE: 0,
        MATCHED: 0,
        CONFLICT: 0,
        INCOMPLETE: 0,
        LOW_CONFIDENCE: 0,
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const initialItems: ProfileImportItemDto[] = [
    {
      id: 'item-exp-1',
      sessionId: 'session-qa-01',
      userId: 'user-01',
      section: 'EXPERIENCE',
      classification: 'NEW',
      confidenceScore: 0.95,
      sourceReference: 'Software Developer at TechCorp (2021 - 2023)',
      extractedPayload: {
        organization: 'TechCorp',
        position: 'Software Developer',
        startDate: '2021-01',
        endDate: '2023-05',
        location: 'Warsaw',
        description: 'Developed backend microservices',
        achievements: ['Increased performance by 30%'],
      },
      existingEntityId: null,
      existingPayload: null,
      conflictDetails: null,
      reviewStatus: 'PENDING',
      userEditedPayload: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item-skill-1',
      sessionId: 'session-qa-01',
      userId: 'user-01',
      section: 'SKILL',
      classification: 'NEW',
      confidenceScore: 0.9,
      sourceReference: 'TypeScript',
      extractedPayload: {
        name: 'TypeScript',
        category: 'Engineering',
        proficiency: null,
        yearsExperience: 4,
      },
      existingEntityId: null,
      existingPayload: null,
      conflictDetails: null,
      reviewStatus: 'PENDING',
      userEditedPayload: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initially renders with 0 approved count', () => {
    render(
      <SmartProfileImportModal
        isOpen={true}
        onClose={vi.fn()}
        initialStep="REVIEW"
        initialSession={mockSession}
        initialItems={initialItems}
      />,
    );

    expect(screen.getByText(/3\. Review/i)).toBeDefined();
    expect(screen.getByText(/0 approved/i)).toBeDefined();
  });

  it('clicking Edit, modifying a field, and Saving Changes persists edits but DOES NOT automatically approve the item', async () => {
    const updatedEditedItem: ProfileImportItemDto = {
      ...initialItems[0]!,
      reviewStatus: 'EDITED',
      userEditedPayload: {
        ...initialItems[0]!.extractedPayload,
        position: 'Lead Backend Engineer',
      },
    };

    (candidateImportApi.updateItem as any).mockResolvedValueOnce(updatedEditedItem);

    render(
      <SmartProfileImportModal
        isOpen={true}
        onClose={vi.fn()}
        initialStep="REVIEW"
        initialSession={mockSession}
        initialItems={initialItems}
      />,
    );

    // 1. Initial State: 0 approved
    expect(screen.getByText(/0 approved/i)).toBeDefined();

    // 2. Click "✎ Edit" on Experience card
    const editButtons = screen.getAllByRole('button', { name: /✎ Edit/i });
    fireEvent.click(editButtons[0]!);

    // 3. Edit form is visible: input for Position
    const positionInput = screen.getByDisplayValue('Software Developer');
    expect(positionInput).toBeDefined();

    // 4. Modify Position field
    fireEvent.change(positionInput, { target: { value: 'Lead Backend Engineer' } });

    // 5. Click "💾 Save Changes"
    const saveButton = screen.getByRole('button', { name: /💾 Save Changes/i });
    fireEvent.click(saveButton);

    // 6. Verify candidateImportApi.updateItem called with 'EDITED' and modified payload
    await waitFor(() => {
      expect(candidateImportApi.updateItem).toHaveBeenCalledTimes(1);
    });
    expect(candidateImportApi.updateItem).toHaveBeenCalledWith(
      'session-qa-01',
      'item-exp-1',
      'EDITED',
      expect.objectContaining({
        position: 'Lead Backend Engineer',
      }),
    );

    // 7. Verify item is updated in display to "Lead Backend Engineer"
    await waitFor(() => {
      expect(screen.getByText(/Lead Backend Engineer at TechCorp/i)).toBeDefined();
    });

    // 8. CRUCIAL SAFETY INVARIANT: Item is NOT approved!
    // Approved count must remain 0!
    expect(screen.getByText(/0 approved/i)).toBeDefined();

    // 9. Card displays "EDITED (NEEDS APPROVAL)" badge
    expect(screen.getByText(/EDITED \(NEEDS APPROVAL\)/i)).toBeDefined();

    // 10. The Accept button is NOT styled as active/primary
    const acceptButtons = screen.getAllByRole('button', { name: /✓ Accept/i });
    // The card's Accept button (index 2, since 0 and 1 are bulk Accept All New and Accept All)
    const cardAcceptBtn = acceptButtons[2]!;
    expect(cardAcceptBtn.className).toContain('btn-secondary');
    expect(cardAcceptBtn.className).not.toContain('btn-primary');
  });

  it('clicking Accept after saving an edit increases the approved count and updates reviewStatus to APPROVED', async () => {
    // Starting with an item in EDITED review status
    const editedItem: ProfileImportItemDto = {
      ...initialItems[0]!,
      reviewStatus: 'EDITED',
      userEditedPayload: {
        ...initialItems[0]!.extractedPayload,
        position: 'Lead Backend Engineer',
      },
    };

    const approvedItem: ProfileImportItemDto = {
      ...editedItem,
      reviewStatus: 'APPROVED',
    };

    (candidateImportApi.updateItem as any).mockResolvedValueOnce(approvedItem);

    render(
      <SmartProfileImportModal
        isOpen={true}
        onClose={vi.fn()}
        initialStep="REVIEW"
        initialSession={mockSession}
        initialItems={[editedItem, initialItems[1]!]}
      />,
    );

    // Initial state: 0 approved (EDITED does not count)
    expect(screen.getByText(/0 approved/i)).toBeDefined();
    expect(screen.getByText(/EDITED \(NEEDS APPROVAL\)/i)).toBeDefined();

    // Click "✓ Accept" on the edited item
    const acceptButtons = screen.getAllByRole('button', { name: /✓ Accept/i });
    const cardAcceptBtn = acceptButtons[2]!;
    fireEvent.click(cardAcceptBtn);

    // Verify candidateImportApi.updateItem called with 'APPROVED'
    await waitFor(() => {
      expect(candidateImportApi.updateItem).toHaveBeenCalledWith(
        'session-qa-01',
        'item-exp-1',
        'APPROVED',
      );
    });

    // CRUCIAL: Approved count increases from 0 to 1!
    await waitFor(() => {
      expect(screen.getByText(/1 approved/i)).toBeDefined();
    });

    // Card now displays APPROVED badge and primary styling
    expect(screen.getByText(/● APPROVED/i)).toBeDefined();
    expect(cardAcceptBtn.className).toContain('btn-primary');
  });

  it('clicking Reject transitions item to REJECTED and preserves 0 approved count', async () => {
    const rejectedItem: ProfileImportItemDto = {
      ...initialItems[0]!,
      reviewStatus: 'REJECTED',
    };

    (candidateImportApi.updateItem as any).mockResolvedValueOnce(rejectedItem);

    render(
      <SmartProfileImportModal
        isOpen={true}
        onClose={vi.fn()}
        initialStep="REVIEW"
        initialSession={mockSession}
        initialItems={initialItems}
      />,
    );

    const rejectButtons = screen.getAllByRole('button', { name: /✕ Reject/i });
    // Card reject button (index 1, since index 0 is bulk Reject All)
    fireEvent.click(rejectButtons[1]!);

    await waitFor(() => {
      expect(candidateImportApi.updateItem).toHaveBeenCalledWith(
        'session-qa-01',
        'item-exp-1',
        'REJECTED',
      );
    });

    // Approved count remains 0
    expect(screen.getByText(/0 approved/i)).toBeDefined();
    expect(screen.getByText(/● REJECTED/i)).toBeDefined();
  });

  it('re-editing an already approved item resets its approval status until re-accepted', async () => {
    // Starting with an already approved item
    const approvedItem: ProfileImportItemDto = {
      ...initialItems[0]!,
      reviewStatus: 'APPROVED',
    };

    const reEditedItem: ProfileImportItemDto = {
      ...approvedItem,
      reviewStatus: 'EDITED',
      userEditedPayload: {
        ...initialItems[0]!.extractedPayload,
        position: 'Staff Engineer',
      },
    };

    (candidateImportApi.updateItem as any).mockResolvedValueOnce(reEditedItem);

    render(
      <SmartProfileImportModal
        isOpen={true}
        onClose={vi.fn()}
        initialStep="REVIEW"
        initialSession={mockSession}
        initialItems={[approvedItem]}
      />,
    );

    // Initial state: 1 approved
    expect(screen.getByText(/1 approved/i)).toBeDefined();

    // Click "✎ Edit"
    const editBtn = screen.getByRole('button', { name: /✎ Edit/i });
    fireEvent.click(editBtn);

    const positionInput = screen.getByDisplayValue('Software Developer');
    fireEvent.change(positionInput, { target: { value: 'Staff Engineer' } });

    // Click "💾 Save Changes"
    const saveBtn = screen.getByRole('button', { name: /💾 Save Changes/i });
    fireEvent.click(saveBtn);

    // After re-editing, approved count drops back from 1 to 0!
    await waitFor(() => {
      expect(screen.getByText(/0 approved/i)).toBeDefined();
    });
    expect(screen.getByText(/EDITED \(NEEDS APPROVAL\)/i)).toBeDefined();
  });
});
