import { useFeedback } from '../ui/Feedback.js';
import { Tabs, Button, Card, Icon, Input, ModalSurface, Select } from '../ui/Primitives.js';
import { useState, useEffect } from 'react';
import { jobApi } from '../api/job-client.js';
import { ApplyWithJobee } from './ApplyWithJobee.js';
import { ApplicationCrmClient } from '../api/application-crm-client.js';
import { CareerFitBadge } from './CareerFitBadge.js';
import { JobFeedbackBar } from './JobFeedbackBar.js';
import type {
  JobDto,
  UpdateJobRequest,
  JobMatchAnalysisDto,
  ApplicationSummaryDto,
} from '@job-agent/shared';

interface Props {
  jobId: string;
  onBack: () => void;
  onJobUpdated?: () => void;
  onPrepareApplication?: (packageId: string) => void;
  onViewApplicationInCrm?: (applicationId: string) => void;
}

export function JobDetailView({
  jobId,
  onBack,
  onJobUpdated,
  onPrepareApplication,
  onViewApplicationInCrm,
}: Props) {
  const { alert } = useFeedback();
  const [job, setJob] = useState<JobDto | null>(null);
  const [crmApp, setCrmApp] = useState<ApplicationSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'requirements' | 'sections' | 'provenance' | 'matching'
  >('overview');

  // Match Analysis state
  const [analysis, setAnalysis] = useState<JobMatchAnalysisDto | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<UpdateJobRequest>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Archive modal state
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiving, setArchiving] = useState(false);

  const loadJob = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await jobApi.getJobById(jobId);
      setJob(data);
      setEditForm({
        title: data.title,
        company: data.company,
        companyUrl: data.companyUrl || undefined,
        locationText: data.locationText || undefined,
        city: data.city || undefined,
        region: data.region || undefined,
        country: data.country || undefined,
        workplaceType: data.workplaceType,
        employmentType: data.employmentType,
        seniority: data.seniority,
        department: data.department || undefined,
        minSalary: data.minSalary || undefined,
        maxSalary: data.maxSalary || undefined,
        currency: data.currency || undefined,
      });

      try {
        const appData = await ApplicationCrmClient.getApplicationForJob(jobId);
        setCrmApp(appData);
      } catch {
        setCrmApp(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const handleTrackInCrm = async () => {
    if (!job) return;
    try {
      const res = await ApplicationCrmClient.createApplication({ jobId: job.id });
      setCrmApp(res.application);
      onViewApplicationInCrm?.(res.application.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to track in CRM');
    }
  };

  const loadAnalysis = async () => {
    setLoadingAnalysis(true);
    setAnalysisError(null);
    try {
      const data = await jobApi.getJobAnalysis(jobId);
      setAnalysis(data);
    } catch (err) {
      setAnalysis(null);
      const message = err instanceof Error ? err.message : 'Match information could not be loaded';
      if (!message.startsWith('No match analysis found')) setAnalysisError(message);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleRunAnalysis = async (force = false) => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const data = await jobApi.analyzeJob(jobId, force);
      setAnalysis(data);
      onJobUpdated?.();
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    loadJob();
    loadAnalysis();
  }, [jobId]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await jobApi.updateJob(job.id, editForm);
      setJob(updated);
      setIsEditing(false);
      onJobUpdated?.();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update job');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleArchive = async () => {
    if (!job) return;
    setArchiving(true);
    try {
      const updated = await jobApi.archiveJob(job.id, archiveReason || undefined);
      setJob(updated);
      setShowArchiveModal(false);
      onJobUpdated?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to archive job');
    } finally {
      setArchiving(false);
    }
  };

  if (loading) {
    return (
      <Card className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading job details...</p>
      </Card>
    );
  }

  if (error || !job) {
    return (
      <Card className="card" style={{ borderColor: 'var(--danger)' }}>
        <h3 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>Failed to Load Job</h3>
        <p>{error || 'Job not found'}</p>
        <Button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginTop: '1rem' }}>
          ← Back to results
        </Button>
      </Card>
    );
  }

  return (
    <div>
      {/* Top Navigation / Breadcrumb */}
      <div
        style={{
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Button className="btn btn-secondary btn-sm" onClick={onBack}>
          ← Back to results
        </Button>
        <div
          style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          className="layout-group"
        >
          {crmApp ? (
            <Button
              className="btn btn-secondary btn-sm"
              onClick={() => onViewApplicationInCrm?.(crmApp.id)}
              style={{ fontWeight: 600, borderColor: 'var(--color-primary)' }}
            >
              <Icon name="list" /> View application ({crmApp.status}) →
            </Button>
          ) : (
            job.state !== 'ARCHIVED' && (
              <Button
                className="btn btn-secondary btn-sm"
                onClick={handleTrackInCrm}
                title="Track this job in Applications"
              >
                Track application
              </Button>
            )
          )}

          <Button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsEditing(true)}
            disabled={job.state === 'ARCHIVED'}
          >
            <Icon name="edit" /> Correct Fields
          </Button>
          {job.state !== 'ARCHIVED' && (
            <Button className="btn btn-danger btn-sm" onClick={() => setShowArchiveModal(true)}>
              <Icon name="folder" /> Archive
            </Button>
          )}
        </div>
      </div>

      {job.state !== 'ARCHIVED' && (
        <ApplyWithJobee
          key={job.id}
          jobId={job.id}
          onOpenPackage={onPrepareApplication}
          onOpenApplication={onViewApplicationInCrm}
          employerUrl={job.applicationUrl || job.originalUrl}
          existingOnly={Boolean(
            crmApp &&
            (crmApp.appliedAt || !['READY_TO_APPLY', 'NEEDS_REVIEW'].includes(crmApp.status)),
          )}
        />
      )}

      {/* Job Header Card */}
      <Card className="card" style={{ marginBottom: '1.5rem' }}>
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
                marginBottom: '0.5rem',
                flexWrap: 'wrap',
              }}
              className="layout-group"
            >
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{job.title}</h2>
              <span
                className={`status-badge ${job.state === 'INGESTED' ? 'ok' : job.state === 'ARCHIVED' ? 'disconnected' : 'degraded'}`}
              >
                {job.state}
              </span>
              {job.hasManualEdits && (
                <span
                  className="nav-tag"
                  style={{
                    backgroundColor: 'var(--m3-secondary-container)',
                    color: 'var(--m3-on-surface)',
                  }}
                >
                  Manual Corrections
                </span>
              )}
            </div>

            <div
              style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}
            >
              <strong>{job.company}</strong>
              {job.locationText && <span> • {job.locationText}</span>}
              {job.department && <span> • {job.department}</span>}
            </div>

            <div
              style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}
              className="layout-group"
            >
              <span className="nav-tag">Provider: {job.provider}</span>
              <span className="nav-tag">Workplace: {job.workplaceType}</span>
              <span className="nav-tag">Type: {job.employmentType}</span>
              <span className="nav-tag">Seniority: {job.seniority}</span>
              {(job.minSalary || job.maxSalary) && (
                <span className="nav-tag" style={{ color: 'var(--status-success)' }}>
                  <Icon name="info" size={20} /> {job.currency || 'Currency unspecified '}
                  {job.minSalary?.toLocaleString()}
                  {job.maxSalary && ` – ${job.maxSalary?.toLocaleString()}`}
                  {job.payPeriod ? ` / ${job.payPeriod.toLowerCase()}` : ''}
                </span>
              )}
            </div>
          </div>

          {job.canonicalUrl && (
            <div>
              <a
                href={job.canonicalUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Icon name="link" /> Original Posting ↗
              </a>
            </div>
          )}
        </div>

        {/* Career Intelligence Feedback Bar */}
        <div
          style={{
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--surface-border)',
          }}
        >
          <JobFeedbackBar jobId={job.id} />
        </div>
      </Card>

      <Card className="job-fit-overview" style={{ marginBottom: 24 }}>
        <h3>Your fit</h3>
        {loadingAnalysis ? (
          <p>Loading match information…</p>
        ) : analysis?.isStale ? (
          <p>
            Your profile or this posting changed. Refresh the analysis before relying on this
            result.
          </p>
        ) : analysis ? (
          <>
            <p>{analysis.summaryExplanation}</p>
            {!!analysis.hardBlockers.length && (
              <p>
                <strong>Blocked:</strong> {analysis.hardBlockers[0]}
              </p>
            )}
            {!!analysis.unknowns.length && (
              <p>
                <strong>Unconfirmed:</strong> {analysis.unknowns[0]}
              </p>
            )}
          </>
        ) : (
          !analysisError && <p>Check how this role fits your verified information.</p>
        )}
        {analysisError && <p role="alert">{analysisError}</p>}
        <Button
          className="btn btn-secondary btn-sm"
          disabled={analyzing || loadingAnalysis}
          onClick={() => handleRunAnalysis(true)}
        >
          {analyzing ? 'Checking fit…' : analysis ? 'Refresh your fit' : 'Check your fit'}
        </Button>
      </Card>

      <Tabs
        panelId="job-details-panel"
        label="Job details"
        value={activeTab}
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'requirements', label: `Requirements (${job.requirements?.length || 0})` },
          { id: 'sections', label: `Sections (${job.sections?.length || 0})` },
          { id: 'provenance', label: 'Sources & history' },
          {
            id: 'matching',
            label: `Match analysis ${analysis ? `(${analysis.overallScore}% ${analysis.decision})` : ''}`,
          },
        ]}
        onChange={(id) => setActiveTab(id as typeof activeTab)}
      />

      <section id="job-details-panel" role="tabpanel" aria-label={activeTab}>
        {/* Tab 1: Overview & Description */}
        {activeTab === 'overview' && (
          <div>
            <Card className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 className="card-title">Job Description</h3>
              {job.descriptionHtml ? (
                <div
                  style={{
                    color: 'var(--text-primary)',
                    lineHeight: '1.7',
                    fontSize: '0.95rem',
                  }}
                  className="job-description"
                  dangerouslySetInnerHTML={{ __html: job.descriptionHtml }}
                />
              ) : (
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    color: 'var(--text-primary)',
                    lineHeight: '1.6',
                    fontSize: '0.95rem',
                  }}
                >
                  {job.description}
                </pre>
              )}
            </Card>
          </div>
        )}

        {/* Tab 2: Requirements */}
        {activeTab === 'requirements' && (
          <Card className="card">
            <h3 className="card-title">Extracted Requirements ({job.requirements?.length || 0})</h3>
            <p
              style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}
            >
              Structured requirements parsed from source bullets and lists. Fact extraction is
              strictly conservative.
            </p>
            {!job.requirements || job.requirements.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>
                No discrete bullet requirements extracted.
              </p>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                className="layout-group"
              >
                {job.requirements.map((req, i) => (
                  <div
                    key={req.id || i}
                    style={{
                      backgroundColor: 'var(--m3-surface-container-low)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '16px',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1rem',
                    }}
                    className="layout-group"
                  >
                    <div style={{ flex: 1, fontSize: '0.9rem' }}>
                      <div>{req.rawText}</div>
                      {req.sourceSection && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            marginTop: '0.25rem',
                          }}
                        >
                          Section: {req.sourceSection}
                        </div>
                      )}
                    </div>
                    <div
                      style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}
                      className="layout-group"
                    >
                      <span className="nav-tag" style={{ fontSize: '0.7rem' }}>
                        {req.category}
                      </span>
                      <span
                        className="nav-tag"
                        style={{
                          fontSize: '0.7rem',
                          backgroundColor:
                            req.requirementStrength === 'MANDATORY'
                              ? 'var(--status-danger-container)'
                              : req.requirementStrength === 'PREFERRED'
                                ? 'var(--status-success-container)'
                                : 'var(--m3-surface)',
                        }}
                      >
                        {req.requirementStrength}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Tab 3: Structured Sections */}
        {activeTab === 'sections' && (
          <Card className="card">
            <h3 className="card-title">Structured Sections ({job.sections?.length || 0})</h3>
            {!job.sections || job.sections.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>
                No separate structured sections detected.
              </p>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                className="layout-group"
              >
                {job.sections.map((sec, i) => (
                  <div
                    key={sec.id || i}
                    style={{
                      backgroundColor: 'var(--m3-surface-container-low)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '16px',
                      padding: '1rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>{sec.title}</h4>
                      <span className="nav-tag">{sec.sectionType}</span>
                    </div>
                    <pre
                      style={{
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'inherit',
                        color: 'var(--text-secondary)',
                        fontSize: '0.875rem',
                        lineHeight: '1.5',
                      }}
                    >
                      {sec.content}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Tab 4: Provenance & Audit Log */}
        {activeTab === 'provenance' && (
          <div>
            <Card className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 className="card-title">Ingestion Provenance</h3>
              <div className="status-grid">
                <div className="status-item">
                  <div className="status-item-label">Source Provider</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600 }}>{job.provider}</div>
                  {job.sourceExternalId && (
                    <div className="status-item-meta">External ID: {job.sourceExternalId}</div>
                  )}
                </div>
                <div className="status-item">
                  <div className="status-item-label">Content Fingerprint (SHA-256)</div>
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      color: 'var(--accent)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {job.contentHash}
                  </div>
                  <div className="status-item-meta">Deterministic duplicate detection</div>
                </div>
                <div className="status-item">
                  <div className="status-item-label">First Discovered</div>
                  <div style={{ fontSize: '0.9rem' }}>
                    {new Date(job.discoveredDate).toLocaleString()}
                  </div>
                </div>
                <div className="status-item">
                  <div className="status-item-label">Source Records</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                    {job.sources?.length || 1} capture(s)
                  </div>
                </div>
              </div>

              {job.sources && job.sources.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                    Raw Source Ingestions
                  </h4>
                  {job.sources.map((src) => (
                    <div
                      key={src.id}
                      style={{
                        backgroundColor: 'var(--m3-surface-container-low)',
                        border: '1px solid var(--surface-border)',
                        borderRadius: '16px',
                        padding: '0.75rem 1rem',
                        marginBottom: '0.5rem',
                        fontSize: '0.85rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '0.25rem',
                        }}
                      >
                        <span>
                          <strong>{src.ingestionMethod}</strong> via {src.provider}
                        </span>
                        <span className="status-item-meta">
                          {new Date(src.retrievedAt).toLocaleString()}
                        </span>
                      </div>
                      {src.sourceUrl && (
                        <div style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                          URL: {src.sourceUrl}
                        </div>
                      )}
                      <div className="status-item-meta" style={{ marginTop: '0.25rem' }}>
                        Status: {src.ingestionStatus} (Parser v{src.parserVersion})
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="card">
              <h3 className="card-title">Job Audit Events Timeline</h3>
              {!job.events || job.events.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>No audit events logged.</p>
              ) : (
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                  className="layout-group"
                >
                  {job.events.map((evt) => (
                    <div
                      key={evt.id}
                      style={{
                        borderLeft: '3px solid var(--accent)',
                        paddingLeft: '0.75rem',
                        paddingTop: '0.25rem',
                        paddingBottom: '0.25rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {evt.eventType}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {new Date(evt.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {evt.changedFields && evt.changedFields.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Changed fields: {evt.changedFields.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Tab 5: Match Analysis (JOB-P2-T02) */}
        {activeTab === 'matching' && (
          <div>
            {loadingAnalysis ? (
              <Card className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Loading match analysis...</p>
              </Card>
            ) : !analysis ? (
              <Card className="card" style={{ textAlign: 'center', padding: '3.5rem' }}>
                <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>
                  No Match Analysis Generated Yet
                </h3>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    maxWidth: '540px',
                    margin: '0 auto 1.5rem',
                    fontSize: '0.9rem',
                  }}
                >
                  Evaluate this position against the Candidate Brain using deterministic policy
                  rules, grounded evidence mapping, and dimensional scoring.
                </p>
                {analysisError && (
                  <div
                    style={{
                      color: 'var(--status-danger)',
                      marginBottom: '1rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    {analysisError}
                  </div>
                )}
                <Button
                  className="btn btn-primary"
                  onClick={() => handleRunAnalysis(false)}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <>
                      <Icon name="schedule" size={20} /> Analyzing Role...
                    </>
                  ) : (
                    <>
                      <Icon name="ai" size={20} /> Run Match Analysis Now
                    </>
                  )}
                </Button>
              </Card>
            ) : (
              <div>
                {/* Staleness Banner */}
                {analysis.isStale && (
                  <Card
                    className="card"
                    style={{
                      backgroundColor: 'var(--status-warning-container)',
                      borderColor: 'var(--status-warning-border)',
                      marginBottom: '1.25rem',
                      padding: '0.85rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--status-warning)' }}>
                        <Icon name="warning" /> Analysis Stale:{' '}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        The candidate profile, preferences, or job posting have been modified since
                        this analysis was generated.
                      </span>
                    </div>
                    <Button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleRunAnalysis(true)}
                      disabled={analyzing}
                      style={{
                        borderColor: 'var(--status-danger-border)',
                        color: 'var(--status-danger)',
                      }}
                    >
                      {analyzing ? (
                        <>
                          <Icon name="schedule" size={20} /> Re-analyzing...
                        </>
                      ) : (
                        <>
                          <Icon name="sync" size={20} /> Re-analyze Now
                        </>
                      )}
                    </Button>
                  </Card>
                )}

                {/* Hard Blockers Banner */}
                {analysis.hardBlockers.length > 0 && (
                  <Card
                    className="card"
                    style={{
                      backgroundColor: 'var(--status-warning-container)',
                      borderColor: 'var(--danger)',
                      marginBottom: '1.25rem',
                      padding: '1rem 1.25rem',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: 'var(--status-warning)',
                        marginBottom: '0.5rem',
                        fontSize: '0.95rem',
                      }}
                    >
                      <Icon name="cancel" size={20} /> Hard Policy Blockers Detected (Automatic SKIP
                      Decision)
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: '1.25rem',
                        color: 'var(--status-danger)',
                        fontSize: '0.85rem',
                      }}
                    >
                      {analysis.hardBlockers.map((blocker, idx) => (
                        <li key={idx} style={{ marginBottom: '0.25rem' }}>
                          {blocker}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* KPI Header Grid */}
                <div
                  className="status-grid"
                  style={{
                    marginBottom: '1.5rem',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  }}
                >
                  <div className="status-item">
                    <div className="status-item-label">Decision</div>
                    <div style={{ marginTop: '0.35rem' }}>
                      <span
                        className={`status-badge ${
                          analysis.decision === 'MATCH'
                            ? 'ok'
                            : analysis.decision === 'REVIEW'
                              ? 'degraded'
                              : 'disconnected'
                        }`}
                        style={{ fontSize: '1rem', padding: '0.35rem 0.75rem' }}
                      >
                        {analysis.decision}
                      </span>
                    </div>
                    <div className="status-item-meta" style={{ marginTop: '0.5rem' }}>
                      {analysis.decision === 'MATCH'
                        ? 'Meets all core criteria'
                        : analysis.decision === 'REVIEW'
                          ? 'Requires human judgment'
                          : 'Blocked by policy or gaps'}
                    </div>
                  </div>

                  <div className="status-item">
                    <div className="status-item-label">Career Fit</div>
                    <div style={{ marginTop: '0.45rem' }}>
                      <CareerFitBadge category={analysis.careerFitCategory} />
                    </div>
                    <div className="status-item-meta" style={{ marginTop: '0.5rem' }}>
                      Career Intelligence 2.0
                    </div>
                  </div>

                  <div className="status-item">
                    <div className="status-item-label">Match Score</div>
                    <div
                      style={{
                        fontSize: '2rem',
                        fontWeight: 800,
                        color:
                          analysis.overallScore >= 70
                            ? 'var(--success)'
                            : analysis.overallScore >= 45
                              ? 'var(--warning)'
                              : 'var(--danger)',
                      }}
                    >
                      {analysis.overallScore}%
                    </div>
                    <div className="status-item-meta">Composite dimension fit</div>
                  </div>

                  <div className="status-item">
                    <div className="status-item-label">Confidence</div>
                    <div
                      style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--m3-on-surface)' }}
                    >
                      {analysis.confidenceScore}%
                    </div>
                    <div className="status-item-meta">Evidence completeness</div>
                  </div>

                  <div className="status-item">
                    <div className="status-item-label">Auto-Apply Eligibility</div>
                    <div style={{ marginTop: '0.35rem' }}>
                      <span
                        className={`status-badge ${analysis.autoApplyEligible ? 'ok' : 'disconnected'}`}
                        style={{ fontSize: '0.85rem' }}
                      >
                        {analysis.autoApplyEligible ? 'PRELIMINARY ELIGIBLE' : 'NOT ELIGIBLE'}
                      </span>
                    </div>
                    <div
                      className="status-item-meta"
                      style={{ fontSize: '0.7rem', marginTop: '0.35rem' }}
                    >
                      Rules authorize; never submitted without human confirmation.
                    </div>
                  </div>

                  <div className="status-item">
                    <div className="status-item-label">Engine & Metadata</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '0.2rem' }}>
                      {analysis.analysisMode}
                    </div>
                    <div className="status-item-meta" style={{ marginTop: '0.2rem' }}>
                      v{analysis.algorithmVersion} • SHA: {analysis.inputFingerprint.slice(0, 8)}
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                      <Button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRunAnalysis(true)}
                        disabled={analyzing}
                        style={{ width: '100%', fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      >
                        {analyzing ? (
                          <>
                            <Icon name="schedule" size={20} /> Analyzing...
                          </>
                        ) : (
                          <>
                            <Icon name="sync" size={20} /> Re-run Analysis
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Executive Summary */}
                <Card className="card" style={{ marginBottom: '1.5rem' }}>
                  <h3 className="card-title">Executive Summary</h3>
                  <p
                    style={{ color: 'var(--text-primary)', lineHeight: '1.6', fontSize: '0.95rem' }}
                  >
                    {analysis.summaryExplanation}
                  </p>
                  {analysis.reasonCodes.length > 0 && (
                    <div
                      style={{
                        marginTop: '0.85rem',
                        display: 'flex',
                        gap: '0.4rem',
                        flexWrap: 'wrap',
                      }}
                      className="layout-group"
                    >
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          alignSelf: 'center',
                        }}
                      >
                        Reason Codes:
                      </span>
                      {analysis.reasonCodes.map((code, idx) => (
                        <span
                          key={idx}
                          className="nav-tag"
                          style={{
                            fontSize: '0.75rem',
                            backgroundColor: 'var(--m3-surface)',
                          }}
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Strengths, Gaps, Unknowns & Warnings Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                  }}
                  className="layout-group"
                >
                  {/* Strengths */}
                  <Card
                    className="card"
                    style={{
                      backgroundColor: 'var(--status-success-container)',
                      border: '1px solid var(--status-success-border)',
                      marginBottom: 0,
                    }}
                  >
                    <h4
                      style={{
                        color: 'var(--status-success)',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        marginBottom: '0.6rem',
                      }}
                    >
                      <Icon name="check" /> Strengths ({analysis.strengths.length})
                    </h4>
                    {analysis.strengths.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        No key strengths highlighted.
                      </p>
                    ) : (
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: '1.1rem',
                          fontSize: '0.85rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {analysis.strengths.map((str, idx) => (
                          <li key={idx} style={{ marginBottom: '0.35rem' }}>
                            {str}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>

                  {/* Gaps */}
                  <Card
                    className="card"
                    style={{
                      backgroundColor: 'var(--status-danger-container)',
                      border: '1px solid var(--status-warning-border)',
                      marginBottom: 0,
                    }}
                  >
                    <h4
                      style={{
                        color: 'var(--status-danger)',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        marginBottom: '0.6rem',
                      }}
                    >
                      <Icon name="warning" /> Gaps ({analysis.gaps.length})
                    </h4>
                    {analysis.gaps.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        No significant gaps identified.
                      </p>
                    ) : (
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: '1.1rem',
                          fontSize: '0.85rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {analysis.gaps.map((gap, idx) => (
                          <li key={idx} style={{ marginBottom: '0.35rem' }}>
                            {gap}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>

                  {/* Unknowns */}
                  <Card
                    className="card"
                    style={{
                      backgroundColor: 'var(--m3-secondary-container)',
                      border: '1px solid var(--m3-outline-variant)',
                      marginBottom: 0,
                    }}
                  >
                    <h4
                      style={{
                        color: 'var(--m3-on-surface)',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        marginBottom: '0.6rem',
                      }}
                    >
                      ❓ Unknowns ({analysis.unknowns.length})
                    </h4>
                    {analysis.unknowns.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        All critical criteria known.
                      </p>
                    ) : (
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: '1.1rem',
                          fontSize: '0.85rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {analysis.unknowns.map((unk, idx) => (
                          <li key={idx} style={{ marginBottom: '0.35rem' }}>
                            {unk}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>

                  {/* Warnings */}
                  {analysis.warnings.length > 0 && (
                    <Card
                      className="card"
                      style={{
                        backgroundColor: 'var(--status-danger-container)',
                        border: '1px solid var(--status-danger-border)',
                        marginBottom: 0,
                      }}
                    >
                      <h4
                        style={{
                          color: 'var(--status-danger)',
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          marginBottom: '0.6rem',
                        }}
                      >
                        <Icon name="warning" /> Warnings ({analysis.warnings.length})
                      </h4>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: '1.1rem',
                          fontSize: '0.85rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {analysis.warnings.map((warn, idx) => (
                          <li key={idx} style={{ marginBottom: '0.35rem' }}>
                            {warn}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                </div>

                {/* Dimensions Breakdown */}
                <Card className="card" style={{ marginBottom: '1.5rem' }}>
                  <h3 className="card-title">Dimension Fit Breakdown</h3>
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      marginBottom: '1.25rem',
                    }}
                  >
                    Independent dimensional evaluations normalized dynamically across available
                    categories.
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: '1rem',
                    }}
                    className="layout-group"
                  >
                    {analysis.dimensions?.map((dim) => {
                      const isKnown = dim.status === 'SCORED';
                      const scoreVal = dim.score ?? 0;
                      const dimColor = !isKnown
                        ? 'var(--text-secondary)'
                        : scoreVal >= 70
                          ? 'var(--status-success)'
                          : scoreVal >= 45
                            ? 'var(--status-warning)'
                            : 'var(--status-danger)';

                      return (
                        <div
                          key={dim.id}
                          style={{
                            backgroundColor: 'var(--m3-surface-container-low)',
                            border: '1px solid var(--surface-border)',
                            borderRadius: '16px',
                            padding: '1rem',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: '0.5rem',
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                color: 'var(--text-primary)',
                              }}
                            >
                              {dim.dimension.replace(/_/g, ' ')}
                            </span>
                            <span
                              className="nav-tag"
                              style={{
                                fontSize: '0.7rem',
                                backgroundColor: isKnown
                                  ? 'var(--m3-secondary-container)'
                                  : 'var(--m3-surface)',
                              }}
                            >
                              Weight: {dim.weight}%
                            </span>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: '0.5rem',
                              marginBottom: '0.5rem',
                            }}
                            className="layout-group"
                          >
                            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: dimColor }}>
                              {isKnown ? `${dim.score}%` : 'N/A'}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              [{dim.status}]
                            </span>
                          </div>

                          {/* Progress bar */}
                          {isKnown && (
                            <div
                              style={{
                                width: '100%',
                                height: '6px',
                                backgroundColor: 'var(--m3-surface)',
                                borderRadius: '3px',
                                overflow: 'hidden',
                                marginBottom: '0.75rem',
                              }}
                            >
                              <div
                                style={{
                                  width: `${dim.score}%`,
                                  height: '100%',
                                  backgroundColor: dimColor,
                                }}
                              />
                            </div>
                          )}

                          <div
                            style={{
                              fontSize: '0.8rem',
                              color: 'var(--text-secondary)',
                              lineHeight: '1.4',
                            }}
                          >
                            {dim.reason}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Grounded Requirement Evaluations Table */}
                <Card className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div
                    style={{
                      padding: '1rem 1.25rem',
                      borderBottom: '1px solid var(--surface-border)',
                    }}
                  >
                    <h3 className="card-title" style={{ marginBottom: '0.25rem' }}>
                      Grounded Requirement Evaluations ({analysis.evaluations?.length || 0})
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                      Every requirement mapped deterministically to verified candidate evidence.
                      Hallucinated evidence strictly forbidden.
                    </p>
                  </div>

                  {!analysis.evaluations || analysis.evaluations.length === 0 ? (
                    <div
                      style={{
                        padding: '2rem',
                        textAlign: 'center',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      No requirement evaluations recorded.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          textAlign: 'left',
                          fontSize: '0.85rem',
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              borderBottom: '1px solid var(--surface-border)',
                              color: 'var(--text-secondary)',
                              backgroundColor: 'var(--m3-surface-container-low)',
                            }}
                          >
                            <th style={{ padding: '0.75rem 1rem', width: '32%' }}>
                              Job Requirement
                            </th>
                            <th style={{ padding: '0.75rem 0.75rem', width: '12%' }}>Status</th>
                            <th style={{ padding: '0.75rem 0.75rem', width: '10%' }}>Source</th>
                            <th style={{ padding: '0.75rem 1rem', width: '24%' }}>
                              Candidate Evidence Grounding
                            </th>
                            <th style={{ padding: '0.75rem 1rem', width: '22%' }}>
                              Evaluation Justification
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.evaluations.map((ev) => {
                            const statusBg =
                              ev.status === 'MET'
                                ? 'ok'
                                : ev.status === 'PARTIAL'
                                  ? 'degraded'
                                  : ev.status === 'NOT_MET'
                                    ? 'disconnected'
                                    : 'neutral';

                            return (
                              <tr
                                key={ev.id}
                                style={{
                                  borderBottom: '1px solid var(--surface-border)',
                                  backgroundColor: ev.contributesToBlocker
                                    ? 'var(--status-danger-container)'
                                    : 'transparent',
                                }}
                              >
                                <td style={{ padding: '0.85rem 1rem' }}>
                                  <div
                                    style={{
                                      color: 'var(--text-primary)',
                                      fontWeight: 500,
                                      marginBottom: '0.25rem',
                                    }}
                                  >
                                    {ev.requirement?.normalizedText ||
                                      ev.requirement?.rawText ||
                                      'Requirement'}
                                  </div>
                                  <div
                                    style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}
                                    className="layout-group"
                                  >
                                    {ev.requirement?.category && (
                                      <span className="nav-tag" style={{ fontSize: '0.65rem' }}>
                                        {ev.requirement.category}
                                      </span>
                                    )}
                                    {ev.requirement?.requirementStrength && (
                                      <span
                                        className="nav-tag"
                                        style={{
                                          fontSize: '0.65rem',
                                          backgroundColor:
                                            ev.requirement.requirementStrength === 'MANDATORY'
                                              ? 'var(--status-danger-container)'
                                              : 'var(--m3-surface)',
                                          color:
                                            ev.requirement.requirementStrength === 'MANDATORY'
                                              ? 'var(--status-danger)'
                                              : 'inherit',
                                        }}
                                      >
                                        {ev.requirement.requirementStrength}
                                      </span>
                                    )}
                                    {ev.contributesToBlocker && (
                                      <span
                                        className="nav-tag"
                                        style={{
                                          fontSize: '0.65rem',
                                          backgroundColor: 'var(--status-danger-container)',
                                          color: 'var(--status-danger)',
                                        }}
                                      >
                                        <Icon name="cancel" size={20} /> Blocker
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td style={{ padding: '0.85rem 0.75rem' }}>
                                  <span
                                    className={`status-badge ${statusBg}`}
                                    style={{ fontSize: '0.75rem' }}
                                  >
                                    {ev.status}
                                  </span>
                                  <div
                                    style={{
                                      fontSize: '0.7rem',
                                      color: 'var(--text-secondary)',
                                      marginTop: '0.2rem',
                                    }}
                                  >
                                    {ev.confidence}% conf
                                  </div>
                                </td>

                                <td style={{ padding: '0.85rem 0.75rem' }}>
                                  <span className="nav-tag" style={{ fontSize: '0.7rem' }}>
                                    {ev.source}
                                  </span>
                                </td>

                                <td style={{ padding: '0.85rem 1rem' }}>
                                  {ev.evidenceItems && ev.evidenceItems.length > 0 ? (
                                    <div
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.35rem',
                                      }}
                                      className="layout-group"
                                    >
                                      {ev.evidenceItems.map((item, i) => (
                                        <div
                                          key={i}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            fontSize: '0.75rem',
                                            backgroundColor: 'var(--m3-secondary-container)',
                                            border: '1px solid var(--m3-outline-variant)',
                                            borderRadius: '16px',
                                            padding: '0.2rem 0.45rem',
                                            color: 'var(--m3-on-surface)',
                                          }}
                                        >
                                          <span
                                            style={{
                                              textTransform: 'uppercase',
                                              fontSize: '0.65rem',
                                              opacity: 0.8,
                                            }}
                                          >
                                            [{item.type}]
                                          </span>
                                          <span>{item.label}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span
                                      style={{
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.75rem',
                                        fontStyle: 'italic',
                                      }}
                                    >
                                      No candidate evidence linked
                                    </span>
                                  )}
                                </td>

                                <td
                                  style={{
                                    padding: '0.85rem 1rem',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.8rem',
                                    lineHeight: '1.4',
                                  }}
                                >
                                  {ev.reason}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Edit Modal */}
        {isEditing && (
          <ModalSurface className="modal-backdrop" onClick={() => setIsEditing(false)}>
            <div
              className="modal-dialog"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '640px' }}
            >
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
                Correct Normalized Fields
              </h2>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  marginBottom: '1.25rem',
                }}
              >
                Original source data remains strictly preserved in raw source tables. Corrections
                update normalized presentation fields.
              </p>

              {editError && (
                <div
                  style={{
                    color: 'var(--status-danger)',
                    marginBottom: '1rem',
                    fontSize: '0.875rem',
                  }}
                >
                  {editError}
                </div>
              )}

              <form onSubmit={handleSaveEdit}>
                <div className="form-grid" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Position Title</label>
                    <Input
                      type="text"
                      className="form-input"
                      value={editForm.title || ''}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company Name</label>
                    <Input
                      type="text"
                      className="form-input"
                      value={editForm.company || ''}
                      onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <Input
                      type="text"
                      className="form-input"
                      value={editForm.city || ''}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Country</label>
                    <Input
                      type="text"
                      className="form-input"
                      value={editForm.country || ''}
                      onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <Input
                      type="text"
                      className="form-input"
                      value={editForm.department || ''}
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Workplace Type</label>
                    <Select
                      className="form-input"
                      value={editForm.workplaceType || 'UNKNOWN'}
                      onChange={(e) =>
                        setEditForm({ ...editForm, workplaceType: e.target.value as any })
                      }
                    >
                      <option value="UNKNOWN">UNKNOWN</option>
                      <option value="REMOTE">REMOTE</option>
                      <option value="HYBRID">HYBRID</option>
                      <option value="ONSITE">ONSITE</option>
                    </Select>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                    marginTop: '1.5rem',
                  }}
                  className="layout-group"
                >
                  <Button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsEditing(false)}
                    disabled={savingEdit}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="btn btn-primary" disabled={savingEdit}>
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </div>
          </ModalSurface>
        )}

        {/* Archive Modal */}
        {showArchiveModal && (
          <ModalSurface className="modal-backdrop" onClick={() => setShowArchiveModal(false)}>
            <div
              className="modal-dialog"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '480px' }}
            >
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                Archive Job
              </h2>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                Archiving removes this job from active matching. You can provide an optional archive
                reason for your records.
              </p>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Archive Reason (Optional)</label>
                <Input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Position closed, not interested, salary mismatch"
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                />
              </div>
              <div
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}
                className="layout-group"
              >
                <Button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowArchiveModal(false)}
                  disabled={archiving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleArchive}
                  disabled={archiving}
                >
                  {archiving ? 'Archiving...' : 'Archive Job'}
                </Button>
              </div>
            </div>
          </ModalSurface>
        )}
      </section>
    </div>
  );
}
