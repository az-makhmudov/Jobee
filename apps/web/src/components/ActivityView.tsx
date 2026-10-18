import { useFeedback } from '../ui/Feedback.js';
import { Button, Card, Icon, Select, ModalSurface } from '../ui/Primitives.js';
import React, { useState, useEffect } from 'react';
import type {
  CandidateAuditEventDto,
  OrchestrationRunDto,
  SystemMetricsDto,
  OrchestrationTaskType,
} from '@job-agent/shared';
import { candidateApi } from '../api/candidate-client.js';
import { OrchestratorClient } from '../api/orchestrator-client.js';

export function ActivityView() {
  const { alert } = useFeedback();
  const [activeTab, setActiveTab] = useState<'orchestrator' | 'audit'>('orchestrator');

  // Candidate Audit State
  const [events, setEvents] = useState<CandidateAuditEventDto[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  // Orchestrator State
  const [runs, setRuns] = useState<OrchestrationRunDto[]>([]);
  const [metrics, setMetrics] = useState<SystemMetricsDto | null>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [loadingOrchestrator, setLoadingOrchestrator] = useState(false);
  const [triggeringTask, setTriggeringTask] = useState<OrchestrationTaskType>('PIPELINE_CYCLE');
  const [isTriggering, setIsTriggering] = useState(false);
  const [selectedRun, setSelectedRun] = useState<OrchestrationRunDto | null>(null);

  const loadAuditEvents = async () => {
    setLoadingAudit(true);
    try {
      const data = await candidateApi.getAuditEvents();
      setEvents(data);
    } catch {
      // silent
    } finally {
      setLoadingAudit(false);
    }
  };

  const loadOrchestratorData = async () => {
    setLoadingOrchestrator(true);
    try {
      const [runsData, metricsData, healthData] = await Promise.all([
        OrchestratorClient.listRuns({ limit: 15 }),
        OrchestratorClient.getMetrics(),
        OrchestratorClient.checkReady(),
      ]);
      setRuns(runsData.runs);
      setMetrics(metricsData);
      setSystemHealth(healthData);
    } catch {
      // silent
    } finally {
      setLoadingOrchestrator(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'orchestrator') {
      loadOrchestratorData();
    } else {
      loadAuditEvents();
    }
  }, [activeTab]);

  const handleTriggerRun = async () => {
    setIsTriggering(true);
    try {
      await OrchestratorClient.triggerRun({ taskType: triggeringTask, force: true });
      await loadOrchestratorData();
    } catch (err: any) {
      alert(`Failed to trigger run: ${err.message}`);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div>
      <header className="page-header" style={{ marginBottom: '1.25rem' }}>
        <h2 className="page-title">System activity</h2>
        <p className="page-subtitle">
          Autonomous pipeline orchestrator status, background execution logs, and privacy-preserving
          audit trail.
        </p>

        {/* Tab Selector */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }} className="layout-group">
          <Button
            className={`btn btn-sm ${activeTab === 'orchestrator' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('orchestrator')}
          >
            <Icon name="ai" size={20} /> Autonomous Orchestrator & Live Queue
          </Button>
          <Button
            className={`btn btn-sm ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('audit')}
          >
            <Icon name="permissions" /> Candidate Brain Audit Log
          </Button>
        </div>
      </header>

      {/* TAB 1: AUTONOMOUS ORCHESTRATOR */}
      {activeTab === 'orchestrator' && (
        <div>
          {/* Metrics & Quota Cards */}
          {metrics && (
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
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Auto-Apply Circuit Breaker
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginTop: '0.4rem',
                  }}
                  className="layout-group"
                >
                  <span
                    className={`status-badge ${metrics.autoApplyEnabled ? 'ok' : 'degraded'}`}
                    style={{ fontSize: '0.85rem' }}
                  >
                    {metrics.autoApplyEnabled ? 'ENABLED' : 'PAUSED (SAFE)'}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginTop: '0.4rem',
                  }}
                >
                  {metrics.autoApplyEnabled
                    ? 'Autonomous submissions authorized'
                    : 'Human review required'}
                </div>
              </Card>

              <Card className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Daily Submission Quota
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.25rem' }}>
                  {metrics.applicationsToday} / {metrics.maxApplicationsPerDay}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginTop: '0.2rem',
                  }}
                >
                  {metrics.dailyQuotaRemaining} slot(s) remaining today
                </div>
              </Card>

              <Card className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Funnel Intelligence
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.25rem' }}>
                  {metrics.totalJobsMatched} Matched / {metrics.totalJobsDiscovered} Discovered
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginTop: '0.2rem',
                  }}
                >
                  {metrics.totalApplicationsSubmitted} total application(s) submitted
                </div>
              </Card>

              <Card className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  System Readiness
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginTop: '0.4rem',
                  }}
                  className="layout-group"
                >
                  <span
                    className={`status-badge ${systemHealth?.status === 'ready' || systemHealth?.status === 'ok' ? 'ok' : 'degraded'}`}
                    style={{ fontSize: '0.85rem' }}
                  >
                    {systemHealth?.status?.toUpperCase() || 'ONLINE'}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginTop: '0.4rem',
                  }}
                >
                  {metrics.pendingApprovalsCount} pending approval(s),{' '}
                  {metrics.unreadNotificationsCount} alert(s)
                </div>
              </Card>
            </div>
          )}

          {/* Trigger Control Bar */}
          <Card
            className="card"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              marginBottom: '1.5rem',
              padding: '1rem 1.25rem',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                On-Demand Orchestration Trigger
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Execute a controlled autonomous cycle or target an individual pipeline task.
              </div>
            </div>

            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
              className="layout-group"
            >
              <Select
                className="input-select"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                value={triggeringTask}
                onChange={(e) => setTriggeringTask(e.target.value as OrchestrationTaskType)}
                disabled={isTriggering}
              >
                <option value="PIPELINE_CYCLE">Full Autonomous Pipeline Cycle</option>
                <option value="DISCOVERY">Discovery & Opportunity Ingestion</option>
                <option value="MATCHING">Requirement Matching & Policy Check</option>
                <option value="PREPARATION">Application Package Preparation</option>
                <option value="AUTO_APPLY">Controlled Auto-Apply Evaluation</option>
                <option value="EMAIL_SYNC">Email Message Synchronization</option>
                <option value="REMINDERS">Approval & Interview Reminders</option>
              </Select>

              <Button
                className="btn btn-primary btn-sm"
                onClick={handleTriggerRun}
                disabled={isTriggering}
              >
                {isTriggering ? 'Triggering...' : '▶ Run Task Now'}
              </Button>

              <Button
                className="btn btn-secondary btn-sm"
                onClick={loadOrchestratorData}
                disabled={loadingOrchestrator}
              >
                {loadingOrchestrator ? (
                  'Refreshing...'
                ) : (
                  <>
                    <Icon name="sync" size={20} /> Refresh
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Orchestration Runs Table */}
          <Card className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--surface-border)',
                fontWeight: 600,
              }}
            >
              Recent Orchestration Runs
            </div>

            {runs.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No background orchestration runs executed yet. Trigger a run above or start the
                worker heartbeat.
              </div>
            ) : (
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.85rem',
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: 'var(--m3-surface-container-low)',
                      borderBottom: '1px solid var(--surface-border)',
                    }}
                  >
                    <th style={{ padding: '0.75rem 1rem' }}>Task Type</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Trigger</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Items Processed</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Started At</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--m3-outline-variant)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{r.taskType}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                        {r.trigger}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          className={`status-badge ${
                            r.status === 'COMPLETED'
                              ? 'ok'
                              : r.status === 'FAILED'
                                ? 'error'
                                : r.status === 'RUNNING'
                                  ? 'degraded'
                                  : 'neutral'
                          }`}
                          style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem' }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {r.itemsSucceededCount} succeeded / {r.itemsProcessedCount} processed
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                        {r.startedAt
                          ? new Date(r.startedAt).toLocaleTimeString()
                          : new Date(r.createdAt).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <Button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => setSelectedRun(r)}
                        >
                          Inspect Trace ({r.stepLogs?.length || 0})
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: CANDIDATE BRAIN AUDIT LOG */}
      {activeTab === 'audit' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <Button
              className="btn btn-secondary btn-sm"
              onClick={loadAuditEvents}
              disabled={loadingAudit}
            >
              {loadingAudit ? 'Refreshing...' : 'Refresh Log'}
            </Button>
          </div>

          {events.length === 0 ? (
            <Card className="card placeholder-view">
              <h3>No Audit Events Yet</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Actions performed on the Candidate Brain will be recorded here with changed field
                names and safe operational metadata.
              </p>
            </Card>
          ) : (
            <Card className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                      backgroundColor: 'var(--m3-surface-container-low)',
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
                        <tr style={{ borderBottom: '1px solid var(--m3-outline-variant)' }}>
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
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                            {ev.entityType}
                          </td>
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
                              <div
                                style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}
                                className="layout-group"
                              >
                                {ev.changedFields.map((field) => (
                                  <span
                                    key={field}
                                    style={{
                                      backgroundColor: 'var(--m3-secondary-container)',
                                      color: 'var(--m3-on-surface)',
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
                              <Button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                onClick={() =>
                                  setExpandedAuditId(expandedAuditId === ev.id ? null : ev.id)
                                }
                              >
                                {expandedAuditId === ev.id ? 'Hide' : 'Inspect'}
                              </Button>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                None
                              </span>
                            )}
                          </td>
                        </tr>

                        {expandedAuditId === ev.id && hasMetadata && (
                          <tr style={{ backgroundColor: 'var(--m3-surface-container-low)' }}>
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
                                    backgroundColor: 'var(--m3-surface-container-low)',
                                    padding: '0.75rem',
                                    borderRadius: '16px',
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
            </Card>
          )}
        </div>
      )}

      {/* STEP LOGS AUDIT TRAIL MODAL */}
      {selectedRun && (
        <ModalSurface
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'color-mix(in srgb,var(--m3-scrim) 48%,transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
          onClick={() => setSelectedRun(null)}
          className="modal-backdrop"
        >
          <Card
            className="card"
            style={{
              width: '100%',
              maxWidth: '850px',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                  Orchestrator Run Trace: {selectedRun.taskType}
                </h3>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    marginTop: '0.2rem',
                  }}
                >
                  Run ID: {selectedRun.id} • Status: {selectedRun.status}
                </div>
              </div>
              <Button className="btn btn-secondary btn-sm" onClick={() => setSelectedRun(null)}>
                <Icon name="close" size={20} /> Close
              </Button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              {selectedRun.stepLogs && selectedRun.stepLogs.length > 0 ? (
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                  className="layout-group"
                >
                  {selectedRun.stepLogs.map((log, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: 'var(--m3-surface-container-low)',
                        borderRadius: '16px',
                        borderLeft: `3px solid ${
                          log.stage === 'FINISH'
                            ? 'var(--status-success-border)'
                            : log.stage === 'FATAL'
                              ? 'var(--status-danger-border)'
                              : log.stage === 'AUTO_APPLY'
                                ? 'var(--status-warning-border)'
                                : 'var(--m3-outline-variant)'
                        }`,
                        fontSize: '0.85rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '0.25rem',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--m3-on-surface)' }}>
                          [{log.stage}]
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-primary)' }}>{log.message}</div>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <pre
                          style={{
                            marginTop: '0.5rem',
                            backgroundColor: 'var(--m3-surface-container-low)',
                            padding: '0.5rem',
                            borderRadius: '16px',
                            fontSize: '0.75rem',
                            overflowX: 'auto',
                            margin: 0,
                          }}
                        >
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}
                >
                  No step logs recorded for this run.
                </div>
              )}
            </div>
          </Card>
        </ModalSurface>
      )}
    </div>
  );
}
