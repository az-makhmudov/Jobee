import { Button, Card, Icon, Input, Select } from '../ui/Primitives.js';
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { jobApi } from '../api/job-client.js';
import { PreparationBatchPanel } from './PreparationBatchPanel.js';
import { AddJobModal } from './AddJobModal.js';
import { CareerFitBadge } from './CareerFitBadge.js';
import type {
  RecommendationStatusDto,
  JobSummaryDto,
  JobState,
  JobProvider,
  JobDashboardMetricsDto,
  MatchDecision,
  WorkplaceType,
  EmploymentType,
} from '@job-agent/shared';

interface Props {
  onSelectJob: (jobId: string) => void;
  onOpenPackage: (id: string) => void;
  selectedJobId: string | null;
  refreshKey: number;
  detail: ReactNode;
}

export function JobInboxView({
  onSelectJob,
  onOpenPackage,
  selectedJobId,
  refreshKey,
  detail,
}: Props) {
  const requestVersion = useRef(0);
  const listLoad = useRef<Promise<void>>(Promise.resolve());
  const listLoadFailed = useRef(false);
  const currentLoader = useRef<() => Promise<void>>(async () => {});
  const detailRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previousSelection = useRef<string | null>(null);
  const [libraryMode, setLibraryMode] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationStatusDto | null>(null);
  const [recommendationError, setRecommendationError] = useState('');
  const [showTools, setShowTools] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [jobs, setJobs] = useState<JobSummaryDto[]>([]);
  const [metrics, setMetrics] = useState<JobDashboardMetricsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzingJobId, setAnalyzingJobId] = useState<string | null>(null);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [discoveryWarnings, setDiscoveryWarnings] = useState<string[]>([]);
  const [discovering, setDiscovering] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [workplaceFilter, setWorkplaceFilter] = useState<WorkplaceType | ''>('');
  const [employmentFilter, setEmploymentFilter] = useState<EmploymentType | ''>('');
  const [stateFilter, setStateFilter] = useState<JobState | ''>('');
  const [providerFilter, setProviderFilter] = useState<JobProvider | ''>('');
  const [decisionFilter, setDecisionFilter] = useState<MatchDecision | 'UNANALYZED' | ''>('');
  const [staleFilter, setStaleFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<
    'discoveredDate' | 'score' | 'confidence' | 'title' | 'company'
  >('score');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, metricsRes] = await Promise.all([
        jobApi.getJobs({
          page,
          limit: 10,
          relevantOnly: !libraryMode,
          recommendationsOnly: !libraryMode,
          search: submittedSearch || undefined,
          workplaceType: workplaceFilter || undefined,
          employmentType: employmentFilter || undefined,
          state: (stateFilter as JobState) || undefined,
          provider: (providerFilter as JobProvider) || undefined,
          includeArchived: stateFilter === 'ARCHIVED',
          decision: decisionFilter || undefined,
          isStale: staleFilter === 'stale' ? true : staleFilter === 'fresh' ? false : undefined,
          sortBy,
          sortOrder,
        }),
        jobApi.getMetrics().catch(() => null),
      ]);

      if (version !== requestVersion.current) return;
      setJobs(
        libraryMode
          ? jobsRes.items
          : jobsRes.items.filter(
              (job) => job.matchSummary?.decision === 'MATCH' && !job.matchSummary.isStale,
            ),
      );
      listLoadFailed.current = false;
      setTotalPages(jobsRes.totalPages);
      setTotalItems(jobsRes.total);
      setMetrics(metricsRes);
    } catch (err) {
      if (version === requestVersion.current) {
        listLoadFailed.current = true;
        setError(err instanceof Error ? err.message : 'Failed to load jobs');
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [
    libraryMode,
    page,
    submittedSearch,
    workplaceFilter,
    employmentFilter,
    stateFilter,
    providerFilter,
    decisionFilter,
    staleFilter,
    sortBy,
    sortOrder,
  ]);

  currentLoader.current = loadData;

  useEffect(() => {
    listLoad.current = loadData();
    return () => {
      requestVersion.current++;
    };
  }, [loadData, refreshKey]);

  useEffect(() => {
    if (libraryMode) return;
    let active = true;
    setRecommendationError('');
    void jobApi
      .refreshRecommendations()
      .then(async (value) => {
        if (active) {
          setRecommendations(value);
          if (value.state === 'IDLE' && value.ready > 0 && !value.pending) {
            await listLoad.current;
            if (active && !listLoadFailed.current) void currentLoader.current();
          }
        }
      })
      .catch((error) => {
        if (active) setRecommendationError(error.message);
      });
    return () => {
      active = false;
    };
  }, [libraryMode, refreshKey]);

  useEffect(() => {
    if (
      libraryMode ||
      !recommendations ||
      recommendationError ||
      recommendations.state === 'FAILED' ||
      (recommendations.state === 'IDLE' && !recommendations.pending)
    )
      return;
    let active = true;
    const timer = setTimeout(() => {
      void jobApi
        .recommendationStatus()
        .then(async (value) => {
          if (!active) return;
          if (value.state === 'IDLE' && value.pending)
            value = await jobApi.refreshRecommendations();
          if (active) {
            setRecommendations(value);
            await currentLoader.current();
          }
        })
        .catch((error) => {
          if (active) setRecommendationError(error.message);
        });
    }, 3000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [libraryMode, recommendations, recommendationError]);

  const retryRecommendations = async () => {
    setRecommendationError('');
    try {
      setRecommendations(await jobApi.refreshRecommendations(true));
    } catch (error) {
      setRecommendationError(error instanceof Error ? error.message : 'Could not start analysis.');
    }
  };

  useEffect(() => {
    const previousId = previousSelection.current;
    previousSelection.current = selectedJobId;
    const frame = requestAnimationFrame(() => {
      if (selectedJobId) {
        detailRef.current?.focus({ preventScroll: true });
        if (window.matchMedia('(max-width: 1100px)').matches)
          detailRef.current?.scrollIntoView({ block: 'start' });
      } else if (previousId) {
        listRef.current
          ?.querySelector<HTMLButtonElement>(`button[data-job-id="${CSS.escape(previousId)}"]`)
          ?.focus();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedJobId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSubmittedSearch(search.trim());
    if (page === 1 && search.trim() === submittedSearch) void loadData();
  };

  const handleAnalyzeJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAnalyzingJobId(jobId);
    setError(null);
    try {
      await jobApi.analyzeJob(jobId, true);
      await currentLoader.current();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze job');
    } finally {
      setAnalyzingJobId(null);
    }
  };

  const handleBatchAnalyze = async () => {
    setBatchAnalyzing(true);
    setDiscoveryWarnings([]);
    setBatchNotice(null);
    setError(null);
    try {
      const res = await jobApi.batchAnalyzeJobs({ limit: 10, unanalyzedOnly: true });
      setBatchNotice(
        `Batch complete: ${res.succeeded} analyzed successfully, ${res.failed} failed, ${res.skipped} skipped.`,
      );
      await currentLoader.current();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run batch analysis');
    } finally {
      setBatchAnalyzing(false);
    }
  };

  const handleDiscoverJobs = async () => {
    setDiscovering(true);
    setDiscoveryWarnings([]);
    setBatchNotice(null);
    setError(null);
    try {
      const res = await jobApi.discoverJobs({ limit: 10 });
      setBatchNotice(
        `Discovery complete: ${res.newJobsIngested} new job(s) ingested from public sources (${res.duplicatesSkipped} duplicates skipped, ${res.totalDiscovered} scanned).`,
      );
      setRecommendations(await jobApi.refreshRecommendations());
      setDiscoveryWarnings(
        res.sourcesSummary.flatMap((source) =>
          source.errors.map((message) => `${source.source}: ${message}`),
        ),
      );
      await currentLoader.current();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover jobs from public sources');
    } finally {
      setDiscovering(false);
    }
  };

  return (
    <div className={`explore-workspace ${selectedJobId ? 'has-selection' : ''}`}>
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
        className="layout-group explore-controls"
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
            title="Find opportunities from your configured public job sources"
          >
            {discovering ? '🌐 Discovering...' : 'Find jobs'}
          </Button>
          <Button className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(true)}>
            Add a job link
          </Button>
        </div>
      </div>

      {!libraryMode && (
        <Card
          role={recommendationError || recommendations?.state === 'FAILED' ? 'alert' : undefined}
        >
          <p>
            {recommendationError || recommendations?.message || 'Preparing your recommendations…'}
          </p>
          {recommendations && (
            <p>
              {recommendations.evaluated} analyzed · {recommendations.ready} matches ·{' '}
              {recommendations.pending} awaiting analysis
              {recommendations.locations.length ? ` · ${recommendations.locations.join(', ')}` : ''}
              {recommendations.levels.length
                ? ` · ${recommendations.levels.map((level) => ({ ENTRY: 'Junior', JUNIOR: 'Junior', INTERNSHIP: 'Internship' })[level.toUpperCase()] ?? level).join(', ')}`
                : ''}
            </p>
          )}
          {(recommendationError || recommendations?.state === 'FAILED') && (
            <Button onClick={() => void retryRecommendations()}>Retry automatic analysis</Button>
          )}
        </Card>
      )}
      {libraryMode && (
        <Card>
          <p>
            Saved job library — includes unanalysed, non-matching and historical jobs. These are not
            recommendations.
          </p>
        </Card>
      )}
      {batchNotice && (
        <Card
          className="card"
          style={{
            borderColor: discoveryWarnings.length ? 'var(--status-warning)' : 'var(--success)',
            marginBottom: '1.5rem',
            padding: '0.75rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div role="status">
            {batchNotice}
            {discoveryWarnings.length > 0 && (
              <div>
                Some sources could not be checked. Results may be incomplete.
                <ul>
                  {discoveryWarnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <Button
            className="btn btn-secondary btn-sm"
            onClick={() => setBatchNotice(null)}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
          >
            Dismiss
          </Button>
        </Card>
      )}

      <details
        className="explore-controls"
        style={{ marginBottom: 16 }}
        onToggle={(event) => setShowTools(event.currentTarget.open)}
      >
        <summary>
          More tools
          {selectedJobIds.length ? ` · ${selectedJobIds.length} selected` : ''}
        </summary>
        <label>
          <input
            type="checkbox"
            checked={libraryMode}
            onChange={(event) => {
              setLibraryMode(event.target.checked);
              if (!event.target.checked) {
                setDecisionFilter('');
                setStaleFilter('');
                setStateFilter('');
              }
              setPage(1);
            }}
          />
          Show all saved jobs
        </label>
        <PreparationBatchPanel
          selectedJobIds={selectedJobIds}
          onPrepared={() => setSelectedJobIds([])}
          onOpenPackage={onOpenPackage}
        />

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
      <Card
        className="card explore-controls"
        style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}
      >
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
          <Select
            aria-label="Workplace"
            value={workplaceFilter}
            onChange={(e) => {
              setWorkplaceFilter(e.target.value as WorkplaceType | '');
              setPage(1);
            }}
          >
            <option value="">All workplaces</option>
            <option value="REMOTE">Remote</option>
            <option value="HYBRID">Hybrid</option>
            <option value="ONSITE">Onsite</option>
          </Select>
          <Select
            aria-label="Employment type"
            value={employmentFilter}
            onChange={(e) => {
              setEmploymentFilter(e.target.value as EmploymentType | '');
              setPage(1);
            }}
          >
            <option value="">All employment types</option>
            <option value="FULL_TIME">Full time</option>
            <option value="PART_TIME">Part time</option>
            <option value="CONTRACT">Contract</option>
            <option value="INTERNSHIP">Internship</option>
            <option value="TEMPORARY">Temporary</option>
            <option value="VOLUNTEER">Volunteer</option>
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
            aria-label="Sort jobs by"
          >
            <option value="discoveredDate:desc">Newest First</option>
            <option value="discoveredDate:asc">Oldest First</option>
            <option value="score:desc">Highest Match Score</option>
            <option value="score:asc">Lowest Match Score</option>
            <option value="confidence:desc">Highest Confidence</option>
            <option value="title:asc">Title (A-Z)</option>
            <option value="company:asc">Company (A-Z)</option>
          </Select>{' '}
          <Button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearch('');
              setSubmittedSearch('');
              setWorkplaceFilter('');
              setEmploymentFilter('');
              setStateFilter('');
              setProviderFilter('');
              setDecisionFilter('');
              setStaleFilter('');
              setPage(1);
            }}
          >
            Clear filters
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
              {libraryMode && (
                <>
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
                </>
              )}
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
          role="alert"
        >
          {error}
          <Button className="btn btn-secondary btn-sm" onClick={loadData}>
            Retry loading jobs
          </Button>
        </Card>
      )}

      <div className="explore-pane-grid">
        <div ref={listRef} className="explore-list" aria-label="Job results">
          {/* Jobs List Table */}
          <Card
            className="job-results-container"
            style={{ padding: 0, border: 0, background: 'transparent' }}
          >
            {error ? null : loading ? (
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
                  {submittedSearch ||
                  workplaceFilter ||
                  employmentFilter ||
                  stateFilter ||
                  providerFilter ||
                  decisionFilter ||
                  staleFilter
                    ? 'Try a broader search or clear the filters. Your saved jobs are unchanged.'
                    : 'Only jobs with a completed, current MATCH analysis appear here. Analysis runs automatically; find more jobs or check your preferences. Your saved jobs remain available under More tools.'}
                </p>
                <Button className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(true)}>
                  Add a job link
                </Button>
              </div>
            ) : (
              <div>
                <div className="job-results">
                  {jobs.map((job) => (
                    <Card
                      key={job.id}
                      className={`job-card ${selectedJobId === job.id ? 'selected' : ''}`}
                    >
                      <div className="action-row">
                        <div>
                          <label className="job-selection">
                            <Input
                              hidden={!showTools}
                              type="checkbox"
                              aria-label={`Select ${job.title} at ${job.company} for preparation`}
                              checked={selectedJobIds.includes(job.id)}
                              disabled={
                                !selectedJobIds.includes(job.id) && selectedJobIds.length >= 10
                              }
                              onChange={(e) =>
                                setSelectedJobIds(
                                  e.target.checked
                                    ? [...selectedJobIds, job.id]
                                    : selectedJobIds.filter((id) => id !== job.id),
                                )
                              }
                            />{' '}
                            {showTools ? 'Select for preparation' : null}
                          </label>
                          <h2>{job.title}</h2>
                          <p>
                            {job.company} · {job.locationText || 'Location not specified'} ·{' '}
                            {job.employmentType === 'UNKNOWN'
                              ? 'Employment type not specified'
                              : job.employmentType.replaceAll('_', ' ').toLowerCase()}
                          </p>
                          {(job.minSalary != null || job.maxSalary != null) && (
                            <p>
                              {job.currency || 'Currency unspecified'}{' '}
                              {job.minSalary?.toLocaleString()}
                              {job.minSalary != null && job.maxSalary != null ? ' – ' : ''}
                              {job.maxSalary?.toLocaleString()}
                              {job.payPeriod
                                ? ` / ${job.payPeriod.toLowerCase()}`
                                : ' · pay period unspecified'}
                            </p>
                          )}
                          <div>
                            {job.matchSummary?.isStale ? (
                              'Analysis needs refresh'
                            ) : job.matchSummary?.careerFitCategory ? (
                              <CareerFitBadge
                                category={job.matchSummary.careerFitCategory}
                                size="sm"
                              />
                            ) : (
                              job.matchSummary?.decision || 'Analysis not run yet'
                            )}
                          </div>
                          {job.matchSummary && !job.matchSummary.isStale && (
                            <small>
                              {job.matchSummary.analysisMode === 'DETERMINISTIC_ONLY'
                                ? 'Rule-based analysis'
                                : 'AI-assisted analysis'}
                            </small>
                          )}
                          {job.matchSummary && !job.matchSummary.isStale && (
                            <p className="job-fit-summary">
                              {job.matchSummary.hardBlockers?.[0] ||
                                job.matchSummary.summaryExplanation}
                              {!job.matchSummary.hardBlockers?.length &&
                              job.matchSummary.unknowns?.[0]
                                ? ` ${job.matchSummary.unknowns[0]}`
                                : ''}
                            </p>
                          )}
                        </div>
                        <Button
                          className="btn-outline"
                          data-job-id={job.id}
                          aria-current={selectedJobId === job.id ? 'true' : undefined}
                          onClick={() => onSelectJob(job.id)}
                        >
                          View job
                        </Button>
                      </div>
                      <details className="advanced-details">
                        <summary>Analysis & source</summary>
                        <p>
                          {job.provider} · Added {new Date(job.discoveredDate).toLocaleDateString()}{' '}
                          · {job.state} · {job.workplaceType} ·{' '}
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
                  className="explore-pagination"
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
                      disabled={loading || page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span>
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      className="btn btn-secondary btn-sm"
                      disabled={loading || page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
        <section ref={detailRef} tabIndex={-1} className="explore-detail" aria-label="Selected job">
          {detail || (
            <Card>
              <h2>Select a job to explore</h2>
              <p>
                Review the role, requirements and your fit here while keeping your search in view.
              </p>
            </Card>
          )}
        </section>
      </div>

      {/* Add Job Modal */}
      <AddJobModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onJobCreated={(newJob) => {
          void currentLoader.current();
          void jobApi
            .refreshRecommendations()
            .then(setRecommendations)
            .catch((error) => setRecommendationError(error.message));
          onSelectJob(newJob.id);
        }}
      />
    </div>
  );
}
