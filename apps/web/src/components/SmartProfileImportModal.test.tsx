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
        POTENTIAL_MATCH: 0,
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

describe('SmartProfileImportModal — Production Upload State & File Selection (Regression)', () => {
  const mockUploadSession: ProfileImportSessionDto = {
    id: 'session-upload-test',
    userId: 'user-01',
    sourceType: 'CV',
    status: 'PENDING',
    originalFilename: 'My_Resume.pdf',
    mimeType: 'application/pdf',
    storageKey: 'uploads/My_Resume.pdf',
    documentId: null,
    aiConsentGiven: false,
    extractorUsed: null,
    rawTextSnippet: null,
    errorMessage: null,
    itemCounts: {
      total: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
      byClassification: {
        NEW: 0,
        DUPLICATE: 0,
        MATCHED: 0,
        POTENTIAL_MATCH: 0,
        CONFLICT: 0,
        INCOMPLETE: 0,
        LOW_CONFIDENCE: 0,
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders in Step 1 (Upload) when invoked without test props (exact production usage)', () => {
    render(<SmartProfileImportModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Smart Candidate Profile Import/i)).toBeDefined();
    expect(screen.getByText(/1\. Upload/i)).toBeDefined();
    expect(screen.getByText(/Click or drag & drop your document here/i)).toBeDefined();

    const continueBtn = screen.getByRole('button', { name: /Continue to Extraction →/i });
    expect(continueBtn).toBeDefined();
    expect((continueBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('selecting a PDF displays its filename and formatted size, and enables Continue button', async () => {
    render(<SmartProfileImportModal isOpen={true} onClose={vi.fn()} />);

    const continueBtn = screen.getByRole('button', {
      name: /Continue to Extraction →/i,
    }) as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(true);

    const testFile = new File(['%PDF-1.4 dummy content'], 'Asadbek_CV.pdf', {
      type: 'application/pdf',
    });
    // Set a known size
    Object.defineProperty(testFile, 'size', { value: 1024 * 150 }); // 150 KB

    const fileInput = document.getElementById('file-upload-input') as HTMLInputElement;
    expect(fileInput).toBeDefined();

    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(screen.getByText('Asadbek_CV.pdf')).toBeDefined();
    });
    expect(screen.getByText(/150\.0 KB — Click or drag to change file/i)).toBeDefined();
    expect(continueBtn.disabled).toBe(false);
  });

  it('selected file state survives component re-renders (does not get wiped by useEffect dependencies)', async () => {
    const { rerender } = render(<SmartProfileImportModal isOpen={true} onClose={vi.fn()} />);

    const testFile = new File(['%PDF-1.4 dummy content'], 'Asadbek_CV.pdf', {
      type: 'application/pdf',
    });
    const fileInput = document.getElementById('file-upload-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(screen.getByText('Asadbek_CV.pdf')).toBeDefined();
    });

    // 1. Re-render by toggling checkbox inside component
    const replaceCheckbox = screen.getByRole('checkbox');
    fireEvent.click(replaceCheckbox);

    // File should still be present!
    expect(screen.getByText('Asadbek_CV.pdf')).toBeDefined();

    // 2. Parent re-renders the component with new callback
    rerender(<SmartProfileImportModal isOpen={true} onClose={vi.fn()} />);

    // CRITICAL REGRESSION CHECK: File MUST still be present after parent re-render!
    expect(screen.getByText('Asadbek_CV.pdf')).toBeDefined();
    const continueBtn = screen.getByRole('button', {
      name: /Continue to Extraction →/i,
    }) as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(false);
  });

  it('selecting a DOCX file displays its filename and enables Continue button', async () => {
    render(<SmartProfileImportModal isOpen={true} onClose={vi.fn()} />);

    const docxFile = new File(['PK\x03\x04 dummy docx'], 'Portfolio_Resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    Object.defineProperty(docxFile, 'size', { value: 1024 * 512 }); // 512 KB

    const fileInput = document.getElementById('file-upload-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [docxFile] } });

    await waitFor(() => {
      expect(screen.getByText('Portfolio_Resume.docx')).toBeDefined();
    });
    expect(screen.getByText(/512\.0 KB — Click or drag to change file/i)).toBeDefined();

    const continueBtn = screen.getByRole('button', {
      name: /Continue to Extraction →/i,
    }) as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(false);
  });

  it('selecting the same file again triggers onChange and updates state', async () => {
    render(<SmartProfileImportModal isOpen={true} onClose={vi.fn()} />);

    const testFile = new File(['dummy'], 'Resume.pdf', { type: 'application/pdf' });
    const fileInput = document.getElementById('file-upload-input') as HTMLInputElement;

    // First selection
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getByText('Resume.pdf')).toBeDefined();
    });

    // Click input to simulate user clicking to re-select
    fireEvent.click(fileInput);
    // Input value is cleared by onClick handler
    expect(fileInput.value).toBe('');

    // Re-select same file
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    expect(screen.getByText('Resume.pdf')).toBeDefined();
  });

  it('rejects files exceeding 25MB and shows descriptive error', async () => {
    render(<SmartProfileImportModal isOpen={true} onClose={vi.fn()} />);

    const largeFile = new File(['large content'], 'Giant_CV.pdf', { type: 'application/pdf' });
    Object.defineProperty(largeFile, 'size', { value: 26 * 1024 * 1024 }); // 26MB

    const fileInput = document.getElementById('file-upload-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText(/File exceeds the 25MB limit/i)).toBeDefined();
    });
    const continueBtn = screen.getByRole('button', {
      name: /Continue to Extraction →/i,
    }) as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(true);
  });

  it('rejects unsupported file formats and displays error', async () => {
    render(<SmartProfileImportModal isOpen={true} onClose={vi.fn()} />);

    const badFile = new File(['exe binary'], 'virus.exe', { type: 'application/x-msdownload' });
    const fileInput = document.getElementById('file-upload-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Unsupported file format/i)).toBeDefined();
    });
  });

  it('drag and drop: dragging over highlights dropzone and dropping a valid file selects it', async () => {
    render(<SmartProfileImportModal isOpen={true} onClose={vi.fn()} />);

    const dropzone = screen
      .getByText(/Click or drag & drop your document here/i)
      .closest('div[style*="dashed"]')!;
    expect(dropzone).toBeDefined();

    // Drag over
    fireEvent.dragOver(dropzone);
    expect(screen.getByText(/Drop your document here/i)).toBeDefined();

    // Drop file
    const droppedFile = new File(['%PDF-1.4 dropped'], 'Dropped_Resume.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(droppedFile, 'size', { value: 1024 * 80 });

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [droppedFile],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Dropped_Resume.pdf')).toBeDefined();
    });
    const continueBtn = screen.getByRole('button', {
      name: /Continue to Extraction →/i,
    }) as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(false);
  });

  it('clicking Continue to Extraction calls candidateImportApi.upload and advances to EXTRACT step', async () => {
    (candidateImportApi.upload as any).mockResolvedValueOnce(mockUploadSession);

    render(<SmartProfileImportModal isOpen={true} onClose={vi.fn()} />);

    const testFile = new File(['%PDF-1.4 dummy'], 'My_Resume.pdf', { type: 'application/pdf' });
    const fileInput = document.getElementById('file-upload-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(screen.getByText('My_Resume.pdf')).toBeDefined();
    });

    const continueBtn = screen.getByRole('button', {
      name: /Continue to Extraction →/i,
    }) as HTMLButtonElement;
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(candidateImportApi.upload).toHaveBeenCalledTimes(1);
    });

    // Check FormData passed to API
    const formDataArg = (candidateImportApi.upload as any).mock.calls[0]![0] as FormData;
    expect(formDataArg.get('file')).toBe(testFile);
    expect(formDataArg.get('sourceType')).toBe('CV');

    // Advanced to Step 2: EXTRACT
    await waitFor(() => {
      expect(screen.getByText(/Choose Extraction Engine/i)).toBeDefined();
    });
    expect(screen.getByText('My_Resume.pdf')).toBeDefined();
  });

  it('upload failure displays error on Step 1 and keeps the file selected for retry', async () => {
    (candidateImportApi.upload as any).mockRejectedValueOnce(
      new Error('Network timeout during upload'),
    );

    render(<SmartProfileImportModal isOpen={true} onClose={vi.fn()} />);

    const testFile = new File(['%PDF-1.4 dummy'], 'My_Resume.pdf', { type: 'application/pdf' });
    const fileInput = document.getElementById('file-upload-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(screen.getByText('My_Resume.pdf')).toBeDefined();
    });

    const continueBtn = screen.getByRole('button', {
      name: /Continue to Extraction →/i,
    }) as HTMLButtonElement;
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(screen.getByText(/Network timeout during upload/i)).toBeDefined();
    });

    // Still on Step 1: Upload
    expect(screen.getByText(/1\. Upload/i)).toBeDefined();
    expect(screen.getByText('My_Resume.pdf')).toBeDefined();
    expect(continueBtn.disabled).toBe(false);
  });

  it('closing and reopening the modal resets the wizard to fresh upload state', async () => {
    const { rerender } = render(<SmartProfileImportModal isOpen={true} onClose={vi.fn()} />);

    const testFile = new File(['%PDF-1.4 dummy'], 'My_Resume.pdf', { type: 'application/pdf' });
    const fileInput = document.getElementById('file-upload-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(screen.getByText('My_Resume.pdf')).toBeDefined();
    });

    // Close modal
    rerender(<SmartProfileImportModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText(/Smart Candidate Profile Import/i)).toBeNull();

    // Reopen modal
    rerender(<SmartProfileImportModal isOpen={true} onClose={vi.fn()} />);

    // Should be clean upload step with no file
    expect(screen.getByText(/Click or drag & drop your document here/i)).toBeDefined();
    expect(screen.queryByText('My_Resume.pdf')).toBeNull();
    const continueBtn = screen.getByRole('button', {
      name: /Continue to Extraction →/i,
    }) as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(true);
  });
});

