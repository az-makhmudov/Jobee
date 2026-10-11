import { useState, useEffect } from 'react';
import { applicationPackageClient } from '../api/application-package-client.js';
import type { ApprovalRequestDto } from '@job-agent/shared';

interface ApprovalsInboxViewProps {
  onOpenPackage: (packageId: string) => void;
}

export function ApprovalsInboxView({ onOpenPackage }: ApprovalsInboxViewProps) {
  const [approvals, setApprovals] = useState<ApprovalRequestDto[]>([]);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApprovals = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await applicationPackageClient.listApprovals(statusFilter);
      setApprovals(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, [statusFilter]);

  const handleApprove = async (id: string, userEditedValue?: string) => {
    try {
      setActionLoading(true);
      await applicationPackageClient.approveRequest(id, userEditedValue);
      await loadApprovals();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setActionLoading(true);
      await applicationPackageClient.rejectRequest(id);
      await loadApprovals();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Human Approvals Inbox</h1>
          <p className="page-subtitle">
            Centralized review queue for sensitive candidate declarations, legal authorizations, and
            answer overrides.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          {['PENDING', 'APPROVED', 'REJECTED'].map((st) => (
            <button
              key={st}
              className={`button ${statusFilter === st ? 'button-primary' : 'button-secondary'}`}
              style={{ fontSize: '0.85rem' }}
              onClick={() => setStatusFilter(st)}
            >
              {st}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          Loading approvals...
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '2rem', color: 'var(--danger)' }}>
          {error}
        </div>
      ) : approvals.length === 0 ? (
        <div
          className="card"
          style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}
        >
          ✓ No {statusFilter.toLowerCase()} approvals found in the queue.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {approvals.map((appr) => (
            <div key={appr.id} className="card" style={{ padding: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <span className="badge">{appr.approvalType}</span>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background:
                          appr.riskLevel === 'CRITICAL'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : appr.riskLevel === 'HIGH'
                              ? 'rgba(249, 115, 22, 0.15)'
                              : 'rgba(234, 179, 8, 0.15)',
                        color:
                          appr.riskLevel === 'CRITICAL'
                            ? '#dc2626'
                            : appr.riskLevel === 'HIGH'
                              ? '#ea580c'
                              : '#ca8a04',
                      }}
                    >
                      Risk: {appr.riskLevel}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {new Date(appr.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <strong style={{ fontSize: '1.05rem' }}>{appr.subject}</strong>
                  <div
                    style={{
                      fontSize: '0.9rem',
                      color: 'var(--text-secondary)',
                      marginTop: '0.2rem',
                    }}
                  >
                    Role: {appr.jobTitle} @ {appr.jobCompany}
                  </div>
                  <p
                    style={{
                      margin: '0.4rem 0 0',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Reason: {appr.reason}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    className="button button-secondary"
                    style={{ fontSize: '0.85rem' }}
                    onClick={() => onOpenPackage(appr.packageId)}
                  >
                    Open Studio ↗
                  </button>
                </div>
              </div>

              <div
                style={{
                  margin: '0.75rem 0',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,0.02)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.9rem',
                }}
              >
                <strong>Proposed Value: </strong>
                <span>
                  {appr.proposedValue || <em style={{ color: 'var(--text-secondary)' }}>None</em>}
                </span>
                {appr.userEditedValue && (
                  <div style={{ marginTop: '0.25rem', color: '#16a34a' }}>
                    <strong>Candidate Edited Value: </strong>
                    <span>{appr.userEditedValue}</span>
                  </div>
                )}
              </div>

              {appr.status === 'NEEDS_USER_RECONFIRMATION' && (
                <div
                  style={{
                    margin: '0.5rem 0',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '4px',
                    background: 'rgba(234, 179, 8, 0.1)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    color: '#ca8a04',
                    fontSize: '0.85rem',
                  }}
                >
                  ⚠️ <strong>Candidate Reconfirmation Required:</strong> This answer was quarantined
                  by safety policy. Your explicit confirmation is required before it can be included
                  in application materials.
                </div>
              )}

              {(appr.status === 'PENDING' || appr.status === 'NEEDS_USER_RECONFIRMATION') && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    className="button button-primary"
                    style={{ fontSize: '0.85rem' }}
                    onClick={() => handleApprove(appr.id)}
                    disabled={actionLoading}
                  >
                    {appr.status === 'NEEDS_USER_RECONFIRMATION'
                      ? '✓ Reconfirm & Approve'
                      : '✓ Approve'}
                  </button>
                  <button
                    className="button button-secondary"
                    style={{ fontSize: '0.85rem' }}
                    onClick={() => {
                      const val = prompt('Edit value before approval:', appr.proposedValue || '');
                      if (val !== null) handleApprove(appr.id, val);
                    }}
                    disabled={actionLoading}
                  >
                    ✏ Edit & Approve
                  </button>
                  <button
                    className="button button-secondary"
                    style={{ fontSize: '0.85rem', color: 'var(--danger)' }}
                    onClick={() => handleReject(appr.id)}
                    disabled={actionLoading}
                  >
                    ✕ Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
