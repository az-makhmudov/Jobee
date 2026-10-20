import { Button, Card, Icon, Input, Select } from '../ui/Primitives.js';
import { useState, useEffect } from 'react';
import { jobApi } from '../api/job-client.js';
import { PreparationBatchPanel } from './PreparationBatchPanel.js';
import { AddJobModal } from './AddJobModal.js';
import { CareerFitBadge } from './CareerFitBadge.js';
import type {
  JobSummaryDto,
  JobState,
  JobProvider,
  JobDashboardMetricsDto,
  MatchDecision,
} from '@job-agent/shared';

interface Props {
  onSelectJob: (jobId: string) => void;
  onOpenPackage: (id: string) => void;
}

export function JobInboxView({ onSelectJob, onOpenPackage }: Props) {
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [jobs, setJobs] = useState<JobSummaryDto[]>([]);
  const [metrics, setMetrics] = useState<JobDashboardMetricsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzingJobId, setAnalyzingJobId] = useState<string | null>(null);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<JobState | ''>('');
  const [providerFilter, setProviderFilter] = useState<JobProvider | ''>('');
  const [decisionFilter, setDecisionFilter] = useState<MatchDecision | 'UNANALYZED' | ''>('');
  const [staleFilter, setStaleFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<
    'discoveredDate' | 'score' | 'confidence' | 'title' | 'company'
  >('discoveredDate');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
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
          decision: decisionFilter || undefined,
          isStale: staleFilter === 'stale' ? true : staleFilter === 'fresh' ? false : undefined,
          sortBy,
          sortOrder,
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
  }, [page, stateFilter, providerFilter, decisionFilter, staleFilter, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleAnalyzeJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAnalyzingJobId(jobId);
    setError(null);
    try {
      await jobApi.analyzeJob(jobId, true);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze job');
    } finally {
      setAnalyzingJobId(null);
    }
  };

  const handleBatchAnalyze = async () => {
    setBatchAnalyzing(true);
    setBatchNotice(null);
    setError(null);
    try {
      const res = await jobApi.batchAnalyzeJobs({ limit: 10, unanalyzedOnly: true });
      setBatchNotice(
        `Batch complete: ${res.succeeded} analyzed successfully, ${res.failed} failed, ${res.skipped} skipped.`,
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run batch analysis');
    } finally {
      setBatchAnalyzing(false);
    }
  };

  const handleDiscoverJobs = async () => {
    setDiscovering(true);
    setBatchNotice(null);
    setError(null);
    try {
      const res = await jobApi.discoverJobs({ limit: 10 });
      setBatchNotice(
        `Discovery complete: ${res.newJobsIngested} new job(s) ingested from public sources (${res.duplicatesSkipped} duplicates skipped, ${res.totalDiscovered} scanned).`,
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover jobs from public sources');
    } finally {
      setDiscovering(false);
    }
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
        className="layout-group"
      >
        <div>
          <h1 className="page-title">Explore</h1>
          <p className="page-subtitle">Explore roles, check your fit and prepare an application.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }} className="layout-group">
          <Button
            className="btn btn-secondary btn-sm"
            onClick={handleDiscoverJobs}
            disabled={discovering || loading}
            title="Discover and ingest opportunities from Arbeitnow and Greenhouse public boards"
          >
            {discovering ? '🌐 Discovering...' : 'Find jobs'}
          </Button>
          <Button className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(true)}>
            Add a job link
          </Button>
        </div>
      </div>

      {batchNotice && (
        <Card
          className="card"
          style={{
            borderColor: 'var(--success)',
            color: 'var(--success)',
            marginBottom: '1.5rem',
            padding: '0.75rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>
            <Icon name="check" /> {batchNotice}
          </span>
          <Button
            className="btn btn-secondary btn-sm"
            onClick={() => setBatchNotice(null)}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
          >
            Dismiss
          </Button>
        </Card>
      )}

      <PreparationBatchPanel
        selectedJobIds={selectedJobIds}
        onPrepared={() => setSelectedJobIds([])}
        onOpenPackage={onOpenPackage}
      />

      <details className="student-tools" style={{ marginBottom: 24 }}>
        <summary>Analysis & source details</summary>
        <div className="account-actions">
          <Button
            className="btn btn-secondary btn-sm"
            onClick={handleBatchAnalyze}
            disabled={batchAnalyzing || loading}
            title="Analyze unanalyzed jobs in batch (up to 10)"
          >
            {batchAnalyzing ? (
              <>
                <Icon name="schedule" size={20} /> Analyzing...
              </>
            ) : (
              'Analyze new jobs'
            )}
          </Button>
          <Button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
            <Icon name="sync" /> Refresh
          </Button>
        </div>
        {/* Metrics Ribbon */}
        {metrics && (
          <div
            className="status-grid"
            style={{
              marginBottom: '1.5rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            }}
          >
            <div className="status-item">
              <div className="status-item-label">Total Jobs</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {metrics.totalJobs}
              </div>
              <div className="status-item-meta">In inbox</div>
            </div>
            <div className="status-item">
              <div className="status-item-label">Analyzed</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--m3-on-surface)' }}>
                {metrics.totalAnalyzed ?? 0}
              </div>
              <div className="status-item-meta">Avg: {metrics.averageMatchScore ?? 0}%</div>
            </div>
            <div className="status-item">
              <div className="status-item-label">Matches</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--status-success)' }}>
                {metrics.matchCount ?? 0}
              </div>
              <div className="status-item-meta">Preference matches</div>
            </div>
            <div className="status-item">
              <div className="status-item-label">Review Needed</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--status-warning)' }}>
                {metrics.reviewCount ?? 0}
              </div>
              <div className="status-item-meta">Gaps or unknowns</div>
            </div>
            <div className="status-item">
              <div className="status-item-label">Policy Skips</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--status-danger)' }}>
                {metrics.skipCount ?? 0}
              </div>
              <div className="status-item-meta">Hard policy blocked</div>
            </div>
            {metrics.staleAnalysisCount > 0 && (
              <div
                className="status-item"
                style={{ borderLeft: '3px solid var(--status-warning-border)' }}
              >
                <div className="status-item-label">Stale Analyses</div>
                <div
                  style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--status-warning)' }}
                >
                  {metrics.staleAnalysisCount}
                </div>
                <div className="status-item-meta">Profile changed</div>
              </div>
            )}
          </div>
        )}
      </details>
      {/* Filter and Search Bar */}
      <Card className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <h2 className="card-title">What are you looking for?</h2>
        <form
          className="job-search-form"
          onSubmit={handleSearchSubmit}
          style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <div style={{ flex: '1 1 200px' }}>
            <Input
              type="text"
              className="form-input"
              aria-label="Search jobs"
              placeholder="Search by title, company, or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <Button type="submit" className="btn btn-secondary btn-sm">
            Search
          </Button>
          <details className="advanced-details">
            <summary>
              More filters
              {decisionFilter || staleFilter || stateFilter || providerFilter ? ' · active' : ''}
            </summary>
            <div
              style={{ flex: '0 0 auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
              className="layout-group"
            >
              <Select
                className="form-input"
                value={decisionFilter}
                onChange={(e) => {
                  setDecisionFilter(e.target.value as any);
                  setPage(1);
                }}
                style={{ minWidth: '130px' }}
                title="Filter by match policy decision"
              >
                <option value="">All Decisions</option>
                <option value="MATCH">MATCH Only</option>
                <option value="REVIEW">REVIEW Only</option>
                <option value="SKIP">SKIP Only</option>
                <option value="UNANALYZED">Unanalyzed Only</option>
              </Select>

              <Select
                className="form-input"
                value={staleFilter}
                onChange={(e) => {
                  setStaleFilter(e.target.value);
                  setPage(1);
                }}
                style={{ minWidth: '120px' }}
                title="Filter by analysis staleness"
              >
                <option value="">All Freshness</option>
                <option value="stale">Stale Only</option>
                <option value="fresh">Fresh Only</option>
              </Select>

              <Select
                className="form-input"
                value={stateFilter}
                onChange={(e) => {
                  setStateFilter(e.target.value as any);
                  setPage(1);
                }}
                style={{ minWidth: '120px' }}
              >
                <option value="">All States</option>
                <option value="INGESTED">Ingested</option>
                <option value="NEW">New</option>
                <option value="NEEDS_REVIEW">Needs Review</option>
                <option value="ARCHIVED">Archived</option>
              </Select>

              <Select
                className="form-input"
                value={providerFilter}
                onChange={(e) => {
                  setProviderFilter(e.target.value as any);
                  setPage(1);
                }}
                style={{ minWidth: '120px' }}
              >
                <option value="">All Providers</option>
                <option value="GREENHOUSE">Greenhouse</option>
                <option value="LEVER">Lever</option>
                <option value="ASHBY">Ashby</option>
                <option value="LINKEDIN">LinkedIn</option>
                <option value="ARBEITNOW">Arbeitnow (Public Feed)</option>
                <option value="GENERIC">Generic</option>
                <option value="MANUAL">Pasted / Manual</option>
              </Select>

              <Select
                className="form-input"
                value={`${sortBy}:${sortOrder}`}
                onChange={(e) => {
                  const [sb, so] = e.target.value.split(':');
                  setSortBy(sb as any);
                  setSortOrder(so as any);
                  setPage(1);
                }}
                style={{ minWidth: '140px' }}
                title="Sort jobs by"
              >
                <option value="discoveredDate:desc">Newest First</option>
                <option value="discoveredDate:asc">Oldest First</option>
                <option value="score:desc">Highest Match Score</option>
                <option value="score:asc">Lowest Match Score</option>
                <option value="confidence:desc">Highest Confidence</option>
                <option value="title:asc">Title (A-Z)</option>
                <option value="company:asc">Company (A-Z)</option>
              </Select>
            </div>
          </details>
        </form>
      </Card>

      {error && (
        <Card
          className="card"
          style={{
            borderColor: 'var(--danger)',
            color: 'var(--status-danger)',
            marginBottom: '1.5rem',
          }}
        >
          {error}
        </Card>
      )}

      {/* Jobs List Table */}
      <Card
        className="job-results-container"
        style={{ padding: 0, border: 0, background: 'transparent' }}
      >
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading job postings...
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>No jobs found</h3>
            <p
              style={{
                color: 'var(--text-secondary)',
                marginBottom: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              Import a public job posting URL or paste a job description text to begin tracking.
            </p>
            <Button className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(true)}>
              ➕ Add your first job
            </Button>
          </div>
        ) : (
          <div>
            <div className="job-results">
              {jobs.map((job) => (
                <Card key={job.id} className="job-card">
                  <div className="action-row">
                    <div>
                      <label className="job-selection">
                        <Input
                          type="checkbox"
                          aria-label={`Select ${job.title} at ${job.company} for preparation`}
                          checked={selectedJobIds.includes(job.id)}
                          disabled={!selectedJobIds.includes(job.id) && selectedJobIds.length >= 10}
                          onChange={(e) =>
                            setSelectedJobIds(
                              e.target.checked
                                ? [...selectedJobIds, job.id]
                                : selectedJobIds.filter((id) => id !== job.id),
                            )
                          }
                        />{' '}
                        Select for preparation
                      </label>
                      <h2>{job.title}</h2>
                      <p>
                        {job.company} · {job.locationText || 'Location not specified'} ·{' '}
                        {job.employmentType === 'UNKNOWN'
                          ? 'Employment type not specified'
                          : job.employmentType.replaceAll('_', ' ').toLowerCase()}
                      </p>
                      <p>
                        {job.matchSummary?.isStale ? (
                          'Analysis needs refresh'
                        ) : job.matchSummary?.careerFitCategory ? (
                          <CareerFitBadge category={job.matchSummary.careerFitCategory} size="sm" />
                        ) : (
                          job.matchSummary?.decision || 'Analysis not run yet'
                        )}
                      </p>
                    </div>
                    <Button className="btn-outline" onClick={() => onSelectJob(job.id)}>
                      View job
                    </Button>
                  </div>
                  <details className="advanced-details">
                    <summary>Analysis & source</summary>
                    <p>
                      {job.provider} · Added {new Date(job.discoveredDate).toLocaleDateString()} ·{' '}
                      {job.state} · {job.workplaceType} ·{' '}
                      {job.lastCheckedDate
                        ? `Last checked ${new Date(job.lastCheckedDate).toLocaleDateString()}`
                        : 'Not checked recently'}
                      {job.department ? ` · ${job.department}` : ''}
                    </p>
                    <p>
                      {job.requirementCount} requirements
                      {job.matchSummary
                        ? ` · ${job.matchSummary.overallScore}% match · Confidence ${job.matchSummary.confidenceScore}%`
                        : ''}
                    </p>
                    <Button
                      className="btn-outline"
                      disabled={analyzingJobId === job.id}
                      onClick={(event) => handleAnalyzeJob(job.id, event)}
                    >
                      {analyzingJobId === job.id ? 'Analyzing…' : 'Analyze'}
                    </Button>
                  </details>
                </Card>
              ))}
            </div>

            {/* Pagination Controls */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.85rem 1.25rem',
                borderTop: '1px solid var(--surface-border)',
                backgroundColor: 'var(--m3-surface-container-low)',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div>
                Showing {jobs.length} of {totalItems} total jobs
              </div>
              <div
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                className="layout-group"
              >
                <Button
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <Button
                  className="btn btn-secondary btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

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
