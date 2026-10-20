import { applicationStatusStyle } from '../ui/status.js';
import { initialApplicationView } from '../ui/student-experience.js';
import { useFeedback } from '../ui/Feedback.js';
import { Button, Card, Icon, Input, ModalSurface, Select, Textarea } from '../ui/Primitives.js';
import { useState, useEffect } from 'react';
import { ApplicationCrmClient } from '../api/application-crm-client.js';
import { jobApi } from '../api/job-client.js';
import { ApplicationAnalyticsModal } from './ApplicationAnalyticsModal.js';
import {
  ApplicationLifecycleStatus,
  SubmissionMethod,
  type ApplicationSummaryDto,
  type ApplicationCrmMetricsDto,
  type JobSummaryDto,
} from '@job-agent/shared';

interface Props {
  onSelectApplication: (id: string) => void;
  onOpenStudio?: (packageId: string) => void;
  onNavigateToStudioList?: () => void;
}

export function formatStatusLabel(status: string): string {
  switch (status) {
    case 'DISCOVERED':
      return 'Discovered';
    case 'ANALYZED':
      return 'Analyzed';
    case 'MATCHED':
      return 'Matched';
    case 'SKIPPED':
      return 'Skipped';
    case 'READY_TO_APPLY':
      return 'Ready to Apply';
    case 'NEEDS_REVIEW':
      return 'Needs Review';
    case 'APPLYING':
      return 'Applying';
    case 'APPLIED':
      return 'Applied';
    case 'CONFIRMATION_RECEIVED':
      return 'Confirmation Received';
    case 'SCREENING':
      return 'Screening';
    case 'ASSESSMENT':
      return 'Assessment';
    case 'INTERVIEW':
      return 'Interview';
    case 'FINAL_INTERVIEW':
      return 'Final Interview';
    case 'OFFER':
      return 'Offer';
    case 'REJECTED':
      return 'Rejected';
    case 'WITHDRAWN':
      return 'Withdrawn';
    case 'EXPIRED':
      return 'Expired';
    default:
      return status;
  }
}

