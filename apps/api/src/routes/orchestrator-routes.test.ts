import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import { getDb, users, orchestrationRuns, eq } from '@job-agent/database';
import { FastifyInstance } from 'fastify';

describe('Orchestrator Routes Integration Tests', () => {
  let app: FastifyInstance;
  let testUserId: string;
  const config = getConfig();
  const db = getDb(config.DATABASE_URL);

  beforeEach(async () => {
    app = buildApp({ config, db });
    await app.ready();

    const timestamp = Date.now();
    const [testUser] = await db
      .insert(users)
      .values({
        name: `Test Orch User ${timestamp}`,
        email: `test_orch_${timestamp}@example.com`,
        systemKey: `test_orch_${timestamp}`,
      })
      .returning();
    testUserId = testUser!.id;
  });

  afterEach(async () => {
    if (testUserId) {
      await db.delete(orchestrationRuns).where(eq(orchestrationRuns.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    }
    await app.close();
  });

  it('GET /api/orchestrator/status returns scheduler configuration', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/orchestrator/status',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.data.orchestratorEnabled).toBe(true);
    expect(body.data.pollIntervalMs).toBeDefined();
  });

  it('GET /api/orchestrator/metrics returns aggregated system metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/orchestrator/metrics',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.data.maxApplicationsPerDay).toBeDefined();
    expect(body.data.dailyQuotaRemaining).toBeDefined();
  });

  it('POST /api/orchestrator/runs queues an on-demand run and GET /api/orchestrator/runs lists it', async () => {
    const queueRes = await app.inject({
      method: 'POST',
      url: '/api/orchestrator/runs',
      payload: {
        taskType: 'MATCHING',
        force: true,
      },
    });

    expect(queueRes.statusCode).toBe(202);
    const queueBody = JSON.parse(queueRes.body);
    expect(queueBody.status).toBe('ok');
    expect(queueBody.data.taskType).toBe('MATCHING');
    expect(queueBody.data.status).toBe('PENDING');
    const runId = queueBody.data.id;

    // GET /api/orchestrator/runs/:id
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/orchestrator/runs/${runId}`,
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    expect(getBody.data.id).toBe(runId);
    expect(getBody.data.taskType).toBe('MATCHING');

    // GET /api/orchestrator/runs
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/orchestrator/runs',
    });

    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body);
    expect(listBody.data.runs.some((r: any) => r.id === runId)).toBe(true);
  });
});
