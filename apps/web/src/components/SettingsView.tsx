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

interface AiProviderInfo {
  id: string;
  name: string;
  recommendedModel: string;
  description: string;
  credentialEnv: string;
  isConfigured: boolean;
}

interface AiSettingsData {
  activeProvider: string;
  activeModel: string;
  isAvailable: boolean;
  mode: 'deterministic' | 'llm';
  credentialsDetected: {
    gemini: boolean;
    openai: boolean;
  };
  supportedProviders: AiProviderInfo[];
  availableModels: string[];
}

export function SettingsView() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [ready, setReady] = useState<ReadyData | null>(null);
  const [aiSettings, setAiSettings] = useState<AiSettingsData | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [testingAi, setTestingAi] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    provider?: string;
  } | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  const [savingAi, setSavingAi] = useState<boolean>(false);
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';

  const checkConnectivity = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [healthRes, readyRes, aiRes] = await Promise.all([
        fetch(`${apiBaseUrl}/health`, { credentials: 'include' }),
        fetch(`${apiBaseUrl}/ready`, { credentials: 'include' }),
        fetch(`${apiBaseUrl}/settings/ai`, { credentials: 'include' }),
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

      if (aiRes.ok) {
        const aiJson = await aiRes.json();
        setAiSettings(aiJson.data);
        if (aiJson.data?.activeProvider) {
          setSelectedProviderId(aiJson.data.activeProvider);
        }
        if (aiJson.data?.activeModel && aiJson.data.activeModel !== 'none') {
          setSelectedModel(aiJson.data.activeModel);
        }
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to reach API server');
      setHealth(null);
      setReady(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAiSettings = async () => {
    setSavingAi(true);
    setSaveResult(null);
    try {
      const res = await fetch(`${apiBaseUrl}/settings/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: selectedProviderId,
          model: selectedModel,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setSaveResult({
          success: true,
          message:
            data.message ||
            `Successfully switched AI provider to ${selectedProviderId.toUpperCase()}`,
        });
        setAiSettings(data.data);
        if (ready?.checks?.ai) {
          setReady({
            ...ready,
            checks: {
              ...ready.checks,
              ai: {
                provider: data.data.activeProvider,
                isConfigured: data.data.isAvailable,
                model: data.data.activeModel,
                mode: data.data.mode,
              },
            },
          });
        }
      } else {
        setSaveResult({
          success: false,
          message: data.error?.message || 'Failed to save AI configuration',
        });
      }
    } catch (err) {
      setSaveResult({
        success: false,
        message: err instanceof Error ? err.message : 'Network error saving AI settings',
      });
    } finally {
      setSavingAi(false);
    }
  };

  const handleTestAi = async () => {
    setTestingAi(true);
    setTestResult(null);
    try {
      const res = await fetch(`${apiBaseUrl}/settings/ai/test`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setTestResult({
          success: true,
          message: data.data.message,
          latencyMs: data.data.latencyMs,
          provider: data.data.provider,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error?.message || 'Failed to test AI connectivity',
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Network error testing AI provider',
      });
    } finally {
      setTestingAi(false);
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

      {/* AI Intelligence Engine & Provider Configuration */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div className="card-title" style={{ marginBottom: 0 }}>
            AI Intelligence Engine & Provider Architecture
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleTestAi} disabled={testingAi}>
            {testingAi ? 'Testing AI Pipeline...' : '⚡ Test AI Connectivity'}
          </button>
        </div>

        {testResult && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.375rem',
              marginBottom: '1rem',
              backgroundColor: testResult.success
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${testResult.success ? '#10b981' : '#ef4444'}`,
              color: testResult.success ? '#34d399' : '#f87171',
              fontSize: '0.875rem',
            }}
          >
            <strong>
              {testResult.success ? '✓ AI Connection Test Successful' : '✗ AI Connection Failed'}
            </strong>
            {testResult.latencyMs !== undefined && (
              <span style={{ marginLeft: '0.5rem', opacity: 0.9 }}>
                ({testResult.latencyMs}ms latency)
              </span>
            )}
            <div style={{ marginTop: '0.25rem', color: 'var(--text-primary)' }}>
              {testResult.message}
            </div>
          </div>
        )}

        {/* Active Runtime Status */}
        <div className="status-grid" style={{ marginBottom: '1.25rem' }}>
          <div className="status-item">
            <div className="status-item-header">
              <span className="status-item-label">Active Intelligence Engine</span>
              <span className={`status-badge ${aiChecks?.isConfigured ? 'ok' : 'connected'}`}>
                {aiChecks?.isConfigured ? 'LLM AUGMENTED' : 'DETERMINISTIC GROUNDED'}
              </span>
            </div>
            <div className="status-item-meta">
              Active Provider: <strong>{aiChecks?.provider?.toUpperCase() || 'DISABLED'}</strong> |
              Model: <code>{aiChecks?.model || 'none'}</code>
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
                ? 'High-speed generative reasoning active with candidate truthfulness verification.'
                : '100% deterministic rule-based matching. Zero external API calls. Zero hallucination risk.'}
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
              Candidate Brain acts as immutable ground truth. Facts marked unverified are strictly
              quarantined from AI prompts and application answers.
            </div>
          </div>
        </div>

        {/* Supported AI Providers Architecture */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.75rem' }}>
            Supported AI Providers & Credentials:
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1rem',
            }}
          >
            {aiSettings?.supportedProviders.map((prov) => {
              const isActive = (aiSettings?.activeProvider || 'disabled') === prov.id;
              const isSelected = selectedProviderId === prov.id;
              return (
                <div
                  key={prov.id}
                  onClick={() => {
                    setSelectedProviderId(prov.id);
                    if (prov.id === 'gemini') setSelectedModel('gemini-3.8-flash');
                    else if (prov.id === 'openai') setSelectedModel('gpt-4o-mini');
                    else setSelectedModel('none');
                  }}
                  style={{
                    padding: '1rem',
                    borderRadius: '0.375rem',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--surface-border)'}`,
                    backgroundColor: isSelected
                      ? 'rgba(59, 130, 246, 0.08)'
                      : 'rgba(15, 23, 42, 0.5)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{prov.name}</span>
                    {isActive ? (
                      <span className="status-badge ok" style={{ fontSize: '0.7rem' }}>
                        ACTIVE
                      </span>
                    ) : prov.isConfigured ? (
                      <span className="status-badge connected" style={{ fontSize: '0.7rem' }}>
                        KEY DETECTED
                      </span>
                    ) : (
                      <span className="status-badge unconfigured" style={{ fontSize: '0.7rem' }}>
                        OPTIONAL
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {prov.description}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#93c5fd' }}>
                    Recommended Model: <code>{prov.recommendedModel}</code>
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      marginTop: '0.2rem',
                    }}
                  >
                    Env: <code>{prov.credentialEnv}</code>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive AI Runtime Configurator */}
          <div
            style={{
              marginTop: '1.25rem',
              padding: '1rem',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '0.375rem',
              border: '1px solid var(--accent)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  ⚙️ Active Engine Configuration
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Selected Provider:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {selectedProviderId.toUpperCase()}
                  </strong>
                </div>
              </div>

              <div
                style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Model:
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    style={{
                      padding: '0.4rem 0.65rem',
                      borderRadius: '0.25rem',
                      backgroundColor: 'var(--surface-color)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--surface-border)',
                      fontSize: '0.85rem',
                    }}
                  >
                    {selectedProviderId === 'gemini' && (
                      <>
                        <option value="gemini-3.8-flash">
                          gemini-3.8-flash (Primary — 1M Tokens, Fast & Multimodal)
                        </option>
                        <option value="gemini-3.5-flash-lite">
                          gemini-3.5-flash-lite (High Availability & Lowest Latency)
                        </option>
                        <option value="gemini-3.1-pro-preview">
                          gemini-3.1-pro-preview (Deep Reasoning & Complex Analysis)
                        </option>
                      </>
                    )}
                    {selectedProviderId === 'openai' && (
                      <>
                        <option value="gpt-4o-mini">gpt-4o-mini (Fast & Cost Efficient)</option>
                        <option value="gpt-4o">gpt-4o (High Performance Reasoning)</option>
                      </>
                    )}
                    {selectedProviderId === 'disabled' && (
                      <option value="none">none (Offline Rule-Based Deterministic)</option>
                    )}
                  </select>
                </div>

                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveAiSettings}
                  disabled={savingAi}
                >
                  {savingAi ? 'Saving...' : 'Save AI Configuration'}
                </button>
              </div>
            </div>

            {saveResult && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.825rem',
                  backgroundColor: saveResult.success
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${saveResult.success ? '#10b981' : '#ef4444'}`,
                  color: saveResult.success ? '#34d399' : '#f87171',
                }}
              >
                {saveResult.success ? '✓ ' : '✗ '}
                {saveResult.message}
              </div>
            )}
          </div>
        </div>

        {/* Configuration Instructions Box */}
        <div
          style={{
            padding: '1rem',
            borderRadius: '0.375rem',
            backgroundColor: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid var(--surface-border)',
            fontSize: '0.85rem',
            lineHeight: '1.5',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            📖 How to Switch Providers & Configure Credentials
          </div>
          <p style={{ marginBottom: '0.5rem' }}>
            To activate or switch providers, configure the corresponding environment variables in
            your <code>.env</code> file or container runtime:
          </p>
          <ul style={{ paddingLeft: '1.25rem', marginBottom: '0.5rem' }}>
            <li>
              <strong>Google Gemini:</strong> Set <code>AI_PROVIDER=gemini</code> and{' '}
              <code>GEMINI_API_KEY=your_gemini_api_key</code>. Recommended model:{' '}
              <code>gemini-3.8-flash</code> (with automatic <code>gemini-3.5-flash-lite</code>{' '}
              failover).
            </li>
            <li>
              <strong>OpenAI:</strong> Set <code>AI_PROVIDER=openai</code> and{' '}
              <code>OPENAI_API_KEY=your_openai_api_key</code>. Recommended model:{' '}
              <code>gpt-4o-mini</code>.
            </li>
            <li>
              <strong>Deterministic (Offline):</strong> Set <code>AI_PROVIDER=disabled</code>. Zero
              API keys needed; runs 100% locally with zero hallucination.
            </li>
          </ul>
          <div style={{ fontSize: '0.8rem', color: '#fbbf24' }}>
            🔒 <em>Security Invariant:</em> API keys are held strictly in backend server memory and
            are never committed to Git or exposed over client bundles.
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

      {/* Identity & Security Model (Better Auth) */}
      <div className="card">
        <div className="card-title">Identity & Multi-User Security Model (Better Auth)</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
          <p>
            <strong>Authoritative Authentication & Multi-Tenant Isolation:</strong> Jobee is powered
            by Better Auth with strict tenant workspace isolation. Each authenticated user has an
            isolated Candidate Brain, Document Vault, Preferences, Applications CRM, and
            Email/Calendar sync.
          </p>
          <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
            <li>
              <code>Authentication Provider</code>:{' '}
              <strong>Better Auth (Google OAuth & Email/Password)</strong>
            </li>
            <li>
              <code>Private Pilot Policy</code>: Registration is invite-only via cryptographic pilot
              tokens.
            </li>
            <li>
              <code>Primary Owner Candidate</code>: <code>Asadbek Makhmudov</code> (
              <code>00000000-0000-0000-0000-000000000001</code>)
            </li>
            <li>
              <code>Multi-User Safety</code>: All API mutations and queries are strictly bound to
              authenticated session identity.
            </li>
            <li>
              <code>Zero Hallucination Guardrail</code>: Candidate Brain acts as the immutable
              ground truth; unverified facts are strictly quarantined.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
