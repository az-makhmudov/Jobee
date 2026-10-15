import { useState, useEffect } from 'react';
import { jobApi } from '../api/job-client.js';
import { applicationPackageClient } from '../api/application-package-client.js';
import { ApplicationCrmClient } from '../api/application-crm-client.js';
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

  // Application preparation state
  const [preparingApp, setPreparingApp] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  const handlePrepareApplication = async () => {
    if (!job || preparingApp) return;
    setPreparingApp(true);
    setPrepareError(null);
    try {
      const res = await applicationPackageClient.createPackage(job.id);
      onPrepareApplication?.(res.package.id);
    } catch (err) {
      setPrepareError(
        err instanceof Error ? err.message : 'Failed to prepare Application Studio package.',
      );
    } finally {
      setPreparingApp(false);
    }
  };

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
    } catch {
      // 404 is normal if unanalyzed
      setAnalysis(null);
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
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading job details...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="card" style={{ borderColor: 'var(--danger)' }}>
        <h3 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>Failed to Load Job</h3>
        <p>{error || 'Job not found'}</p>
        <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginTop: '1rem' }}>
          ← Back to Inbox
        </button>
      </div>
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
        <button className="btn btn-secondary btn-sm" onClick={onBack}>
          ← Back to Job Inbox
        </button>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {crmApp ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onViewApplicationInCrm?.(crmApp.id)}
              style={{ fontWeight: 600, borderColor: 'var(--color-primary)' }}
            >
              📋 View in CRM ({crmApp.status}) →
            </button>
          ) : (
            job.state !== 'ARCHIVED' && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleTrackInCrm}
                title="Track this job in Application CRM pipeline"
              >
                + Track in CRM
              </button>
            )
          )}
          {job.state !== 'ARCHIVED' && onPrepareApplication && (
            <button
              className="btn btn-primary btn-sm"
              onClick={handlePrepareApplication}
              disabled={preparingApp}
              title="Prepare or open Application Studio package with tailored CV & Cover Letter"
            >
              {preparingApp ? '⏳ Generating Tailored Documents...' : '🚀 Prepare Studio Package'}
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsEditing(true)}
            disabled={job.state === 'ARCHIVED'}
          >
            ✏️ Correct Fields
          </button>
          {job.state !== 'ARCHIVED' && (
            <button className="btn btn-danger btn-sm" onClick={() => setShowArchiveModal(true)}>
              📁 Archive
            </button>
          )}
        </div>
      </div>

      {/* Prepare Application Error Banner */}
      {prepareError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            borderRadius: '0.5rem',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                Application Package Preparation Error
              </div>
              <div style={{ fontSize: '0.85rem', color: '#fca5a5', marginTop: '0.15rem' }}>
                {prepareError}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handlePrepareApplication}
              disabled={preparingApp}
            >
              🔄 Retry
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setPrepareError(null)}>
              ✕ Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Job Header Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
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
                marginBottom: '0.5rem',
                flexWrap: 'wrap',
              }}
            >
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{job.title}</h1>
              <span
                className={`status-badge ${job.state === 'INGESTED' ? 'ok' : job.state === 'ARCHIVED' ? 'disconnected' : 'degraded'}`}
              >
                {job.state}
              </span>
              {job.hasManualEdits && (
                <span
                  className="nav-tag"
                  style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd' }}
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

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <span className="nav-tag">Provider: {job.provider}</span>
              <span className="nav-tag">Workplace: {job.workplaceType}</span>
              <span className="nav-tag">Type: {job.employmentType}</span>
              <span className="nav-tag">Seniority: {job.seniority}</span>
              {(job.minSalary || job.maxSalary) && (
                <span className="nav-tag" style={{ color: '#34d399' }}>
                  💰 {job.currency || '$'}
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
                🔗 Original Posting ↗
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--surface-border)',
          marginBottom: '1.5rem',
          gap: '0.5rem',
        }}
      >
        <button
          className={`btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('overview')}
        >
          Description & Overview
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'requirements' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('requirements')}
        >
          Requirements ({job.requirements?.length || 0})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'sections' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('sections')}
        >
          Structured Sections ({job.sections?.length || 0})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'provenance' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('provenance')}
        >
          Provenance & Audit Log
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'matching' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('matching')}
        >
          Match Analysis {analysis ? `(${analysis.overallScore}% ${analysis.decision})` : ''}
        </button>
      </div>

      {/* Tab 1: Overview & Description */}
      {activeTab === 'overview' && (
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 className="card-title">Job Description</h3>
            {job.descriptionHtml ? (
              <div
                style={{
                  color: 'var(--text-primary)',
                  lineHeight: '1.7',
                  fontSize: '0.95rem',
                }}
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
          </div>
        </div>
      )}

      {/* Tab 2: Requirements */}
      {activeTab === 'requirements' && (
        <div className="card">
          <h3 className="card-title">Extracted Requirements ({job.requirements?.length || 0})</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Structured requirements parsed from source bullets and lists. Fact extraction is
            strictly conservative.
          </p>
          {!job.requirements || job.requirements.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>
              No discrete bullet requirements extracted.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {job.requirements.map((req, i) => (
                <div
                  key={req.id || i}
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '0.375rem',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '1rem',
                  }}
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
                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                    <span className="nav-tag" style={{ fontSize: '0.7rem' }}>
                      {req.category}
                    </span>
                    <span
                      className="nav-tag"
                      style={{
                        fontSize: '0.7rem',
                        backgroundColor:
                          req.requirementStrength === 'MANDATORY'
                            ? 'rgba(239, 68, 68, 0.2)'
                            : req.requirementStrength === 'PREFERRED'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      {req.requirementStrength}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Structured Sections */}
      {activeTab === 'sections' && (
        <div className="card">
          <h3 className="card-title">Structured Sections ({job.sections?.length || 0})</h3>
          {!job.sections || job.sections.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>
              No separate structured sections detected.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {job.sections.map((sec, i) => (
                <div
                  key={sec.id || i}
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '0.375rem',
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
        </div>
      )}

      {/* Tab 4: Provenance & Audit Log */}
      {activeTab === 'provenance' && (
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
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
                      backgroundColor: 'rgba(15, 23, 42, 0.4)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '0.375rem',
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
          </div>

          <div className="card">
            <h3 className="card-title">Job Audit Events Timeline</h3>
            {!job.events || job.events.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No audit events logged.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{evt.eventType}</span>
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
          </div>
        </div>
      )}

      {/* Tab 5: Match Analysis (JOB-P2-T02) */}
      {activeTab === 'matching' && (
        <div>
          {loadingAnalysis ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--text-secondary)' }}>Loading match analysis...</p>
            </div>
          ) : !analysis ? (
            <div className="card" style={{ textAlign: 'center', padding: '3.5rem' }}>
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
                Evaluate this position against the Candidate Brain using deterministic policy rules,
                grounded evidence mapping, and dimensional scoring.
              </p>
              {analysisError && (
                <div style={{ color: '#f87171', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  {analysisError}
                </div>
              )}
              <button
                className="btn btn-primary"
                onClick={() => handleRunAnalysis(false)}
                disabled={analyzing}
              >
                {analyzing ? '⏳ Analyzing Role...' : '⚡ Run Match Analysis Now'}
              </button>
            </div>
          ) : (
            <div>
              {/* Staleness Banner */}
              {analysis.isStale && (
                <div
                  className="card"
                  style={{
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    borderColor: '#fbbf24',
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
                    <span style={{ fontWeight: 600, color: '#fbbf24' }}>⚠️ Analysis Stale: </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      The candidate profile, preferences, or job posting have been modified since
                      this analysis was generated.
                    </span>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleRunAnalysis(true)}
                    disabled={analyzing}
                    style={{ borderColor: '#fbbf24', color: '#fbbf24' }}
                  >
                    {analyzing ? '⏳ Re-analyzing...' : '🔄 Re-analyze Now'}
                  </button>
                </div>
              )}

              {/* Hard Blockers Banner */}
              {analysis.hardBlockers.length > 0 && (
                <div
                  className="card"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'var(--danger)',
                    marginBottom: '1.25rem',
                    padding: '1rem 1.25rem',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: '#f87171',
                      marginBottom: '0.5rem',
                      fontSize: '0.95rem',
                    }}
                  >
                    🛑 Hard Policy Blockers Detected (Automatic SKIP Decision)
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '1.25rem',
                      color: '#fca5a5',
                      fontSize: '0.85rem',
                    }}
                  >
                    {analysis.hardBlockers.map((blocker, idx) => (
                      <li key={idx} style={{ marginBottom: '0.25rem' }}>
                        {blocker}
                      </li>
                    ))}
                  </ul>
                </div>
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
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#60a5fa' }}>
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
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleRunAnalysis(true)}
                      disabled={analyzing}
                      style={{ width: '100%', fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    >
                      {analyzing ? '⏳ Analyzing...' : '🔄 Re-run Analysis'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 className="card-title">Executive Summary</h3>
                <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', fontSize: '0.95rem' }}>
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
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Strengths, Gaps, Unknowns & Warnings Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                {/* Strengths */}
                <div
                  className="card"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    marginBottom: 0,
                  }}
                >
                  <h4
                    style={{
                      color: '#34d399',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      marginBottom: '0.6rem',
                    }}
                  >
                    ✅ Strengths ({analysis.strengths.length})
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
                </div>

                {/* Gaps */}
                <div
                  className="card"
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.05)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    marginBottom: 0,
                  }}
                >
                  <h4
                    style={{
                      color: '#fbbf24',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      marginBottom: '0.6rem',
                    }}
                  >
                    ⚠️ Gaps ({analysis.gaps.length})
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
                </div>

                {/* Unknowns */}
                <div
                  className="card"
                  style={{
                    backgroundColor: 'rgba(139, 92, 246, 0.05)',
                    border: '1px solid rgba(139, 92, 246, 0.25)',
                    marginBottom: 0,
                  }}
                >
                  <h4
                    style={{
                      color: '#a78bfa',
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
                </div>

                {/* Warnings */}
                {analysis.warnings.length > 0 && (
                  <div
                    className="card"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.05)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      marginBottom: 0,
                    }}
                  >
                    <h4
                      style={{
                        color: '#f87171',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        marginBottom: '0.6rem',
                      }}
                    >
                      ⚠️ Warnings ({analysis.warnings.length})
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
                  </div>
                )}
              </div>

              {/* Dimensions Breakdown */}
              <div className="card" style={{ marginBottom: '1.5rem' }}>
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
                >
                  {analysis.dimensions?.map((dim) => {
                    const isKnown = dim.status === 'SCORED';
                    const scoreVal = dim.score ?? 0;
                    const dimColor = !isKnown
                      ? 'var(--text-secondary)'
                      : scoreVal >= 70
                        ? '#34d399'
                        : scoreVal >= 45
                          ? '#fbbf24'
                          : '#f87171';

                    return (
                      <div
                        key={dim.id}
                        style={{
                          backgroundColor: 'rgba(15, 23, 42, 0.4)',
                          border: '1px solid var(--surface-border)',
                          borderRadius: '6px',
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
                                ? 'rgba(59, 130, 246, 0.2)'
                                : 'rgba(255, 255, 255, 0.05)',
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
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
              </div>

              {/* Grounded Requirement Evaluations Table */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                    style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}
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
                            backgroundColor: 'rgba(15, 23, 42, 0.4)',
                          }}
                        >
                          <th style={{ padding: '0.75rem 1rem', width: '32%' }}>Job Requirement</th>
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
                                  ? 'rgba(239, 68, 68, 0.05)'
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
                                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
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
                                            ? 'rgba(239, 68, 68, 0.2)'
                                            : 'rgba(255, 255, 255, 0.05)',
                                        color:
                                          ev.requirement.requirementStrength === 'MANDATORY'
                                            ? '#fca5a5'
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
                                        backgroundColor: 'rgba(239, 68, 68, 0.3)',
                                        color: '#f87171',
                                      }}
                                    >
                                      🛑 Blocker
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
                                  >
                                    {ev.evidenceItems.map((item, i) => (
                                      <div
                                        key={i}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.35rem',
                                          fontSize: '0.75rem',
                                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                          border: '1px solid rgba(59, 130, 246, 0.25)',
                                          borderRadius: '4px',
                                          padding: '0.2rem 0.45rem',
                                          color: '#93c5fd',
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
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && (
        <div className="modal-backdrop" onClick={() => setIsEditing(false)}>
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
              <div style={{ color: '#f87171', marginBottom: '1rem', fontSize: '0.875rem' }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit}>
              <div className="form-grid" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Position Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.title || ''}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input
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
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.city || ''}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <input
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
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.department || ''}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Workplace Type</label>
                  <select
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
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '1.5rem',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsEditing(false)}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="modal-backdrop" onClick={() => setShowArchiveModal(false)}>
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px' }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Archive Job
            </h2>
            <p
              style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}
            >
              Archiving removes this job from active matching. You can provide an optional archive
              reason for your records.
            </p>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Archive Reason (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Position closed, not interested, salary mismatch"
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowArchiveModal(false)}
                disabled={archiving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleArchive}
                disabled={archiving}
              >
                {archiving ? 'Archiving...' : 'Archive Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
