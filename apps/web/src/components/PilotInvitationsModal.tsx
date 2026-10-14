import React, { useState, useEffect, useCallback } from 'react';
import { createPilotInvite, listPilotInvites, revokePilotInvite } from '../api/auth-client.js';
import type { PilotInvitationDto } from '@job-agent/shared';

interface PilotInvitationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PilotInvitationsModal: React.FC<PilotInvitationsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [invitations, setInvitations] = useState<PilotInvitationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New invitation form state
  const [invitedEmail, setInvitedEmail] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [generating, setGenerating] = useState(false);
  const [newlyCreatedCode, setNewlyCreatedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPilotInvites();
      setInvitations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load invitations');
    } finally {
      setLoading(false);
    }
  }, []);

  // Keyboard accessibility (Esc to close) & scroll lock
  useEffect(() => {
    if (!isOpen) return;

    fetchInvitations();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, fetchInvitations, onClose]);

  if (!isOpen) return null;

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const invite = await createPilotInvite({
        invitedEmail: invitedEmail.trim() || undefined,
        role,
        expiresInDays,
      });
      setNewlyCreatedCode(invite.code);
      setSuccess(`Invitation code generated successfully!`);
      setInvitedEmail('');
      await fetchInvitations();
    } catch (err: any) {
      setError(err.message || 'Failed to create invitation');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (
      !window.confirm(
        'Are you sure you want to revoke this invitation? Once revoked, it cannot be used.',
      )
    ) {
      return;
    }
    try {
      setError(null);
      await revokePilotInvite(id);
      setSuccess('Invitation revoked successfully.');
      await fetchInvitations();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke invitation');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => {
      setCopiedCode((prev) => (prev === text ? null : prev));
    }, 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-dialog modal-dialog-large modal-dialog-clean"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pilot-invitations-title"
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-content">
            <span className="modal-icon" aria-hidden="true">
              🎟️
            </span>
            <div>
              <h3 id="pilot-invitations-title" className="modal-title">
                Pilot Invitation Management
              </h3>
              <p className="modal-subtitle">
                Generate and monitor invite-only private pilot access for candidate testers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {error && (
            <div className="alert alert-error" role="alert">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert alert-success" role="status">
              <span>✓</span>
              <span>{success}</span>
            </div>
          )}

          {/* Newly created code spotlight */}
          {newlyCreatedCode && (
            <div className="spotlight-box">
              <div>
                <div className="spotlight-box-title">New Active Invitation Code</div>
                <div className="spotlight-box-code">{newlyCreatedCode}</div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginTop: '0.25rem',
                  }}
                >
                  Share this code with the invited tester or send the registration link.
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(newlyCreatedCode)}
                className="btn btn-primary btn-sm"
              >
                {copiedCode === newlyCreatedCode ? '✓ Copied!' : 'Copy Code'}
              </button>
            </div>
          )}

          {/* Generate New Invitation Form */}
          <div className="modal-card-section">
            <div className="modal-card-title">Generate New Invitation</div>
            <form onSubmit={handleCreateInvitation}>
              <div className="form-grid-4">
                <div className="form-group">
                  <label htmlFor="invite-email" className="form-label">
                    Recipient Email{' '}
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                      (Optional)
                    </span>
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    value={invitedEmail}
                    onChange={(e) => setInvitedEmail(e.target.value)}
                    placeholder="candidate@company.com"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="invite-role" className="form-label">
                    Role
                  </label>
                  <select
                    id="invite-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'user' | 'admin')}
                    className="form-input"
                  >
                    <option value="user">User (Tester)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="invite-expiry" className="form-label">
                    Expires In
                  </label>
                  <select
                    id="invite-expiry"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(Number(e.target.value))}
                    className="form-input"
                  >
                    <option value={7}>7 Days</option>
                    <option value={14}>14 Days</option>
                    <option value={30}>30 Days</option>
                    <option value={90}>90 Days</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="submit" disabled={generating} className="btn btn-primary">
                  {generating ? 'Generating...' : '+ Generate Invitation Code'}
                </button>
              </div>
            </form>
          </div>

          {/* Existing Invitations List */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Issued Invitations ({invitations.length})
              </div>
              <button
                type="button"
                onClick={fetchInvitations}
                disabled={loading}
                className="btn btn-ghost btn-sm"
              >
                {loading ? 'Refreshing...' : '↻ Refresh'}
              </button>
            </div>

            {loading && invitations.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: 'var(--text-secondary)',
                  fontSize: '0.9rem',
                }}
              >
                Loading invitations...
              </div>
            ) : invitations.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.4)',
                  borderRadius: '0.5rem',
                  color: 'var(--text-secondary)',
                  fontSize: '0.85rem',
                }}
              >
                No pilot invitations have been issued yet. Generate an invitation code above.
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Status</th>
                      <th>Reserved For</th>
                      <th>Role</th>
                      <th>Expires</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv) => (
                      <tr key={inv.id}>
                        <td className="table-mono" style={{ fontWeight: 700, color: '#60a5fa' }}>
                          {inv.code}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${
                              inv.status === 'ACCEPTED'
                                ? 'ok'
                                : inv.status === 'PENDING'
                                  ? 'degraded'
                                  : 'error'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td
                          style={{
                            color: inv.invitedEmail
                              ? 'var(--text-primary)'
                              : 'var(--text-secondary)',
                          }}
                        >
                          {inv.invitedEmail || 'Anyone with code'}
                        </td>
                        <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                          {inv.role}
                        </td>
                        <td
                          style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.8rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              gap: '0.4rem',
                              justifyContent: 'flex-end',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => copyToClipboard(inv.code)}
                              className="btn btn-secondary btn-sm"
                              title="Copy invitation code"
                            >
                              {copiedCode === inv.code ? '✓ Copied' : 'Copy'}
                            </button>
                            {inv.status === 'PENDING' && (
                              <button
                                type="button"
                                onClick={() => handleRevoke(inv.id)}
                                className="btn btn-danger btn-sm"
                                title="Revoke this invitation"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
