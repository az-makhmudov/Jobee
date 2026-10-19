import { useFeedback } from '../ui/Feedback.js';
import { Tabs, Button, Card, Icon, Input, ModalSurface } from '../ui/Primitives.js';
import { useState, useEffect } from 'react';
import { emailClient } from '../api/email-client.js';
import type {
  EmailAccountDto,
  EmailMessageDto,
  EmailReviewItemDto,
  EmailSyncStatsDto,
} from '@job-agent/shared';

export function EmailIntelligenceView() {
  const { confirm } = useFeedback();
  const [activeTab, setActiveTab] = useState<'queue' | 'messages' | 'accounts' | 'settings'>(
    'messages',
  );
  const [stats, setStats] = useState<EmailSyncStatsDto | null>(null);
  const [accounts, setAccounts] = useState<EmailAccountDto[]>([]);
  const [messages, setMessages] = useState<EmailMessageDto[]>([]);
  const [reviewItems, setReviewItems] = useState<EmailReviewItemDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessageDto | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, accountsData, reviewData, messagesData] = await Promise.all([
        emailClient.getStats(),
        emailClient.getAccounts(),
        emailClient.getReviewQueue('PENDING'),
        emailClient.getMessages({ limit: 50 }),
      ]);
      setStats(statsData);
      setAccounts(accountsData);
      setReviewItems(reviewData);
      setMessages(messagesData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncAccount = async (accountId: string) => {
    try {
      setSyncing(true);
      setError(null);
      setSuccessMessage(null);
      const res = await emailClient.syncAccount(accountId);
      setSuccessMessage(
        `Sync completed: ${res.messagesIngested} messages processed, ${res.autoSyncedCount} auto-synced, ${res.jobsDiscoveredCount} jobs discovered, ${res.reviewItemsCreated} routed to review.`,
      );
      await loadData();
    } catch (err) {
      setError(`Sync failed: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectFixture = async () => {
    try {
      setLoading(true);
      setError(null);
      await emailClient.connectFixtureAccount('bek.candidate@example.com');
      setSuccessMessage('Fixture email account connected successfully!');
      await loadData();
    } catch (err) {
      setError(`Failed to connect fixture account: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      setError(null);
      const res = await emailClient.getConnectUrl('GMAIL');
      window.location.href = res.authorizationUrl;
    } catch (err) {
      setError(
        `Gmail connect failed: ${(err as Error).message}. (Tip: Use the Demo Fixture account below for instant testing!)`,
      );
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!(await confirm('Disconnect this email account? Associated data will be unlinked.')))
      return;
    try {
      setLoading(true);
      await emailClient.disconnectAccount(accountId);
      setSuccessMessage('Email account disconnected.');
      await loadData();
    } catch (err) {
      setError(`Failed to disconnect: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveReviewItem = async (
    item: EmailReviewItemDto,
    resolution: 'APPROVED' | 'DISMISSED' | 'REJECTED',
  ) => {
    try {
      setResolvingId(item.id);
      await emailClient.resolveReviewItem(item.id, {
        resolution,
        resolutionNote: resolutionNote.trim() || undefined,
      });
      setSuccessMessage(`Review item ${resolution.toLowerCase()} successfully.`);
      setResolutionNote('');
      await loadData();
    } catch (err) {
      setError(`Failed to resolve review item: ${(err as Error).message}`);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="email-intelligence-view">
      <header
        className="page-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div>
          <h1 className="page-title">Messages</h1>
          <p className="page-subtitle">
            Autonomous recruitment email parsing, entity resolution, and deterministic CRM state
            synchronization.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }} className="layout-group">
          {accounts.length > 0 && (
            <Button
              className="btn btn-primary"
              disabled={syncing}
              onClick={() => handleSyncAccount(accounts[0]!.id)}
            >
              {syncing ? (
                'Syncing...'
              ) : (
                <>
                  <Icon name="sync" size={20} /> Sync Inboxes
                </>
              )}
            </Button>
          )}
        </div>
      </header>

      {loading && (
        <div
          style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}
        >
          <Icon name="schedule" size={20} /> Loading inbox data and review queue...
        </div>
      )}

      {error && (
        <div
          className="alert alert-danger"
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: 'var(--status-danger-container)',
            border: '1px solid var(--danger)',
            borderRadius: '16px',
          }}
        >
          <Icon name="warning" /> {error}
        </div>
      )}

      {successMessage && (
        <div
          className="alert alert-success"
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: 'var(--status-success-container)',
            border: '1px solid var(--success)',
            borderRadius: '16px',
          }}
        >
          <Icon name="check" size={20} /> {successMessage}
        </div>
      )}

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
        className="layout-group"
      >
        <Card className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Connected Inboxes
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', marginTop: '0.25rem' }}>
            {stats?.connectedAccountsCount ?? accounts.length}
          </div>
        </Card>

        <Card className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Ingested Messages
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', marginTop: '0.25rem' }}>
            {stats?.totalMessagesIngested ?? messages.length}
          </div>
        </Card>

        <Card className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Auto-Synced Updates
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 'bold',
              marginTop: '0.25rem',
              color: 'var(--success)',
            }}
          >
            {stats?.autoSyncedUpdatesCount ?? 0}
          </div>
        </Card>

        <Card className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Discovered Jobs</div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 'bold',
              marginTop: '0.25rem',
              color: 'var(--accent)',
            }}
          >
            {stats?.jobsDiscoveredCount ?? 0}
          </div>
        </Card>

        <Card
          className="card"
          style={{
            padding: '1rem',
            borderLeft: reviewItems.length > 0 ? '4px solid var(--warning)' : undefined,
          }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Human Review Queue
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 'bold',
              marginTop: '0.25rem',
              color: reviewItems.length > 0 ? 'var(--warning)' : 'inherit',
            }}
          >
            {stats?.pendingReviewCount ?? reviewItems.length}
          </div>
        </Card>
      </div>

      {/* Account Connection Bar */}
      <Card className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
          className="layout-group"
        >
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>Connected Accounts</h3>
            {accounts.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                No email accounts connected yet. Connect an account to monitor recruiter responses
                and job alerts.
              </p>
            ) : (
              <div
                style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}
                className="layout-group"
              >
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    style={{
                      background: 'var(--m3-surface)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      border: '1px solid var(--surface-border)',
                    }}
                    className="layout-group"
                  >
                    <span
                      style={{
                        fontSize: '0.8rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '16px',
                        background:
                          acc.provider === 'GMAIL'
                            ? 'var(--status-danger-container)'
                            : 'var(--m3-secondary-container)',
                        color: 'var(--m3-on-surface)',
                        fontWeight: 600,
                      }}
                    >
                      {acc.provider === 'FIXTURE' ? 'OFFLINE FIXTURE (SIMULATED)' : acc.provider}
                    </span>
                    <span style={{ fontWeight: 500 }}>{acc.emailAddress}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Last sync:{' '}
                      {acc.lastSyncAt ? new Date(acc.lastSyncAt).toLocaleTimeString() : 'Never'}
                    </span>
                    <Button
                      className="btn btn-sm btn-outline-danger"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => handleDisconnect(acc.id)}
                    >
                      Disconnect
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '0.4rem',
            }}
            className="layout-group"
          >
            <div style={{ display: 'flex', gap: '0.75rem' }} className="layout-group">
              <Button className="btn btn-primary" onClick={handleConnectGmail}>
                + Connect Gmail (OAuth)
              </Button>
              <Button
                className="btn btn-outline"
                onClick={handleConnectFixture}
                title="Connect offline simulated email fixture for local testing without live Google credentials."
              >
                <Icon name="settings" size={20} /> Offline Test Fixture
              </Button>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Live sync requires Google OAuth credentials. Test fixture runs locally offline.
            </span>
          </div>
        </div>
      </Card>

      <Tabs
        panelId="messages-panel"
        label="Messages workspace"
        value={activeTab}
        items={[
          { id: 'queue', label: `Review queue (${reviewItems.length})` },
          { id: 'messages', label: `Messages (${messages.length})` },
          { id: 'settings', label: 'Security & policies' },
        ]}
        onChange={(id) => setActiveTab(id as typeof activeTab)}
      />

      <section id="messages-panel" role="tabpanel" aria-label={activeTab}>
        {/* Tab 1: Human Review Queue */}
        {activeTab === 'queue' && (
          <div>
            {reviewItems.length === 0 ? (
              <Card
                className="card"
                style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}
              >
                <h3>
                  <Icon name="check" size={20} /> Review Queue is Empty
                </h3>
                <p style={{ marginTop: '0.5rem' }}>
                  All high-confidence actions have been automatically synchronized or processed
                  according to deterministic policy.
                </p>
              </Card>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                className="layout-group"
              >
                {reviewItems.map((item) => (
                  <Card
                    key={item.id}
                    className="card"
                    style={{
                      padding: '1.25rem',
                      borderLeft:
                        item.riskLevel === 'HIGH'
                          ? '4px solid var(--danger)'
                          : '4px solid var(--warning)',
                    }}
                  >
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
                            gap: '0.5rem',
                            alignItems: 'center',
                            marginBottom: '0.25rem',
                          }}
                          className="layout-group"
                        >
                          <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                            {item.messageSubject}
                          </span>
                          <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                            {item.classification} ({(item.confidence * 100).toFixed(0)}%)
                          </span>
                          <span
                            className={`badge ${item.riskLevel === 'HIGH' ? 'badge-danger' : 'badge-secondary'}`}
                            style={{ fontSize: '0.75rem' }}
                          >
                            Risk: {item.riskLevel}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          From:{' '}
                          {item.senderName
                            ? `${item.senderName} <${item.senderEmail}>`
                            : item.senderEmail}{' '}
                          • {new Date(item.receivedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <p
                      style={{
                        marginTop: '0.75rem',
                        fontSize: '0.9rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {item.snippet}
                    </p>

                    <div
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        background: 'var(--m3-surface)',
                        borderRadius: '16px',
                        fontSize: '0.85rem',
                      }}
                    >
                      <strong>Proposed Action: </strong>
                      <span style={{ color: 'var(--accent)' }}>
                        {item.proposedAction}{' '}
                        {item.proposedTargetStatus ? `➔ ${item.proposedTargetStatus}` : ''}
                      </span>
                      {item.proposedCompanyName && (
                        <span style={{ marginLeft: '1rem' }}>
                          Linked: <strong>{item.proposedCompanyName}</strong>{' '}
                          {item.proposedJobTitle ? `(${item.proposedJobTitle})` : ''}
                        </span>
                      )}
                      <div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                        <em>{item.explanation}</em>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: '1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                      }}
                      className="layout-group"
                    >
                      <Input
                        type="text"
                        placeholder="Optional human note or reason..."
                        className="input"
                        style={{ maxWidth: '350px', fontSize: '0.85rem' }}
                        value={resolvingId === item.id ? resolutionNote : ''}
                        onChange={(e) => setResolutionNote(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }} className="layout-group">
                        <Button
                          className="btn btn-outline"
                          disabled={resolvingId === item.id}
                          onClick={() => handleResolveReviewItem(item, 'DISMISSED')}
                        >
                          Dismiss
                        </Button>
                        <Button
                          className="btn btn-primary"
                          disabled={resolvingId === item.id}
                          onClick={() => handleResolveReviewItem(item, 'APPROVED')}
                        >
                          {resolvingId === item.id ? (
                            'Saving...'
                          ) : (
                            <>
                              <Icon name="check" size={20} /> Approve Action
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Message Log */}
        {activeTab === 'messages' && (
          <Card className="card" style={{ padding: '1rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Ingested Email Messages</h3>
            {messages.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>
                No messages ingested yet. Run sync above.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--surface-border)',
                        textAlign: 'left',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <th style={{ padding: '0.75rem 0.5rem' }}>Received</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>From</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Subject</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Classification</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Linked Entity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((m) => (
                      <tr
                        key={m.id}
                        style={{
                          borderBottom: '1px solid var(--m3-outline-variant)',
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelectedMessage(m)}
                      >
                        <td style={{ padding: '0.75rem 0.5rem', whiteSpace: 'nowrap' }}>
                          {new Date(m.receivedAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          {m.senderName || m.senderEmail}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{m.subject}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                            {m.classification}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span
                            className={`badge ${
                              m.processingStatus === 'AUTO_SYNCED'
                                ? 'badge-success'
                                : m.processingStatus === 'NEEDS_REVIEW'
                                  ? 'badge-warning'
                                  : 'badge-secondary'
                            }`}
                            style={{ fontSize: '0.75rem' }}
                          >
                            {m.processingStatus}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                          {m.linkedCompanyName
                            ? `${m.linkedCompanyName} ${m.linkedJobTitle ? `(${m.linkedJobTitle})` : ''}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* Selected Message Modal / Drawer */}
        {selectedMessage && (
          <ModalSurface
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'color-mix(in srgb,var(--m3-scrim) 48%,transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem',
            }}
            onClick={() => setSelectedMessage(null)}
            className="modal-backdrop"
          >
            <Card
              className="card"
              style={{
                maxWidth: '700px',
                width: '100%',
                maxHeight: '85vh',
                overflowY: 'auto',
                padding: '1.5rem',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <h3>{selectedMessage.subject}</h3>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)',
                      marginTop: '0.25rem',
                    }}
                  >
                    From: {selectedMessage.senderEmail} •{' '}
                    {new Date(selectedMessage.receivedAt).toLocaleString()}
                  </div>
                </div>
                <Button
                  className="btn btn-sm btn-ghost"
                  onClick={() => setSelectedMessage(null)}
                  aria-label="Close"
                >
                  <Icon name="close" size={20} />
                </Button>
              </div>

              <div
                style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}
                className="layout-group"
              >
                <span className="badge badge-primary">{selectedMessage.classification}</span>
                <span className="badge badge-secondary">{selectedMessage.processingStatus}</span>
              </div>

              <div
                style={{
                  background: 'var(--m3-surface-container-low)',
                  padding: '1rem',
                  borderRadius: '16px',
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.9rem',
                  fontFamily: 'monospace',
                }}
              >
                {selectedMessage.bodyText}
              </div>

              <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
                <Button className="btn btn-outline" onClick={() => setSelectedMessage(null)}>
                  Close
                </Button>
              </div>
            </Card>
          </ModalSurface>
        )}

        {/* Tab 3: Security & Policies */}
        {activeTab === 'settings' && (
          <Card className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Security Invariants & Execution Guarantees</h3>
            <ul style={{ lineHeight: 1.8, paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
              <li>
                <strong>Tokens Encrypted at Rest:</strong> OAuth tokens are protected via
                authenticated AES-256-GCM encryption with cryptographic initialization vectors.
              </li>
              <li>
                <strong>Minimal Read-Only Scopes:</strong> Only{' '}
                <code>https://www.googleapis.com/auth/gmail.readonly</code> is requested. No compose
                or outbound sending capabilities exist in this phase.
              </li>
              <li>
                <strong>Deterministic Authorization:</strong> AI assists in classification, but CRM
                state transitions are authorized only by deterministic rules through the canonical{' '}
                <code>ApplicationStateMachine</code>.
              </li>
              <li>
                <strong>Conservative Rejection Guard:</strong> Rejections require high confidence (≥
                0.95) and exact entity alignment, or they are escalated to the human review queue.
              </li>
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
