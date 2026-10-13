import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import fs from 'node:fs';
import path from 'node:path';

describe('Production Single-Port Static Web Assets Serving (BL-05)', () => {
  const originalEnv = process.env.NODE_ENV;
  const webDistPath = path.resolve(process.cwd(), 'apps/web/dist');
  let testApp: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    // Ensure apps/web/dist has at least a dummy index.html for testing if not built yet
    if (!fs.existsSync(webDistPath)) {
      fs.mkdirSync(webDistPath, { recursive: true });
    }
    const indexPath = path.join(webDistPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(
        indexPath,
        '<!DOCTYPE html><html><head><title>Jobee</title></head><body><div id="root">Jobee App</div></body></html>',
        'utf8',
      );
    }

    const config = getConfig();
    process.env.SERVE_STATIC = 'true';

    testApp = buildApp({
      config: {
        ...config,
        NODE_ENV: 'production',
      },
    });
    await testApp.ready();
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalEnv;
    delete process.env.SERVE_STATIC;
    await testApp.close();
  });

  it('serves index.html at root GET / with status 200', async () => {
    const res = await testApp.inject({
      method: 'GET',
      url: '/',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Jobee');
  });

  it('serves SPA fallback index.html for client-side routes like GET /dashboard', async () => {
    const res = await testApp.inject({
      method: 'GET',
      url: '/dashboard',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Jobee');
  });

  it('preserves API 404 JSON response for missing API routes GET /api/bogus-endpoint', async () => {
    const res = await testApp.inject({
      method: 'GET',
      url: '/api/bogus-endpoint',
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('error');
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('preserves /health and /ready probe responses alongside static assets', async () => {
    const healthRes = await testApp.inject({
      method: 'GET',
      url: '/health',
    });
    expect(healthRes.statusCode).toBe(200);
    const healthBody = JSON.parse(healthRes.body);
    expect(healthBody.status).toBe('ok');

    const readyRes = await testApp.inject({
      method: 'GET',
      url: '/ready',
    });
    expect([200, 503]).toContain(readyRes.statusCode);
  });
});
