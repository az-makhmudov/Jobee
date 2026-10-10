import {
  type BrowserApplicationRunDto,
  type StartBrowserRunRequest,
  BrowserRunMode,
} from '@job-agent/shared';

const API_BASE = '/api';

export class BrowserWorkerClient {
  /**
   * Queue or start a browser form-fill run.
   */
  static async startBrowserRun(
    applicationId: string,
    req: StartBrowserRunRequest = { mode: BrowserRunMode.DRY_RUN },
  ): Promise<BrowserApplicationRunDto> {
    const res = await fetch(`${API_BASE}/applications/${applicationId}/browser-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to start browser run: HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.data;
  }

  /**
   * List browser runs for an application.
   */
  static async listBrowserRuns(applicationId: string): Promise<BrowserApplicationRunDto[]> {
    const res = await fetch(`${API_BASE}/applications/${applicationId}/browser-runs`);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to fetch browser runs: HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.data || [];
  }

  /**
   * Get single browser run with step logs.
   */
  static async getBrowserRun(runId: string): Promise<BrowserApplicationRunDto> {
    const res = await fetch(`${API_BASE}/browser-runs/${runId}`);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to fetch browser run: HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.data;
  }
}
