import { useState } from 'react';
import { jobApi } from '../api/job-client.js';
import type { JobDto } from '@job-agent/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onJobCreated: (job: JobDto) => void;
}

export function AddJobModal({ isOpen, onClose, onJobCreated }: Props) {
  const [tab, setTab] = useState<'url' | 'text'>('url');

  // URL Tab state
  const [url, setUrl] = useState('');

  // Text Tab state
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [sourceNotes, setSourceNotes] = useState('');

  // Common state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please provide a valid job posting URL');
      return;
    }

    setLoading(true);
    setError(null);
    setDuplicateNotice(null);

    try {
      const res = await jobApi.ingestUrl({ url: url.trim() });
      if (res.isDuplicate) {
        setDuplicateNotice(
          res.message || 'Job with identical URL or content already exists in Job Inbox.',
        );
      }
      onJobCreated(res.job);
      if (!res.isDuplicate) {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest job from URL');
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || text.trim().length < 20) {
      setError('Please paste a job description with at least 20 characters');
      return;
    }

    setLoading(true);
    setError(null);
    setDuplicateNotice(null);

    try {
      const res = await jobApi.ingestText({
        text: text.trim(),
        title: title.trim() || undefined,
        company: company.trim() || undefined,
        sourceNotes: sourceNotes.trim() || undefined,
      });

      if (res.isDuplicate) {
        setDuplicateNotice(
          res.message || 'Job with identical content fingerprint already exists in Job Inbox.',
        );
      }
      onJobCreated(res.job);
      if (!res.isDuplicate) {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest pasted job text');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Add Job to Inbox</h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            disabled={loading}
            style={{ borderRadius: '50%', width: '28px', height: '28px', padding: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--surface-border)',
            marginBottom: '1.25rem',
            gap: '0.5rem',
          }}
        >
          <button
            type="button"
            className={`btn btn-sm ${tab === 'url' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setTab('url');
              setError(null);
              setDuplicateNotice(null);
            }}
            disabled={loading}
          >
            Import from URL
          </button>
          <button
            type="button"
            className={`btn btn-sm ${tab === 'text' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setTab('text');
              setError(null);
              setDuplicateNotice(null);
            }}
            disabled={loading}
          >
            Paste Job Text
          </button>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              padding: '0.75rem 1rem',
              borderRadius: '0.375rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {duplicateNotice && (
          <div
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              padding: '0.75rem 1rem',
              borderRadius: '0.375rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            <strong>Duplicate Detected:</strong> {duplicateNotice}
            <div style={{ marginTop: '0.5rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={onClose}>
                View Existing Job
              </button>
            </div>
          </div>
        )}

        {/* URL Form */}
        {tab === 'url' && (
          <form onSubmit={handleUrlSubmit}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" htmlFor="job-url">
                Job Posting Public URL
              </label>
              <input
                id="job-url"
                type="url"
                className="form-input"
                placeholder="https://boards.greenhouse.io/... or https://jobs.lever.co/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                required
                autoFocus
              />
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  marginTop: '0.35rem',
                }}
              >
                Safe SSRF-protected retrieval supports Greenhouse, Lever, Ashby, Schema.org
                JobPosting, and LinkedIn link preservation.
              </p>
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
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Fetching & Parsing...' : 'Import Job'}
              </button>
            </div>
          </form>
        )}

        {/* Text Form */}
        {tab === 'text' && (
          <form onSubmit={handleTextSubmit}>
            <div className="form-grid" style={{ marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="job-title-hint">
                  Position Title (Optional Hint)
                </label>
                <input
                  id="job-title-hint"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Senior Backend Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="job-company-hint">
                  Company / Organization (Optional Hint)
                </label>
                <input
                  id="job-company-hint"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Acme Corp"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" htmlFor="job-text">
                Pasted Job Description *
              </label>
              <textarea
                id="job-text"
                className="form-textarea"
                rows={10}
                placeholder="Paste the complete job posting text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" htmlFor="job-source-notes">
                Source Notes / Context (Optional)
              </label>
              <input
                id="job-source-notes"
                type="text"
                className="form-input"
                placeholder="e.g. Sourced from recruiter email, tech meetup, or personal referral"
                value={sourceNotes}
                onChange={(e) => setSourceNotes(e.target.value)}
                disabled={loading}
              />
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
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Normalizing...' : 'Save Job'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
