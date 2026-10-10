import { useState, useEffect, useCallback } from 'react';
import { calendarClient } from '../api/calendar-client.js';
import type {
  ScheduledInterviewWorkspaceItemDto,
  InterviewDashboardMetrics,
  CalendarAccountDto,
  PreparationBriefDto,
  AvailabilityResult,
  ConflictResult,
  ChecklistItem,
  UpdateInterviewDebriefRequest,
} from '@job-agent/shared';

interface Props {
  onNavigateToApplication?: (applicationId: string) => void;
}

export function InterviewWorkspaceView({ onNavigateToApplication }: Props) {
  const [activeTab, setActiveTab] = useState<'interviews' | 'availability' | 'accounts'>(
    'interviews',
  );
  const [filter, setFilter] = useState<
    'ALL' | 'UPCOMING' | 'PAST' | 'NEEDS_BRIEF' | 'NEEDS_DEBRIEF'
  >('ALL');
  const [metrics, setMetrics] = useState<InterviewDashboardMetrics | null>(null);
  const [interviews, setInterviews] = useState<ScheduledInterviewWorkspaceItemDto[]>([]);
  const [accounts, setAccounts] = useState<CalendarAccountDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Preparation Brief Modal State
  const [briefModalInterview, setBriefModalInterview] =
    useState<ScheduledInterviewWorkspaceItemDto | null>(null);
  const [briefData, setBriefData] = useState<PreparationBriefDto | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [humanNotes, setHumanNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [regeneratingBrief, setRegeneratingBrief] = useState(false);

  // Debrief Modal State
  const [debriefModalInterview, setDebriefModalInterview] =
    useState<ScheduledInterviewWorkspaceItemDto | null>(null);
  const [debriefForm, setDebriefForm] = useState<UpdateInterviewDebriefRequest>({
    questionsAsked: '',
    topicsDiscussed: '',
    candidateObservations: '',
    followUpCommitments: '',
    concerns: '',
    expectedNextStep: '',
    expectedResponseDate: '',
    privateNotes: '',
  });
  const [savingDebrief, setSavingDebrief] = useState(false);

  // Calendar Event Booking Modal State
  const [bookingModalInterview, setBookingModalInterview] =
    useState<ScheduledInterviewWorkspaceItemDto | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState('primary');
  const [bookingTimezone, setBookingTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  );
  const [includePrepInEvent, setIncludePrepInEvent] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Availability & Conflict Inspector State
  const [availStart, setAvailStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [availEnd, setAvailEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [availTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [availResult, setAvailResult] = useState<AvailabilityResult | null>(null);
  const [availLoading, setAvailLoading] = useState(false);

  const [conflictDateTime, setConflictDateTime] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(14, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [conflictDuration, setConflictDuration] = useState(45);
  const [conflictResult, setConflictResult] = useState<ConflictResult | null>(null);
  const [conflictLoading, setConflictLoading] = useState(false);

  // ─── Data Loading ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [metricsData, interviewsData, accountsData] = await Promise.all([
        calendarClient.getMetrics().catch(() => null),
        calendarClient.listInterviews().catch(() => []),
        calendarClient.getAccounts().catch(() => []),
      ]);
      setMetrics(metricsData);
      setInterviews(interviewsData);
      setAccounts(accountsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar and interview data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Filter Logic ─────────────────────────────────────────────────────────

  const now = new Date();
  const filteredInterviews = interviews.filter((item) => {
    const isPast = new Date(item.interview.scheduledAt).getTime() < now.getTime();
    if (filter === 'UPCOMING') return !isPast;
    if (filter === 'PAST') return isPast;
    if (filter === 'NEEDS_BRIEF')
      return !isPast && (!item.preparationBrief || item.preparationBrief.isStale);
    if (filter === 'NEEDS_DEBRIEF') {
      return (
        item.interview.status === 'COMPLETED' ||
        (isPast && !item.interview.debriefQuestionsAsked && !item.interview.debriefObservations)
      );
    }
    return true;
  });

  // ─── Calendar Account Actions ─────────────────────────────────────────────

  const handleConnectFixture = async () => {
    try {
      setError(null);
      await calendarClient.connectFixtureAccount('candidate.fixture@example.com');
      setSuccess('Demo Fixture calendar account connected successfully.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect fixture account');
    }
  };

  const handleConnectGoogle = async () => {
    try {
      setError(null);
      const res = await calendarClient.getGoogleAuthUrl('EVENT_MANAGEMENT');
      window.location.href = res.authUrl;
    } catch (err) {
      setError(
        `Google Calendar authorization unavailable: ${
          err instanceof Error ? err.message : 'Unknown error'
        }. Tip: You can connect the offline Demo Fixture Calendar for full functionality without Google credentials!`,
      );
    }
  };

  const handleDisconnectAccount = async (accountId: string) => {
    if (
      !window.confirm('Disconnect this calendar account? Linked event metadata will be unlinked.')
    ) {
      return;
    }
    try {
      setError(null);
      await calendarClient.disconnectAccount(accountId);
      setSuccess('Calendar account disconnected.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect account');
    }
  };

  // ─── Calendar Event Booking & Unlinking ───────────────────────────────────

  const handleOpenBookingModal = (item: ScheduledInterviewWorkspaceItemDto) => {
    setBookingModalInterview(item);
    const primaryAccount = accounts.find((a) => a.status === 'CONNECTED');
    if (primaryAccount && primaryAccount.defaultCalendarId) {
      setSelectedCalendarId(primaryAccount.defaultCalendarId);
    } else {
      setSelectedCalendarId('primary');
    }
  };

  const handleConfirmCreateEvent = async () => {
    if (!bookingModalInterview) return;
    try {
      setBookingLoading(true);
      setError(null);
      await calendarClient.createCalendarEvent(
        bookingModalInterview.application.id,
        bookingModalInterview.interview.id,
        {
          calendarId: selectedCalendarId,
          timezone: bookingTimezone,
          includePreparationNotes: includePrepInEvent,
        },
      );
      setSuccess('Calendar event created and linked successfully.');
      setBookingModalInterview(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create calendar event');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleDeleteCalendarEvent = async (item: ScheduledInterviewWorkspaceItemDto) => {
    if (!window.confirm('Remove this interview from your connected calendar?')) return;
    try {
      setError(null);
      await calendarClient.deleteCalendarEvent(item.application.id, item.interview.id);
      setSuccess('Calendar event removed and unlinked.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove calendar event');
    }
  };

  // ─── Preparation Brief Actions ────────────────────────────────────────────

  const handleOpenBrief = async (item: ScheduledInterviewWorkspaceItemDto) => {
    setBriefModalInterview(item);
    setBriefLoading(true);
    setBriefData(null);
    try {
      // Try to get or generate brief
      let brief: PreparationBriefDto;
      try {
        brief = await calendarClient.getPreparationBrief(item.application.id, item.interview.id);
      } catch {
        // Generate if not present
        brief = await calendarClient.generatePreparationBrief(
          item.application.id,
          item.interview.id,
        );
      }
      setBriefData(brief);
      setHumanNotes(brief.humanNotes || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preparation brief');
    } finally {
      setBriefLoading(false);
    }
  };

  const handleRegenerateBrief = async () => {
    if (!briefModalInterview) return;
    try {
      setRegeneratingBrief(true);
      setError(null);
      const brief = await calendarClient.generatePreparationBrief(
        briefModalInterview.application.id,
        briefModalInterview.interview.id,
        true,
      );
      setBriefData(brief);
      setSuccess('Preparation brief regenerated with latest candidate and company evidence.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate brief');
    } finally {
      setRegeneratingBrief(false);
    }
  };

  const handleToggleChecklist = async (index: number) => {
    if (!briefModalInterview || !briefData) return;
    const updatedChecklist = briefData.preparationChecklist.map((item, idx) =>
      idx === index ? { ...item, isCompleted: !item.isCompleted } : item,
    );
    // Optimistic update
    setBriefData({ ...briefData, preparationChecklist: updatedChecklist });
    try {
      const savedBrief = await calendarClient.updateChecklist(
        briefModalInterview.application.id,
        briefModalInterview.interview.id,
        updatedChecklist,
      );
      setBriefData(savedBrief);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update checklist');
    }
  };

  const handleSaveNotes = async () => {
    if (!briefModalInterview) return;
    try {
      setSavingNotes(true);
      setError(null);
      const savedBrief = await calendarClient.updateHumanNotes(
        briefModalInterview.application.id,
        briefModalInterview.interview.id,
        humanNotes,
      );
      setBriefData(savedBrief);
      setSuccess('Personal preparation notes saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  // ─── Debrief Actions ──────────────────────────────────────────────────────

  const handleOpenDebrief = (item: ScheduledInterviewWorkspaceItemDto) => {
    setDebriefModalInterview(item);
    setDebriefForm({
      questionsAsked: item.interview.debriefQuestionsAsked || '',
      topicsDiscussed: item.interview.debriefTopicsDiscussed || '',
      candidateObservations: item.interview.debriefObservations || '',
      followUpCommitments: item.interview.debriefFollowUpCommitments || '',
      concerns: item.interview.debriefConcerns || '',
      expectedNextStep: item.interview.debriefExpectedNextStep || '',
      expectedResponseDate: item.interview.debriefExpectedResponseDate
        ? item.interview.debriefExpectedResponseDate.slice(0, 10)
        : '',
      privateNotes: item.interview.debriefPrivateNotes || '',
    });
  };

  const handleSaveDebrief = async () => {
    if (!debriefModalInterview) return;
    try {
      setSavingDebrief(true);
      setError(null);
      await calendarClient.updateDebrief(
        debriefModalInterview.application.id,
        debriefModalInterview.interview.id,
        {
          ...debriefForm,
          expectedResponseDate: debriefForm.expectedResponseDate
            ? new Date(debriefForm.expectedResponseDate).toISOString()
            : null,
        },
      );
      setSuccess('Interview debrief saved and application timeline updated.');
      setDebriefModalInterview(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save debrief');
    } finally {
      setSavingDebrief(false);
    }
  };

  // ─── Availability & Conflict Checks ───────────────────────────────────────

  const handleQueryAvailability = async () => {
    try {
      setAvailLoading(true);
      setError(null);
      const res = await calendarClient.getAvailability({
        windowStart: new Date(availStart).toISOString(),
        windowEnd: new Date(availEnd + 'T23:59:59').toISOString(),
        timezone: availTimezone,
      });
      setAvailResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to query availability');
    } finally {
      setAvailLoading(false);
    }
  };

  const handleCheckConflict = async () => {
    try {
      setConflictLoading(true);
      setError(null);
      const res = await calendarClient.checkConflict({
        scheduledAt: new Date(conflictDateTime).toISOString(),
        durationMinutes: conflictDuration,
        timezone: availTimezone,
      });
      setConflictResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check scheduling conflicts');
    } finally {
      setConflictLoading(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <header
        className="page-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <div>
          <h1 className="page-title">Interviews & Calendar Workspace</h1>
          <p className="page-subtitle">
            Ground interview preparation in verified candidate evidence, synchronize calendars, and
            audit debriefs.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </header>

      {/* Global Alerts */}
      {error && (
        <div
          className="card"
          style={{
            borderColor: 'var(--danger)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            padding: '1rem',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>⚠️ {error}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div
          className="card"
          style={{
            borderColor: 'var(--success)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            padding: '1rem',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#34d399', fontSize: '0.9rem' }}>✓ {success}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setSuccess(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Bar */}
      {metrics && (
        <div className="status-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="status-item">
            <div className="status-item-label">Upcoming (7 Days)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)' }}>
              {metrics.interviewsThisWeek}
            </div>
            <div className="status-item-meta">{metrics.upcomingInterviews} total upcoming</div>
          </div>

          <div className="status-item">
            <div className="status-item-label">Prep Needed</div>
            <div
              style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                color: metrics.preparationNeeded > 0 ? '#fbbf24' : '#34d399',
              }}
            >
              {metrics.preparationNeeded}
            </div>
            <div className="status-item-meta">Briefs pending generation</div>
          </div>

          <div className="status-item">
            <div className="status-item-label">Overdue Follow-ups</div>
            <div
              style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                color: metrics.overdueFollowUps > 0 ? 'var(--danger)' : 'inherit',
              }}
            >
              {metrics.overdueFollowUps}
            </div>
            <div className="status-item-meta">Pending response dates</div>
          </div>

          <div className="status-item">
            <div className="status-item-label">Calendar Sync</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>
              {metrics.calendarConnected ? (
                <span style={{ color: '#34d399' }}>Connected</span>
              ) : (
                <span style={{ color: 'var(--text-secondary)' }}>Offline</span>
              )}
            </div>
            <div className="status-item-meta">{accounts.length} linked account(s)</div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--surface-border)',
          marginBottom: '1.5rem',
        }}
      >
        <button
          className={`btn ${activeTab === 'interviews' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('interviews')}
          style={{ borderRadius: '0.375rem 0.375rem 0 0', borderBottom: 'none' }}
        >
          Scheduled Interviews ({interviews.length})
        </button>
        <button
          className={`btn ${activeTab === 'availability' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('availability')}
          style={{ borderRadius: '0.375rem 0.375rem 0 0', borderBottom: 'none' }}
        >
          Availability & Conflicts
        </button>
        <button
          className={`btn ${activeTab === 'accounts' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('accounts')}
          style={{ borderRadius: '0.375rem 0.375rem 0 0', borderBottom: 'none' }}
        >
          Calendar Accounts ({accounts.length})
        </button>
      </div>

      {/* ─── TAB 1: SCHEDULED INTERVIEWS ────────────────────────────────────── */}
      {activeTab === 'interviews' && (
        <div>
          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${filter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('ALL')}
            >
              All ({interviews.length})
            </button>
            <button
              className={`btn btn-sm ${filter === 'UPCOMING' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('UPCOMING')}
            >
              Upcoming (
              {
                interviews.filter(
                  (i) => new Date(i.interview.scheduledAt).getTime() >= now.getTime(),
                ).length
              }
              )
            </button>
            <button
              className={`btn btn-sm ${filter === 'PAST' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('PAST')}
            >
              Past (
              {
                interviews.filter(
                  (i) => new Date(i.interview.scheduledAt).getTime() < now.getTime(),
                ).length
              }
              )
            </button>
            <button
              className={`btn btn-sm ${filter === 'NEEDS_BRIEF' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('NEEDS_BRIEF')}
            >
              Needs Brief ({metrics?.preparationNeeded || 0})
            </button>
            <button
              className={`btn btn-sm ${filter === 'NEEDS_DEBRIEF' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('NEEDS_DEBRIEF')}
            >
              Needs Debrief
            </button>
          </div>

          {filteredInterviews.length === 0 ? (
            <div className="card placeholder-view">
              <h3>No Interviews Found</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                {filter === 'ALL'
                  ? 'No scheduled interviews found in Application CRM. Log an interview round from an active application to generate grounded briefs and calendar events.'
                  : `No interviews match the "${filter}" filter.`}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredInterviews.map((item) => {
                const isUpcoming = new Date(item.interview.scheduledAt).getTime() >= now.getTime();
                const isSynced = Boolean(item.calendarLink);
                const hasBrief = Boolean(item.preparationBrief);
                const hasDebrief = Boolean(
                  item.interview.debriefQuestionsAsked || item.interview.debriefObservations,
                );

                return (
                  <div
                    key={item.interview.id}
                    className="card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      borderLeft: isUpcoming
                        ? '4px solid var(--accent)'
                        : '4px solid var(--surface-border)',
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
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.15rem', fontWeight: 600 }}>
                            🎙️ {item.interview.roundTitle}
                          </span>
                          <span className="badge">{item.interview.interviewType}</span>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: isUpcoming
                                ? 'rgba(59, 130, 246, 0.2)'
                                : 'rgba(255, 255, 255, 0.1)',
                              color: isUpcoming ? '#93c5fd' : 'var(--text-secondary)',
                            }}
                          >
                            {isUpcoming ? 'Upcoming' : 'Completed / Past'}
                          </span>
                        </div>
                        <div
                          style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.9rem',
                            marginTop: '0.25rem',
                          }}
                        >
                          🏢{' '}
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {item.application.companyName}
                          </strong>{' '}
                          — {item.application.jobTitle}
                          {onNavigateToApplication && (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{
                                marginLeft: '0.75rem',
                                padding: '0.1rem 0.5rem',
                                fontSize: '0.75rem',
                              }}
                              onClick={() => onNavigateToApplication(item.application.id)}
                            >
                              View in CRM ↗
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                          📅{' '}
                          {new Date(item.interview.scheduledAt).toLocaleString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                          Duration: {item.interview.durationMinutes || 45} mins | TZ:{' '}
                          {item.interview.timezone || 'UTC'}
                        </div>
                      </div>
                    </div>

                    {/* Metadata & Meeting URL */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {item.interview.interviewerName && (
                        <div>
                          👤 Interviewer:{' '}
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {item.interview.interviewerName}
                          </strong>
                        </div>
                      )}
                      {(item.interview.meetingUrl || item.interview.locationOrUrl) && (
                        <div>
                          🔗 Location:{' '}
                          <a
                            href={item.interview.meetingUrl || item.interview.locationOrUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#60a5fa', textDecoration: 'underline' }}
                          >
                            {item.interview.meetingUrl || item.interview.locationOrUrl}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Status Pills */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      {/* Calendar Sync Status */}
                      {isSynced ? (
                        <span
                          className="status-badge ok"
                          title={`Event ID: ${item.calendarLink?.externalEventId}`}
                        >
                          ✓ Calendar Synced
                        </span>
                      ) : (
                        <span className="status-badge disconnected">✕ Not Synced to Calendar</span>
                      )}

                      {/* Prep Brief Status */}
                      {hasBrief ? (
                        <span className="status-badge ok">
                          ✓ Prep Brief ({item.preparationBrief?.checklistProgress.completed}/
                          {item.preparationBrief?.checklistProgress.total} Tasks)
                        </span>
                      ) : (
                        <span className="status-badge degraded">⚠️ No Brief Generated</span>
                      )}

                      {/* Debrief Status */}
                      {hasDebrief ? (
                        <span className="status-badge ok">✓ Debrief Recorded</span>
                      ) : isUpcoming ? (
                        <span className="status-badge ok" style={{ opacity: 0.7 }}>
                          Debrief Pending Interview
                        </span>
                      ) : (
                        <span className="status-badge degraded">⚠️ Debrief Needed</span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '0.5rem',
                        borderTop: '1px solid var(--surface-border)',
                        paddingTop: '0.75rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Calendar Action */}
                      {isSynced ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#f87171' }}
                          onClick={() => handleDeleteCalendarEvent(item)}
                        >
                          Remove from Calendar
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenBookingModal(item)}
                        >
                          + Add to Calendar
                        </button>
                      )}

                      {/* Brief Action */}
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleOpenBrief(item)}
                      >
                        {hasBrief ? '📖 View Preparation Brief' : '✨ Generate Preparation Brief'}
                      </button>

                      {/* Debrief Action */}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenDebrief(item)}
                      >
                        {hasDebrief ? '📝 Edit Debrief' : '📝 Record Debrief'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: AVAILABILITY & CONFLICTS ─────────────────────────────────── */}
      {activeTab === 'availability' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {/* Multi-Calendar Availability Inspector */}
          <div className="card">
            <h3 className="card-title">Multi-Calendar Availability Finder</h3>
            <p
              style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}
            >
              Aggregate busy slots across all connected accounts to find open interview scheduling
              windows.
            </p>

            <div className="form-grid" style={{ marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Window Start Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={availStart}
                  onChange={(e) => setAvailStart(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Window End Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={availEnd}
                  onChange={(e) => setAvailEnd(e.target.value)}
                />
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleQueryAvailability}
              disabled={availLoading}
              style={{ width: '100%', marginBottom: '1rem' }}
            >
              {availLoading ? 'Querying Calendars...' : 'Query Combined Availability'}
            </button>

            {availResult && (
              <div
                style={{
                  marginTop: '1rem',
                  borderTop: '1px solid var(--surface-border)',
                  paddingTop: '1rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Query Status:</span>
                  <span
                    className={`status-badge ${availResult.status === 'AVAILABLE' ? 'ok' : 'degraded'}`}
                  >
                    {availResult.status}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.75rem',
                  }}
                >
                  Queried {availResult.queriedCalendars.length} calendar(s) | Timezone:{' '}
                  {availResult.timezone}
                </div>

                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Busy Slots ({availResult.busySlots.length}):
                </div>
                {availResult.busySlots.length === 0 ? (
                  <p style={{ color: '#34d399', fontSize: '0.85rem' }}>
                    ✓ No busy slots found in selected range. Entire window is free.
                  </p>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      maxHeight: '200px',
                      overflowY: 'auto',
                    }}
                  >
                    {availResult.busySlots.map((slot, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(15, 23, 42, 0.6)',
                          padding: '0.4rem 0.6rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          border: '1px solid var(--surface-border)',
                        }}
                      >
                        ⛔ {new Date(slot.start).toLocaleString()} →{' '}
                        {new Date(slot.end).toLocaleTimeString()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Interactive Conflict Checker */}
          <div className="card">
            <h3 className="card-title">Interview Conflict Verifier</h3>
            <p
              style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}
            >
              Test any proposed interview datetime against external calendars and existing scheduled
              interviews.
            </p>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Proposed Interview DateTime</label>
              <input
                type="datetime-local"
                className="form-input"
                value={conflictDateTime}
                onChange={(e) => setConflictDateTime(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Duration (Minutes)</label>
              <select
                className="form-input"
                value={conflictDuration}
                onChange={(e) => setConflictDuration(Number(e.target.value))}
              >
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 minutes</option>
              </select>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleCheckConflict}
              disabled={conflictLoading}
              style={{ width: '100%', marginBottom: '1rem' }}
            >
              {conflictLoading ? 'Checking Conflicts...' : 'Verify Scheduling Conflict'}
            </button>

            {conflictResult && (
              <div
                style={{
                  marginTop: '1rem',
                  borderTop: '1px solid var(--surface-border)',
                  paddingTop: '1rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Conflict Result:</span>
                  <span className={`status-badge ${conflictResult.hasConflict ? 'error' : 'ok'}`}>
                    {conflictResult.hasConflict ? 'CONFLICT DETECTED' : 'CLEAR (NO CONFLICT)'}
                  </span>
                </div>

                {conflictResult.hasConflict ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {conflictResult.conflicts.map((c, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                        }}
                      >
                        <strong>
                          ⚠️ {c.type}: {c.description}
                        </strong>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          {new Date(c.conflictStart).toLocaleTimeString()} -{' '}
                          {new Date(c.conflictEnd).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#34d399', fontSize: '0.85rem' }}>
                    ✓ Proposed slot is completely free. No overlapping interviews or external
                    events.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: CALENDAR ACCOUNTS ────────────────────────────────────────── */}
      {activeTab === 'accounts' && (
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
            }}
          >
            <div>
              <h3 className="card-title">Connected Calendar Inboxes</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Manage Google Calendar OAuth connections and offline Demo Fixture accounts.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleConnectFixture}>
                + Connect Demo Fixture
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleConnectGoogle}>
                + Connect Google Calendar
              </button>
            </div>
          </div>

          {accounts.length === 0 ? (
            <div className="placeholder-view">
              <h3>No Calendar Accounts Connected</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Connect a calendar to sync interview meetings, check availability, and prevent
                overlapping rounds.
              </p>
              <button
                className="btn btn-primary"
                onClick={handleConnectFixture}
                style={{ marginTop: '1rem' }}
              >
                Connect Demo Fixture (Instant Offline Test)
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '6px',
                    padding: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>
                        {acc.provider === 'GOOGLE' ? '🗓️' : '🧪'}
                      </span>
                      <strong style={{ fontSize: '1rem' }}>{acc.emailAddress}</strong>
                      <span className="badge">{acc.provider}</span>
                      <span
                        className={`status-badge ${acc.status === 'CONNECTED' ? 'ok' : 'error'}`}
                      >
                        {acc.status}
                      </span>
                    </div>
                    <div
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        marginTop: '0.25rem',
                      }}
                    >
                      Scope: {acc.scopeLevel} | Calendars selected:{' '}
                      {acc.selectedCalendarIds.length || 1}
                    </div>
                  </div>

                  <div>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ color: '#f87171' }}
                      onClick={() => handleDisconnectAccount(acc.id)}
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL 1: PREPARATION BRIEF MODAL ────────────────────────────────── */}
      {briefModalInterview && (
        <div className="modal-backdrop" onClick={() => setBriefModalInterview(null)}>
          <div
            className="modal-dialog"
            style={{ maxWidth: '800px', width: '95%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid var(--surface-border)',
                paddingBottom: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  Interview Preparation Brief: {briefModalInterview.interview.roundTitle}
                </h2>
                <div
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    marginTop: '0.25rem',
                  }}
                >
                  🏢 {briefModalInterview.application.companyName} —{' '}
                  {briefModalInterview.application.jobTitle}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleRegenerateBrief}
                  disabled={regeneratingBrief}
                >
                  {regeneratingBrief ? 'Regenerating...' : '↻ Regenerate Brief'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setBriefModalInterview(null)}
                >
                  ✕
                </button>
              </div>
            </div>

            {briefLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Synthesizing grounded interview preparation brief...
                </p>
              </div>
            ) : briefData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Role Summary & Company Context */}
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    padding: '1rem',
                    borderRadius: '6px',
                    border: '1px solid var(--surface-border)',
                  }}
                >
                  <h4
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      marginBottom: '0.5rem',
                      color: '#60a5fa',
                    }}
                  >
                    Role & Company Context
                  </h4>
                  <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    {briefData.roleSummary}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {briefData.companyContext}
                  </p>
                </div>

                {/* Candidate Grounded Strengths */}
                <div>
                  <h4
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      marginBottom: '0.5rem',
                      color: '#34d399',
                    }}
                  >
                    Verified Candidate Strengths (Zero Hallucination)
                  </h4>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: '0.75rem',
                    }}
                  >
                    {briefData.candidateStrengths.map((strength, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(16, 185, 129, 0.05)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          padding: '0.75rem',
                          borderRadius: '6px',
                        }}
                      >
                        <strong style={{ fontSize: '0.85rem', color: '#34d399' }}>
                          {strength.evidenceTitle}
                        </strong>
                        <div
                          style={{ fontSize: '0.75rem', color: '#93c5fd', marginTop: '0.15rem' }}
                        >
                          Type: {strength.evidenceType} | Target: {strength.relevantRequirement}
                        </div>
                        <p
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            marginTop: '0.25rem',
                          }}
                        >
                          {strength.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Anticipated Questions & STAR Frameworks */}
                <div>
                  <h4
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      marginBottom: '0.5rem',
                      color: '#fbbf24',
                    }}
                  >
                    Anticipated Questions & Grounded STAR Frameworks
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {briefData.suggestedAnswerFrameworks.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid var(--surface-border)',
                          padding: '0.85rem',
                          borderRadius: '6px',
                        }}
                      >
                        <div
                          style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}
                        >
                          Q: {item.question}
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '0.5rem',
                            fontSize: '0.8rem',
                          }}
                        >
                          <div>
                            <strong style={{ color: '#93c5fd' }}>Situation:</strong>{' '}
                            {item.situation || 'To be framed live'}
                          </div>
                          <div>
                            <strong style={{ color: '#93c5fd' }}>Task:</strong>{' '}
                            {item.task || 'To be framed live'}
                          </div>
                          <div>
                            <strong style={{ color: '#34d399' }}>Action:</strong>{' '}
                            {item.action || 'To be framed live'}
                          </div>
                          <div>
                            <strong style={{ color: '#34d399' }}>Result:</strong>{' '}
                            {item.result || 'To be framed live'}
                          </div>
                        </div>
                        {item.sourceEvidenceId && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                              marginTop: '0.4rem',
                            }}
                          >
                            Grounded Evidence ID: {item.sourceEvidenceId}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preparation Checklist */}
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Preparation Checklist (
                    {briefData.preparationChecklist.filter((c) => c.isCompleted).length} /{' '}
                    {briefData.preparationChecklist.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {briefData.preparationChecklist.map((item: ChecklistItem, idx: number) => (
                      <label
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          background: 'rgba(15, 23, 42, 0.4)',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          border: '1px solid var(--surface-border)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={item.isCompleted}
                          onChange={() => handleToggleChecklist(idx)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span
                          style={{
                            fontSize: '0.85rem',
                            textDecoration: item.isCompleted ? 'line-through' : 'none',
                            color: item.isCompleted
                              ? 'var(--text-secondary)'
                              : 'var(--text-primary)',
                          }}
                        >
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Personal Human Notes */}
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Candidate Talking Points & Notes
                  </h4>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    value={humanNotes}
                    onChange={(e) => setHumanNotes(e.target.value)}
                    placeholder="Add your personal notes, questions to ask the interviewer, salary notes, etc."
                    style={{ width: '100%', marginBottom: '0.5rem' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                    >
                      {savingNotes ? 'Saving Notes...' : 'Save Notes'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>No brief generated.</p>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL 2: DEBRIEF MODAL ─────────────────────────────────────────── */}
      {debriefModalInterview && (
        <div className="modal-backdrop" onClick={() => setDebriefModalInterview(null)}>
          <div
            className="modal-dialog"
            style={{ maxWidth: '650px', width: '95%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid var(--surface-border)',
                paddingBottom: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  Post-Interview Debrief: {debriefModalInterview.interview.roundTitle}
                </h2>
                <div
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    marginTop: '0.25rem',
                  }}
                >
                  🏢 {debriefModalInterview.application.companyName}
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setDebriefModalInterview(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Questions Asked by Interviewer</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={debriefForm.questionsAsked}
                  onChange={(e) =>
                    setDebriefForm({ ...debriefForm, questionsAsked: e.target.value })
                  }
                  placeholder="What technical or behavioral questions did they ask?"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Topics Discussed & Highlights</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={debriefForm.topicsDiscussed}
                  onChange={(e) =>
                    setDebriefForm({ ...debriefForm, topicsDiscussed: e.target.value })
                  }
                  placeholder="Key project discussions, architecture topics, team dynamics..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Candidate Impressions / Observations</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={debriefForm.candidateObservations}
                  onChange={(e) =>
                    setDebriefForm({ ...debriefForm, candidateObservations: e.target.value })
                  }
                  placeholder="How did you feel it went? Positive signals, rapport with interviewers..."
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Follow-Up Commitments</label>
                  <input
                    type="text"
                    className="form-input"
                    value={debriefForm.followUpCommitments}
                    onChange={(e) =>
                      setDebriefForm({ ...debriefForm, followUpCommitments: e.target.value })
                    }
                    placeholder="e.g. Send GitHub repository link, thank you note"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Expected Response Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={debriefForm.expectedResponseDate || ''}
                    onChange={(e) =>
                      setDebriefForm({ ...debriefForm, expectedResponseDate: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Concerns or Flagged Items</label>
                <input
                  type="text"
                  className="form-input"
                  value={debriefForm.concerns}
                  onChange={(e) => setDebriefForm({ ...debriefForm, concerns: e.target.value })}
                  placeholder="Any hesitations, tricky questions, or red flags observed"
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.5rem',
                  marginTop: '1rem',
                }}
              >
                <button
                  className="btn btn-secondary"
                  onClick={() => setDebriefModalInterview(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveDebrief}
                  disabled={savingDebrief}
                >
                  {savingDebrief ? 'Saving Debrief...' : 'Save Debrief'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: BOOK / SYNC CALENDAR EVENT MODAL ───────────────────────── */}
      {bookingModalInterview && (
        <div className="modal-backdrop" onClick={() => setBookingModalInterview(null)}>
          <div
            className="modal-dialog"
            style={{ maxWidth: '550px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid var(--surface-border)',
                paddingBottom: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Sync Interview to Calendar</h2>
                <div
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    marginTop: '0.25rem',
                  }}
                >
                  {bookingModalInterview.interview.roundTitle} (
                  {bookingModalInterview.application.companyName})
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setBookingModalInterview(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Target Calendar</label>
                <select
                  className="form-input"
                  value={selectedCalendarId}
                  onChange={(e) => setSelectedCalendarId(e.target.value)}
                >
                  <option value="primary">Primary Calendar (Default)</option>
                  {accounts.flatMap((a) =>
                    a.selectedCalendarIds.map((cid) => (
                      <option key={cid} value={cid}>
                        {a.emailAddress} - {cid}
                      </option>
                    )),
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Timezone</label>
                <input
                  type="text"
                  className="form-input"
                  value={bookingTimezone}
                  onChange={(e) => setBookingTimezone(e.target.value)}
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={includePrepInEvent}
                  onChange={(e) => setIncludePrepInEvent(e.target.checked)}
                />
                Include company context and preparation summary in calendar event description
              </label>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.5rem',
                  marginTop: '1rem',
                }}
              >
                <button
                  className="btn btn-secondary"
                  onClick={() => setBookingModalInterview(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleConfirmCreateEvent}
                  disabled={bookingLoading}
                >
                  {bookingLoading ? 'Syncing...' : 'Sync to Calendar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
