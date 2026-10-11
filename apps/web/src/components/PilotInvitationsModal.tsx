import React, { useState, useEffect } from 'react';
import { createPilotInvite, listPilotInvites, revokePilotInvite } from '../api/auth-client';
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

  const fetchInvitations = async () => {
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
  };

  useEffect(() => {
    if (isOpen) {
      fetchInvitations();
    }
  }, [isOpen]);

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
    if (!confirm('Are you sure you want to revoke this invitation?')) return;
    try {
      await revokePilotInvite(id);
      await fetchInvitations();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke invitation');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎟️</span>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Pilot Invitation Management</h3>
              <p className="text-xs text-gray-500">
                Generate and monitor invite-only private pilot access
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              {success}
            </div>
          )}

          {/* Newly created code spotlight */}
          {newlyCreatedCode && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                  Active Invitation Code
                </p>
                <p className="text-lg font-mono font-bold text-blue-700 select-all">
                  {newlyCreatedCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(newlyCreatedCode)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition-colors"
              >
                Copy Code
              </button>
            </div>
          )}

          {/* Generate New Invitation */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Generate New Invitation</h4>
            <form
              onSubmit={handleCreateInvitation}
              className="grid grid-cols-1 sm:grid-cols-4 gap-3"
            >
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Recipient Email (Optional)
                </label>
                <input
                  type="email"
                  value={invitedEmail}
                  onChange={(e) => setInvitedEmail(e.target.value)}
                  placeholder="candidate@company.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">User (Tester)</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Expires In</label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={7}>7 Days</option>
                  <option value={14}>14 Days</option>
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days</option>
                </select>
              </div>

              <div className="sm:col-span-4 flex justify-end">
                <button
                  type="submit"
                  disabled={generating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow transition-colors disabled:opacity-50"
                >
                  {generating ? 'Generating...' : '+ Generate Invitation Code'}
                </button>
              </div>
            </form>
          </div>

          {/* Existing Invitations List */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-gray-900">
                Issued Invitations ({invitations.length})
              </h4>
              <button
                type="button"
                onClick={fetchInvitations}
                disabled={loading}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-gray-400 py-6 text-center">Loading invitations...</p>
            ) : invitations.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center bg-gray-50 rounded-xl">
                No invitations issued yet.
              </p>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider text-left">
                    <tr>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Reserved For</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Expires</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 font-mono text-xs">
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-semibold text-gray-900 select-all">
                          {inv.code}
                        </td>
                        <td className="px-4 py-3 font-sans">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                              inv.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800'
                                : inv.status === 'ACCEPTED'
                                  ? 'bg-green-100 text-green-800'
                                  : inv.status === 'REVOKED'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-sans text-gray-600">
                          {inv.invitedEmail || (
                            <span className="text-gray-400">Anyone with code</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-sans capitalize text-gray-700">{inv.role}</td>
                        <td className="px-4 py-3 font-sans text-gray-500">
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-sans text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(inv.code)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Copy
                          </button>
                          {inv.status === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => handleRevoke(inv.id)}
                              className="text-red-600 hover:text-red-800 font-medium"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
