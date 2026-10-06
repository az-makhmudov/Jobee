import { useState, useEffect } from 'react';
import { candidateApi } from '../api/candidate-client.js';
import { jobApi } from '../api/job-client.js';
import { applicationPackageClient } from '../api/application-package-client.js';
import { ApplicationCrmClient } from '../api/application-crm-client.js';
import type {
  CandidateOverviewDto,
  JobDashboardMetricsDto,
  ApplicationStudioMetricsDto,
  ApplicationCrmMetricsDto,
} from '@job-agent/shared';

interface Props {
  onNavigate: (section: string, tab?: string) => void;
}

export function DashboardView({ onNavigate }: Props) {
  const [overview, setOverview] = useState<CandidateOverviewDto | null>(null);
  const [jobMetrics, setJobMetrics] = useState<JobDashboardMetricsDto | null>(null);
  const [packageMetrics, setPackageMetrics] = useState<ApplicationStudioMetricsDto | null>(null);
  const [crmMetrics, setCrmMetrics] = useState<ApplicationCrmMetricsDto | null>(null);
  const [auditEvents, setAuditEvents] = useState<
    Array<{
      id: string;
      action: string;
      entityType: string;
      createdAt: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, eventsData, metricsData, packageMetricsData, crmMetricsData] =
        await Promise.all([
          candidateApi.getOverview(),
          candidateApi.getAuditEvents(),
          jobApi.getMetrics().catch(() => null),
          applicationPackageClient.getMetrics().catch(() => null),
          ApplicationCrmClient.getMetrics().catch(() => null),
        ]);
      setOverview(overviewData);
      setAuditEvents(eventsData.slice(0, 10)); // Top 10 recent
      setJobMetrics(metricsData);
      setPackageMetrics(packageMetricsData);
      setCrmMetrics(crmMetricsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading Candidate Brain overview...</p>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="card" style={{ borderColor: 'var(--danger)' }}>
        <div className="card-title" style={{ color: 'var(--danger)' }}>
          Error Loading Candidate Data
        </div>
        <p>{error || 'Could not retrieve candidate overview'}</p>
        <button className="btn btn-primary" onClick={loadData} style={{ marginTop: '1rem' }}>
          Retry
        </button>
      </div>
    );
  }

  const { completeness } = overview;
  const score = completeness.score;
  const scoreColor =
    score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Candidate Brain Dashboard</h1>
        <p className="page-subtitle">
          Authoritative structured candidate profile, document vault & application guardrails
        </p>
      </header>

      {/* Completeness Card */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Profile Completeness</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Deterministic quality score based on verified candidate facts and documentation
            </p>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: scoreColor }}>{score}%</div>
        </div>

        {/* Progress Bar */}
        <div
          style={{
            width: '100%',
            height: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            overflow: 'hidden',
            marginBottom: '1.5rem',
          }}
        >
          <div
            style={{
              width: `${score}%`,
              height: '100%',
              backgroundColor: scoreColor,
              transition: 'width 0.4s ease-in-out',
            }}
          />
        </div>

        {/* Categories Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          {completeness.categories.map((cat) => (
            <div
              key={cat.category}
              style={{
                padding: '0.75rem',
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                border: `1px solid ${cat.completed ? 'rgba(16, 185, 129, 0.3)' : 'var(--surface-border)'}`,
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cat.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Weight: {cat.weight}%
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: cat.completed ? 'var(--success)' : 'var(--text-secondary)',
                }}
              >
                {cat.completed ? '✓ Ready' : 'Pending'}
              </span>
            </div>
          ))}
        </div>

        {/* Missing Items Box */}
        {completeness.missingItems.length > 0 && (
          <div
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              padding: '0.85rem 1rem',
              borderRadius: '6px',
            }}
          >
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--warning)',
                marginBottom: '0.35rem',
              }}
            >
              Missing Profile Elements:
            </div>
            <ul
              style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
            >
              {completeness.missingItems.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          className="card"
          style={{ marginBottom: 0, cursor: 'pointer' }}
          onClick={() => onNavigate('documents')}
        >
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
            MASTER CV
          </div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              marginTop: '0.25rem',
              color: overview.hasActiveMasterCv ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {overview.hasActiveMasterCv ? 'Active' : 'Missing'}
          </div>
          <div
            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}
          >
            {overview.documentCount} total documents ({overview.roleCvCount} role CVs)
          </div>
        </div>

        <div
          className="card"
          style={{ marginBottom: 0, cursor: 'pointer' }}
          onClick={() => onNavigate('profile', 'experience')}
        >
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
            WORK EXPERIENCE
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>
            {overview.experienceCount}
          </div>
          <div
            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}
          >
            {overview.educationCount} education records
          </div>
        </div>

        <div
          className="card"
          style={{ marginBottom: 0, cursor: 'pointer' }}
          onClick={() => onNavigate('profile', 'skills')}
        >
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
            SKILLS & LANGUAGES
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>
            {overview.skillCount}
          </div>
          <div
            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}
          >
            {overview.languageCount} languages configured
          </div>
        </div>

        <div
          className="card"
          style={{ marginBottom: 0, cursor: 'pointer' }}
          onClick={() => onNavigate('profile', 'facts')}
        >
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
            CANDIDATE FACTS
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>
            {overview.factCount}
          </div>
          <div
            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}
          >
            {overview.verifiedFactCount} verified for AI application use
          </div>
        </div>

        <div
          className="card"
          style={{ marginBottom: 0, cursor: 'pointer' }}
          onClick={() => onNavigate('answers')}
        >
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
            ANSWER LIBRARY
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>
            {overview.answerCount}
          </div>
          <div
            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}
          >
            Pre-approved application answers
          </div>
        </div>
      </div>

      {/* Job Ingestion & Match Intelligence (Phase 2) */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>
              Job Ingestion & Match Intelligence (Phase 2)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Normalized job inbox, grounded requirement evaluations, and deterministic policy
              authorization
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('jobs')}>
            Go to Job Inbox →
          </button>
        </div>

        <div
          className="status-grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            marginBottom: '1.25rem',
          }}
        >
          <div
            className="status-item"
            onClick={() => onNavigate('jobs')}
            style={{ cursor: 'pointer' }}
          >
            <div className="status-item-label">Total Jobs</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{jobMetrics?.totalJobs ?? 0}</div>
            <div className="status-item-meta">In local database</div>
          </div>

          <div
            className="status-item"
            onClick={() => onNavigate('jobs')}
            style={{ cursor: 'pointer' }}
          >
            <div className="status-item-label">Analyzed</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#60a5fa' }}>
              {jobMetrics?.totalAnalyzed ?? 0}
            </div>
            <div className="status-item-meta">Avg: {jobMetrics?.averageMatchScore ?? 0}%</div>
          </div>

          <div
            className="status-item"
            onClick={() => onNavigate('jobs')}
            style={{ cursor: 'pointer' }}
          >
            <div className="status-item-label">Matches</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399' }}>
              {jobMetrics?.matchCount ?? 0}
            </div>
            <div className="status-item-meta">Ready for application</div>
          </div>

          <div
            className="status-item"
            onClick={() => onNavigate('jobs')}
            style={{ cursor: 'pointer' }}
          >
            <div className="status-item-label">Review Needed</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fbbf24' }}>
              {jobMetrics?.reviewCount ?? 0}
            </div>
            <div className="status-item-meta">Gaps or unknowns</div>
          </div>

          <div
            className="status-item"
            onClick={() => onNavigate('jobs')}
            style={{ cursor: 'pointer' }}
          >
            <div className="status-item-label">Policy Skips</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f87171' }}>
              {jobMetrics?.skipCount ?? 0}
            </div>
            <div className="status-item-meta">Hard policy blocked</div>
          </div>
        </div>

        {jobMetrics && jobMetrics.recentJobs && jobMetrics.recentJobs.length > 0 && (
          <div>
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
              }}
            >
              RECENT JOBS & MATCH STATUS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {jobMetrics.recentJobs.slice(0, 5).map((j) => (
                <div
                  key={j.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.6rem 0.8rem',
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    borderRadius: '4px',
                    border: '1px solid var(--surface-border)',
                    cursor: 'pointer',
                  }}
                  onClick={() => onNavigate('jobs', j.id)}
                >
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{j.title}</span>
                    <span
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        marginLeft: '0.5rem',
                      }}
                    >
                      at {j.company}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {j.matchSummary ? (
                      <span
                        className={`status-badge ${
                          j.matchSummary.decision === 'MATCH'
                            ? 'ok'
                            : j.matchSummary.decision === 'REVIEW'
                              ? 'degraded'
                              : 'disconnected'
                        }`}
                        style={{ fontSize: '0.7rem' }}
                      >
                        {j.matchSummary.decision} ({j.matchSummary.overallScore}%)
                      </span>
                    ) : (
                      <span className="nav-tag" style={{ fontSize: '0.7rem' }}>
                        Unanalyzed
                      </span>
                    )}
                    <span className="nav-tag" style={{ fontSize: '0.7rem' }}>
                      {j.provider}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {new Date(j.discoveredDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Application Studio & Materials (Phase 3) */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>
              Application Studio & Prepared Materials (Phase 3)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Versioned application packages, ATS-safe tailored CVs, grounded cover letters, and
              human approvals
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('approvals')}>
              Approvals Queue ({packageMetrics?.pendingApprovals ?? 0})
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('applications')}>
              View Applications →
            </button>
          </div>
        </div>

        <div
          className="status-grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          }}
        >
          <div
            className="status-item"
            onClick={() => onNavigate('applications')}
            style={{ cursor: 'pointer' }}
          >
            <div className="status-item-label">In Preparation</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>
              {packageMetrics?.packagesInPreparation ?? 0}
            </div>
            <div className="status-item-meta">Packages being authored</div>
          </div>

          <div
            className="status-item"
            onClick={() => onNavigate('applications')}
            style={{ cursor: 'pointer' }}
          >
            <div className="status-item-label">Ready for Submission</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399' }}>
              {packageMetrics?.packagesReady ?? 0}
            </div>
            <div className="status-item-meta">All requirements satisfied</div>
          </div>

          <div
            className="status-item"
            onClick={() => onNavigate('applications')}
            style={{ cursor: 'pointer' }}
          >
            <div className="status-item-label">Needs Review</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fbbf24' }}>
              {packageMetrics?.packagesNeedingReview ?? 0}
            </div>
            <div className="status-item-meta">Pending answer or approval</div>
          </div>

          <div
            className="status-item"
            onClick={() => onNavigate('approvals')}
            style={{ cursor: 'pointer' }}
          >
            <div className="status-item-label">Pending Approvals</div>
            <div
              style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                color:
                  (packageMetrics?.pendingApprovals ?? 0) > 0 ? '#f87171' : 'var(--text-secondary)',
              }}
            >
              {packageMetrics?.pendingApprovals ?? 0}
            </div>
            <div className="status-item-meta">Sensitive declarations queue</div>
          </div>
        </div>
      </div>

      {/* Application Lifecycle CRM & Personal ATS (Phase 3 MVP) */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>
              Application Lifecycle CRM & ATS Pipeline (Phase 3 MVP)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Personal ATS state machine, submission audit provenance, interview tracking, offers,
              and analytics
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('applications')}>
            Open CRM Board →
          </button>
        </div>

        <div
          className="status-grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          }}
        >
          <div
            className="status-item"
            onClick={() => onNavigate('applications')}
            style={{ cursor: 'pointer' }}
          >
            <div className="status-item-label">Active Processes</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#60a5fa' }}>
              {crmMetrics?.activeProcesses ?? 0}
            </div>
            <div className="status-item-meta">Active candidate pipeline</div>
          </div>

          <div
            className="status-item"
            onClick={() => onNavigate('applications')}
            style={{ cursor: 'pointer' }}
          >
            <div className="status-item-label">Total Applied</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{crmMetrics?.applied ?? 0}</div>
            <div className="status-item-meta">Outbound submissions</div>
          </div>

          <div
            className="status-item"
            onClick={() => onNavigate('applications')}
            style={{ cursor: 'pointer' }}
          >
            <div className="status-item-label">In Interview</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8' }}>
              {crmMetrics?.interviews ?? 0}
            </div>
            <div className="status-item-meta">Screenings & tech rounds</div>
          </div>

          <div
            className="status-item"
            onClick={() => onNavigate('applications')}
            style={{ cursor: 'pointer' }}
          >
            <div className="status-item-label">Offers Received</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399' }}>
              {crmMetrics?.offers ?? 0}
            </div>
            <div className="status-item-meta">Target compensation</div>
          </div>

          <div
            className="status-item"
            onClick={() => onNavigate('applications')}
            style={{ cursor: 'pointer' }}
          >
            <div className="status-item-label">Follow-ups Due</div>
            <div
              style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                color:
                  (crmMetrics?.pendingFollowUps ?? 0) > 0 ? '#fbbf24' : 'var(--text-secondary)',
              }}
            >
              {crmMetrics?.pendingFollowUps ?? 0}
            </div>
            <div className="status-item-meta">Action required</div>
          </div>

          <div
            className="status-item"
            onClick={() => onNavigate('applications')}
            style={{ cursor: 'pointer' }}
          >
            <div className="status-item-label">Follow-ups Overdue</div>
            <div
              style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                color:
                  (crmMetrics?.overdueFollowUps ?? 0) > 0 ? '#f87171' : 'var(--text-secondary)',
              }}
            >
              {crmMetrics?.overdueFollowUps ?? 0}
            </div>
            <div className="status-item-meta">Past follow-up date</div>
          </div>
        </div>
      </div>

      {/* Recent Activity Audit */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Recent Candidate Audit Log</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('activity')}>
            View Full Log
          </button>
        </div>

        {auditEvents.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            No audit events logged yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {auditEvents.map((ev) => (
              <div
                key={ev.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.6rem 0.8rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.4)',
                  borderRadius: '4px',
                  border: '1px solid var(--surface-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    className={`status-badge ${ev.action === 'DELETE' ? 'error' : ev.action === 'CREATE' ? 'ok' : 'degraded'}`}
                    style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}
                  >
                    {ev.action}
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{ev.entityType}</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {new Date(ev.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
