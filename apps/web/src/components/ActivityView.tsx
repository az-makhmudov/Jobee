import React, { useState, useEffect } from 'react';
import type { CandidateAuditEventDto } from '@job-agent/shared';
import { candidateApi } from '../api/candidate-client.js';

export function ActivityView() {
  const [events, setEvents] = useState<CandidateAuditEventDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await candidateApi.getAuditEvents();
      setEvents(data);
    } catch {
      // silent or fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Candidate Audit Log</h1>
        <p className="page-subtitle">
          Privacy-preserving metadata audit trail of changes across Candidate Brain entities.
          Sensitive profile and answer contents are excluded from audit storage by design.
        </p>
      </header>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-secondary btn-sm" onClick={loadEvents} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Log'}
        </button>
      </div>

      {events.length === 0 ? (
        <div className="card placeholder-view">
          <h3>No Audit Events Yet</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Actions performed on the Candidate Brain will be recorded here with changed field names
            and safe operational metadata.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  borderBottom: '1px solid var(--surface-border)',
                }}
              >
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Action</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Entity Type</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Entity ID</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Changed Fields</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Timestamp</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'right' }}>
                  Metadata
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const hasMetadata = ev.metadata && Object.keys(ev.metadata).length > 0;
                return (
                  <React.Fragment key={ev.id}>
                    <tr style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.4)' }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span
                          className={`status-badge ${
                            ev.action === 'DELETE'
                              ? 'error'
                              : ev.action === 'CREATE'
                                ? 'ok'
                                : 'degraded'
                          }`}
                          style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem' }}
                        >
                          {ev.action}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{ev.entityType}</td>
                      <td
                        style={{
                          padding: '0.85rem 1rem',
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {ev.entityId.slice(0, 8)}...
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {ev.changedFields && ev.changedFields.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {ev.changedFields.map((field) => (
                              <span
                                key={field}
                                style={{
                                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                  color: '#93c5fd',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '3px',
                                  fontSize: '0.75rem',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {field}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            —
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: '0.85rem 1rem',
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {new Date(ev.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        {hasMetadata ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                          >
                            {expandedId === ev.id ? 'Hide' : 'Inspect'}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                            None
                          </span>
                        )}
                      </td>
                    </tr>

                    {expandedId === ev.id && hasMetadata && (
                      <tr style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }}>
                        <td colSpan={6} style={{ padding: '1rem' }}>
                          <div style={{ fontSize: '0.8rem' }}>
                            <div
                              style={{
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                marginBottom: '0.35rem',
                              }}
                            >
                              Operational Metadata (Safe / Non-PII):
                            </div>
                            <pre
                              style={{
                                backgroundColor: '#090d16',
                                padding: '0.75rem',
                                borderRadius: '4px',
                                overflowX: 'auto',
                                margin: 0,
                              }}
                            >
                              {JSON.stringify(ev.metadata, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
