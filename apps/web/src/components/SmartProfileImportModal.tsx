import { useState, useEffect } from 'react';
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
}

type WizardStep = 'UPLOAD' | 'EXTRACT' | 'REVIEW' | 'CONFIRM' | 'SUCCESS';

export function SmartProfileImportModal({
  isOpen,
  onClose,
  onSuccess,
  initialSourceType = 'CV',
}: Props) {
  const [step, setStep] = useState<WizardStep>('UPLOAD');
  const [sourceType, setSourceType] = useState<ProfileImportSourceType>(initialSourceType);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aiConsent, setAiConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active Session & Items
  const [session, setSession] = useState<ProfileImportSessionDto | null>(null);
  const [items, setItems] = useState<ProfileImportItemDto[]>([]);

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

  useEffect(() => {
    if (isOpen) {
      setStep('UPLOAD');
      setSelectedFile(null);
      setError(null);
      setSession(null);
      setItems([]);
      setCommitResult(null);
      setSourceType(initialSourceType);
    }
  }, [isOpen, initialSourceType]);

  if (!isOpen) return null;

  // --- Step 1: Upload File ---
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
    try {
      const updated = await candidateImportApi.updateItem(session.id, itemId, action);
      setItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
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

  const handleSaveEdit = async (itemId: string) => {
    if (!session) return;
    try {
      const updated = await candidateImportApi.updateItem(
        session.id,
        itemId,
        'EDITED',
        editFormData,
      );
      setItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
      setEditingItemId(null);
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

  const approvedCount = items.filter(
    (i) => i.reviewStatus === 'APPROVED' || i.reviewStatus === 'EDITED',
  ).length;

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

        {/* Global Error Banner */}
        {error && (
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
                    border: '2px dashed var(--border-color, #3b4252)',
                    borderRadius: '10px',
                    padding: '2.5rem 1.5rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: selectedFile ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                    marginBottom: '1.5rem',
                  }}
                  onClick={() => document.getElementById('file-upload-input')?.click()}
                >
                  <input
                    id="file-upload-input"
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                    }}
                  />
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
                    {selectedFile ? '📑' : '📤'}
                  </div>
                  {selectedFile ? (
                    <div>
                      <div
                        style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}
                      >
                        {selectedFile.name}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {(selectedFile.size / 1024).toFixed(1)} KB — Click to change file
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>
                        Click or drag & drop your document here
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Supports PDF and Word (DOCX) up to 25MB
                      </div>
                    </div>
                  )}
                </div>

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
                    Extract Locally (No AI)
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
                      onSaveEdit={() => handleSaveEdit(item.id)}
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
                      onChange={(e) => setVerifyOnCommit(e.target.checked)}
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
                      onChange={(e) => setAllowAiOnCommit(e.target.checked)}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        Authorize approved facts for AI Job Application Tailoring
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        If enabled, Jobee's Application Studio can use these facts when crafting
                        truthful, tailored CVs and cover letters.
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
function ReviewItemCard({
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
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditChange: (key: string, val: any) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
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
    if (item.section === 'SKILL') return String(payload.name || 'Skill');
    if (item.section === 'CERTIFICATION')
      return `${String(payload.name || 'Certification')} (${String(payload.issuingOrganization || '')})`;
    if (item.section === 'LANGUAGE')
      return `${String(payload.language || 'Language')} - ${String(payload.proficiency || '')}`;
    if (item.section === 'PROJECT') return String(payload.name || 'Project');
    if (item.section === 'LINK')
      return `${String(payload.label || 'Link')}: ${String(payload.url || '')}`;
    return String(item.section);
  };

  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '0.85rem 1rem',
        backgroundColor:
          item.reviewStatus === 'APPROVED' || item.reviewStatus === 'EDITED'
            ? 'rgba(16, 185, 129, 0.05)'
            : item.reviewStatus === 'REJECTED'
              ? 'rgba(239, 68, 68, 0.03)'
              : 'rgba(255, 255, 255, 0.02)',
        borderColor:
          item.reviewStatus === 'APPROVED' || item.reviewStatus === 'EDITED'
            ? 'rgba(16, 185, 129, 0.3)'
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
                    item.reviewStatus === 'REJECTED' ? 'var(--danger)' : 'var(--success, #10b981)',
                }}
              >
                ● {item.reviewStatus}
              </span>
            )}
          </div>

          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
            {getPrimaryLabel()}
          </div>

          {/* Dates or Secondary Info */}
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

          {/* Conflict Details Banner */}
          {item.conflictDetails && (
            <div
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderLeft: '3px solid var(--danger, #ef4444)',
                borderRadius: '4px',
                fontSize: '0.8rem',
                color: '#fca5a5',
                marginTop: '0.4rem',
                marginBottom: '0.4rem',
              }}
            >
              ⚠️ <strong>Conflict with existing record:</strong> {item.conflictDetails}
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
                onClick={onStartEdit}
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
            gap: '0.5rem',
          }}
        >
          {item.section === 'EXPERIENCE' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <input
                type="text"
                className="input"
                placeholder="Position"
                value={editFormData.position || ''}
                onChange={(e) => onEditChange('position', e.target.value)}
              />
              <input
                type="text"
                className="input"
                placeholder="Organization"
                value={editFormData.organization || ''}
                onChange={(e) => onEditChange('organization', e.target.value)}
              />
              <input
                type="text"
                className="input"
                placeholder="Start Date (e.g. 2022-01)"
                value={editFormData.startDate || ''}
                onChange={(e) => onEditChange('startDate', e.target.value)}
              />
              <input
                type="text"
                className="input"
                placeholder="End Date (or empty)"
                value={editFormData.endDate || ''}
                onChange={(e) => onEditChange('endDate', e.target.value)}
              />
            </div>
          )}

          {item.section === 'SKILL' && (
            <input
              type="text"
              className="input"
              placeholder="Skill Name"
              value={editFormData.name || ''}
              onChange={(e) => onEditChange('name', e.target.value)}
            />
          )}

          {item.section === 'EDUCATION' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <input
                type="text"
                className="input"
                placeholder="Degree"
                value={editFormData.degree || ''}
                onChange={(e) => onEditChange('degree', e.target.value)}
              />
              <input
                type="text"
                className="input"
                placeholder="Institution"
                value={editFormData.institution || ''}
                onChange={(e) => onEditChange('institution', e.target.value)}
              />
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem',
              marginTop: '0.25rem',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
              onClick={onCancelEdit}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
              onClick={onSaveEdit}
            >
              Save & Approve
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
