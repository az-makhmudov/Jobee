export interface ApiSuccessResponse<T> {
  status: 'ok';
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  status: 'error';
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
}

export interface DatabaseHealthCheck {
  status: 'connected' | 'disconnected' | 'unconfigured';
  latencyMs?: number;
  message?: string;
}

export interface ReadinessResponse {
  status: 'ready' | 'degraded' | 'unhealthy';
  service: string;
  version: string;
  timestamp: string;
  checks: {
    database: DatabaseHealthCheck;
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
