import { Icon } from '../ui/Primitives.js';
import { Button, Card, Input, ModalSurface } from '../ui/Primitives.js';
import { useState, useEffect } from 'react';
import type { SystemNotificationDto, NotificationPreferencesDto } from '@job-agent/shared';
import { NotificationClient } from '../api/notification-client.js';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (section: string, tabOrId?: string) => void;
}

export function NotificationCenterModal({
  isOpen,
  onClose,
  onNavigate,
}: NotificationCenterModalProps) {
  const [activeTab, setActiveTab] = useState<'notifications' | 'preferences'>('notifications');
  const [notifications, setNotifications] = useState<SystemNotificationDto[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferencesDto | null>(null);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [notifsData, prefsData] = await Promise.all([
        NotificationClient.list({
          status: filterUnreadOnly ? 'UNREAD' : undefined,
          limit: 30,
        }),
        NotificationClient.getPreferences(),
      ]);
      setNotifications(notifsData.notifications);
      setPreferences(prefsData);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, filterUnreadOnly]);

  if (!isOpen) return null;

  const handleMarkAsRead = async (id: string) => {
    try {
      await NotificationClient.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, status: 'READ', readAt: new Date().toISOString() } : n,
        ),
      );
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await NotificationClient.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, status: 'READ', readAt: new Date().toISOString() })),
      );
    } catch {
      // silent
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await NotificationClient.dismiss(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // silent
    }
  };

  const handleUpdatePreference = async (key: keyof NotificationPreferencesDto, value: boolean) => {
    if (!preferences) return;
    try {
      const updated = await NotificationClient.updatePreferences({ [key]: value });
      setPreferences(updated);
    } catch {
      // silent
    }
  };

  const handleActionClick = (notif: SystemNotificationDto) => {
    onClose();
    if (notif.actionUrl && onNavigate) {
      if (notif.actionUrl.startsWith('/approvals')) {
        onNavigate('approvals');
      } else if (notif.actionUrl.startsWith('/interviews')) {
        onNavigate('interviews');
      } else if (notif.actionUrl.startsWith('/applications')) {
        onNavigate('applications', notif.targetId || undefined);
      } else if (notif.actionUrl.startsWith('/emails')) {
        onNavigate('emails');
      }
    }
  };

  return (
    <ModalSurface
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'color-mix(in srgb,var(--m3-scrim) 48%,transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1.5rem',
      }}
      onClick={onClose}
      className="modal-backdrop"
    >
      <Card
        className="card"
        style={{
          width: '100%',
          maxWidth: '700px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--surface-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Notifications</h3>
            <div
              style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}
            >
              Real-time approval reminders, bot challenge alerts, and autonomous status updates
            </div>
          </div>
          <Button className="btn btn-secondary btn-sm" onClick={onClose}>
            <Icon name="close" size={20} /> Close
          </Button>
        </div>

        {/* Tab & Filter Bar */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderBottom: '1px solid var(--surface-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--m3-surface-container-low)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }} className="layout-group">
            <Button
              className={`btn btn-sm ${activeTab === 'notifications' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('notifications')}
            >
              Alerts ({notifications.filter((n) => n.status === 'UNREAD').length} unread)
            </Button>
            <Button
              className={`btn btn-sm ${activeTab === 'preferences' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('preferences')}
            >
              <Icon name="settings" size={20} /> Preferences
            </Button>
          </div>

          {activeTab === 'notifications' && (
            <div
              style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}
              className="layout-group"
            >
              <label
                style={{
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                }}
              >
                <Input
                  type="checkbox"
                  checked={filterUnreadOnly}
                  onChange={(e) => setFilterUnreadOnly(e.target.checked)}
                />
                Unread only
              </label>
              <Button className="btn btn-secondary btn-sm" onClick={handleMarkAllRead}>
                Mark all read
              </Button>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'notifications' ? (
            loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <h3>No Notifications</h3>
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  {filterUnreadOnly
                    ? 'No unread notifications.'
                    : 'You are all caught up! No active notifications.'}
                </p>
              </div>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                className="layout-group"
              >
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: '1rem',
                      borderRadius: '16px',
                      backgroundColor:
                        n.status === 'UNREAD'
                          ? 'var(--m3-secondary-container)'
                          : 'var(--m3-surface-container-low)',
                      border:
                        n.status === 'UNREAD'
                          ? '1px solid var(--m3-outline-variant)'
                          : '1px solid var(--surface-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                    className="layout-group"
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        className="layout-group"
                      >
                        <span
                          className={`status-badge ${
                            n.severity === 'CRITICAL'
                              ? 'error'
                              : n.severity === 'WARNING'
                                ? 'degraded'
                                : 'ok'
                          }`}
                          style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}
                        >
                          {n.severity}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{n.title}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {new Date(n.createdAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                      }}
                    >
                      {n.message}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '0.5rem',
                        marginTop: '0.25rem',
                      }}
                      className="layout-group"
                    >
                      {n.actionUrl && (
                        <Button
                          className="btn btn-primary btn-sm"
                          style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={() => handleActionClick(n)}
                        >
                          Take Action →
                        </Button>
                      )}
                      {n.status === 'UNREAD' && (
                        <Button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => handleMarkAsRead(n.id)}
                        >
                          Mark as read
                        </Button>
                      )}
                      <Button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => handleDismiss(n.id)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : preferences ? (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              className="layout-group"
            >
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                Notification Dispatch Settings
              </div>

              <label
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
              >
                <Input
                  type="checkbox"
                  checked={preferences.notifyOnApprovalRequests}
                  onChange={(e) =>
                    handleUpdatePreference('notifyOnApprovalRequests', e.target.checked)
                  }
                />
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                    Pending Approval Reminders
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Notify when sensitive questions or application packages require human review.
                  </div>
                </div>
              </label>

              <label
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
              >
                <Input
                  type="checkbox"
                  checked={preferences.notifyOnCaptchaHalt}
                  onChange={(e) => handleUpdatePreference('notifyOnCaptchaHalt', e.target.checked)}
                />
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                    CAPTCHA & Challenge Halts
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Alert immediately when browser automation pauses for human bot challenge
                    resolution.
                  </div>
                </div>
              </label>

              <label
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
              >
                <Input
                  type="checkbox"
                  checked={preferences.notifyOnAutoApply}
                  onChange={(e) => handleUpdatePreference('notifyOnAutoApply', e.target.checked)}
                />
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                    Auto-Apply Dispatch Events
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Receive alerts upon successful autonomous submissions or quota limits reached.
                  </div>
                </div>
              </label>

              <label
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
              >
                <Input
                  type="checkbox"
                  checked={preferences.notifyOnInterviewReminders}
                  onChange={(e) =>
                    handleUpdatePreference('notifyOnInterviewReminders', e.target.checked)
                  }
                />
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                    Upcoming Interview Briefs
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Remind when interviews are scheduled within 48 hours to review preparation
                    materials.
                  </div>
                </div>
              </label>

              <label
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
              >
                <Input
                  type="checkbox"
                  checked={preferences.dailyDigestEnabled}
                  onChange={(e) => handleUpdatePreference('dailyDigestEnabled', e.target.checked)}
                />
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Daily Summary Digest</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Aggregate daily discovery and application activity into a single digest.
                  </div>
                </div>
              </label>
            </div>
          ) : (
            <div>Loading preferences...</div>
          )}
        </div>
      </Card>
    </ModalSurface>
  );
}
