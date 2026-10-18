import { Icon } from '../ui/Primitives.js';
import { Button, Card, ModalSurface } from '../ui/Primitives.js';
import { useState, useEffect } from 'react';
import { ApplicationCrmClient } from '../api/application-crm-client.js';
import type { ApplicationCrmAnalyticsDto } from '@job-agent/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ApplicationAnalyticsModal({ isOpen, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<ApplicationCrmAnalyticsDto | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    ApplicationCrmClient.getAnalytics()
      .then((data) => {
        setAnalytics(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <ModalSurface className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div className="modal-container" style={{ maxWidth: '850px', width: '90%' }}>
        <header className="modal-header">
          <div>
            <h2 className="modal-title">Personal ATS — Application Analytics</h2>
            <p className="modal-subtitle">
              Funnel conversions, response times, and source attribution metrics
            </p>
          </div>
          <Button className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </Button>
        </header>

        <div className="modal-body">
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="spinner" />
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
                Calculating CRM analytics...
              </p>
            </div>
          )}

          {error && <div className="banner banner-error">{error}</div>}

          {analytics && (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
              className="layout-group"
            >
              {/* Funnel Section */}
              <Card className="card" style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                  Pipeline Conversion Funnel
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '1rem',
                    textAlign: 'center',
                    marginBottom: '1.5rem',
                  }}
                  className="layout-group"
                >
                  <div
                    style={{
                      background: 'var(--bg-secondary)',
                      padding: '0.75rem',
                      borderRadius: '16px',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Total Tracked
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 600 }}>
                      {analytics.funnel.totalApplications}
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'var(--bg-secondary)',
                      padding: '0.75rem',
                      borderRadius: '16px',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Applied
                    </div>
                    <div
                      style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--color-primary)' }}
                    >
                      {analytics.funnel.applied}
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'var(--bg-secondary)',
                      padding: '0.75rem',
                      borderRadius: '16px',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Screening / Tests
                    </div>
                    <div
                      style={{
                        fontSize: '1.4rem',
                        fontWeight: 600,
                        color: 'var(--status-warning)',
                      }}
                    >
                      {analytics.funnel.screening}
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'var(--bg-secondary)',
                      padding: '0.75rem',
                      borderRadius: '16px',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Interviews
                    </div>
                    <div
                      style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--m3-on-surface)' }}
                    >
                      {analytics.funnel.interview}
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'var(--bg-secondary)',
                      padding: '0.75rem',
                      borderRadius: '16px',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Offers</div>
                    <div
                      style={{
                        fontSize: '1.4rem',
                        fontWeight: 600,
                        color: 'var(--status-success)',
                      }}
                    >
                      {analytics.funnel.offer}
                    </div>
                  </div>
                </div>

                {/* Conversion Rates */}
                <h4
                  style={{
                    fontSize: '0.9rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.75rem',
                  }}
                >
                  Stage Conversion Rates
                </h4>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                  className="layout-group"
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <span>Applied → Screening</span>
                      <strong>
                        {analytics.funnel.conversions.appliedToScreening.rate !== null
                          ? `${analytics.funnel.conversions.appliedToScreening.rate}% (${analytics.funnel.conversions.appliedToScreening.numerator}/${analytics.funnel.conversions.appliedToScreening.denominator})`
                          : 'N/A (0 submissions)'}
                      </strong>
                    </div>
                    <div
                      style={{
                        height: '6px',
                        background: 'var(--border-color)',
                        borderRadius: '3px',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${analytics.funnel.conversions.appliedToScreening.rate || 0}%`,
                          background: 'var(--status-warning-container)',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <span>Applied → Interview</span>
                      <strong>
                        {analytics.funnel.conversions.appliedToInterview.rate !== null
                          ? `${analytics.funnel.conversions.appliedToInterview.rate}% (${analytics.funnel.conversions.appliedToInterview.numerator}/${analytics.funnel.conversions.appliedToInterview.denominator})`
                          : 'N/A (0 submissions)'}
                      </strong>
                    </div>
                    <div
                      style={{
                        height: '6px',
                        background: 'var(--border-color)',
                        borderRadius: '3px',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${analytics.funnel.conversions.appliedToInterview.rate || 0}%`,
                          background: 'var(--m3-secondary-container)',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <span>Applied → Offer</span>
                      <strong>
                        {analytics.funnel.conversions.appliedToOffer.rate !== null
                          ? `${analytics.funnel.conversions.appliedToOffer.rate}% (${analytics.funnel.conversions.appliedToOffer.numerator}/${analytics.funnel.conversions.appliedToOffer.denominator})`
                          : 'N/A (0 submissions)'}
                      </strong>
                    </div>
                    <div
                      style={{
                        height: '6px',
                        background: 'var(--border-color)',
                        borderRadius: '3px',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${analytics.funnel.conversions.appliedToOffer.rate || 0}%`,
                          background: 'var(--status-success-container)',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <span>Interview → Offer</span>
                      <strong>
                        {analytics.funnel.conversions.interviewToOffer.rate !== null
                          ? `${analytics.funnel.conversions.interviewToOffer.rate}% (${analytics.funnel.conversions.interviewToOffer.numerator}/${analytics.funnel.conversions.interviewToOffer.denominator})`
                          : 'N/A (0 interviews)'}
                      </strong>
                    </div>
                    <div
                      style={{
                        height: '6px',
                        background: 'var(--border-color)',
                        borderRadius: '3px',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${analytics.funnel.conversions.interviewToOffer.rate || 0}%`,
                          background: 'var(--status-success-container)',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Time Analytics */}
              <Card className="card" style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                  Time to Stage & Application Velocity
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '1rem',
                  }}
                  className="layout-group"
                >
                  <div
                    style={{
                      background: 'var(--bg-secondary)',
                      padding: '1rem',
                      borderRadius: '16px',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Days to 1st Response
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                      {analytics.timeMetrics.avgDaysToFirstResponse !== null
                        ? `${analytics.timeMetrics.avgDaysToFirstResponse}d`
                        : '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Sample: {analytics.timeMetrics.sampleSizes.firstResponse}
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'var(--bg-secondary)',
                      padding: '1rem',
                      borderRadius: '16px',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Days to Interview
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                      {analytics.timeMetrics.avgDaysToInterview !== null
                        ? `${analytics.timeMetrics.avgDaysToInterview}d`
                        : '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Sample: {analytics.timeMetrics.sampleSizes.interview}
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'var(--bg-secondary)',
                      padding: '1rem',
                      borderRadius: '16px',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Days to Final Outcome
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                      {analytics.timeMetrics.avgDaysToOutcome !== null
                        ? `${analytics.timeMetrics.avgDaysToOutcome}d`
                        : '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Sample: {analytics.timeMetrics.sampleSizes.outcome}
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'var(--bg-secondary)',
                      padding: '1rem',
                      borderRadius: '16px',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Active Aging (Pending)
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                      {analytics.timeMetrics.avgActiveAgingDays !== null
                        ? `${analytics.timeMetrics.avgActiveAgingDays}d`
                        : '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Active: {analytics.timeMetrics.sampleSizes.active}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Source Distribution */}
              <Card className="card" style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                  Submission Source Distribution
                </h3>
                {analytics.sourceDistribution.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    No submission source data recorded yet.
                  </p>
                ) : (
                  <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Source / Platform</th>
                        <th>Applications</th>
                        <th>Share (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.sourceDistribution.map((item) => (
                        <tr key={item.source}>
                          <td>
                            <strong>{item.source}</strong>
                          </td>
                          <td>{item.count}</td>
                          <td>{item.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          )}
        </div>

        <footer
          className="modal-footer"
          style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem' }}
        >
          <Button className="btn btn-secondary" onClick={onClose}>
            Close
          </Button>
        </footer>
      </div>
    </ModalSurface>
  );
}
