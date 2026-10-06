import { useState, useEffect } from 'react';
import {
  applicationPackageClient,
  type PackageDetailResponse,
} from '../api/application-package-client.js';
import type {
  TailoredCv,
  QuestionCategory,
  QuestionType,
  ApplicationQuestionDto,
} from '@job-agent/shared';

interface ApplicationStudioViewProps {
  packageId: string;
  onBack: () => void;
  onNavigateToJob?: (jobId: string) => void;
}

type StudioTab = 'overview' | 'cv' | 'coverLetter' | 'questions' | 'approvals' | 'evidence';

export function ApplicationStudioView({
  packageId,
  onBack,
  onNavigateToJob,
}: ApplicationStudioViewProps) {
  const [data, setData] = useState<PackageDetailResponse | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTab>('overview');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showEditSummaryModal, setShowEditSummaryModal] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');

  const [showEditCoverLetterModal, setShowEditCoverLetterModal] = useState(false);
  const [coverLetterDraft, setCoverLetterDraft] = useState('');

  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionCategory, setNewQuestionCategory] = useState<QuestionCategory>('GENERAL');
  const [newQuestionType, setNewQuestionType] = useState<QuestionType>('TEXT');
  const [newQuestionOptions, setNewQuestionOptions] = useState('');
  const [newQuestionRequired, setNewQuestionRequired] = useState(true);

  const [selectedQuestionForAnswer, setSelectedQuestionForAnswer] =
    useState<ApplicationQuestionDto | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  const loadPackage = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await applicationPackageClient.getPackage(packageId);
      setData(res);
      if (res.currentVersion?.tailoredCvContent) {
        setSummaryDraft(res.currentVersion.tailoredCvContent.summary || '');
      }
      if (res.currentVersion?.coverLetterContent) {
        setCoverLetterDraft(res.currentVersion.coverLetterContent);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application package');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackage();
  }, [packageId]);

  if (loading) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading Application Studio package...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ padding: '2rem' }}>
        <h3 style={{ color: 'var(--danger)' }}>Error Loading Package</h3>
        <p style={{ marginTop: '0.5rem' }}>{error || 'Package not found'}</p>
        <button className="button button-secondary" style={{ marginTop: '1rem' }} onClick={onBack}>
          Back
        </button>
      </div>
    );
  }

  const pkg = data.package;
  const version = data.currentVersion;
  const readiness = data.readiness;
  const tailoredCv = version?.tailoredCvContent as TailoredCv | undefined;

  const cvArtifact = data.artifacts.find((a) => a.artifactType === 'TAILORED_CV');
  const clArtifact = data.artifacts.find((a) => a.artifactType === 'COVER_LETTER');

  const handleRegenerate = async () => {
    if (
      !confirm(
        'Regenerate package into a new version? Existing approved answers will be preserved.',
      )
    )
      return;
    try {
      setActionLoading(true);
      await applicationPackageClient.regeneratePackage(packageId);
      await loadPackage();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Regeneration failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSummary = async () => {
    try {
      setActionLoading(true);
      await applicationPackageClient.updateCv(packageId, summaryDraft);
      setShowEditSummaryModal(false);
      await loadPackage();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveCoverLetter = async () => {
    try {
      setActionLoading(true);
      await applicationPackageClient.updateCoverLetter(packageId, coverLetterDraft);
      setShowEditCoverLetterModal(false);
      await loadPackage();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const optionsArray = newQuestionOptions
        .split('\n')
        .map((o) => o.trim())
        .filter(Boolean);

      await applicationPackageClient.addQuestion(packageId, {
        questionText: newQuestionText,
        category: newQuestionCategory,
        questionType: newQuestionType,
        options: optionsArray,
        isRequired: newQuestionRequired,
      });

      setShowAddQuestionModal(false);
      setNewQuestionText('');
      setNewQuestionOptions('');
      await loadPackage();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add question');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAnswerQuestion = async () => {
    if (!selectedQuestionForAnswer) return;
    try {
      setActionLoading(true);
      await applicationPackageClient.answerQuestion(
        packageId,
        selectedQuestionForAnswer.id,
        answerDraft,
      );
      setSelectedQuestionForAnswer(null);
      setAnswerDraft('');
      await loadPackage();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save answer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (approvalId: string, editedValue?: string) => {
    try {
      setActionLoading(true);
      await applicationPackageClient.approveRequest(approvalId, editedValue);
      await loadPackage();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (approvalId: string) => {
    try {
      setActionLoading(true);
      await applicationPackageClient.rejectRequest(approvalId);
      await loadPackage();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOverrideBlocker = async () => {
    try {
      setActionLoading(true);
      await applicationPackageClient.overrideBlocker(packageId, overrideReason);
      setShowOverrideModal(false);
      setOverrideReason('');
      await loadPackage();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to override blocker');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      className="application-studio-container"
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      {/* Studio Header */}
      <header className="page-header" style={{ marginBottom: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '0.25rem',
              }}
            >
              <button
                className="button button-secondary"
                onClick={onBack}
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.85rem' }}
              >
                ← Back
              </button>
              <h1 className="page-title" style={{ fontSize: '1.5rem', margin: 0 }}>
                {pkg.jobTitle}
              </h1>
              <span style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
                @ {pkg.jobCompany}
              </span>
            </div>
            <p className="page-subtitle" style={{ margin: 0 }}>
              Application Studio • Version {pkg.currentVersionNumber}
              {version?.baseSelectionReason && (
                <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
                  ({version.baseSelectionReason})
                </span>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Readiness Badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.85rem',
                borderRadius: '9999px',
                fontWeight: 600,
                fontSize: '0.85rem',
                background:
                  readiness.status === 'READY'
                    ? 'rgba(34, 197, 94, 0.15)'
                    : 'rgba(234, 179, 8, 0.15)',
                color: readiness.status === 'READY' ? '#16a34a' : '#ca8a04',
                border: `1px solid ${readiness.status === 'READY' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
              }}
            >
              {readiness.status === 'READY' ? '✓ READY FOR SUBMISSION' : '⚠ NEEDS REVIEW'}
            </span>

            {/* Staleness Badge */}
            {pkg.isStale && (
              <span
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#dc2626',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                STALE INPUTS
              </span>
            )}

            {/* Regenerate Button */}
            <button
              className="button button-secondary"
              onClick={handleRegenerate}
              disabled={actionLoading}
            >
              🔄 Regenerate (v{pkg.currentVersionNumber + 1})
            </button>
          </div>
        </div>
      </header>

      {/* Staleness Warning Banner */}
      {pkg.isStale && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <strong style={{ color: '#dc2626' }}>Package is Stale:</strong>
            <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
              Candidate Brain credentials or job parameters have been updated since this version was
              generated.
            </span>
          </div>
          <button
            className="button button-secondary"
            onClick={handleRegenerate}
            disabled={actionLoading}
          >
            Regenerate Now
          </button>
        </div>
      )}

      {/* Hard Blocker Alert Banner */}
      {pkg.hasPolicyBlocker && !pkg.blockerOverridden && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <strong style={{ color: '#dc2626' }}>Deterministic Policy Blocker:</strong>
            <p
              style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}
            >
              This job triggered a hard exclusion rule during match analysis. Applications cannot be
              finalized without an auditable human override.
            </p>
          </div>
          <button className="button button-secondary" onClick={() => setShowOverrideModal(true)}>
            Override Blocker
          </button>
        </div>
      )}

      {/* Tabs Bar */}
      <div
        style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '0.5rem' }}
      >
        {[
          { id: 'overview', label: 'Overview & Readiness' },
          { id: 'cv', label: `Tailored CV (${tailoredCv?.experiences.length || 0} exp)` },
          { id: 'coverLetter', label: 'Cover Letter' },
          { id: 'questions', label: `Questions (${data.questions.length})` },
          {
            id: 'approvals',
            label: `Approvals (${data.approvals.filter((a) => a.status === 'PENDING').length})`,
          },
          { id: 'evidence', label: 'Evidence & Changes' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as StudioTab)}
            style={{
              padding: '0.65rem 1.1rem',
              fontWeight: activeTab === t.id ? 600 : 500,
              color: activeTab === t.id ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom:
                activeTab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & READINESS */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>Readiness Inspection</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>Overall Readiness: </span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: readiness.isReady ? '#16a34a' : '#ca8a04',
                    }}
                  >
                    {readiness.isReady ? 'READY FOR SUBMISSION' : 'NEEDS CANDIDATE REVIEW'}
                  </span>
                </div>

                {readiness.reasons.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.9rem', color: '#16a34a', margin: '0.5rem 0' }}>
                      ✓ Verified Elements:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                      {readiness.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {readiness.blockingIssues.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.9rem', color: '#dc2626', margin: '0.5rem 0' }}>
                      ⚠ Outstanding Blockers / Items:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                      {readiness.blockingIssues.map((b, i) => (
                        <li key={i} style={{ color: '#dc2626' }}>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Generated Artifacts Summary */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>Generated Documents</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {data.artifacts.map((art) => (
                  <div
                    key={art.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      background: 'rgba(0,0,0,0.02)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{art.filename}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {art.artifactType} • {(art.sizeBytes / 1024).toFixed(1)} KB • SHA:{' '}
                        {art.sha256Checksum.slice(0, 10)}...
                      </div>
                    </div>
                    <a
                      href={applicationPackageClient.getArtifactDownloadUrl(packageId, art.id)}
                      className="button button-secondary"
                      download={art.filename}
                      style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                    >
                      ⬇ Download (DOCX)
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Job & Match Context */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card">
              <h4 style={{ marginBottom: '0.75rem' }}>Matching Context</h4>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  fontSize: '0.9rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Score: </span>
                  <strong>{pkg.matchScore !== null ? `${pkg.matchScore}%` : 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Decision: </span>
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        pkg.matchDecision === 'MATCH'
                          ? '#16a34a'
                          : pkg.matchDecision === 'REVIEW'
                            ? '#ca8a04'
                            : '#dc2626',
                    }}
                  >
                    {pkg.matchDecision || 'N/A'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Confidence: </span>
                  <span>{pkg.matchConfidence !== null ? `${pkg.matchConfidence}%` : 'N/A'}</span>
                </div>
                {onNavigateToJob && (
                  <button
                    className="button button-secondary"
                    style={{ marginTop: '0.5rem' }}
                    onClick={() => onNavigateToJob(pkg.jobId)}
                  >
                    View Job & Requirements
                  </button>
                )}
              </div>
            </div>

            <div className="card">
              <h4 style={{ marginBottom: '0.75rem' }}>Package Safety Rules</h4>
              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                • Grounded Candidate Brain only: zero synthetic employers, dates, or skills.
                <br />
                • Metric Safeguard active: all numbers and KPIs are cross-checked.
                <br />• ATS-safe layout: single-column DOCX generation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TAILORED CV PREVIEW */}
      {activeTab === 'cv' && tailoredCv && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {cvArtifact && (
                <a
                  href={applicationPackageClient.getArtifactDownloadUrl(packageId, cvArtifact.id)}
                  className="button button-primary"
                  download={cvArtifact.filename}
                  style={{ textDecoration: 'none' }}
                >
                  ⬇ Download Tailored CV (DOCX)
                </a>
              )}
              <button
                className="button button-secondary"
                onClick={() => setShowEditSummaryModal(true)}
              >
                ✏ Edit Summary
              </button>
            </div>
          </div>

          {/* Clean ATS CV Preview Container */}
          <div
            className="card cv-preview"
            style={{
              padding: '2.5rem',
              background: '#ffffff',
              color: '#1f2937',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              maxWidth: '850px',
              margin: '0 auto',
              width: '100%',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              lineHeight: 1.6,
            }}
          >
            {/* Header */}
            <div
              style={{
                textAlign: 'center',
                borderBottom: '1px solid #e5e7eb',
                paddingBottom: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <h2
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 700,
                  margin: '0 0 0.25rem',
                  color: '#111827',
                }}
              >
                {tailoredCv.header.fullName}
              </h2>
              {tailoredCv.header.headline && (
                <div style={{ fontStyle: 'italic', color: '#4b5563', marginBottom: '0.5rem' }}>
                  {tailoredCv.header.headline}
                </div>
              )}
              <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                {[
                  tailoredCv.header.email,
                  tailoredCv.header.phone,
                  tailoredCv.header.location,
                  ...tailoredCv.header.links.map((l) => `${l.label}: ${l.url}`),
                ]
                  .filter(Boolean)
                  .join('  •  ')}
              </div>
            </div>

            {/* Summary */}
            {tailoredCv.summary && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '0.25rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  Professional Summary
                </h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151' }}>
                  {tailoredCv.summary}
                </p>
              </div>
            )}

            {/* Skills */}
            {tailoredCv.skills.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '0.25rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  Technical Skills
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {tailoredCv.skills.map((s) => (
                    <span
                      key={s.id}
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        background: s.isHighlighted ? 'rgba(59, 130, 246, 0.1)' : '#f3f4f6',
                        color: s.isHighlighted ? '#1d4ed8' : '#374151',
                        border: s.isHighlighted
                          ? '1px solid rgba(59, 130, 246, 0.3)'
                          : '1px solid transparent',
                        fontWeight: s.isHighlighted ? 600 : 400,
                      }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Experience */}
            {tailoredCv.experiences.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '0.25rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  Work Experience
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {tailoredCv.experiences.map((exp) => (
                    <div key={exp.id}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '0.95rem', color: '#111827' }}>
                            {exp.title}
                          </strong>
                          <span style={{ color: '#4b5563' }}>
                            {' '}
                            — {exp.organization}
                            {exp.location ? `, ${exp.location}` : ''}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>
                          {exp.startDate} - {exp.isCurrent ? 'Present' : exp.endDate || 'Present'}
                        </span>
                      </div>
                      <ul
                        style={{
                          margin: '0.4rem 0 0',
                          paddingLeft: '1.25rem',
                          fontSize: '0.875rem',
                          color: '#374151',
                        }}
                      >
                        {exp.bullets.map((b, idx) => (
                          <li key={idx} style={{ marginBottom: '0.25rem' }}>
                            {b.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {tailoredCv.education.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '0.25rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  Education
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {tailoredCv.education.map((edu) => (
                    <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <strong>
                          {edu.degree}
                          {edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}
                        </strong>
                        <div style={{ color: '#4b5563', fontSize: '0.85rem' }}>
                          {edu.institution}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>
                        {edu.startDate} - {edu.endDate || 'Present'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {tailoredCv.languages.length > 0 && (
              <div>
                <h3
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '0.25rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  Languages
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#374151' }}>
                  {tailoredCv.languages
                    .map(
                      (l) =>
                        `${l.language} (${l.proficiencyLevel}${l.cefrLevel ? `, ${l.cefrLevel}` : ''})`,
                    )
                    .join('  •  ')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: COVER LETTER */}
      {activeTab === 'coverLetter' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {clArtifact && (
                <a
                  href={applicationPackageClient.getArtifactDownloadUrl(packageId, clArtifact.id)}
                  className="button button-primary"
                  download={clArtifact.filename}
                  style={{ textDecoration: 'none' }}
                >
                  ⬇ Download Cover Letter (DOCX)
                </a>
              )}
              <button
                className="button button-secondary"
                onClick={() => setShowEditCoverLetterModal(true)}
              >
                ✏ Edit Text
              </button>
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: '2.5rem',
              background: '#ffffff',
              color: '#1f2937',
              maxWidth: '850px',
              margin: '0 auto',
              width: '100%',
              lineHeight: 1.8,
              fontSize: '0.95rem',
              whiteSpace: 'pre-wrap',
            }}
          >
            {version?.coverLetterContent || 'No cover letter content generated.'}
          </div>
        </div>
      )}

      {/* TAB 4: APPLICATION QUESTIONS */}
      {activeTab === 'questions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              Application questions mapped to Answer Library rules and Candidate Brain facts.
            </p>
            <button className="button button-primary" onClick={() => setShowAddQuestionModal(true)}>
              + Add Custom Question
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {data.questions.map((q) => (
              <div key={q.id} className="card" style={{ padding: '1.25rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.4rem',
                      }}
                    >
                      <span className="badge">{q.category}</span>
                      <span className="badge">{q.questionType}</span>
                      {q.sensitivity === 'SENSITIVE' && (
                        <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
                          SENSITIVE
                        </span>
                      )}
                      {q.isRequired && (
                        <span style={{ fontSize: '0.75rem', color: '#ca8a04', fontWeight: 600 }}>
                          REQUIRED
                        </span>
                      )}
                    </div>
                    <strong style={{ fontSize: '1rem' }}>{q.questionText}</strong>
                  </div>

                  <span
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '9999px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      background:
                        q.approvalState === 'APPROVED'
                          ? 'rgba(34, 197, 94, 0.15)'
                          : q.approvalState === 'PENDING'
                            ? 'rgba(234, 179, 8, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                      color:
                        q.approvalState === 'APPROVED'
                          ? '#16a34a'
                          : q.approvalState === 'PENDING'
                            ? '#ca8a04'
                            : '#dc2626',
                    }}
                  >
                    {q.approvalState}
                  </span>
                </div>

                <div
                  style={{
                    margin: '0.85rem 0',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    background: 'rgba(0,0,0,0.02)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Source: {q.answerSource}
                  </div>
                  <div>
                    <strong>Answer: </strong>
                    <span>
                      {q.finalAnswer || q.proposedAnswer || (
                        <em style={{ color: 'var(--text-secondary)' }}>
                          Unresolved (Human input required)
                        </em>
                      )}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="button button-secondary"
                    onClick={() => {
                      setSelectedQuestionForAnswer(q);
                      setAnswerDraft(q.finalAnswer || q.proposedAnswer || '');
                    }}
                  >
                    ✏ Edit / Answer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: APPROVALS */}
      {activeTab === 'approvals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            Pending authorizations for sensitive declarations, answer library overrides, and legal
            statements.
          </p>

          {data.approvals.length === 0 ? (
            <div
              className="card"
              style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}
            >
              ✓ No approval requests for this package.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {data.approvals.map((appr) => (
                <div key={appr.id} className="card" style={{ padding: '1.25rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <span className="badge">{appr.approvalType}</span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: appr.riskLevel === 'CRITICAL' ? '#dc2626' : '#ca8a04',
                          }}
                        >
                          Risk: {appr.riskLevel}
                        </span>
                      </div>
                      <strong style={{ fontSize: '1rem' }}>{appr.subject}</strong>
                      <p
                        style={{
                          margin: '0.25rem 0 0',
                          fontSize: '0.85rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {appr.reason}
                      </p>
                    </div>

                    <span
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '9999px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background:
                          appr.status === 'APPROVED'
                            ? 'rgba(34, 197, 94, 0.15)'
                            : appr.status === 'PENDING'
                              ? 'rgba(234, 179, 8, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                        color:
                          appr.status === 'APPROVED'
                            ? '#16a34a'
                            : appr.status === 'PENDING'
                              ? '#ca8a04'
                              : '#dc2626',
                      }}
                    >
                      {appr.status}
                    </span>
                  </div>

                  <div
                    style={{
                      margin: '0.75rem 0',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      background: 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <strong>Proposed Value: </strong>
                    <span>{appr.proposedValue || 'None'}</span>
                  </div>

                  {appr.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="button button-primary"
                        onClick={() => handleApprove(appr.id)}
                        disabled={actionLoading}
                      >
                        ✓ Approve
                      </button>
                      <button
                        className="button button-secondary"
                        onClick={() => {
                          const val = prompt(
                            'Edit value before approval:',
                            appr.proposedValue || '',
                          );
                          if (val !== null) handleApprove(appr.id, val);
                        }}
                        disabled={actionLoading}
                      >
                        ✏ Edit & Approve
                      </button>
                      <button
                        className="button button-secondary"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => handleReject(appr.id)}
                        disabled={actionLoading}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: EVIDENCE & CHANGES */}
      {activeTab === 'evidence' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3>Change Explanation</h3>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.75rem', lineHeight: 1.6 }}>
              {version?.changeSummary.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CV SUMMARY */}
      {showEditSummaryModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '600px', width: '100%' }}>
            <h3>Edit Professional Summary</h3>
            <textarea
              className="input"
              rows={6}
              value={summaryDraft}
              onChange={(e) => setSummaryDraft(e.target.value)}
              style={{ width: '100%', marginTop: '0.75rem' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.5rem',
                marginTop: '1rem',
              }}
            >
              <button
                className="button button-secondary"
                onClick={() => setShowEditSummaryModal(false)}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                onClick={handleSaveSummary}
                disabled={actionLoading}
              >
                Save & Regenerate DOCX
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT COVER LETTER */}
      {showEditCoverLetterModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '650px', width: '100%' }}>
            <h3>Edit Cover Letter</h3>
            <textarea
              className="input"
              rows={12}
              value={coverLetterDraft}
              onChange={(e) => setCoverLetterDraft(e.target.value)}
              style={{ width: '100%', marginTop: '0.75rem' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.5rem',
                marginTop: '1rem',
              }}
            >
              <button
                className="button button-secondary"
                onClick={() => setShowEditCoverLetterModal(false)}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                onClick={handleSaveCoverLetter}
                disabled={actionLoading}
              >
                Save & Regenerate DOCX
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD QUESTION */}
      {showAddQuestionModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '550px', width: '100%' }}>
            <h3>Add Application Question</h3>
            <form
              onSubmit={handleAddQuestion}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                marginTop: '0.75rem',
              }}
            >
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Question Text</label>
                <input
                  className="input"
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  placeholder="e.g. What is your notice period?"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Category</label>
                  <select
                    className="input"
                    value={newQuestionCategory}
                    onChange={(e) => setNewQuestionCategory(e.target.value as QuestionCategory)}
                  >
                    <option value="GENERAL">General</option>
                    <option value="WORK_AUTHORIZATION">Work Authorization</option>
                    <option value="SPONSORSHIP">Sponsorship</option>
                    <option value="SALARY">Salary</option>
                    <option value="AVAILABILITY">Availability</option>
                    <option value="EXPERIENCE_YEARS">Experience Years</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Question Type</label>
                  <select
                    className="input"
                    value={newQuestionType}
                    onChange={(e) => setNewQuestionType(e.target.value as QuestionType)}
                  >
                    <option value="TEXT">Text</option>
                    <option value="TEXTAREA">Textarea</option>
                    <option value="BOOLEAN">Boolean</option>
                    <option value="SINGLE_SELECT">Single Select</option>
                    <option value="MULTI_SELECT">Multi Select</option>
                    <option value="NUMBER">Number</option>
                  </select>
                </div>
              </div>

              {(newQuestionType === 'SINGLE_SELECT' || newQuestionType === 'MULTI_SELECT') && (
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Options (one per line)
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    value={newQuestionOptions}
                    onChange={(e) => setNewQuestionOptions(e.target.value)}
                    placeholder="Yes&#10;No"
                  />
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="reqCheck"
                  checked={newQuestionRequired}
                  onChange={(e) => setNewQuestionRequired(e.target.checked)}
                />
                <label htmlFor="reqCheck" style={{ fontSize: '0.85rem' }}>
                  Required Question
                </label>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.5rem',
                  marginTop: '0.75rem',
                }}
              >
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setShowAddQuestionModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={actionLoading}>
                  Add Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ANSWER QUESTION */}
      {selectedQuestionForAnswer && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '500px', width: '100%' }}>
            <h3>Answer Question</h3>
            <p style={{ fontWeight: 600, marginTop: '0.5rem' }}>
              {selectedQuestionForAnswer.questionText}
            </p>

            {selectedQuestionForAnswer.options && selectedQuestionForAnswer.options.length > 0 ? (
              <select
                className="input"
                value={answerDraft}
                onChange={(e) => setAnswerDraft(e.target.value)}
                style={{ width: '100%', marginTop: '0.75rem' }}
              >
                <option value="">-- Select an option --</option>
                {selectedQuestionForAnswer.options.map((opt: string) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                value={answerDraft}
                onChange={(e) => setAnswerDraft(e.target.value)}
                style={{ width: '100%', marginTop: '0.75rem' }}
                placeholder="Enter answer..."
              />
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.5rem',
                marginTop: '1rem',
              }}
            >
              <button
                className="button button-secondary"
                onClick={() => setSelectedQuestionForAnswer(null)}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                onClick={handleAnswerQuestion}
                disabled={actionLoading}
              >
                Save & Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: OVERRIDE BLOCKER */}
      {showOverrideModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '500px', width: '100%' }}>
            <h3 style={{ color: '#dc2626' }}>Override Policy Blocker</h3>
            <p
              style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}
            >
              Please provide an auditable justification explaining why this hard policy restriction
              is being waived.
            </p>
            <textarea
              className="input"
              rows={4}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g. Candidate confirmed willing to relocate or accept terms for this specific position..."
              style={{ width: '100%', marginTop: '0.75rem' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.5rem',
                marginTop: '1rem',
              }}
            >
              <button
                className="button button-secondary"
                onClick={() => setShowOverrideModal(false)}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                onClick={handleOverrideBlocker}
                disabled={actionLoading || overrideReason.trim().length < 5}
              >
                Confirm Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
