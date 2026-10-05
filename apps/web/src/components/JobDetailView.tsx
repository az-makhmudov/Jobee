import { useState, useEffect } from 'react';
import { jobApi } from '../api/job-client.js';
import type { JobDto, UpdateJobRequest } from '@job-agent/shared';

interface Props {
  jobId: string;
  onBack: () => void;
  onJobUpdated?: () => void;
}

export function JobDetailView({ jobId, onBack, onJobUpdated }: Props) {
  const [job, setJob] = useState<JobDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'requirements' | 'sections' | 'provenance' | 'matching'
  >('overview');

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJob();
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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
          style={{ opacity: 0.8 }}
        >
          Match Analysis (JOB-P2-T02)
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

      {/* Tab 5: Match Analysis (Phase boundary) */}
      {activeTab === 'matching' && (
        <div className="card placeholder-view">
          <h3>Phase Boundary: JOB-P2-T02</h3>
          <p
            style={{
              color: 'var(--text-secondary)',
              marginTop: '0.5rem',
              maxWidth: '600px',
              margin: '0.5rem auto 0',
            }}
          >
            Detailed requirement analysis, semantic keyword matching, candidate profile
            compatibility scoring, and deterministic policy authorization decisions are scheduled
            for <strong>JOB-P2-T02</strong>.
          </p>
          <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--accent)' }}>
            Core Invariant Enforced: AI evaluates and prepares. Rules authorize. Humans handle
            uncertainty.
          </div>
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
