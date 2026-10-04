import { useState, useEffect } from 'react';
import { candidateApi } from '../api/candidate-client.js';
import type { CandidateOverviewDto } from '@job-agent/shared';

interface Props {
  onNavigate: (section: string, tab?: string) => void;
}

export function DashboardView({ onNavigate }: Props) {
  const [overview, setOverview] = useState<CandidateOverviewDto | null>(null);
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
      const [overviewData, eventsData] = await Promise.all([
        candidateApi.getOverview(),
        candidateApi.getAuditEvents(),
      ]);
      setOverview(overviewData);
      setAuditEvents(eventsData.slice(0, 10)); // Top 10 recent
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
