import { useState, useEffect } from 'react';
import { jobApi } from '../api/job-client.js';
import { AddJobModal } from './AddJobModal.js';
import type {
  JobSummaryDto,
  JobState,
  JobProvider,
  JobDashboardMetricsDto,
} from '@job-agent/shared';

interface Props {
  onSelectJob: (jobId: string) => void;
}

export function JobInboxView({ onSelectJob }: Props) {
  const [jobs, setJobs] = useState<JobSummaryDto[]>([]);
  const [metrics, setMetrics] = useState<JobDashboardMetricsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<JobState | ''>('');
  const [providerFilter, setProviderFilter] = useState<JobProvider | ''>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, metricsRes] = await Promise.all([
        jobApi.getJobs({
          page,
          limit: 10,
          search: search.trim() || undefined,
          state: (stateFilter as JobState) || undefined,
          provider: (providerFilter as JobProvider) || undefined,
          includeArchived: stateFilter === 'ARCHIVED',
        }),
        jobApi.getMetrics(),
      ]);

      setJobs(jobsRes.items);
      setTotalPages(jobsRes.totalPages);
      setTotalItems(jobsRes.total);
      setMetrics(metricsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, stateFilter, providerFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  return (
    <div>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 className="page-title">Job Inbox</h1>
          <p className="page-subtitle">
            Central repository of ingested, parsed, and normalized job postings
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
            🔄 Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(true)}>
            ➕ Add Job
          </button>
        </div>
      </div>

      {/* Metrics Ribbon */}
      {metrics && (
        <div
          className="status-grid"
          style={{
            marginBottom: '1.5rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          }}
        >
          <div className="status-item">
            <div className="status-item-label">Total Jobs</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {metrics.totalJobs}
            </div>
            <div className="status-item-meta">Across all providers</div>
          </div>
          <div className="status-item">
            <div className="status-item-label">Ingested</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399' }}>
              {metrics.ingestedJobs}
            </div>
            <div className="status-item-meta">Ready for matching</div>
          </div>
          <div className="status-item">
            <div className="status-item-label">Needs Review</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fbbf24' }}>
              {metrics.needsReviewJobs}
            </div>
            <div className="status-item-meta">Incomplete / auth wall</div>
          </div>
          <div className="status-item">
            <div className="status-item-label">Archived</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {metrics.archivedJobs}
            </div>
            <div className="status-item-meta">Closed or declined</div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <form
          onSubmit={handleSearchSubmit}
          style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <div style={{ flex: '1 1 240px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by title, company, or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ flex: '0 0 auto', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select
              className="form-input"
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value as any);
                setPage(1);
              }}
              style={{ minWidth: '130px' }}
            >
              <option value="">All States</option>
              <option value="INGESTED">Ingested</option>
              <option value="NEW">New</option>
              <option value="NEEDS_REVIEW">Needs Review</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            <select
              className="form-input"
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value as any);
                setPage(1);
              }}
              style={{ minWidth: '130px' }}
            >
              <option value="">All Providers</option>
              <option value="GREENHOUSE">Greenhouse</option>
              <option value="LEVER">Lever</option>
              <option value="ASHBY">Ashby</option>
              <option value="LINKEDIN">LinkedIn</option>
              <option value="GENERIC">Generic</option>
              <option value="MANUAL">Pasted / Manual</option>
            </select>

            <button type="submit" className="btn btn-secondary btn-sm">
              Search
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div
          className="card"
          style={{ borderColor: 'var(--danger)', color: '#f87171', marginBottom: '1.5rem' }}
        >
          {error}
        </div>
      )}

      {/* Jobs List Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading job postings...
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>No Jobs Found in Inbox</h3>
            <p
              style={{
                color: 'var(--text-secondary)',
                marginBottom: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              Import a public job posting URL or paste a job description text to begin tracking.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(true)}>
              ➕ Ingest Your First Job
            </button>
          </div>
        ) : (
          <div>
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.9rem',
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
                    <th style={{ padding: '0.85rem 1.25rem' }}>Position & Company</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Location</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Provider</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Requirements</th>
                    <th style={{ padding: '0.85rem 1rem' }}>State</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Discovered</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      style={{
                        borderBottom: '1px solid var(--surface-border)',
                        transition: 'background-color 0.15s',
                        cursor: 'pointer',
                      }}
                      onClick={() => onSelectJob(job.id)}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            marginBottom: '0.2rem',
                          }}
                        >
                          {job.title}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {job.company}
                          {job.department && <span> • {job.department}</span>}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div>{job.locationText || '—'}</div>
                        {job.workplaceType && job.workplaceType !== 'UNKNOWN' && (
                          <span className="nav-tag" style={{ fontSize: '0.7rem' }}>
                            {job.workplaceType}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span className="nav-tag">{job.provider}</span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {job.requirementCount} items
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span
                          className={`status-badge ${
                            job.state === 'INGESTED'
                              ? 'ok'
                              : job.state === 'ARCHIVED'
                                ? 'disconnected'
                                : 'degraded'
                          }`}
                          style={{ fontSize: '0.75rem' }}
                        >
                          {job.state}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '1rem',
                          color: 'var(--text-secondary)',
                          fontSize: '0.8rem',
                        }}
                      >
                        {new Date(job.discoveredDate).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectJob(job.id);
                          }}
                        >
                          View Details →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.85rem 1.25rem',
                borderTop: '1px solid var(--surface-border)',
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div>
                Showing {jobs.length} of {totalItems} total jobs
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Job Modal */}
      <AddJobModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onJobCreated={(newJob) => {
          loadData();
          onSelectJob(newJob.id);
        }}
      />
    </div>
  );
}