describe('SmartProfileImportModal — Multi-Source Conflict Resolution & Side-by-Side Review', () => {
  const mockConflictSession: ProfileImportSessionDto = {
    id: 'session-qa-conflict',
    userId: 'user-01',
    sourceType: 'LINKEDIN_PDF',
    status: 'REVIEW_READY',
    originalFilename: 'Profile.pdf',
    mimeType: 'application/pdf',
    storageKey: 'uploads/Profile.pdf',
    documentId: null,
    aiConsentGiven: true,
    extractorUsed: 'GEMINI_AI',
    rawTextSnippet: 'Operations Assistant at Asia Alliance Bank',
    errorMessage: null,
    itemCounts: {
      total: 2,
      approved: 0,
      rejected: 0,
      pending: 2,
      byClassification: {
        NEW: 0,
        DUPLICATE: 0,
        MATCHED: 0,
        POTENTIAL_MATCH: 1,
        CONFLICT: 1,
        INCOMPLETE: 0,
        LOW_CONFIDENCE: 0,
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const conflictItem: ProfileImportItemDto = {
    id: 'item-conflict-asia',
    sessionId: 'session-qa-conflict',
    userId: 'user-01',
    section: 'EXPERIENCE',
    classification: 'CONFLICT',
    confidenceScore: 0.9,
    sourceReference: 'Asia Alliance Bank Operations Assistant (May 2023 - Aug 2023)',
    extractedPayload: {
      organization: 'Asia Alliance Bank',
      position: 'Operations Assistant',
      startDate: 'May 2023',
      endDate: 'August 2023',
    },
    existingEntityId: 'exp-asia-01',
    existingPayload: {
      organization: 'Asia Alliance Bank',
      position: 'Operations Assistant',
      startDate: 'June 2023',
      endDate: 'August 2023',
      verificationStatus: 'VERIFIED',
    },
    conflictDetails:
      'Date mismatch: existing (June 2023 to August 2023) vs imported (May 2023 to August 2023)',
    reviewStatus: 'PENDING',
    conflictResolution: null,
    userEditedPayload: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const potentialMatchItem: ProfileImportItemDto = {
    id: 'item-potential-edu',
    sessionId: 'session-qa-conflict',
    userId: 'user-01',
    section: 'EDUCATION',
    classification: 'POTENTIAL_MATCH',
    confidenceScore: 0.85,
    sourceReference: 'Vistula University October 2023',
    extractedPayload: {
      institution: 'Vistula University',
      degree: "Bachelor's degree",
      fieldOfStudy: 'English Studies',
      startDate: 'October 2023',
      endDate: null,
    },
    existingEntityId: 'edu-vistula-01',
    existingPayload: {
      institution: 'Vistula University',
      degree: 'B. A.',
      fieldOfStudy: 'English Studies',
      startDate: '2020-10',
      endDate: null,
      isCurrent: true,
      verificationStatus: 'VERIFIED',
    },
    conflictDetails:
      'Ongoing education at Vistula University with single imported date (October 2023); review required to clarify enrollment vs completion',
    reviewStatus: 'PENDING',
    conflictResolution: null,
    userEditedPayload: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders side-by-side comparison for CONFLICT items with explicit resolution buttons and no generic Accept button', () => {
    render(
      <SmartProfileImportModal
        isOpen={true}
        onClose={vi.fn()}
        initialStep="REVIEW"
        initialSession={mockConflictSession}
        initialItems={[conflictItem]}
      />,
    );

    // Verify side-by-side comparison sections
    expect(screen.getByText(/Conflicting Details Comparison:/i)).toBeDefined();
    expect(screen.getAllByText(/Existing Record/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Imported Record/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/June 2023/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/May 2023/i).length).toBeGreaterThan(0);

    // Verify NO generic item Accept button
    expect(screen.queryByRole('button', { name: /^✓ Accept$/i })).toBeNull();

    // Verify explicit conflict resolution buttons exist
    expect(screen.getByRole('button', { name: /Keep Existing/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Replace Existing/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Add as Separate/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /✎ Edit/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^✕ Reject$/i })).toBeDefined();
  });

  it('clicking "Keep Existing" approves the item with KEEP_EXISTING resolution and updates UI badge', async () => {
    const updated = {
      ...conflictItem,
      reviewStatus: 'APPROVED' as const,
      conflictResolution: 'KEEP_EXISTING' as const,
    };
    (candidateImportApi.updateItem as any).mockResolvedValueOnce(updated);

    render(
      <SmartProfileImportModal
        isOpen={true}
        onClose={vi.fn()}
        initialStep="REVIEW"
        initialSession={mockConflictSession}
        initialItems={[conflictItem]}
      />,
    );

    const keepBtn = screen.getByRole('button', { name: /Keep Existing/i });
    fireEvent.click(keepBtn);

    await waitFor(() => {
      expect(candidateImportApi.updateItem).toHaveBeenCalledWith(
        'session-qa-conflict',
        'item-conflict-asia',
        'APPROVED',
        undefined,
        'KEEP_EXISTING',
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/● RESOLVED \(Keep Existing\)/i)).toBeDefined();
      expect(screen.getByText(/1 approved/i)).toBeDefined();
    });
  });

  it('clicking "Replace Existing" approves the item with REPLACE_EXISTING resolution and updates UI badge', async () => {
    const updated = {
      ...conflictItem,
      reviewStatus: 'APPROVED' as const,
      conflictResolution: 'REPLACE_EXISTING' as const,
    };
    (candidateImportApi.updateItem as any).mockResolvedValueOnce(updated);

    render(
      <SmartProfileImportModal
        isOpen={true}
        onClose={vi.fn()}
        initialStep="REVIEW"
        initialSession={mockConflictSession}
        initialItems={[conflictItem]}
      />,
    );

    const replaceBtn = screen.getByRole('button', { name: /Replace Existing/i });
    fireEvent.click(replaceBtn);

    await waitFor(() => {
      expect(candidateImportApi.updateItem).toHaveBeenCalledWith(
        'session-qa-conflict',
        'item-conflict-asia',
        'APPROVED',
        undefined,
        'REPLACE_EXISTING',
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/● RESOLVED \(Replace Existing\)/i)).toBeDefined();
      expect(screen.getByText(/1 approved/i)).toBeDefined();
    });
  });

  it('clicking "Add as Separate" approves the item with ADD_AS_SEPARATE resolution and updates UI badge', async () => {
    const updated = {
      ...conflictItem,
      reviewStatus: 'APPROVED' as const,
      conflictResolution: 'ADD_AS_SEPARATE' as const,
    };
    (candidateImportApi.updateItem as any).mockResolvedValueOnce(updated);

    render(
      <SmartProfileImportModal
        isOpen={true}
        onClose={vi.fn()}
        initialStep="REVIEW"
        initialSession={mockConflictSession}
        initialItems={[conflictItem]}
      />,
    );

    const addSeparateBtn = screen.getByRole('button', { name: /Add as Separate/i });
    fireEvent.click(addSeparateBtn);

    await waitFor(() => {
      expect(candidateImportApi.updateItem).toHaveBeenCalledWith(
        'session-qa-conflict',
        'item-conflict-asia',
        'APPROVED',
        undefined,
        'ADD_AS_SEPARATE',
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/● RESOLVED \(Add as Separate\)/i)).toBeDefined();
      expect(screen.getByText(/1 approved/i)).toBeDefined();
    });
  });

  it('renders POTENTIAL_MATCH item with "Confirm Match" and "Add as New" buttons and handles user choices', async () => {
    const approvedMatch = {
      ...potentialMatchItem,
      reviewStatus: 'APPROVED' as const,
    };
    (candidateImportApi.updateItem as any).mockResolvedValueOnce(approvedMatch);

    render(
      <SmartProfileImportModal
        isOpen={true}
        onClose={vi.fn()}
        initialStep="REVIEW"
        initialSession={mockConflictSession}
        initialItems={[potentialMatchItem]}
      />,
    );

    expect(screen.getByText(/Potential Match:/i)).toBeDefined();
    expect(screen.getByText(/Ongoing education at Vistula University/i)).toBeDefined();
    const confirmMatchBtn = screen.getByRole('button', { name: /Confirm Match/i });
    const addAsNewBtn = screen.getByRole('button', { name: /Add as New/i });
    expect(confirmMatchBtn).toBeDefined();
    expect(addAsNewBtn).toBeDefined();

    // Click Confirm Match
    fireEvent.click(confirmMatchBtn);

    await waitFor(() => {
      expect(candidateImportApi.updateItem).toHaveBeenCalledWith(
        'session-qa-conflict',
        'item-potential-edu',
        'APPROVED',
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/1 approved/i)).toBeDefined();
    });
  });
});
