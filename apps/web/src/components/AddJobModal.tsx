import { Icon } from '../ui/Primitives.js';
import { Button, Input, ModalSurface, Textarea } from '../ui/Primitives.js';
import { useState, useEffect } from 'react';
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
  const [incompleteImport, setIncompleteImport] = useState<JobDto | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIncompleteImport(null);
      setTab('url');
      setUrl('');
      setText('');
      setTitle('');
      setCompany('');
      setSourceNotes('');
      setError(null);
      setDuplicateNotice(null);
    }
  }, [isOpen]);
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
      setIncompleteImport(null);
      const res = await jobApi.ingestUrl({ url: url.trim() });
      if (res.job.description.trim().length < 100) {
        setIncompleteImport(res.job);
        setTab('text');
        setError(
          'This page did not expose the vacancy details. Paste the complete job description below to finish this import.',
        );
        return;
      }
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
    if (!text.trim() || text.trim().length < (incompleteImport ? 100 : 20)) {
      setError(
        incompleteImport
          ? 'Paste the complete job description with at least 100 characters.'
          : 'Please paste a job description with at least 20 characters',
      );
      return;
    }

    setLoading(true);
    setError(null);
    setDuplicateNotice(null);

    try {
      if (incompleteImport) {
        const job = await jobApi.updateJob(incompleteImport.id, {
          description: text.trim(),
          ...(title.trim() ? { title: title.trim() } : {}),
          ...(company.trim() ? { company: company.trim() } : {}),
        });
        setIncompleteImport(null);
        onJobCreated(job);
        onClose();
        return;
      }
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
    <ModalSurface className="modal-backdrop" onClick={loading ? undefined : onClose}>
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
          <Button
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            disabled={loading}
            style={{ borderRadius: '50%', width: '28px', height: '28px', padding: 0 }}
            aria-label="Close"
          >
            <Icon name="close" size={20} />
          </Button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--surface-border)',
            marginBottom: '1.25rem',
            gap: '0.5rem',
          }}
          className="layout-group"
        >
          <Button
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
          </Button>
          <Button
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
          </Button>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: 'var(--status-warning-container)',
              border: '1px solid var(--status-warning-border)',
              color: 'var(--status-warning)',
              padding: '0.75rem 1rem',
              borderRadius: '16px',
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
              backgroundColor: 'var(--status-danger-container)',
              border: '1px solid var(--status-danger-border)',
              color: 'var(--status-danger)',
              padding: '0.75rem 1rem',
              borderRadius: '16px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            <strong>Duplicate Detected:</strong> {duplicateNotice}
            <div style={{ marginTop: '0.5rem' }}>
              <Button className="btn btn-secondary btn-sm" onClick={onClose}>
                View Existing Job
              </Button>
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
              <Input
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
              className="layout-group"
            >
              <Button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Fetching & Parsing...' : 'Import Job'}
              </Button>
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
                <Input
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
                <Input
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
              <Textarea
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
              <Input
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
              className="layout-group"
            >
              <Button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Normalizing...' : 'Save Job'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </ModalSurface>
  );
}