export function ApplicationsCrmView({
  onSelectApplication,
  onOpenStudio,
  onNavigateToStudioList,
}: Props) {
  const { alert } = useFeedback();
  const [viewMode, setViewMode] = useState<'board' | 'list'>(initialApplicationView);
  useEffect(() => {
    try {
      localStorage.setItem('jobee.applications.view', viewMode);
    } catch {
      // The view still works when browser storage is unavailable.
    }
  }, [viewMode]);
  const [applications, setApplications] = useState<ApplicationSummaryDto[]>([]);
  const [metrics, setMetrics] = useState<ApplicationCrmMetricsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [onlyFollowUps, setOnlyFollowUps] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Modals
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showQuickMarkModal, setShowQuickMarkModal] = useState<string | null>(null);

  // Record application state
  const [availableJobs, setAvailableJobs] = useState<JobSummaryDto[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [manualAppliedDate, setManualAppliedDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualMethod, setManualMethod] = useState<string>('COMPANY_SITE');
  const [manualRef, setManualRef] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  // Quick mark applied state
  const [quickMethod, setQuickMethod] = useState<string>('COMPANY_SITE');
  const [quickRef, setQuickRef] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [appsResult, metricsResult] = await Promise.all([
        ApplicationCrmClient.listApplications({
          search: search || undefined,
          status: statusFilter || undefined,
          source: sourceFilter || undefined,
          hasFollowUp: onlyFollowUps ? true : undefined,
          isArchived: showArchived ? true : undefined,
          limit: 100,
        }),
        ApplicationCrmClient.getMetrics(),
      ]);

      setApplications(appsResult.items);
      setMetrics(metricsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter, sourceFilter, onlyFollowUps, showArchived]);

  const loadJobsForRecordModal = async () => {
    try {
      const res = await jobApi.getJobs({ limit: 100 });
      setAvailableJobs(res.items);
      if (res.items.length > 0 && !selectedJobId) {
        setSelectedJobId(res.items[0].id);
      }
    } catch (err) {
      console.error('Failed to load jobs', err);
    }
  };

  const handleOpenRecordModal = () => {
    loadJobsForRecordModal();
    setShowRecordModal(true);
  };

  const handleRecordApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId) return;
    try {
      const res = await ApplicationCrmClient.createApplication({
        jobId: selectedJobId,
        status: ApplicationLifecycleStatus.APPLIED,
        appliedAt: new Date(manualAppliedDate).toISOString(),
        submissionMethod: manualMethod,
        externalReferenceId: manualRef || undefined,
        applicationUrl: manualUrl || undefined,
        notes: manualNotes || undefined,
      });
      setShowRecordModal(false);
      await loadData();
      onSelectApplication(res.application.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleQuickMarkApplied = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showQuickMarkModal) return;
    try {
      await ApplicationCrmClient.markApplied(showQuickMarkModal, {
        submissionMethod: quickMethod,
        externalReferenceId: quickRef || undefined,
      });
      setShowQuickMarkModal(null);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  // Grouping for Kanban Board covering all 17 canonical statuses
  const boardColumns = [
    {
      id: 'pre_apply',
      title: 'Preparing',
      color: 'var(--m3-on-surface)',
      filter: (app: ApplicationSummaryDto) =>
        app.status === 'DISCOVERED' ||
        app.status === 'ANALYZED' ||
        app.status === 'MATCHED' ||
        app.status === 'NEEDS_REVIEW' ||
        app.status === 'READY_TO_APPLY' ||
        app.status === 'APPLYING',
    },
    {
      id: 'applied',
      title: 'Applied',
      color: 'var(--status-success)',
      filter: (app: ApplicationSummaryDto) =>
        app.status === 'APPLIED' || app.status === 'CONFIRMATION_RECEIVED',
    },
    {
      id: 'screening',
      title: 'Screening & Tests',
      color: 'var(--status-warning)',
      filter: (app: ApplicationSummaryDto) =>
        app.status === 'SCREENING' || app.status === 'ASSESSMENT',
    },
    {
      id: 'interviews',
      title: 'Interviews',
      color: 'var(--m3-on-surface)',
      filter: (app: ApplicationSummaryDto) =>
        app.status === 'INTERVIEW' || app.status === 'FINAL_INTERVIEW',
    },
    {
      id: 'offers',
      title: 'Offers',
      color: 'var(--status-success)',
      filter: (app: ApplicationSummaryDto) => app.status === 'OFFER',
    },
    {
      id: 'closed',
      title: 'Outcome / Closed',
      color: 'var(--m3-on-surface-variant)',
      filter: (app: ApplicationSummaryDto) =>
        app.status === 'REJECTED' ||
        app.status === 'WITHDRAWN' ||
        app.status === 'EXPIRED' ||
        app.status === 'SKIPPED',
    },
  ];

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}
      className="layout-group"
    >
      {/* Header & Main Actions */}
      <header className="page-header" style={{ marginBottom: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
          className="layout-group"
        >
          <div>
            <h2 className="card-title">Your applications</h2>
            <p className="page-subtitle">Role, company, current status and next step.</p>
          </div>
        </div>
      </header>
      {/* Filter and View Mode Toolbar */}
      <Card
        className="card crm-filters"
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div
          style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}
          className="layout-group"
        >
          <Input
            type="text"
            className="input"
            aria-label="Search applications"
            placeholder="Search company or title..."
            style={{ minWidth: '220px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <details className="advanced-details">
            <summary>
              Filters
              {statusFilter || sourceFilter || onlyFollowUps || showArchived ? ' · active' : ''}
            </summary>
            <div className="account-actions">
              <Select
                className="input"
                aria-label="Application status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                {Object.values(ApplicationLifecycleStatus).map((s) => (
                  <option key={s} value={s}>
                    {formatStatusLabel(s)}
                  </option>
                ))}
              </Select>

              <Select
                className="input"
                aria-label="Application source"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <option value="">All Sources</option>
                {Object.values(SubmissionMethod).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <Input
                  type="checkbox"
                  checked={onlyFollowUps}
                  onChange={(e) => setOnlyFollowUps(e.target.checked)}
                />
                <Icon name="schedule" size={20} /> Follow-ups Due
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <Input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                <Icon name="folder" size={20} /> Show Archived
              </label>
            </div>
          </details>
        </div>

        {/* View Switcher Toggle */}
        <div
          style={{
            display: 'flex',
            gap: '0.25rem',
            background: 'var(--bg-secondary)',
            padding: '2px',
            borderRadius: '16px',
          }}
          className="layout-group"
        >
          <Button
            className={`btn btn-sm ${viewMode === 'board' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '0.25rem 0.6rem' }}
            aria-pressed={viewMode === 'board'}
            onClick={() => setViewMode('board')}
          >
            <Icon name="board" /> Board
          </Button>
          <Button
            className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '0.25rem 0.6rem' }}
            aria-pressed={viewMode === 'list'}
            onClick={() => setViewMode('list')}
          >
            <Icon name="list" size={20} /> List
          </Button>
        </div>
      </Card>

      {error && <div className="banner banner-error">{error}</div>}

      {/* Main Content: Kanban Board or List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" />
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
            Loading applications CRM...
          </p>
        </div>
      ) : applications.length === 0 ? (
        <Card className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <h3>No applications tracked yet</h3>
          <p
            style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '1.5rem' }}
          >
            Prepare an application package in Studio, or record an existing application.
          </p>
          <Button className="btn btn-primary" onClick={handleOpenRecordModal}>
            <Icon name="edit" /> Record application
          </Button>
        </Card>
      ) : viewMode === 'board' ? (
        /* KANBAN STAGE BOARD VIEW */
        <div
          className="application-board"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, minmax(152px, 1fr))',
            gap: '1rem',
            alignItems: 'start',
          }}
        >
          {boardColumns.map((col) => {
            const colApps = applications.filter(col.filter);

            return (
              <div
                key={col.id}
                style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: '16px',
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  minHeight: '280px',
                }}
                className="layout-group"
              >
                {/* Column Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: '0.5rem',
                    borderBottom: '2px solid',
                    borderColor: col.color,
                  }}
                >
                  <strong style={{ fontSize: '0.9rem' }}>{col.title}</strong>
                  <span
                    style={{
                      background: 'var(--bg-card)',
                      padding: '0.1rem 0.5rem',
                      borderRadius: '10px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {colApps.length}
                  </span>
                </div>

                {/* Cards List */}
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                  className="layout-group"
                >
                  {colApps.map((app) => (
                    <Card
                      key={app.id}
                      className="card"
                      style={{
                        padding: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                      onClick={() => onSelectApplication(app.id)}
                    >
                      {/* Card Header */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{app.jobTitle}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {app.company}
                          </div>
                        </div>
                        {app.matchScore !== null && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: 'var(--color-primary)',
                              background: 'var(--bg-secondary)',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '16px',
                            }}
                          >
                            {app.matchScore}%
                          </span>
                        )}
                      </div>

                      {/* Status & Overdue Badges */}
                      <div
                        style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}
                        className="layout-group"
                      >
                        <span
                          style={{
                            ...applicationStatusStyle(app.status),
                            fontSize: '0.7rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '16px',
                            fontWeight: 600,
                          }}
                        >
                          {formatStatusLabel(app.status)}
                        </span>
                        {app.isArchived && (
                          <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                            <Icon name="folder" size={20} /> Archived
                          </span>
                        )}
                        {app.isFollowUpOverdue && (
                          <span className="badge badge-error" style={{ fontSize: '0.7rem' }}>
                            <Icon name="warning" /> Overdue
                          </span>
                        )}
                        {app.isFollowUpDue && !app.isFollowUpOverdue && (
                          <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                            <Icon name="schedule" size={20} /> Due Today
                          </span>
                        )}
                      </div>

                      {/* Next Action preview */}
                      {app.nextAction && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            background: 'var(--bg-secondary)',
                            padding: '0.35rem 0.5rem',
                            borderRadius: '16px',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <Icon name="schedule" size={20} /> {app.nextAction}
                        </div>
                      )}

                      {/* Card Footer */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          marginTop: '0.25rem',
                          paddingTop: '0.4rem',
                          borderTop: '1px solid var(--border-color)',
                        }}
                      >
                        <span>
                          {app.appliedAt
                            ? `Applied ${new Date(app.appliedAt).toLocaleDateString()}`
                            : 'Not submitted'}
                        </span>

                        {/* Quick Mark Applied button on ready cards */}
                        <div
                          style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}
                          className="layout-group"
                        >
                          {app.packageId && onOpenStudio && (
                            <Button
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenStudio(app.packageId!);
                              }}
                              title="Open Studio Package"
                            >
                              Studio
                            </Button>
                          )}
                          {app.status === 'READY_TO_APPLY' && (
                            <Button
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowQuickMarkModal(app.id);
                              }}
                            >
                              Mark Applied
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}

                  {colApps.length === 0 && (
                    <div
                      style={{
                        textAlign: 'center',
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        padding: '1.5rem 0',
                      }}
                    >
                      No applications
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div className="student-stack">
          <Card className="application-list">
            {applications.map((app) => (
              <div className="action-row" key={app.id}>
                <div>
                  <strong>
                    {app.jobTitle} · {app.company}
                  </strong>
                  <p>
                    <span style={applicationStatusStyle(app.status)}>
                      {formatStatusLabel(app.status)}
                    </span>
                    {app.appliedAt
                      ? ` · Submission recorded ${new Date(app.appliedAt).toLocaleDateString()}`
                      : ' · No submission date recorded'}
                    {app.nextAction ? ` · ${app.nextAction}` : ''}
                  </p>
                  {(app.isFollowUpDue || app.isFollowUpOverdue) && (
                    <p className="follow-up-notice">
                      {app.isFollowUpOverdue ? 'Follow-up overdue' : 'Follow-up due today'}
                    </p>
                  )}
                  {app.isArchived && <p>Archived</p>}
                </div>
                <Button className="btn-outline" onClick={() => onSelectApplication(app.id)}>
                  Open application
                </Button>
              </div>
            ))}
          </Card>
          <details className="student-tools">
            <summary>Detailed table</summary>
            <Card className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Job Title & Company</th>
                    <th>Status</th>
                    <th>Match Fit</th>
                    <th>Applied Date</th>
                    <th>Next Action</th>
                    <th>Follow-up</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr
                      key={app.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onSelectApplication(app.id)}
                    >
                      <td>
                        <strong>{app.jobTitle}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {app.company} {app.location ? `• ${app.location}` : ''}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            ...applicationStatusStyle(app.status),
                            fontSize: '0.75rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '16px',
                            fontWeight: 600,
                          }}
                        >
                          {formatStatusLabel(app.status)}
                        </span>
                        {app.isArchived && (
                          <span
                            className="badge badge-secondary"
                            style={{ marginLeft: '0.35rem', fontSize: '0.7rem' }}
                          >
                            <Icon name="folder" size={20} /> Archived
                          </span>
                        )}
                      </td>
                      <td>
                        {app.matchScore !== null ? (
                          <strong>{app.matchScore}%</strong>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {app.appliedAt ? (
                          new Date(app.appliedAt).toLocaleDateString()
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {app.nextAction ? (
                          <span>{app.nextAction}</span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {app.followUpAt ? (
                          <div>
                            <span>{new Date(app.followUpAt).toLocaleDateString()}</span>
                            {app.isFollowUpOverdue && (
                              <div
                                style={{
                                  color: 'var(--status-danger)',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                }}
                              >
                                Overdue
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem' }} className="layout-group">
                          {app.packageId && onOpenStudio && (
                            <Button
                              className="btn btn-secondary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenStudio(app.packageId!);
                              }}
                              title="Open Studio Package"
                            >
                              Studio
                            </Button>
                          )}
                          <Button
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectApplication(app.id);
                            }}
                          >
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </details>
        </div>
      )}

      <details className="student-tools">
        <summary>More tools · filters, analytics & recording</summary>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }} className="layout-group">
          <Button className="btn btn-secondary" onClick={() => setShowAnalyticsModal(true)}>
            <Icon name="activity" /> Analytics
          </Button>
          <Button className="btn btn-outline" onClick={handleOpenRecordModal}>
            <Icon name="edit" /> Record application
          </Button>
          {onNavigateToStudioList && (
            <Button className="btn btn-outline" onClick={onNavigateToStudioList}>
              <Icon name="document" /> Prepared materials
            </Button>
          )}
        </div>

        {/* Metrics KPI Ribbon */}
        {metrics && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.75rem',
              marginTop: '1.25rem',
            }}
            className="layout-group"
          >
            <Card className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tracked</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{metrics.totalTracked}</div>
            </Card>
            <Card className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ready</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--m3-on-surface)' }}>
                {metrics.readyToApply}
              </div>
            </Card>
            <Card className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Applied</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--status-success)' }}>
                {metrics.applied}
              </div>
            </Card>
            <Card className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Active</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--status-warning)' }}>
                {metrics.activeProcesses}
              </div>
            </Card>
            <Card className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Interviews</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--m3-on-surface)' }}>
                {metrics.interviews}
              </div>
            </Card>
            <Card className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Offers</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--status-success)' }}>
                {metrics.offers}
              </div>
            </Card>
            <Card className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Follow-ups</div>
              <div
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  color:
                    metrics.overdueFollowUps > 0 ? 'var(--status-danger)' : 'var(--text-primary)',
                }}
              >
                {metrics.pendingFollowUps + metrics.overdueFollowUps}
                {metrics.overdueFollowUps > 0 && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--status-danger)',
                      marginLeft: '0.25rem',
                    }}
                  >
                    ({metrics.overdueFollowUps} overdue)
                  </span>
                )}
              </div>
            </Card>
          </div>
        )}
      </details>

      {/* Analytics Modal */}
      <ApplicationAnalyticsModal
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
      />

      {/* Record application Modal */}
      {showRecordModal && (
        <ModalSurface className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '550px' }}>
            <header className="modal-header">
              <h2 className="modal-title">Record application</h2>
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowRecordModal(false)}
                aria-label="Close"
              >
                <Icon name="close" size={20} />
              </Button>
            </header>
            <form
              onSubmit={handleRecordApplication}
              className="modal-body"
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div>
                <label className="label">Target Job Listing (Required)</label>
                <Select
                  className="input"
                  required
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                >
                  {availableJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} at {j.company} ({j.state})
                    </option>
                  ))}
                </Select>
              </div>

              <div
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}
                className="layout-group"
              >
                <div>
                  <label className="label">Date Applied</label>
                  <Input
                    type="date"
                    className="input"
                    required
                    value={manualAppliedDate}
                    onChange={(e) => setManualAppliedDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Submission Method</label>
                  <Select
                    className="input"
                    value={manualMethod}
                    onChange={(e) => setManualMethod(e.target.value)}
                  >
                    {Object.values(SubmissionMethod).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <label className="label">External Confirmation / Reference ID</label>
                <Input
                  type="text"
                  className="input"
                  placeholder="e.g. APPL-2026-99"
                  value={manualRef}
                  onChange={(e) => setManualRef(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Application Portal URL</label>
                <Input
                  type="url"
                  className="input"
                  placeholder="https://..."
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Submission Notes</label>
                <Textarea
                  className="input"
                  rows={2}
                  placeholder="Notes about where/how you applied..."
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                />
              </div>

              <footer
                className="modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}
              >
                <Button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRecordModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="btn btn-primary">
                  Record Application
                </Button>
              </footer>
            </form>
          </div>
        </ModalSurface>
      )}

      {/* Quick Mark Applied Modal */}
      {showQuickMarkModal && (
        <ModalSurface className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '450px' }}>
            <header className="modal-header">
              <h2 className="modal-title">Mark as Applied</h2>
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowQuickMarkModal(null)}
                aria-label="Close"
              >
                <Icon name="close" size={20} />
              </Button>
            </header>
            <form
              onSubmit={handleQuickMarkApplied}
              className="modal-body"
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div>
                <label className="label">Submission Method / Platform</label>
                <Select
                  className="input"
                  value={quickMethod}
                  onChange={(e) => setQuickMethod(e.target.value)}
                >
                  {Object.values(SubmissionMethod).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="label">External Reference ID (Optional)</label>
                <Input
                  type="text"
                  className="input"
                  placeholder="Confirmation code or ID"
                  value={quickRef}
                  onChange={(e) => setQuickRef(e.target.value)}
                />
              </div>

              <footer
                className="modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}
              >
                <Button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowQuickMarkModal(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="btn btn-primary">
                  Confirm Applied
                </Button>
              </footer>
            </form>
          </div>
        </ModalSurface>
      )}
    </div>
  );
}
