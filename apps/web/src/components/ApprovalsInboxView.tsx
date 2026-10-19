import { useFeedback } from '../ui/Feedback.js';
import { Button, Card, Icon } from '../ui/Primitives.js';
import { useState, useEffect } from 'react';
import { applicationPackageClient } from '../api/application-package-client.js';
import type { ApprovalRequestDto } from '@job-agent/shared';

interface ApprovalsInboxViewProps {
  onOpenPackage: (packageId: string) => void;
}

export function ApprovalsInboxView({ onOpenPackage }: ApprovalsInboxViewProps) {
  const { alert, prompt } = useFeedback();
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
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
      className="layout-group"
    >
      <header className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h2 className="card-title">Review what needs your decision</h2>
          <p className="page-subtitle">
            Check application questions and proposed changes before continuing.
          </p>
        </div>

        <div
          style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}
          className="layout-group"
        >
          {['PENDING', 'APPROVED', 'REJECTED'].map((st) => (
            <Button
              key={st[0] + st.slice(1).toLowerCase()}
              className={`button ${statusFilter === st ? 'button-primary' : 'button-secondary'}`}
              style={{ fontSize: '0.85rem' }}
              onClick={() => setStatusFilter(st)}
            >
              {st[0] + st.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
      </header>

      {!loading && !error && approvals.length > 0 && (
        <Card>
          <h2 className="card-title">Applications to review</h2>
          {Array.from(new Map(approvals.map((item) => [item.packageId, item])).values()).map(
            (item) => (
              <div className="action-row" key={item.packageId}>
                <div>
                  <strong>
                    {item.jobTitle || 'Application'}
                    {item.jobCompany ? ` · ${item.jobCompany}` : ''}
                  </strong>
                  <p>
                    {approvals.filter((decision) => decision.packageId === item.packageId).length}{' '}
                    {statusFilter.toLowerCase()} decision(s) · Review each item separately.
                  </p>
                </div>
                <Button className="btn-primary" onClick={() => onOpenPackage(item.packageId)}>
                  Open application
                </Button>
              </div>
            ),
          )}
        </Card>
      )}
      {loading && <p role="status">Loading review items…</p>}
      {error && (
        <Card role="alert">
          <h2 className="card-title">Could not load review items</h2>
          <p>{error}</p>
          <Button className="btn-outline" onClick={loadApprovals}>
            Retry review items
          </Button>
        </Card>
      )}
      {!loading && !error && approvals.length === 0 && (
        <Card>
          <h2 className="card-title">No {statusFilter.toLowerCase()} decisions found</h2>
          <p>Change the decision filter to view past decisions.</p>
        </Card>
      )}
      <details className="student-tools">
        <summary>Review individual decisions</summary>
        <div className="banner banner-warning">
          <Icon name="info" size={20} /> Your authorization is required. Check the proposed answer,
          its risk and the role. Open the application for context, edit and approve, or reject.
        </div>
        {loading ? (
          <Card className="card" style={{ padding: '2rem', textAlign: 'center' }}>
            Loading approvals...
          </Card>
        ) : error ? (
          <Card className="card" style={{ padding: '2rem', color: 'var(--danger)' }}>
            {error}
          </Card>
        ) : approvals.length === 0 ? (
          <Card
            className="card"
            style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}
          >
            <Icon name="check" size={20} /> No {statusFilter.toLowerCase()} approvals found in the
            queue.
          </Card>
        ) : (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            className="layout-group"
          >
            {approvals.map((appr) => (
              <Card key={appr.id} className="card" style={{ padding: '1.25rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                  className="layout-group"
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.25rem',
                      }}
                      className="layout-group"
                    >
                      <span className="badge">{appr.approvalType}</span>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '16px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background:
                            appr.riskLevel === 'CRITICAL'
                              ? 'var(--status-danger-container)'
                              : appr.riskLevel === 'HIGH'
                                ? 'var(--status-warning-container)'
                                : 'var(--status-warning-container)',
                          color:
                            appr.riskLevel === 'CRITICAL'
                              ? 'var(--status-danger)'
                              : appr.riskLevel === 'HIGH'
                                ? 'var(--status-warning)'
                                : 'var(--status-warning)',
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

                  <div
                    style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                    className="layout-group"
                  >
                    <Button
                      className="button button-secondary"
                      style={{ fontSize: '0.85rem' }}
                      onClick={() => onOpenPackage(appr.packageId)}
                    >
                      Open application
                    </Button>
                  </div>
                </div>

                <div
                  style={{
                    margin: '0.75rem 0',
                    padding: '0.75rem',
                    borderRadius: '16px',
                    background: 'var(--m3-surface-container-low)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.9rem',
                  }}
                >
                  <strong>Proposed Value: </strong>
                  <span>
                    {appr.proposedValue || <em style={{ color: 'var(--text-secondary)' }}>None</em>}
                  </span>
                  {appr.userEditedValue && (
                    <div style={{ marginTop: '0.25rem', color: 'var(--status-success)' }}>
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
                      borderRadius: '16px',
                      background: 'var(--status-warning-container)',
                      border: '1px solid var(--status-warning-border)',
                      color: 'var(--status-warning)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <Icon name="warning" /> <strong>Candidate Reconfirmation Required:</strong> This
                    answer was quarantined by safety policy. Your explicit confirmation is required
                    before it can be included in application materials.
                  </div>
                )}

                {(appr.status === 'PENDING' || appr.status === 'NEEDS_USER_RECONFIRMATION') && (
                  <div
                    style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}
                    className="layout-group"
                  >
                    <Button
                      className="button button-primary"
                      style={{ fontSize: '0.85rem' }}
                      onClick={() => handleApprove(appr.id)}
                      disabled={actionLoading}
                    >
                      {appr.status === 'NEEDS_USER_RECONFIRMATION' ? (
                        <>
                          <Icon name="check" size={20} /> Reconfirm &amp; Approve
                        </>
                      ) : (
                        <>
                          <Icon name="check" size={20} /> Approve
                        </>
                      )}
                    </Button>
                    <Button
                      className="button button-secondary"
                      style={{ fontSize: '0.85rem' }}
                      onClick={async () => {
                        const val = await prompt(
                          'Edit value before approval:',
                          appr.proposedValue || '',
                        );
                        if (val !== null) handleApprove(appr.id, val);
                      }}
                      disabled={actionLoading}
                    >
                      <Icon name="edit" size={20} /> Edit & Approve
                    </Button>
                    <Button
                      className="button button-secondary"
                      style={{ fontSize: '0.85rem', color: 'var(--danger)' }}
                      onClick={() => handleReject(appr.id)}
                      disabled={actionLoading}
                    >
                      <Icon name="close" size={20} /> Reject
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </details>
    </div>
  );
}
