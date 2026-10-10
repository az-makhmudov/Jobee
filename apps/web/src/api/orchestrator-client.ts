import type {
  OrchestrationRunDto,
  TriggerOrchestrationRequest,
  SystemMetricsDto,
} from '@job-agent/shared';

const API_BASE = '/api';

export class OrchestratorClient {
  static async triggerRun(req: TriggerOrchestrationRequest = {}): Promise<OrchestrationRunDto> {
    const res = await fetch(`${API_BASE}/orchestrator/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error?.message || `Failed to trigger orchestration run: HTTP ${res.status}`,
      );
    }
    const json = await res.json();
    return json.data;
  }

  static async listRuns(query: { limit?: number; offset?: number } = {}): Promise<{
    runs: OrchestrationRunDto[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (query.limit) params.append('limit', String(query.limit));
    if (query.offset) params.append('offset', String(query.offset));

    const res = await fetch(`${API_BASE}/orchestrator/runs?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error?.message || `Failed to list orchestration runs: HTTP ${res.status}`,
      );
    }
    const json = await res.json();
    return json.data;
  }

  static async getRun(id: string): Promise<OrchestrationRunDto> {
    const res = await fetch(`${API_BASE}/orchestrator/runs/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to fetch run details: HTTP ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  }

  static async getMetrics(): Promise<SystemMetricsDto> {
    const res = await fetch(`${API_BASE}/orchestrator/metrics`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to fetch system metrics: HTTP ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  }

  static async getStatus(): Promise<{
    orchestratorEnabled: boolean;
    pollIntervalMs: number;
    discoveryIntervalMinutes: number;
    emailSyncIntervalMinutes: number;
    remindersIntervalMinutes: number;
    dailyLimitDefault: number;
  }> {
    const res = await fetch(`${API_BASE}/orchestrator/status`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error?.message || `Failed to fetch orchestrator status: HTTP ${res.status}`,
      );
    }
    const json = await res.json();
    return json.data;
  }

  static async checkReady(): Promise<any> {
    const res = await fetch(`${API_BASE}/health/ready`).catch(() => fetch('/ready'));
    if (!res.ok) {
      return { status: 'unhealthy' };
    }
    return res.json();
  }
}
