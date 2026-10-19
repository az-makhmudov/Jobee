import { useFeedback } from '../ui/Feedback.js';
import {
  Tabs,
  Button,
  Card,
  Icon,
  Input,
  ModalSurface,
  Select,
  Textarea,
} from '../ui/Primitives.js';
import { useState, useEffect } from 'react';
import {
  applicationPackageClient,
  type PackageDetailResponse,
} from '../api/application-package-client.js';
import { ApplicationCrmClient } from '../api/application-crm-client.js';
import {
  ApplicationLifecycleStatus,
  type TailoredCv,
  type QuestionCategory,
  type QuestionType,
  type ApplicationQuestionDto,
  type ApplicationSummaryDto,
} from '@job-agent/shared';

interface ApplicationStudioViewProps {
  packageId: string;
  onBack: () => void;
  onNavigateToJob?: (jobId: string) => void;
  onNavigateToApplication?: (applicationId: string) => void;
}

type StudioTab = 'overview' | 'cv' | 'coverLetter' | 'questions' | 'approvals' | 'evidence';

export function ApplicationStudioView({
  packageId,
  onBack,
  onNavigateToJob,
  onNavigateToApplication,
}: ApplicationStudioViewProps) {
  const { confirm, alert, prompt } = useFeedback();
  const [data, setData] = useState<PackageDetailResponse | null>(null);
  const [crmApp, setCrmApp] = useState<ApplicationSummaryDto | null>(null);
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
      try {
        const appRes = await ApplicationCrmClient.getApplicationForJob(res.package.jobId);
        setCrmApp(appRes);
      } catch {
        setCrmApp(null);
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
      <Card className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading Prepare application package...</p>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="card" style={{ padding: '2rem' }}>
        <h3 style={{ color: 'var(--danger)' }}>Error Loading Package</h3>
        <p style={{ marginTop: '0.5rem' }}>{error || 'Package not found'}</p>
        <Button className="button button-secondary" style={{ marginTop: '1rem' }} onClick={onBack}>
          Back
        </Button>
      </Card>
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
      !(await confirm(
        'Regenerate package into a new version? Existing approved answers will be preserved.',
      ))
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

  const handleTrackInCrm = async () => {
    if (!data) return;
    try {
      setActionLoading(true);
      const res = await ApplicationCrmClient.createApplication({
        jobId: data.package.jobId,
        packageId: data.package.id,
        status: ApplicationLifecycleStatus.READY_TO_APPLY,
      });
      setCrmApp(res.application);
      if (onNavigateToApplication) {
        onNavigateToApplication(res.application.id);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to track in CRM');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAppliedInCrm = async () => {
    if (!data) return;
    try {
      setActionLoading(true);
      let appId = crmApp?.id;
      if (!appId) {
        const created = await ApplicationCrmClient.createApplication({
          jobId: data.package.jobId,
          packageId: data.package.id,
        });
        appId = created.application.id;
      }
      const updated = await ApplicationCrmClient.markApplied(appId, {
        submissionMethod: 'COMPANY_SITE',
        packageVersionId: data.currentVersion?.id,
        cvArtifactId: cvArtifact?.id,
        coverLetterArtifactId: clArtifact?.id,
      });
      setCrmApp(updated);
      if (onNavigateToApplication) {
        onNavigateToApplication(updated.id);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to record application in CRM');
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
          className="layout-group"
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '0.25rem',
              }}
              className="layout-group"
            >
              <Button
                className="button button-secondary"
                onClick={onBack}
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.85rem' }}
              >
                ← Back
              </Button>
              <h1 className="page-title" style={{ fontSize: '1.5rem', margin: 0 }}>
                {pkg.jobTitle}
              </h1>
              <span style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
                @ {pkg.jobCompany}
              </span>
            </div>
            <p className="page-subtitle" style={{ margin: 0 }}>
              {version
                ? `Application documents · Version ${version.versionNumber}`
                : 'Application documents · Not created yet'}
              {version?.baseSelectionReason && (
                <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
                  ({version.baseSelectionReason})
                </span>
              )}
            </p>
          </div>

          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}
            className="layout-group"
          >
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
                    ? 'var(--status-success-container)'
                    : 'var(--status-warning-container)',
                color:
                  readiness.status === 'READY' ? 'var(--status-success)' : 'var(--status-warning)',
                border: `1px solid ${readiness.status === 'READY' ? 'var(--status-success-border)' : 'var(--status-warning-border)'}`,
              }}
            >
              {readiness.status === 'READY' ? (
                <>
                  <Icon name="check" size={20} /> READY FOR SUBMISSION
                </>
              ) : (
                <>
                  <Icon name="warning" size={20} /> NEEDS REVIEW
                </>
              )}
            </span>

            {/* Staleness Badge */}
            {pkg.isStale && (
              <span
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px',
                  background: 'var(--status-danger-container)',
                  color: 'var(--status-danger)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                STALE INPUTS
              </span>
            )}

            {/* Regenerate Button */}
            <Button
              className="button button-secondary"
              onClick={handleRegenerate}
              disabled={actionLoading}
            >
              <Icon name="sync" />{' '}
              {version
                ? `Regenerate documents (v${pkg.currentVersionNumber + 1})`
                : 'Create application documents'}
            </Button>

            {/* CRM Lifecycle Action Button */}
            {crmApp ? (
              <Button
                className="button button-primary"
                onClick={() => onNavigateToApplication?.(crmApp.id)}
                title="View application lifecycle, timeline and follow-ups in CRM"
              >
                <Icon name="list" /> View application →
              </Button>
            ) : (
              <div style={{ display: 'flex', gap: '0.4rem' }} className="layout-group">
                <Button
                  className="button button-secondary"
                  onClick={handleTrackInCrm}
                  disabled={actionLoading}
                >
                  Add to my applications
                </Button>
                {readiness.status === 'READY' && (
                  <Button
                    className="button button-primary"
                    onClick={handleMarkAppliedInCrm}
                    disabled={actionLoading}
                  >
                    <Icon name="check" size={20} /> Mark Applied in CRM →
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Staleness Warning Banner */}
      {pkg.isStale && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '16px',
            background: 'var(--status-danger-container)',
            border: '1px solid var(--status-danger-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <strong style={{ color: 'var(--status-danger)' }}>Package is Stale:</strong>
            <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
              Candidate Brain credentials or job parameters have been updated since this version was
              generated.
            </span>
          </div>
          <Button
            className="button button-secondary"
            onClick={handleRegenerate}
            disabled={actionLoading}
          >
            Regenerate Now
          </Button>
        </div>
      )}

      {/* Hard Blocker Alert Banner */}
      {pkg.hasPolicyBlocker && !pkg.blockerOverridden && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '16px',
            background: 'var(--status-danger-container)',
            border: '1px solid var(--status-danger-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <strong style={{ color: 'var(--status-danger)' }}>Deterministic Policy Blocker:</strong>
            <p
              style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}
            >
              This job triggered a hard exclusion rule during match analysis. Applications cannot be
              finalized without an auditable human override.
            </p>
          </div>
          <Button className="button button-secondary" onClick={() => setShowOverrideModal(true)}>
            Override Blocker
          </Button>
        </div>
      )}

      <Tabs
        panelId="studio-panel"
        label="Application materials"
        value={activeTab}
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'cv', label: 'CV' },
          { id: 'coverLetter', label: 'Cover letter' },
          { id: 'questions', label: `Questions (${data.questions.length})` },
          {
            id: 'approvals',
            label: `Approvals (${data.approvals.filter((a) => a.status === 'PENDING').length})`,
          },
          { id: 'evidence', label: 'Sources & changes' },
        ]}
        onChange={(id) => setActiveTab(id as StudioTab)}
      />

      <section id="studio-panel" role="tabpanel" aria-label={activeTab}>
        {/* TAB 1: OVERVIEW & READINESS */}
        {activeTab === 'overview' && (
          <div className="detail-columns">
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              className="layout-group"
            >
              <Card className="card">
                <h3 style={{ marginBottom: '1rem' }}>Readiness Inspection</h3>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                  className="layout-group"
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>Overall Readiness: </span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: readiness.isReady
                          ? 'var(--status-success)'
                          : 'var(--status-warning)',
                      }}
                    >
                      {readiness.isReady ? 'READY FOR SUBMISSION' : 'NEEDS CANDIDATE REVIEW'}
                    </span>
                  </div>

                  {readiness.reasons.length > 0 && (
                    <div>
                      <h4
                        style={{
                          fontSize: '0.9rem',
                          color: 'var(--status-success)',
                          margin: '0.5rem 0',
                        }}
                      >
                        <Icon name="check" size={20} /> Verified Elements:
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
                      <h4
                        style={{
                          fontSize: '0.9rem',
                          color: 'var(--status-danger)',
                          margin: '0.5rem 0',
                        }}
                      >
                        <Icon name="warning" /> Outstanding Blockers / Items:
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                        {readiness.blockingIssues.map((b, i) => (
                          <li key={i} style={{ color: 'var(--status-danger)' }}>
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>

              {/* Generated Artifacts Summary */}
              <Card className="card">
                <h3 style={{ marginBottom: '1rem' }}>Generated Documents</h3>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                  className="layout-group"
                >
                  {data.artifacts.map((art) => (
                    <div
                      key={art.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        borderRadius: '16px',
                        background: 'var(--m3-surface-container-low)',
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
                        <Icon name="download" size={20} /> Download (DOCX)
                      </a>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Right Column: Job & Match Context */}
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              className="layout-group"
            >
              <Card className="card">
                <h4 style={{ marginBottom: '0.75rem' }}>Matching Context</h4>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                  }}
                  className="layout-group"
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
                            ? 'var(--status-success)'
                            : pkg.matchDecision === 'REVIEW'
                              ? 'var(--status-warning)'
                              : 'var(--status-danger)',
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
                    <Button
                      className="button button-secondary"
                      style={{ marginTop: '0.5rem' }}
                      onClick={() => onNavigateToJob(pkg.jobId)}
                    >
                      View Job & Requirements
                    </Button>
                  )}
                </div>
              </Card>

              <Card className="card">
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
              </Card>
            </div>
          </div>
        )}

        {/* TAB 2: TAILORED CV PREVIEW */}
        {activeTab === 'cv' && tailoredCv && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            className="layout-group"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }} className="layout-group">
                {cvArtifact ? (
                  <a
                    href={applicationPackageClient.getArtifactDownloadUrl(packageId, cvArtifact.id)}
                    className="button button-primary"
                    download={cvArtifact.filename}
                    style={{ textDecoration: 'none' }}
                  >
                    <Icon name="download" size={20} /> Download Tailored CV (DOCX)
                  </a>
                ) : (
                  <Button
                    className="button button-primary"
                    onClick={handleRegenerate}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <>
                        <Icon name="schedule" size={20} /> Generating...
                      </>
                    ) : (
                      <>
                        <Icon name="ai" size={20} /> Generate CV Document
                      </>
                    )}
                  </Button>
                )}
                <Button
                  className="button button-secondary"
                  onClick={() => setShowEditSummaryModal(true)}
                >
                  <Icon name="edit" size={20} /> Edit Summary
                </Button>
              </div>
            </div>

            {/* Clean ATS CV Preview Container */}
            <Card
              className="card cv-preview"
              style={{
                padding: '2.5rem',
                background: 'var(--m3-surface)',
                color: 'var(--m3-on-surface)',
                boxShadow: '0 4px 16px color-mix(in srgb,var(--m3-scrim) 12%,transparent)',
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
                  borderBottom: '1px solid var(--m3-outline-variant)',
                  paddingBottom: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                <h2
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 700,
                    margin: '0 0 0.25rem',
                    color: 'var(--m3-on-surface)',
                  }}
                >
                  {tailoredCv.header.fullName}
                </h2>
                {tailoredCv.header.headline && (
                  <div
                    style={{
                      fontStyle: 'italic',
                      color: 'var(--m3-on-surface-variant)',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {tailoredCv.header.headline}
                  </div>
                )}
                <div style={{ fontSize: '0.85rem', color: 'var(--m3-on-surface-variant)' }}>
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
                      color: 'var(--m3-on-surface)',
                      borderBottom: '1px solid var(--m3-outline-variant)',
                      paddingBottom: '0.25rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Professional Summary
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--m3-on-surface)' }}>
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
                      color: 'var(--m3-on-surface)',
                      borderBottom: '1px solid var(--m3-outline-variant)',
                      paddingBottom: '0.25rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Technical Skills
                  </h3>
                  <div
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}
                    className="layout-group"
                  >
                    {tailoredCv.skills.map((s) => (
                      <span
                        key={s.id}
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '16px',
                          fontSize: '0.85rem',
                          background: s.isHighlighted
                            ? 'var(--m3-secondary-container)'
                            : 'var(--m3-surface-container-low)',
                          color: s.isHighlighted ? 'var(--m3-on-surface)' : 'var(--m3-on-surface)',
                          border: s.isHighlighted
                            ? '1px solid var(--m3-outline-variant)'
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
                      color: 'var(--m3-on-surface)',
                      borderBottom: '1px solid var(--m3-outline-variant)',
                      paddingBottom: '0.25rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    Work Experience
                  </h3>
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                    className="layout-group"
                  >
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
                            <strong style={{ fontSize: '0.95rem', color: 'var(--m3-on-surface)' }}>
                              {exp.title}
                            </strong>
                            <span style={{ color: 'var(--m3-on-surface-variant)' }}>
                              {' '}
                              — {exp.organization}
                              {exp.location ? `, ${exp.location}` : ''}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: '0.8rem',
                              color: 'var(--m3-on-surface-variant)',
                              fontStyle: 'italic',
                            }}
                          >
                            {exp.startDate} - {exp.isCurrent ? 'Present' : exp.endDate || 'Present'}
                          </span>
                        </div>
                        <ul
                          style={{
                            margin: '0.4rem 0 0',
                            paddingLeft: '1.25rem',
                            fontSize: '0.875rem',
                            color: 'var(--m3-on-surface)',
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
                      color: 'var(--m3-on-surface)',
                      borderBottom: '1px solid var(--m3-outline-variant)',
                      paddingBottom: '0.25rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    Education
                  </h3>
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                    className="layout-group"
                  >
                    {tailoredCv.education.map((edu) => (
                      <div
                        key={edu.id}
                        style={{ display: 'flex', justifyContent: 'space-between' }}
                      >
                        <div>
                          <strong>
                            {edu.degree}
                            {edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}
                          </strong>
                          <div
                            style={{ color: 'var(--m3-on-surface-variant)', fontSize: '0.85rem' }}
                          >
                            {edu.institution}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--m3-on-surface-variant)',
                            fontStyle: 'italic',
                          }}
                        >
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
                      color: 'var(--m3-on-surface)',
                      borderBottom: '1px solid var(--m3-outline-variant)',
                      paddingBottom: '0.25rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Languages
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--m3-on-surface)' }}>
                    {tailoredCv.languages
                      .map(
                        (l) =>
                          `${l.language} (${l.proficiencyLevel}${l.cefrLevel ? `, ${l.cefrLevel}` : ''})`,
                      )
                      .join('  •  ')}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 3: COVER LETTER */}
        {activeTab === 'coverLetter' && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            className="layout-group"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }} className="layout-group">
                {clArtifact ? (
                  <a
                    href={applicationPackageClient.getArtifactDownloadUrl(packageId, clArtifact.id)}
                    className="button button-primary"
                    download={clArtifact.filename}
                    style={{ textDecoration: 'none' }}
                  >
                    <Icon name="download" size={20} /> Download Cover Letter (DOCX)
                  </a>
                ) : (
                  <Button
                    className="button button-primary"
                    onClick={handleRegenerate}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <>
                        <Icon name="schedule" size={20} /> Generating...
                      </>
                    ) : (
                      <>
                        <Icon name="ai" size={20} /> Generate Cover Letter Document
                      </>
                    )}
                  </Button>
                )}
                <Button
                  className="button button-secondary"
                  onClick={() => setShowEditCoverLetterModal(true)}
                >
                  <Icon name="edit" size={20} /> Edit Text
                </Button>
              </div>
            </div>

            <Card
              className="card"
              style={{
                padding: '2.5rem',
                background: 'var(--m3-surface)',
                color: 'var(--m3-on-surface)',
                maxWidth: '850px',
                margin: '0 auto',
                width: '100%',
                lineHeight: 1.8,
                fontSize: '0.95rem',
                whiteSpace: 'pre-wrap',
              }}
            >
              {version?.coverLetterContent || 'No cover letter content generated.'}
            </Card>
          </div>
        )}

        {/* TAB 4: APPLICATION QUESTIONS */}
        {activeTab === 'questions' && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            className="layout-group"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Application questions mapped to Answer Library rules and Candidate Brain facts.
              </p>
              <Button
                className="button button-primary"
                onClick={() => setShowAddQuestionModal(true)}
              >
                + Add Custom Question
              </Button>
            </div>

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
              className="layout-group"
            >
              {data.questions.map((q) => (
                <Card key={q.id} className="card" style={{ padding: '1.25rem' }}>
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
                        className="layout-group"
                      >
                        <span className="badge">{q.category}</span>
                        <span className="badge">{q.questionType}</span>
                        {q.sensitivity === 'SENSITIVE' && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--status-warning)',
                              fontWeight: 600,
                            }}
                          >
                            SENSITIVE
                          </span>
                        )}
                        {q.isRequired && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--status-danger)',
                              fontWeight: 600,
                            }}
                          >
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
                            ? 'var(--status-success-container)'
                            : q.approvalState === 'PENDING'
                              ? 'var(--status-warning-container)'
                              : 'var(--status-danger-container)',
                        color:
                          q.approvalState === 'APPROVED'
                            ? 'var(--status-success)'
                            : q.approvalState === 'PENDING'
                              ? 'var(--status-warning)'
                              : 'var(--status-danger)',
                      }}
                    >
                      {q.approvalState}
                    </span>
                  </div>

                  <div
                    style={{
                      margin: '0.85rem 0',
                      padding: '0.75rem',
                      borderRadius: '16px',
                      background: 'var(--m3-surface-container-low)',
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

                  <div style={{ display: 'flex', gap: '0.5rem' }} className="layout-group">
                    <Button
                      className="button button-secondary"
                      onClick={() => {
                        setSelectedQuestionForAnswer(q);
                        setAnswerDraft(q.finalAnswer || q.proposedAnswer || '');
                      }}
                    >
                      <Icon name="edit" size={20} /> Edit / Answer
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: APPROVALS */}
        {activeTab === 'approvals' && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            className="layout-group"
          >
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              Pending authorizations for sensitive declarations, answer library overrides, and legal
              statements.
            </p>

            {data.approvals.length === 0 ? (
              <Card
                className="card"
                style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}
              >
                <Icon name="check" size={20} /> No approval requests for this package.
              </Card>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                className="layout-group"
              >
                {data.approvals.map((appr) => (
                  <Card key={appr.id} className="card" style={{ padding: '1.25rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div>
                        <div
                          style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem' }}
                          className="layout-group"
                        >
                          <span className="badge">{appr.approvalType}</span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color:
                                appr.riskLevel === 'CRITICAL'
                                  ? 'var(--status-danger)'
                                  : 'var(--status-warning)',
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
                              ? 'var(--status-success-container)'
                              : appr.status === 'PENDING'
                                ? 'var(--status-warning-container)'
                                : 'var(--status-danger-container)',
                          color:
                            appr.status === 'APPROVED'
                              ? 'var(--status-success)'
                              : appr.status === 'PENDING'
                                ? 'var(--status-warning)'
                                : 'var(--status-danger)',
                        }}
                      >
                        {appr.status}
                      </span>
                    </div>

                    <div
                      style={{
                        margin: '0.75rem 0',
                        padding: '0.75rem',
                        borderRadius: '16px',
                        background: 'var(--m3-surface-container-low)',
                      }}
                    >
                      <strong>Proposed Value: </strong>
                      <span>{appr.proposedValue || 'None'}</span>
                    </div>

                    {appr.status === 'NEEDS_USER_RECONFIRMATION' && (
                      <div
                        style={{
                          margin: '0.5rem 0',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '16px',
                          background: 'var(--status-warning-container)',
                          border: '1px solid var(--status-warning-border)',
                          color: 'var(--status-warning)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <Icon name="warning" /> <strong>Candidate Reconfirmation Required:</strong>{' '}
                        Quarantined by safety policy.
                      </div>
                    )}

                    {(appr.status === 'PENDING' || appr.status === 'NEEDS_USER_RECONFIRMATION') && (
                      <div style={{ display: 'flex', gap: '0.5rem' }} className="layout-group">
                        <Button
                          className="button button-primary"
                          onClick={() => handleApprove(appr.id)}
                          disabled={actionLoading}
                        >
                          {appr.status === 'NEEDS_USER_RECONFIRMATION' ? (
                            <>
                              <Icon name="check" size={20} /> Reconfirm &amp; Approve
                            </>
                          ) : (
                            <>
                              <Icon name="check" size={20} /> Approve
                            </>
                          )}
                        </Button>
                        <Button
                          className="button button-secondary"
                          onClick={async () => {
                            const val = await prompt(
                              'Edit value before approval:',
                              appr.proposedValue || '',
                            );
                            if (val !== null) handleApprove(appr.id, val);
                          }}
                          disabled={actionLoading}
                        >
                          <Icon name="edit" size={20} /> Edit & Approve
                        </Button>
                        <Button
                          className="button button-secondary"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => handleReject(appr.id)}
                          disabled={actionLoading}
                        >
                          <Icon name="close" size={20} /> Reject
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: EVIDENCE & CHANGES */}
        {activeTab === 'evidence' && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            className="layout-group"
          >
            <Card className="card">
              <h3>Change Explanation</h3>
              <ul style={{ paddingLeft: '1.25rem', marginTop: '0.75rem', lineHeight: 1.6 }}>
                {version?.changeSummary.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {/* MODAL: EDIT CV SUMMARY */}
        {showEditSummaryModal && (
          <ModalSurface className="modal-backdrop">
            <div className="modal-card" style={{ maxWidth: '600px', width: '100%' }}>
              <h3>Edit Professional Summary</h3>
              <Textarea
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
                className="layout-group"
              >
                <Button
                  className="button button-secondary"
                  onClick={() => setShowEditSummaryModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="button button-primary"
                  onClick={handleSaveSummary}
                  disabled={actionLoading}
                >
                  Save & Regenerate DOCX
                </Button>
              </div>
            </div>
          </ModalSurface>
        )}

        {/* MODAL: EDIT COVER LETTER */}
        {showEditCoverLetterModal && (
          <ModalSurface className="modal-backdrop">
            <div className="modal-card" style={{ maxWidth: '650px', width: '100%' }}>
              <h3>Edit Cover Letter</h3>
              <Textarea
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
                className="layout-group"
              >
                <Button
                  className="button button-secondary"
                  onClick={() => setShowEditCoverLetterModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="button button-primary"
                  onClick={handleSaveCoverLetter}
                  disabled={actionLoading}
                >
                  Save & Regenerate DOCX
                </Button>
              </div>
            </div>
          </ModalSurface>
        )}

        {/* MODAL: ADD QUESTION */}
        {showAddQuestionModal && (
          <ModalSurface className="modal-backdrop">
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
                  <Input
                    className="input"
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="e.g. What is your notice period?"
                    required
                  />
                </div>

                <div
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}
                  className="layout-group"
                >
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Category</label>
                    <Select
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
                    </Select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Question Type</label>
                    <Select
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
                    </Select>
                  </div>
                </div>

                {(newQuestionType === 'SINGLE_SELECT' || newQuestionType === 'MULTI_SELECT') && (
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      Options (one per line)
                    </label>
                    <Textarea
                      className="input"
                      rows={3}
                      value={newQuestionOptions}
                      onChange={(e) => setNewQuestionOptions(e.target.value)}
                      placeholder="Yes&#10;No"
                    />
                  </div>
                )}

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  className="layout-group"
                >
                  <Input
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
                  className="layout-group"
                >
                  <Button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setShowAddQuestionModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="button button-primary" disabled={actionLoading}>
                    Add Question
                  </Button>
                </div>
              </form>
            </div>
          </ModalSurface>
        )}

        {/* MODAL: ANSWER QUESTION */}
        {selectedQuestionForAnswer && (
          <ModalSurface className="modal-backdrop">
            <div className="modal-card" style={{ maxWidth: '500px', width: '100%' }}>
              <h3>Answer Question</h3>
              <p style={{ fontWeight: 600, marginTop: '0.5rem' }}>
                {selectedQuestionForAnswer.questionText}
              </p>

              {selectedQuestionForAnswer.options && selectedQuestionForAnswer.options.length > 0 ? (
                <Select
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
                </Select>
              ) : (
                <Input
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
                className="layout-group"
              >
                <Button
                  className="button button-secondary"
                  onClick={() => setSelectedQuestionForAnswer(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="button button-primary"
                  onClick={handleAnswerQuestion}
                  disabled={actionLoading}
                >
                  Save & Approve
                </Button>
              </div>
            </div>
          </ModalSurface>
        )}

        {/* MODAL: OVERRIDE BLOCKER */}
        {showOverrideModal && (
          <ModalSurface className="modal-backdrop">
            <div className="modal-card" style={{ maxWidth: '500px', width: '100%' }}>
              <h3 style={{ color: 'var(--status-danger)' }}>Override Policy Blocker</h3>
              <p
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.25rem',
                }}
              >
                Please provide an auditable justification explaining why this hard policy
                restriction is being waived.
              </p>
              <Textarea
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
                className="layout-group"
              >
                <Button
                  className="button button-secondary"
                  onClick={() => setShowOverrideModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="button button-primary"
                  onClick={handleOverrideBlocker}
                  disabled={actionLoading || overrideReason.trim().length < 5}
                >
                  Confirm Override
                </Button>
              </div>
            </div>
          </ModalSurface>
        )}
      </section>
    </div>
  );
}
