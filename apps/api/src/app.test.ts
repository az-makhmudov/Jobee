import { describe, it, expect } from 'vitest';
import { buildApp } from './app.js';
import type { AppConfig } from '@job-agent/config';
import { AppError } from '@job-agent/shared';

const testConfig: AppConfig = {
  NODE_ENV: 'test',
  API_HOST: '127.0.0.1',
  API_PORT: 3000,
  WEB_ORIGIN: 'http://localhost:5173',
  LOG_LEVEL: 'fatal', // silence logs in tests
  WORKER_POLL_INTERVAL_MS: 5000,
  DATABASE_URL: undefined,
  AI_PROVIDER: 'disabled',
  EMAIL_TOKEN_ENCRYPTION_KEY: 'test-encryption-key-for-unit-testing-purposes-min-32-chars',
  GMAIL_REDIRECT_URI: 'http://localhost:3000/api/email/oauth/callback',
  GOOGLE_CALENDAR_REDIRECT_URI: 'http://localhost:3000/api/calendar/google/callback',
  ORCHESTRATOR_ENABLED: true,
  ORCHESTRATOR_POLL_INTERVAL_MS: 15000,
  DISCOVERY_INTERVAL_MINUTES: 60,
  EMAIL_SYNC_INTERVAL_MINUTES: 15,
  REMINDERS_INTERVAL_MINUTES: 30,
  RATE_LIMIT_DAILY_APPLICATIONS_DEFAULT: 10,
  BETTER_AUTH_SECRET: 'test-better-auth-secret-min-32-chars-long',
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_TRUSTED_ORIGINS: 'http://localhost:5173',
  SMTP_FROM: 'noreply@jobee.local',
  INVITE_ONLY_REGISTRATION: true,
};

describe('API Foundation', () => {
  it('GET /health returns 200 and health payload', async () => {
    const app = buildApp({ config: testConfig });
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('api');
    expect(body.version).toBe('0.1.0');
    expect(body.uptimeSeconds).toBeTypeOf('number');

    const liveRes = await app.inject({ method: 'GET', url: '/health/live' });
    expect(liveRes.statusCode).toBe(200);
    expect(JSON.parse(liveRes.body).status).toBe('ok');
  });

  it('GET /ready returns readiness payload with unconfigured database in test', async () => {
    const app = buildApp({ config: testConfig });
    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('degraded');
    expect(body.checks.database.status).toBe('unconfigured');

    const readyAlias = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(readyAlias.statusCode).toBe(200);
    expect(JSON.parse(readyAlias.body).status).toBe('degraded');
  });

  it('GET /unknown-route returns 404 with standardized error JSON', async () => {
    const app = buildApp({ config: testConfig });
    const response = await app.inject({
      method: 'GET',
      url: '/random-missing-route',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('error');
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('/random-missing-route');
  });

  it('handles operational AppError thrown inside routes', async () => {
    const app = buildApp({ config: testConfig });
    app.get('/test-error', async () => {
      throw AppError.badRequest('Custom bad request detail', { foo: 'bar' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test-error',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('error');
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toBe('Custom bad request detail');
    expect(body.error.details).toEqual({ foo: 'bar' });
  });
});
