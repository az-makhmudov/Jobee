import { useState, useEffect, useRef } from 'react';
import { candidateImportApi } from '../api/candidate-import-client.js';
import type {
  ProfileImportSessionDto,
  ProfileImportItemDto,
  ProfileImportSourceType,
  ProfileImportClassification,
  CommitImportSessionResult,
} from '@job-agent/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialSourceType?: ProfileImportSourceType;
  initialStep?: WizardStep;
  initialSession?: ProfileImportSessionDto | null;
  initialItems?: ProfileImportItemDto[];
}

export type WizardStep = 'UPLOAD' | 'EXTRACT' | 'REVIEW' | 'CONFIRM' | 'SUCCESS';

const DEFAULT_INITIAL_ITEMS: ProfileImportItemDto[] = [];

export function SmartProfileImportModal({
  isOpen,
  onClose,
  onSuccess,
  initialSourceType = 'CV',
  initialStep = 'UPLOAD',
  initialSession = null,
  initialItems = DEFAULT_INITIAL_ITEMS,
}: Props) {
  const [step, setStep] = useState<WizardStep>(initialStep);
  const [sourceType, setSourceType] = useState<ProfileImportSourceType>(initialSourceType);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [replaceMasterCv, setReplaceMasterCv] = useState(false);
  const [aiConsent, setAiConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Active Session & Items
  const [session, setSession] = useState<ProfileImportSessionDto | null>(initialSession);
  const [items, setItems] = useState<ProfileImportItemDto[]>(initialItems);

  // Filtering during Review
  const [activeSectionFilter, setActiveSectionFilter] = useState<string>('ALL');
  const [activeClassificationFilter, setActiveClassificationFilter] = useState<string>('ALL');

  // Inline editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});

  // Confirmation options
  const [verifyOnCommit, setVerifyOnCommit] = useState(false);
  const [allowAiOnCommit, setAllowAiOnCommit] = useState(false);

  // Success summary
  const [commitResult, setCommitResult] = useState<CommitImportSessionResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef(false);

  // Stable ref for initial props to avoid re-running initialization during normal renders
  const initialPropsRef = useRef({
    initialStep,
    initialSession,
    initialItems,
    initialSourceType,
  });

  useEffect(() => {
    initialPropsRef.current = {
      initialStep,
      initialSession,
      initialItems,
      initialSourceType,
    };
  });

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      // Transition from closed to open (or first mount while open):
      // Initialize/reset all wizard states to start fresh.
      const currentProps = initialPropsRef.current;
      setStep(currentProps.initialStep);
      setSelectedFile(null);
      setReplaceMasterCv(false);
      setError(null);
      setIsDragging(false);
      setSession(currentProps.initialSession);
      setItems(currentProps.initialItems);
      setCommitResult(null);
      setSourceType(currentProps.initialSourceType);
      setEditingItemId(null);
      setEditFormData({});
      setActiveSectionFilter('ALL');
      setActiveClassificationFilter('ALL');
    } else if (!isOpen && wasOpenRef.current) {
      // Transition from open to closed
      setSelectedFile(null);
      setError(null);
      setIsDragging(false);
      setEditingItemId(null);
      setEditFormData({});
      setCommitResult(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  if (!isOpen) return null;

  // --- Step 1: Upload File ---
  const handleFileSelected = (file: File) => {
    const MAX_SIZE_BYTES = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      setError('File exceeds the 25MB limit. Please upload a smaller document.');
      return;
    }

    const validExtensions = ['.pdf', '.docx', '.doc', '.txt'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(ext)) {
      setError('Unsupported file format. Please upload a PDF or Word (DOCX) document.');
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a CV or LinkedIn PDF file to import');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('sourceType', sourceType);
      formData.append('replaceMasterCv', String(replaceMasterCv));

      const createdSession = await candidateImportApi.upload(formData);
      setSession(createdSession);
      setStep('EXTRACT');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  // --- Step 2: Trigger Extraction ---
  const handleStartExtraction = async (useAi: boolean) => {
    if (!session) return;
    setLoading(true);
    setError(null);

    try {
      const extractedSession = await candidateImportApi.extractAndCompare(session.id, useAi);
      setSession(extractedSession);
      setItems(extractedSession.items || []);
      setStep('REVIEW');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Information extraction failed');
    } finally {
      setLoading(false);
    }
  };

  // --- Step 3: Review Item Actions ---
  const handleItemAction = async (itemId: string, action: 'APPROVED' | 'REJECTED') => {
    if (!session) return;
    const targetItem = items.find((i) => i.id === itemId);
    if (
      action === 'APPROVED' &&
      targetItem?.classification === 'INCOMPLETE' &&
      !targetItem.userEditedPayload
    ) {
      handleStartEdit(targetItem);
      setError(
        `Cannot approve incomplete ${targetItem.section.toLowerCase()} without required information (${targetItem.conflictDetails || 'missing required fields'}). Please fill in missing fields below.`,
      );
      return;
    }

    try {
      const updated = await candidateImportApi.updateItem(session.id, itemId, action);
      setItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update review item');
    }
  };

  const handleBulkAction = async (action: 'APPROVE_ALL_NEW' | 'APPROVE_ALL' | 'REJECT_ALL') => {
    if (!session) return;
    setLoading(true);
    try {
      await candidateImportApi.bulkUpdateItems(session.id, action);
      const reloaded = await candidateImportApi.getSession(session.id);
      setSession(reloaded);
      setItems(reloaded.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk action failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (item: ProfileImportItemDto) => {
    setEditingItemId(item.id);
    setEditFormData({
      ...(item.userEditedPayload || item.extractedPayload),
    });
  };

  const handleSaveEdit = async (itemId: string, editedPayload?: Record<string, any>) => {
    if (!session) return;
    const payloadToSend = editedPayload || editFormData;
    try {
      const updated = await candidateImportApi.updateItem(
        session.id,
        itemId,
        'EDITED',
        payloadToSend,
      );
      setItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
      setEditingItemId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save edits');
    }
  };

  // --- Step 4: Commit Approved Items ---
  const handleCommit = async () => {
    if (!session) return;
    setLoading(true);
    setError(null);

    try {
      const result = await candidateImportApi.commitSession(session.id, {
        verifyOnCommit,
        allowAiOnCommit,
      });
      setCommitResult(result);
      setStep('SUCCESS');
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit failed');
    } finally {
      setLoading(false);
    }
  };

  // Filtered Items for Review
  const filteredItems = items.filter((item) => {
    if (activeSectionFilter !== 'ALL' && item.section !== activeSectionFilter) return false;
    if (activeClassificationFilter !== 'ALL' && item.classification !== activeClassificationFilter)
      return false;
    return true;
  });

  const approvedCount = items.filter((i) => i.reviewStatus === 'APPROVED').length;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1.5rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--surface-color, #1e222b)',
          borderColor: 'var(--border-color, #2f3542)',
          borderRadius: '12px',
          padding: '1.75rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header with Step Indicator */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '1px solid var(--border-color, #2f3542)',
            paddingBottom: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 600, margin: '0 0 0.35rem 0' }}>
              Smart Candidate Profile Import
            </h2>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem' }}>
              <span
                style={{
                  fontWeight: step === 'UPLOAD' ? 600 : 400,
                  color:
                    step === 'UPLOAD'
                      ? 'var(--primary, #3b82f6)'
                      : 'var(--text-secondary, #94a3b8)',
                }}
              >
                1. Upload
              </span>
              <span>›</span>
              <span
                style={{
                  fontWeight: step === 'EXTRACT' ? 600 : 400,
                  color:
                    step === 'EXTRACT'
                      ? 'var(--primary, #3b82f6)'
                      : 'var(--text-secondary, #94a3b8)',
                }}
              >
                2. Extract
              </span>
              <span>›</span>
              <span
                style={{
                  fontWeight: step === 'REVIEW' ? 600 : 400,
                  color:
                    step === 'REVIEW'
                      ? 'var(--primary, #3b82f6)'
                      : 'var(--text-secondary, #94a3b8)',
                }}
              >
                3. Review ({approvedCount} approved)
              </span>
              <span>›</span>
              <span
                style={{
                  fontWeight: step === 'CONFIRM' ? 600 : 400,
                  color:
                    step === 'CONFIRM'
                      ? 'var(--primary, #3b82f6)'
                      : 'var(--text-secondary, #94a3b8)',
                }}
              >
                4. Confirm
              </span>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
          >
            ✕ Close
          </button>
        </div>

        {/* Global Error Banner (omitted on EXTRACT step to avoid duplicate display with dedicated AI error card) */}
        {error && step !== 'EXTRACT' && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--danger, #ef4444)',
              borderRadius: '6px',
              color: '#fca5a5',
              fontSize: '0.9rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
          {/* STEP 1: UPLOAD */}
          {step === 'UPLOAD' && (
            <div>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  className={`btn ${sourceType === 'CV' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSourceType('CV')}
                  style={{ flex: 1 }}
                >
                  📄 Master CV (PDF / DOCX)
                </button>
                <button
                  type="button"
                  className={`btn ${sourceType === 'LINKEDIN_PDF' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSourceType('LINKEDIN_PDF')}
                  style={{ flex: 1 }}
                >
                  🔗 LinkedIn Profile Export (PDF)
                </button>
              </div>

              {sourceType === 'LINKEDIN_PDF' && (
                <div
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '8px',
                    padding: '0.85rem 1rem',
                    marginBottom: '1.25rem',
                    fontSize: '0.85rem',
                    lineHeight: '1.45',
                  }}
                >
                  <strong>How to export from LinkedIn without scraping:</strong>
                  <ol style={{ margin: '0.5rem 0 0 1.25rem', padding: 0 }}>
                    <li>Open your LinkedIn profile in your web browser.</li>
                    <li>
                      Click the <strong>More</strong> button (beside "Add profile section").
                    </li>
                    <li>
                      Select <strong>Save to PDF</strong>.
                    </li>
                    <li>
                      Upload that official PDF below to import full history and credentials safely.
                    </li>
                  </ol>
                </div>
              )}

              <form onSubmit={handleFileUpload}>
                <div
                  style={{
                    border: isDragging
                      ? '2px dashed var(--primary, #3b82f6)'
                      : '2px dashed var(--border-color, #3b4252)',
                    borderRadius: '10px',
                    padding: '2.5rem 1.5rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: isDragging
                      ? 'rgba(59, 130, 246, 0.12)'
                      : selectedFile
                        ? 'rgba(59, 130, 246, 0.05)'
                        : 'transparent',
                    marginBottom: '1.5rem',
                    transition: 'all 0.15s ease-in-out',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isDragging) setIsDragging(true);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                    const file = e.dataTransfer?.files?.[0];
                    if (file) {
                      handleFileSelected(file);
                    }
                  }}
                >
                  <input
                    ref={fileInputRef}
                    id="file-upload-input"
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    style={{ display: 'none' }}
                    onClick={(e) => {
                      (e.currentTarget as HTMLInputElement).value = '';
                      e.stopPropagation();
                    }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileSelected(file);
                      }
                    }}
                  />
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
                    {isDragging ? '📥' : selectedFile ? '📑' : '📤'}
                  </div>
                  {selectedFile ? (
                    <div>
                      <div
                        style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}
                      >
                        {selectedFile.name}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {selectedFile.size < 1024 * 1024
                          ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                          : `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`}{' '}
                        — Click or drag to change file
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>
                        {isDragging
                          ? 'Drop your document here'
                          : 'Click or drag & drop your document here'}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Supports PDF and Word (DOCX) up to 25MB
                      </div>
                    </div>
                  )}
                </div>

                {sourceType === 'CV' && (
                  <div
                    style={{
                      marginBottom: '1rem',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={replaceMasterCv}
                        onChange={(e) => setReplaceMasterCv(e.target.checked)}
                      />
                      <span>
                        <strong>Replace active Master CV:</strong> Set this document as your active
                        Master CV in Document Vault. (If unchecked, your existing Master CV is
                        preserved and this file is stored as an additional supporting CV).
                      </span>
                    </label>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                      Prime Directive Truthfulness Protection
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      No candidate information will be written to Candidate Brain automatically. All
                      facts require review.
                    </div>
                  </div>
                  <span style={{ fontSize: '1.25rem' }}>🛡️</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={onClose}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!selectedFile || loading}
                  >
                    {loading ? 'Uploading...' : 'Continue to Extraction →'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 2: EXTRACT */}
          {step === 'EXTRACT' && (
            <div>
              <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>
                  Choose Extraction Engine
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  File uploaded: <strong>{session?.originalFilename}</strong>
                </p>
              </div>

              <div
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  marginBottom: '1.25rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <input
                    type="checkbox"
                    id="ai-consent"
                    checked={aiConsent}
                    onChange={(e) => setAiConsent(e.target.checked)}
                    style={{ marginTop: '0.25rem' }}
                  />
                  <div>
                    <label
                      htmlFor="ai-consent"
                      style={{ fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer' }}
                    >
                      Process with Google Gemini 3.8 Flash AI (Recommended)
                    </label>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        margin: '0.35rem 0 0 0',
                        lineHeight: '1.45',
                      }}
                    >
                      I explicitly consent to sending this document's text to Google Gemini AI for
                      accurate structured entity extraction. In accordance with Jobee's Prime
                      Directive, AI will only prepare suggestions with source citations and will
                      never invent facts or write to Candidate Brain without approval.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid var(--danger, #ef4444)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#fca5a5', marginBottom: '0.35rem' }}>
                    ⚠️ AI Extraction Notice
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#fca5a5', marginBottom: '0.75rem' }}>
                    {error}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleStartExtraction(true)}
                      style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                    >
                      🔄 Retry with Gemini AI
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleStartExtraction(false)}
                      style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                    >
                      ⚙️ Extract with Basic Parser (No AI)
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <div style={{ textAlign: 'center', padding: '2.5rem' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      border: '3px solid rgba(59, 130, 246, 0.2)',
                      borderTopColor: 'var(--primary, #3b82f6)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 1rem auto',
                    }}
                  />
                  <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>
                    Extracting Candidate Facts & Comparing Brain...
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Reading document text, classifying new skills, experiences, and detecting
                    conflicts
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleStartExtraction(false)}
                  >
                    Extract with Basic Parser (No AI)
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!aiConsent}
                    onClick={() => handleStartExtraction(true)}
                  >
                    Extract with Gemini AI ✨
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: REVIEW & RESOLVE */}
          {step === 'REVIEW' && (
            <div>
              {/* Extraction Engine Transparency Banner */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  borderRadius: '8px',
                  backgroundColor:
                    session?.extractorUsed === 'GEMINI_AI'
                      ? 'rgba(59, 130, 246, 0.1)'
                      : 'rgba(234, 179, 8, 0.1)',
                  border: `1px solid ${
                    session?.extractorUsed === 'GEMINI_AI'
                      ? 'rgba(59, 130, 246, 0.3)'
                      : 'rgba(234, 179, 8, 0.3)'
                  }`,
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      color: session?.extractorUsed === 'GEMINI_AI' ? '#93c5fd' : '#fde047',
                    }}
                  >
                    {session?.extractorUsed === 'GEMINI_AI'
                      ? '✨ Extracted with Google Gemini 3.8 Flash AI'
                      : '⚙️ Extracted with Basic Deterministic Parser (Local / Rule-Based)'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {session?.extractorUsed === 'GEMINI_AI'
                      ? 'High-accuracy semantic entity recognition with source references.'
                      : 'Rule-based heuristic parsing without external AI processing. Review and adjust extracted fields below.'}
                  </div>
                </div>
                <span style={{ fontSize: '1.2rem' }}>
                  {session?.extractorUsed === 'GEMINI_AI' ? '🤖' : '⚙️'}
                </span>
              </div>

              {/* Filter Tabs & Bulk Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {[
                    'ALL',
                    'PROFILE',
                    'EXPERIENCE',
                    'EDUCATION',
                    'SKILL',
                    'CERTIFICATION',
                    'LANGUAGE',
                    'PROJECT',
                    'LINK',
                  ].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      className={`btn ${activeSectionFilter === sec ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      onClick={() => setActiveSectionFilter(sec)}
                    >
                      {sec}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '0.35rem',
                    flexWrap: 'wrap',
                    width: '100%',
                    margin: '0.4rem 0',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      alignSelf: 'center',
                      marginRight: '0.25rem',
                    }}
                  >
                    Status:
                  </span>
                  {[
                    'ALL',
                    'NEW',
                    'CONFLICT',
                    'DUPLICATE',
                    'MATCHED',
                    'INCOMPLETE',
                    'LOW_CONFIDENCE',
                  ].map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      className={`btn ${activeClassificationFilter === cls ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => setActiveClassificationFilter(cls)}
                    >
                      {cls}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}
                    onClick={() => handleBulkAction('APPROVE_ALL_NEW')}
                  >
                    ✓ Accept All New
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}
                    onClick={() => handleBulkAction('APPROVE_ALL')}
                  >
                    ✓ Accept All
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}
                    onClick={() => handleBulkAction('REJECT_ALL')}
                  >
                    ✕ Reject All
                  </button>
                </div>
              </div>

              {/* Items List */}
              {filteredItems.length === 0 ? (
                <div
                  style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}
                >
                  No items found in this section.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {filteredItems.map((item) => (
                    <ReviewItemCard
                      key={item.id}
                      item={item}
                      isEditing={editingItemId === item.id}
                      editFormData={editFormData}
                      onStartEdit={() => handleStartEdit(item)}
                      onSaveEdit={(payload) => handleSaveEdit(item.id, payload)}
                      onCancelEdit={() => setEditingItemId(null)}
                      onEditChange={(key, val) =>
                        setEditFormData((prev) => ({ ...prev, [key]: val }))
                      }
                      onApprove={() => handleItemAction(item.id, 'APPROVED')}
                      onReject={() => handleItemAction(item.id, 'REJECTED')}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: CONFIRM */}
          {step === 'CONFIRM' && (
            <div>
              <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                  Commit Approved Information to Candidate Brain
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  You have approved <strong>{approvedCount}</strong> items for inclusion.
                </p>
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ marginBottom: '1rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={verifyOnCommit}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setVerifyOnCommit(checked);
                        if (!checked) {
                          setAllowAiOnCommit(false);
                        }
                      }}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        Mark approved items as VERIFIED in Candidate Brain
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        If unchecked, items will be saved with status <code>UNVERIFIED</code> so you
                        can verify each record individually at a later time.
                      </div>
                    </div>
                  </label>
                </div>

                <div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={allowAiOnCommit}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAllowAiOnCommit(checked);
                        if (checked) {
                          setVerifyOnCommit(true);
                        }
                      }}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        Authorize approved facts for AI Job Application Tailoring
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        If enabled, Jobee's Application Studio can use these facts when crafting
                        truthful, tailored CVs and cover letters.{' '}
                        <em>
                          (Requires items to be VERIFIED — unverified facts cannot be used by AI)
                        </em>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setStep('REVIEW')}
                >
                  ← Back to Review
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={loading || approvedCount === 0}
                  onClick={handleCommit}
                >
                  {loading ? 'Committing to Database...' : `Commit ${approvedCount} Items →`}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: SUCCESS */}
          {step === 'SUCCESS' && commitResult && (
            <div style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎉</div>
              <h3 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>
                Candidate Profile Enriched Successfully!
              </h3>
              <p
                style={{
                  fontSize: '0.95rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1.5rem',
                }}
              >
                Your Candidate Brain has been updated with verified, auditable career information.
              </p>

              {/* Completeness Card */}
              <div
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  marginBottom: '1.5rem',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Profile Completeness</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary, #3b82f6)' }}>
                    {commitResult.newProfileCompleteness.score}%
                  </span>
                </div>
                <div
                  style={{
                    height: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${commitResult.newProfileCompleteness.score}%`,
                      backgroundColor: 'var(--primary, #3b82f6)',
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>

              {/* Committed Counts Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '0.75rem',
                  marginBottom: '1.5rem',
                }}
              >
                {commitResult.committedCounts.experiencesCreated > 0 && (
                  <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                      +{commitResult.committedCounts.experiencesCreated}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Experiences
                    </div>
                  </div>
                )}
                {commitResult.committedCounts.skillsCreated > 0 && (
                  <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                      +{commitResult.committedCounts.skillsCreated}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Skills</div>
                  </div>
                )}
                {commitResult.committedCounts.educationCreated > 0 && (
                  <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                      +{commitResult.committedCounts.educationCreated}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Education
                    </div>
                  </div>
                )}
                {commitResult.committedCounts.certificationsCreated > 0 && (
                  <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                      +{commitResult.committedCounts.certificationsCreated}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Certifications
                    </div>
                  </div>
                )}
                {commitResult.committedCounts.languagesCreated > 0 && (
                  <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                      +{commitResult.committedCounts.languagesCreated}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Languages
                    </div>
                  </div>
                )}
              </div>

              <button type="button" className="btn btn-primary" onClick={onClose}>
                View Updated Candidate Profile
              </button>
            </div>
          )}
        </div>

        {/* Footer (for Review step) */}
        {step === 'REVIEW' && (
          <div
            style={{
              borderTop: '1px solid var(--border-color)',
              paddingTop: '1rem',
              marginTop: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <strong>{approvedCount}</strong> items ready to commit
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('UPLOAD')}>
                ← Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={approvedCount === 0}
                onClick={() => setStep('CONFIRM')}
              >
                Proceed to Confirmation ({approvedCount}) →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Subcomponent: ReviewItemCard
export function ReviewItemCard({
  item,
  isEditing,
  editFormData,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditChange,
  onApprove,
  onReject,
}: {
  item: ProfileImportItemDto;
  isEditing: boolean;
  editFormData: Record<string, any>;
  onStartEdit: () => void;
  onSaveEdit: (payloadToSave?: Record<string, any>) => void;
  onCancelEdit: () => void;
  onEditChange: (key: string, val: any) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const payload = item.userEditedPayload || item.extractedPayload;

  const classificationColor = (cls: ProfileImportClassification) => {
    switch (cls) {
      case 'NEW':
        return '#10b981'; // Green
      case 'MATCHED':
        return '#64748b'; // Slate
      case 'DUPLICATE':
        return '#f59e0b'; // Amber
      case 'CONFLICT':
        return '#ef4444'; // Red
      case 'INCOMPLETE':
        return '#ea580c'; // Orange
      case 'LOW_CONFIDENCE':
        return '#8b5cf6'; // Purple
      default:
        return '#64748b';
    }
  };

  const getPrimaryLabel = (): string => {
    if (item.section === 'PROFILE') return String(payload.fullName || 'Personal Information');
    if (item.section === 'EXPERIENCE')
      return `${String(payload.position || 'Role')} at ${String(payload.organization || 'Organization')}`;
    if (item.section === 'EDUCATION')
      return `${String(payload.degree || 'Degree')} - ${String(payload.institution || 'Institution')}`;
    if (item.section === 'SKILL') {
      const details = [payload.category, payload.proficiency].filter(Boolean).join(' • ');
      return details
        ? `${String(payload.name || 'Skill')} (${details})`
        : String(payload.name || 'Skill');
    }
    if (item.section === 'CERTIFICATION')
      return `${String(payload.name || 'Certification')}${payload.issuingOrganization ? ` (${payload.issuingOrganization})` : ''}`;
    if (item.section === 'LANGUAGE') {
      const details = [payload.proficiency, payload.cefrLevel].filter(Boolean).join(', ');
      return details
        ? `${String(payload.language || 'Language')} (${details})`
        : String(payload.language || 'Language');
    }
    if (item.section === 'PROJECT') return String(payload.name || 'Project');
    if (item.section === 'LINK')
      return `${String(payload.label || 'Link')}: ${String(payload.url || '')}`;
    return String(item.section);
  };

  const handleValidateAndSave = () => {
    setValidationError(null);
    const data: Record<string, any> = { ...editFormData };

    if (item.section === 'PROFILE') {
      if (!data.fullName?.trim()) {
        setValidationError('Full Name is required.');
        return;
      }
    } else if (item.section === 'EXPERIENCE') {
      if (!data.organization?.trim()) {
        setValidationError('Organization / Company is required.');
        return;
      }
      if (!data.position?.trim()) {
        setValidationError('Position / Role is required.');
        return;
      }
      if (!data.startDate?.trim()) {
        setValidationError('Start Date is required (e.g. 2022-01 or 2022).');
        return;
      }
    } else if (item.section === 'EDUCATION') {
      if (!data.institution?.trim()) {
        setValidationError('Institution / University name is required.');
        return;
      }
    } else if (item.section === 'SKILL') {
      if (!data.name?.trim()) {
        setValidationError('Skill Name is required.');
        return;
      }
    } else if (item.section === 'CERTIFICATION') {
      if (!data.name?.trim()) {
        setValidationError('Certification Name is required.');
        return;
      }
      if (!data.issuingOrganization?.trim()) {
        setValidationError('Issuing Organization is required.');
        return;
      }
    } else if (item.section === 'LANGUAGE') {
      if (!data.language?.trim()) {
        setValidationError('Language name is required.');
        return;
      }
    } else if (item.section === 'PROJECT') {
      if (!data.name?.trim()) {
        setValidationError('Project Name is required.');
        return;
      }
    } else if (item.section === 'LINK') {
      if (!data.label?.trim()) {
        setValidationError('Link Label is required.');
        return;
      }
      if (!data.url?.trim()) {
        setValidationError('Link URL is required.');
        return;
      }
    }

    // Clean payload fields
    if (item.section === 'LANGUAGE') {
      data.proficiency = data.proficiency?.trim() || null;
      data.cefrLevel = data.cefrLevel?.trim() || null;
      data.notes = data.notes?.trim() || null;
    }
    if (item.section === 'SKILL') {
      data.proficiency = data.proficiency?.trim() || null;
      if (
        data.yearsExperience !== undefined &&
        data.yearsExperience !== null &&
        data.yearsExperience !== ''
      ) {
        data.yearsExperience = Number(data.yearsExperience) || null;
      } else {
        data.yearsExperience = null;
      }
    }
    if (typeof data.achievements === 'string') {
      data.achievements = data.achievements
        .split('\n')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }

    onSaveEdit(data);
  };

  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '0.85rem 1rem',
        backgroundColor:
          item.reviewStatus === 'APPROVED'
            ? 'rgba(16, 185, 129, 0.05)'
            : item.reviewStatus === 'EDITED'
              ? 'rgba(59, 130, 246, 0.05)'
              : item.reviewStatus === 'REJECTED'
                ? 'rgba(239, 68, 68, 0.03)'
                : 'rgba(255, 255, 255, 0.02)',
        borderColor:
          item.reviewStatus === 'APPROVED'
            ? 'rgba(16, 185, 129, 0.3)'
            : item.reviewStatus === 'EDITED'
              ? 'rgba(59, 130, 246, 0.3)'
              : item.reviewStatus === 'REJECTED'
                ? 'rgba(239, 68, 68, 0.2)'
                : 'var(--border-color)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.35rem',
            }}
          >
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '0.15rem 0.4rem',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--text-secondary)',
              }}
            >
              {item.section}
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '0.15rem 0.4rem',
                borderRadius: '4px',
                backgroundColor: `${classificationColor(item.classification)}22`,
                color: classificationColor(item.classification),
                border: `1px solid ${classificationColor(item.classification)}44`,
              }}
            >
              {item.classification}
            </span>
            {item.reviewStatus !== 'PENDING' && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color:
                    item.reviewStatus === 'REJECTED'
                      ? 'var(--danger)'
                      : item.reviewStatus === 'EDITED'
                        ? 'var(--info, #3b82f6)'
                        : 'var(--success, #10b981)',
                }}
              >
                ● {item.reviewStatus === 'EDITED' ? 'EDITED (NEEDS APPROVAL)' : item.reviewStatus}
              </span>
            )}
          </div>

          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
            {getPrimaryLabel()}
          </div>

          {/* Secondary Details for Cards */}
          {Boolean(item.section === 'PROFILE') && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.35rem',
              }}
            >
              {(
                [
                  payload.headline,
                  payload.email,
                  payload.phone,
                  payload.location || payload.city,
                ].filter(Boolean) as string[]
              ).join(' • ')}
            </div>
          )}

          {Boolean(payload.startDate || payload.endDate) && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.35rem',
              }}
            >
              📅 {String(payload.startDate || '')} —{' '}
              {String(payload.endDate || (payload.isCurrent ? 'Present' : ''))}
            </div>
          )}

          {Boolean(item.section === 'EXPERIENCE' && payload.location) && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.25rem',
              }}
            >
              📍 {String(payload.location)}
            </div>
          )}

          {Boolean(item.section === 'EXPERIENCE' && payload.description) && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.35rem',
              }}
            >
              {String(payload.description).length > 150
                ? `${String(payload.description).slice(0, 150)}...`
                : String(payload.description)}
            </div>
          )}

          {Boolean(item.section === 'EDUCATION' && payload.fieldOfStudy) && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.25rem',
              }}
            >
              📚 Field of Study: {String(payload.fieldOfStudy)}
            </div>
          )}

          {Boolean(
            item.section === 'CERTIFICATION' && (payload.issueDate || payload.expirationDate),
          ) && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.25rem',
              }}
            >
              📅 Issued: {String(payload.issueDate || 'N/A')}
              {payload.expirationDate ? ` • Expires: ${String(payload.expirationDate)}` : ''}
            </div>
          )}

          {Boolean(item.section === 'LANGUAGE') && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.25rem',
              }}
            >
              Proficiency: {String(payload.proficiency || 'Not specified')}
              {payload.cefrLevel ? ` (CEFR: ${String(payload.cefrLevel)})` : ''}
              {payload.notes ? ` • ${String(payload.notes)}` : ''}
            </div>
          )}

          {Boolean(item.section === 'SKILL') && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.25rem',
              }}
            >
              Proficiency: {String(payload.proficiency || 'Not specified')}
              {payload.yearsExperience ? ` • ${String(payload.yearsExperience)} yrs exp` : ''}
            </div>
          )}

          {Boolean(item.section === 'PROJECT' && (payload.projectUrl || payload.role)) && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.25rem',
              }}
            >
              {payload.role ? `Role: ${String(payload.role)}` : ''}
              {payload.role && payload.projectUrl ? ' • ' : ''}
              {payload.projectUrl ? `🔗 ${String(payload.projectUrl)}` : ''}
            </div>
          )}

          {Boolean(item.section === 'LINK' && payload.url) && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.25rem',
              }}
            >
              🔗 {String(payload.url)}
            </div>
          )}

          {/* Status Details Banner */}
          {item.conflictDetails && (
            <div
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor:
                  item.classification === 'INCOMPLETE'
                    ? 'rgba(245, 158, 11, 0.1)'
                    : item.classification === 'LOW_CONFIDENCE'
                      ? 'rgba(59, 130, 246, 0.1)'
                      : item.classification === 'DUPLICATE'
                        ? 'rgba(100, 116, 139, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                borderLeft: `3px solid ${
                  item.classification === 'INCOMPLETE'
                    ? 'var(--warning, #f59e0b)'
                    : item.classification === 'LOW_CONFIDENCE'
                      ? 'var(--primary, #3b82f6)'
                      : item.classification === 'DUPLICATE'
                        ? '#64748b'
                        : 'var(--danger, #ef4444)'
                }`,
                borderRadius: '4px',
                fontSize: '0.8rem',
                color:
                  item.classification === 'INCOMPLETE'
                    ? '#fcd34d'
                    : item.classification === 'LOW_CONFIDENCE'
                      ? '#93c5fd'
                      : item.classification === 'DUPLICATE'
                        ? '#cbd5e1'
                        : '#fca5a5',
                marginTop: '0.4rem',
                marginBottom: '0.4rem',
              }}
            >
              {item.classification === 'INCOMPLETE' && (
                <>
                  ⚠️ <strong>Missing Information:</strong> {item.conflictDetails} (Click ✎ Edit to
                  fill in before approval)
                </>
              )}
              {item.classification === 'LOW_CONFIDENCE' && (
                <>
                  ℹ️ <strong>Uncertain Extraction:</strong> {item.conflictDetails}
                </>
              )}
              {item.classification === 'CONFLICT' && (
                <>
                  ⚡ <strong>Conflict with existing record:</strong> {item.conflictDetails}
                </>
              )}
              {item.classification === 'DUPLICATE' && (
                <>
                  📋 <strong>Existing Record Found:</strong> {item.conflictDetails}
                </>
              )}
              {!['INCOMPLETE', 'LOW_CONFIDENCE', 'CONFLICT', 'DUPLICATE'].includes(
                item.classification,
              ) && <>{item.conflictDetails}</>}
            </div>
          )}

          {/* Source Citation */}
          {item.sourceReference && (
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
                marginTop: '0.25rem',
              }}
            >
              Source excerpt: "{item.sourceReference.slice(0, 120)}"
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {!isEditing && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                onClick={() => {
                  setValidationError(null);
                  onStartEdit();
                }}
              >
                ✎ Edit
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.8rem',
                  color: item.reviewStatus === 'REJECTED' ? 'var(--danger)' : undefined,
                }}
                onClick={onReject}
              >
                ✕ Reject
              </button>
              <button
                type="button"
                className={`btn ${item.reviewStatus === 'APPROVED' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                onClick={onApprove}
              >
                ✓ Accept
              </button>
            </>
          )}
        </div>
      </div>

      {/* Inline Editing Form */}
      {isEditing && (
        <div
          style={{
            marginTop: '0.85rem',
            paddingTop: '0.85rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          {/* 1. PROFILE */}
          {item.section === 'PROFILE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Full Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. Jane Doe"
                    value={editFormData.fullName || ''}
                    onChange={(e) => onEditChange('fullName', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Headline (Optional)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. Senior Software Engineer"
                    value={editFormData.headline || ''}
                    onChange={(e) => onEditChange('headline', e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="email@example.com"
                    value={editFormData.email || ''}
                    onChange={(e) => onEditChange('email', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="+1 555-0199"
                    value={editFormData.phone || ''}
                    onChange={(e) => onEditChange('phone', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Location (Optional)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="City, Country"
                    value={
                      editFormData.location ||
                      (editFormData.city
                        ? `${editFormData.city}${editFormData.country ? `, ${editFormData.country}` : ''}`
                        : '')
                    }
                    onChange={(e) => onEditChange('location', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginBottom: '0.25rem',
                  }}
                >
                  Professional Summary (Optional)
                </label>
                <textarea
                  className="input"
                  rows={3}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="Brief professional summary"
                  value={editFormData.summary || ''}
                  onChange={(e) => onEditChange('summary', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* 2. EXPERIENCE */}
          {item.section === 'EXPERIENCE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Position / Role <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. Lead Developer"
                    value={editFormData.position || ''}
                    onChange={(e) => onEditChange('position', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Organization / Company <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. Acme Corp"
                    value={editFormData.organization || ''}
                    onChange={(e) => onEditChange('organization', e.target.value)}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '0.5rem',
                  alignItems: 'flex-end',
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Start Date <span style={{ color: 'var(--danger)' }}>*</span> (YYYY-MM or YYYY)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="2022-01"
                    value={editFormData.startDate || ''}
                    onChange={(e) => onEditChange('startDate', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    End Date (Optional, YYYY-MM or YYYY)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder={editFormData.isCurrent ? 'Present' : '2024-06'}
                    disabled={Boolean(editFormData.isCurrent)}
                    value={editFormData.isCurrent ? '' : editFormData.endDate || ''}
                    onChange={(e) => onEditChange('endDate', e.target.value)}
                  />
                </div>
                <div style={{ paddingBottom: '0.45rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(editFormData.isCurrent)}
                      onChange={(e) => {
                        onEditChange('isCurrent', e.target.checked);
                        if (e.target.checked) onEditChange('endDate', null);
                      }}
                    />
                    Currently working here
                  </label>
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginBottom: '0.25rem',
                  }}
                >
                  Location (Optional)
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="e.g. San Francisco, CA or Remote"
                  value={editFormData.location || ''}
                  onChange={(e) => onEditChange('location', e.target.value)}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginBottom: '0.25rem',
                  }}
                >
                  Description (Optional)
                </label>
                <textarea
                  className="input"
                  rows={2}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="Role responsibilities overview"
                  value={editFormData.description || ''}
                  onChange={(e) => onEditChange('description', e.target.value)}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginBottom: '0.25rem',
                  }}
                >
                  Achievements (Optional, one bullet per line)
                </label>
                <textarea
                  className="input"
                  rows={3}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="• Architected microservices platform&#10;• Reduced latency by 35%"
                  value={
                    Array.isArray(editFormData.achievements)
                      ? editFormData.achievements.join('\n')
                      : editFormData.achievements || ''
                  }
                  onChange={(e) => onEditChange('achievements', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* 3. EDUCATION */}
          {item.section === 'EDUCATION' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Institution / University <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. Stanford University"
                    value={editFormData.institution || ''}
                    onChange={(e) => onEditChange('institution', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Degree (Optional)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. Bachelor of Science"
                    value={editFormData.degree || ''}
                    onChange={(e) => onEditChange('degree', e.target.value)}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '0.5rem',
                  alignItems: 'flex-end',
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Field of Study (Optional)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. Computer Science"
                    value={editFormData.fieldOfStudy || ''}
                    onChange={(e) => onEditChange('fieldOfStudy', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Start Date (Optional, YYYY-MM or YYYY)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="2018"
                    value={editFormData.startDate || ''}
                    onChange={(e) => onEditChange('startDate', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    End Date (Optional, YYYY-MM or YYYY)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder={editFormData.isCurrent ? 'Present' : '2022'}
                    disabled={Boolean(editFormData.isCurrent)}
                    value={editFormData.isCurrent ? '' : editFormData.endDate || ''}
                    onChange={(e) => onEditChange('endDate', e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Location (Optional)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="City, Country"
                    value={editFormData.location || ''}
                    onChange={(e) => onEditChange('location', e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', paddingTop: '1.25rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(editFormData.isCurrent)}
                      onChange={(e) => {
                        onEditChange('isCurrent', e.target.checked);
                        if (e.target.checked) onEditChange('endDate', null);
                      }}
                    />
                    Currently studying
                  </label>
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginBottom: '0.25rem',
                  }}
                >
                  Description (Optional)
                </label>
                <textarea
                  className="input"
                  rows={2}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="Honors, thesis, or coursework"
                  value={editFormData.description || ''}
                  onChange={(e) => onEditChange('description', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* 4. SKILL */}
          {item.section === 'SKILL' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Skill Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. TypeScript"
                    value={editFormData.name || ''}
                    onChange={(e) => onEditChange('name', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Category (Optional)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. Programming Languages, Cloud"
                    value={editFormData.category || ''}
                    onChange={(e) => onEditChange('category', e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Proficiency (Optional)
                  </label>
                  <select
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={editFormData.proficiency || ''}
                    onChange={(e) => onEditChange('proficiency', e.target.value || null)}
                  >
                    <option value="">Not specified</option>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Years of Experience (Optional)
                  </label>
                  <input
                    type="number"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    min="0"
                    max="50"
                    step="0.5"
                    placeholder="e.g. 5"
                    value={editFormData.yearsExperience ?? ''}
                    onChange={(e) => onEditChange('yearsExperience', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. CERTIFICATION */}
          {item.section === 'CERTIFICATION' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Certification Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. AWS Certified Solutions Architect"
                    value={editFormData.name || ''}
                    onChange={(e) => onEditChange('name', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Issuing Organization <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. Amazon Web Services"
                    value={editFormData.issuingOrganization || ''}
                    onChange={(e) => onEditChange('issuingOrganization', e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Issue Date (Optional, YYYY-MM or YYYY)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="2023-05"
                    value={editFormData.issueDate || ''}
                    onChange={(e) => onEditChange('issueDate', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Expiration Date (Optional, YYYY-MM or YYYY)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="2026-05"
                    value={editFormData.expirationDate || ''}
                    onChange={(e) => onEditChange('expirationDate', e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Credential ID (Optional)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. ABC123XYZ"
                    value={editFormData.credentialId || ''}
                    onChange={(e) => onEditChange('credentialId', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Credential URL (Optional)
                  </label>
                  <input
                    type="url"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="https://..."
                    value={editFormData.credentialUrl || ''}
                    onChange={(e) => onEditChange('credentialUrl', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 6. LANGUAGE */}
          {item.section === 'LANGUAGE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Language <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. English, German, Japanese"
                    value={editFormData.language || ''}
                    onChange={(e) => onEditChange('language', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Proficiency (Optional)
                  </label>
                  <select
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={editFormData.proficiency || ''}
                    onChange={(e) => onEditChange('proficiency', e.target.value || null)}
                  >
                    <option value="">Not specified</option>
                    <option value="Elementary">Elementary</option>
                    <option value="Conversational">Conversational</option>
                    <option value="Professional">Professional</option>
                    <option value="Fluent">Fluent</option>
                    <option value="Native">Native</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    CEFR Level (Optional)
                  </label>
                  <select
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={editFormData.cefrLevel || ''}
                    onChange={(e) => onEditChange('cefrLevel', e.target.value || null)}
                  >
                    <option value="">Not specified</option>
                    <option value="A1">A1 - Beginner</option>
                    <option value="A2">A2 - Elementary</option>
                    <option value="B1">B1 - Intermediate</option>
                    <option value="B2">B2 - Upper Intermediate</option>
                    <option value="C1">C1 - Advanced</option>
                    <option value="C2">C2 - Mastery / Native</option>
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. Technical reading, daily speech"
                    value={editFormData.notes || ''}
                    onChange={(e) => onEditChange('notes', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 7. PROJECT */}
          {item.section === 'PROJECT' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Project Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. Distributed Task Queue"
                    value={editFormData.name || ''}
                    onChange={(e) => onEditChange('name', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Role (Optional)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. Creator & Maintainer"
                    value={editFormData.role || ''}
                    onChange={(e) => onEditChange('role', e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Start Date (Optional, YYYY-MM)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="2023-01"
                    value={editFormData.startDate || ''}
                    onChange={(e) => onEditChange('startDate', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    End Date (Optional, YYYY-MM)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="2023-10"
                    value={editFormData.endDate || ''}
                    onChange={(e) => onEditChange('endDate', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Project URL (Optional)
                  </label>
                  <input
                    type="url"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="https://github.com/..."
                    value={editFormData.projectUrl || ''}
                    onChange={(e) => onEditChange('projectUrl', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginBottom: '0.25rem',
                  }}
                >
                  Description (Optional)
                </label>
                <textarea
                  className="input"
                  rows={2}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="Project purpose, tech stack, and impact"
                  value={editFormData.description || ''}
                  onChange={(e) => onEditChange('description', e.target.value)}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginBottom: '0.25rem',
                  }}
                >
                  Highlights (Optional, one bullet per line)
                </label>
                <textarea
                  className="input"
                  rows={2}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="• Processed 10M messages daily&#10;• 99.99% uptime"
                  value={
                    Array.isArray(editFormData.achievements)
                      ? editFormData.achievements.join('\n')
                      : editFormData.achievements || ''
                  }
                  onChange={(e) => onEditChange('achievements', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* 8. LINK */}
          {item.section === 'LINK' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginBottom: '0.25rem',
                  }}
                >
                  Label <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="e.g. GitHub, Portfolio, LinkedIn"
                  value={editFormData.label || ''}
                  onChange={(e) => onEditChange('label', e.target.value)}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginBottom: '0.25rem',
                  }}
                >
                  URL <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="url"
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="https://..."
                  value={editFormData.url || ''}
                  onChange={(e) => onEditChange('url', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Validation Error Banner */}
          {validationError && (
            <div
              style={{
                color: 'var(--danger, #ef4444)',
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: '0.35rem 0.5rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '4px',
              }}
            >
              ⚠️ {validationError}
            </div>
          )}

          {/* Action Buttons: Save & Cancel */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem',
              marginTop: '0.4rem',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
              onClick={() => {
                setValidationError(null);
                onCancelEdit();
              }}
            >
              ✕ Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
              onClick={handleValidateAndSave}
            >
              💾 Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
