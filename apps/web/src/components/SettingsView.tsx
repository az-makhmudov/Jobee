import { useState, useEffect } from 'react';

interface HealthData {
  status: string;
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
}

interface ReadyData {
  status: string;
  service: string;
  checks: {
    database: {
      status: string;
      latencyMs?: number;
      message?: string;
    };
    ai?: {
      provider: string;
      isConfigured: boolean;
      model: string;
      mode: 'deterministic' | 'llm';
    };
    integrations?: {
      gmail: { isConfigured: boolean };
      googleCalendar: { isConfigured: boolean };
    };
  };
}

export function SettingsView() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [ready, setReady] = useState<ReadyData | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';

  const checkConnectivity = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [healthRes, readyRes] = await Promise.all([
        fetch(`${apiBaseUrl}/health`),
        fetch(`${apiBaseUrl}/ready`),
      ]);

      if (healthRes.ok) {
        const healthJson = await healthRes.json();
        setHealth(healthJson);
      } else {
        setApiError(`API health returned status ${healthRes.status}`);
      }

      if (readyRes.ok || readyRes.status === 503) {
        const readyJson = await readyRes.json();
        setReady(readyJson);
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to reach API server');
      setHealth(null);
      setReady(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConnectivity();
  }, []);

  const aiChecks = ready?.checks?.ai;
  const intChecks = ready?.checks?.integrations;

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Platform Settings & Connectivity</h1>
        <p className="page-subtitle">
          Core runtime configuration, intelligence engines, external integrations, and security
          boundaries
        </p>
      </header>

      {/* System Health & Readiness */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <div className="card-title" style={{ marginBottom: 0 }}>
            System Health & Infrastructure
          </div>
          <button className="btn btn-primary btn-sm" onClick={checkConnectivity} disabled={loading}>
            {loading ? 'Probing...' : 'Re-probe Services'}
          </button>
        </div>

        {apiError ? (
          <div className="status-item">
            <div className="status-item-header">
              <span className="status-item-label">API Connectivity</span>
              <span className="status-badge error">Offline</span>
            </div>
            <div className="status-item-meta">{apiError}</div>
          </div>
        ) : (
          <div className="status-grid">
            <div className="status-item">
              <div className="status-item-header">
                <span className="status-item-label">Backend API Process</span>
                <span className={`status-badge ${health?.status === 'ok' ? 'ok' : 'degraded'}`}>
                  {health?.status ? health.status.toUpperCase() : 'Checking...'}
                </span>
              </div>
              <div className="status-item-meta">
                Service: {health?.service || 'api'} | Version: {health?.version || '0.1.0'}
              </div>
              {health?.uptimeSeconds !== undefined && (
                <div className="status-item-meta">Uptime: {health.uptimeSeconds}s</div>
              )}
            </div>

            <div className="status-item">
              <div className="status-item-header">
                <span className="status-item-label">PostgreSQL Database Readiness</span>
                <span
                  className={`status-badge ${ready?.checks?.database?.status || 'unconfigured'}`}
                >
                  {ready?.checks?.database?.status || 'Unconfigured'}
                </span>
              </div>
              <div className="status-item-meta">Storage: PostgreSQL / Drizzle ORM</div>
              {ready?.checks?.database?.latencyMs !== undefined && (
                <div className="status-item-meta">Latency: {ready.checks.database.latencyMs}ms</div>
              )}
              {ready?.checks?.database?.message && (
                <div className="status-item-meta">Note: {ready.checks.database.message}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI Intelligence Engine */}
      <div className="card">
        <div className="card-title">AI Intelligence Engine</div>
        <div className="status-grid">
          <div className="status-item">
            <div className="status-item-header">
              <span className="status-item-label">Operating Mode</span>
              <span className={`status-badge ${aiChecks?.isConfigured ? 'ok' : 'connected'}`}>
                {aiChecks?.isConfigured ? 'LLM AUGMENTED' : 'DETERMINISTIC GROUNDED'}
              </span>
            </div>
            <div className="status-item-meta">
              Provider: <strong>{aiChecks?.provider || 'disabled'}</strong> | Model:{' '}
              <code>{aiChecks?.model || 'none'}</code>
            </div>
            <div
              style={{
                marginTop: '0.5rem',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
              }}
            >
              {aiChecks?.isConfigured
                ? 'Gemini LLM enabled for semantic reasoning, match extraction, and drafting. All outputs are strictly validated against verified candidate facts.'
                : '100% deterministic rule-based matching. Zero external AI API calls. Zero hallucination risk.'}
            </div>
          </div>

          <div className="status-item">
            <div className="status-item-header">
              <span className="status-item-label">Truthfulness & Fact Safety</span>
              <span className="status-badge ok">ENFORCED</span>
            </div>
            <div className="status-item-meta">Invariant: Zero Candidate Fact Fabrication</div>
            <div
              style={{
                marginTop: '0.5rem',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
              }}
            >
              Candidate Brain acts as the immutable ground truth. Facts marked unverified are
              strictly quarantined from AI prompts and application answers.
            </div>
          </div>
        </div>
      </div>

      {/* External Communications & OAuth Integrations */}
      <div className="card">
        <div className="card-title">Communications & Calendar Integrations</div>
        <div className="status-grid">
          <div className="status-item">
            <div className="status-item-header">
              <span className="status-item-label">Gmail OAuth Integration</span>
              <span
                className={`status-badge ${intChecks?.gmail?.isConfigured ? 'ok' : 'unconfigured'}`}
              >
                {intChecks?.gmail?.isConfigured ? 'CONFIGURED' : 'PENDING CREDENTIALS'}
              </span>
            </div>
            <div className="status-item-meta">Protocol: OAuth 2.0 PKCE / Restricted Scope</div>
            <div
              style={{
                marginTop: '0.5rem',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
              }}
            >
              {intChecks?.gmail?.isConfigured
                ? 'Google Client credentials configured. Live mailbox sync and recruiter thread tracking active.'
                : 'Requires GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET. Local FixtureEmailProvider active for offline testing.'}
            </div>
          </div>

          <div className="status-item">
            <div className="status-item-header">
              <span className="status-item-label">Google Calendar Integration</span>
              <span
                className={`status-badge ${
                  intChecks?.googleCalendar?.isConfigured ? 'ok' : 'unconfigured'
                }`}
              >
                {intChecks?.googleCalendar?.isConfigured ? 'CONFIGURED' : 'PENDING CREDENTIALS'}
              </span>
            </div>
            <div className="status-item-meta">Protocol: Google Calendar API v3 / FreeBusy</div>
            <div
              style={{
                marginTop: '0.5rem',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
              }}
            >
              {intChecks?.googleCalendar?.isConfigured
                ? 'Google Calendar credentials configured. Interview scheduling and conflict detection active.'
                : 'Requires GOOGLE_CALENDAR_CLIENT_ID and secret. Local FixtureCalendarProvider active for offline testing.'}
            </div>
          </div>
        </div>
      </div>

      {/* Application Automation & Browser ATS Worker */}
      <div className="card">
        <div className="card-title">Application Automation & Browser ATS Worker</div>
        <div className="status-grid">
          <div className="status-item">
            <div className="status-item-header">
              <span className="status-item-label">Playwright Browser Worker</span>
              <span className="status-badge connected">SUPERVISED DRY-RUN</span>
            </div>
            <div className="status-item-meta">Supported ATS: Greenhouse, Lever, Workday</div>
            <div
              style={{
                marginTop: '0.5rem',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
              }}
            >
              Form introspection and field mapping execute in dry-run mode. Final application
              submission requires explicit deterministic user authorization.
            </div>
          </div>

          <div className="status-item">
            <div className="status-item-header">
              <span className="status-item-label">Cryptographic Token Envelopes</span>
              <span className="status-badge ok">SECURE</span>
            </div>
            <div className="status-item-meta">Algorithm: AES-256-GCM + PBKDF2 Nonce</div>
            <div
              style={{
                marginTop: '0.5rem',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
              }}
            >
              All external OAuth tokens and refresh tokens are encrypted at rest with verified
              entropy keys before persisting to PostgreSQL.
            </div>
          </div>
        </div>
      </div>

      {/* Identity & Security Model */}
      <div className="card">
        <div className="card-title">Identity & Security Model</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
          <p>
            <strong>Deterministic Single-User Mode:</strong> Jobee currently executes in single-user
            personal mode. All candidate data is attached to the deterministic primary candidate
            identity:
          </p>
          <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
            <li>
              <code>System Key</code>: <code>default_primary_candidate</code>
            </li>
            <li>
              <code>Deterministic UUID</code>: <code>00000000-0000-0000-0000-000000000001</code>
            </li>
            <li>
              <code>Storage Sandboxing</code>: Document files are persisted locally in{' '}
              <code>uploads/</code> and excluded from version control.
            </li>
            <li>
              <code>Security Posture</code>: Auto-apply is disabled by default; generative AI
              operates strictly on explicitly stored and verified candidate facts.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
