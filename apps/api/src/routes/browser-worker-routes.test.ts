import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import {
  closeDbPool,
  getDb,
  getOrCreatePrimaryUser,
  jobs,
  applications,
  browserApplicationRuns,
  eq,
  type Database,
} from '@job-agent/database';
import { AtsProviderType, BrowserRunMode, BrowserRunStatus } from '@job-agent/shared';

describe('Browser Worker Routes Integration Tests (JOB-P5-T01)', () => {
  const config = getConfig();
  let app: ReturnType<typeof buildApp>;
  let db: Database;
  let userId: string;

  let testJobId: string;
  let testAppId: string;
  let createdRunId: string;

  beforeAll(async () => {
    app = buildApp({ config });
    await app.ready();

    db = getDb(config.DATABASE_URL);
    const user = await getOrCreatePrimaryUser(db);
    userId = user.id;

    // Create test job with Greenhouse apply URL
    const [job] = await db
      .insert(jobs)
      .values({
        userId,
        title: 'Lead Distributed Systems Engineer',
        company: 'Nova Metrics',
        description: 'Lead engineering team building distributed data pipelines.',
        applicationUrl: 'https://boards.greenhouse.io/novametrics/jobs/998877',
        contentHash: `hash-browser-routes-test-${Date.now()}`,
      })
      .returning();
    testJobId = job!.id;

    // Create test application
    const [appRecord] = await db
      .insert(applications)
      .values({
        userId,
        jobId: testJobId,
        status: 'READY_TO_APPLY',
        source: 'DIRECT',
        applicationUrl: 'https://boards.greenhouse.io/novametrics/jobs/998877',
      })
      .returning();
    testAppId = appRecord!.id;
  });

  afterAll(async () => {
    // Teardown test data
    if (createdRunId) {
      await db.delete(browserApplicationRuns).where(eq(browserApplicationRuns.id, createdRunId));
    }
    if (testAppId) {
      await db.delete(applications).where(eq(applications.id, testAppId));
    }
    if (testJobId) {
      await db.delete(jobs).where(eq(jobs.id, testJobId));
    }
    await app.close();
    await closeDbPool();
  });

  it('POST /api/applications/:id/browser-runs - queues a new browser run in DRY_RUN mode', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/applications/${testAppId}/browser-runs`,
      payload: {
        mode: BrowserRunMode.DRY_RUN,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.data).toBeDefined();

    const run = body.data;
    createdRunId = run.id;
    expect(run.applicationId).toBe(testAppId);
    expect(run.userId).toBe(userId);
    expect(run.mode).toBe(BrowserRunMode.DRY_RUN);
    expect(run.status).toBe(BrowserRunStatus.PENDING);
    expect(run.atsProvider).toBe(AtsProviderType.GREENHOUSE);
    expect(run.targetUrl).toContain('boards.greenhouse.io');
    expect(run.stepLogs).toHaveLength(1);
    expect(run.stepLogs[0].step).toBe('QUEUED');
  });

  it('GET /api/applications/:id/browser-runs - lists all runs for the application', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/applications/${testAppId}/browser-runs`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const found = body.data.find((r: any) => r.id === createdRunId);
    expect(found).toBeDefined();
    expect(found.atsProvider).toBe(AtsProviderType.GREENHOUSE);
  });

  it('GET /api/browser-runs/:runId - fetches full run details with audit trail', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/browser-runs/${createdRunId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.data.id).toBe(createdRunId);
    expect(body.data.applicationId).toBe(testAppId);
    expect(body.data.stepLogs).toBeDefined();
  });

  it('POST /api/applications/:id/browser-runs - rejects nonexistent application with 404', async () => {
    const nonexistentId = '00000000-0000-0000-0000-000000000000';
    const res = await app.inject({
      method: 'POST',
      url: `/api/applications/${nonexistentId}/browser-runs`,
      payload: {},
    });

    expect(res.statusCode).toBe(404);
  });

  it('GET /api/browser-runs/:runId - rejects nonexistent run with 404', async () => {
    const nonexistentId = '00000000-0000-0000-0000-000000000000';
    const res = await app.inject({
      method: 'GET',
      url: `/api/browser-runs/${nonexistentId}`,
    });

    expect(res.statusCode).toBe(404);
  });
});
