import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import {
  getDb,
  users,
  jobs,
  browserApplicationRuns,
  applications,
  eq,
  evaluateTestDatabaseSafety,
} from '@job-agent/database';
import { createStorageProvider } from '../storage/index.js';
const config = getConfig(),
  db = getDb(config.DATABASE_URL);
const app = buildApp({ config });
let userId: string,
  otherId: string,
  jobId: string,
  applicationId: string,
  runId: string,
  batchId: string,
  key: string;
beforeAll(async () => {
  if (!evaluateTestDatabaseSafety().safe) throw new Error('Isolated database required');
  const [user, other] = await db
    .insert(users)
    .values([
      { name: 'Route fixture', email: `batchroute-${crypto.randomUUID()}@example.test` },
      { name: 'Other fixture', email: `otherroute-${crypto.randomUUID()}@example.test` },
    ])
    .returning();
  userId = user!.id;
  otherId = other!.id;
  const [job] = await db
    .insert(jobs)
    .values({
      userId,
      title: 'Fixture Coordinator',
      company: 'Fixture Company',
      description: 'Coordinate projects.',
      contentHash: crypto.randomUUID(),
    })
    .returning();
  jobId = job!.id;
  const [application] = await db.insert(applications).values({ userId, jobId }).returning();
  applicationId = application!.id;
  runId = crypto.randomUUID();
  key = `browser-${runId}-fixture.png`;
  const storage = createStorageProvider(config);
  await storage.putFile!(key, Buffer.from('fixture image'), 'image/png');
  await db.insert(browserApplicationRuns).values({
    id: runId,
    userId,
    applicationId,
    targetUrl: 'https://example.test',
    mode: 'SUBMIT',
    status: 'SUBMISSION_UNCERTAIN',
    screenshotPaths: [key],
    completedAt: new Date(),
  });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await createStorageProvider(config).deleteFile(key);
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(users).where(eq(users.id, otherId));
});
describe('Preparation and evidence API boundaries', () => {
  it('validates selected job IDs and persists owner-only batches', async () => {
    const headers = { 'x-test-user-id': userId };
    const bad = await app.inject({
      method: 'POST',
      url: '/api/preparation-batches',
      headers,
      payload: { jobIds: ['not-a-uuid'] },
    });
    expect(bad.statusCode).toBe(400);
    const created = await app.inject({
      method: 'POST',
      url: '/api/preparation-batches',
      headers,
      payload: { jobIds: [jobId] },
    });
    expect(created.statusCode).toBe(202);
    batchId = created.json().data.id;
    const other = await app.inject({
      url: `/api/preparation-batches/${batchId}`,
      headers: { 'x-test-user-id': otherId },
    });
    expect(other.statusCode).toBe(404);
    const questions = await app.inject({
      url: `/api/preparation-batches/${batchId}/questions`,
      headers: { 'x-test-user-id': otherId },
    });
    expect(questions.statusCode).toBe(404);
    const cancel = await app.inject({
      method: 'POST',
      url: `/api/preparation-batches/${batchId}/cancel`,
      headers: { 'x-test-user-id': otherId },
    });
    expect(cancel.statusCode).toBe(404);
  });
  it('serves retained evidence only to its owner with private cache controls', async () => {
    const owner = await app.inject({
      url: `/api/browser-runs/${runId}/evidence/0`,
      headers: { 'x-test-user-id': userId },
    });
    expect(owner.statusCode).toBe(200);
    expect(owner.headers['cache-control']).toBe('private, no-store');
    const other = await app.inject({
      url: `/api/browser-runs/${runId}/evidence/0`,
      headers: { 'x-test-user-id': otherId },
    });
    expect(other.statusCode).toBe(404);
    const missing = await app.inject({
      url: `/api/browser-runs/${runId}/evidence/1`,
      headers: { 'x-test-user-id': userId },
    });
    expect(missing.statusCode).toBe(404);
  });
  it('requires an explicit employer check before clearing uncertainty and records reconciliation', async () => {
    const url = `/api/browser-runs/${runId}/reconcile-not-sent`;
    const headers = { 'x-test-user-id': userId };
    expect(
      (await app.inject({ method: 'POST', url, headers, payload: { note: 'unchecked' } }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url,
          headers: { 'x-test-user-id': otherId },
          payload: { checkedEmployerWebsite: true, note: 'Checked employer account and email.' },
        })
      ).statusCode,
    ).toBe(404);
    const response = await app.inject({
      method: 'POST',
      url,
      headers,
      payload: { checkedEmployerWebsite: true, note: 'Checked employer account and email.' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe('FAILED');
    expect(response.json().data.stepLogs.at(-1).step).toBe('USER_RECONCILIATION');
  });
  it('expires evidence access after 30 days', async () => {
    await db
      .update(browserApplicationRuns)
      .set({ createdAt: new Date(Date.now() - 31 * 24 * 60 * 60_000) })
      .where(eq(browserApplicationRuns.id, runId));
    expect(
      (
        await app.inject({
          url: `/api/browser-runs/${runId}/evidence/0`,
          headers: { 'x-test-user-id': userId },
        })
      ).statusCode,
    ).toBe(404);
  });
});
