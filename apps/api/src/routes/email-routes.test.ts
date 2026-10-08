import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import {
  closeDbPool,
  getDb,
  jobs,
  applications,
  emailAccounts,
  inArray,
} from '@job-agent/database';
import { ApplicationLifecycleStatus } from '@job-agent/shared';

describe('Email Intelligence Routes Integration Tests (JOB-P4-T01)', () => {
  const config = getConfig();
  let app: ReturnType<typeof buildApp>;
  const createdJobIds: string[] = [];
  const createdAppIds: string[] = [];
  let connectedAccountId: string;
  const runId = Date.now();

  beforeAll(async () => {
    app = buildApp({ config });
    await app.ready();
  });

  afterAll(async () => {
    const db = getDb(config.DATABASE_URL);

    // Clean up created test accounts (cascades to email_messages, sync_runs, review_items)
    if (connectedAccountId) {
      await db.delete(emailAccounts).where(inArray(emailAccounts.id, [connectedAccountId]));
    }
    // Clean up test applications and jobs
    if (createdAppIds.length > 0) {
      await db.delete(applications).where(inArray(applications.id, createdAppIds));
    }
    if (createdJobIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
    }

    await app.close();
    await closeDbPool();
  });

  it('1. connects a fixture email account and lists it', async () => {
    const fixtureEmail = `test.candidate.${runId}@example.com`;

    const connectRes = await app.inject({
      method: 'POST',
      url: '/api/email/accounts/fixture-connect',
      payload: {
        emailAddress: fixtureEmail,
      },
    });

    expect(connectRes.statusCode).toBe(201);
    const body = JSON.parse(connectRes.body);
    expect(body.status).toBe('ok');
    expect(body.data.emailAddress).toBe(fixtureEmail);
    expect(body.data.provider).toBe('FIXTURE');
    expect(body.data.status).toBe('CONNECTED');
    connectedAccountId = body.data.id;

    // List accounts
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/email/accounts',
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body);
    expect(listBody.data.some((a: any) => a.id === connectedAccountId)).toBe(true);
  });

  it('2. generates OAuth authorization URL for Gmail or Fixture', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/email/accounts/connect-url',
      payload: { provider: 'FIXTURE' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.authorizationUrl).toContain('fixture-callback');
    expect(body.data.state).toBeDefined();
  });

  it('3. synchronizes the account, auto-syncing matching applications and creating review items', async () => {
    // First, set up a real application matching Acme Corp with external ref APP-ACME-98421
    const jobRes = await app.inject({
      method: 'POST',
      url: '/api/jobs/text',
      payload: {
        title: 'Senior Backend Engineer',
        company: 'Acme Corp',
        text: `Acme Corp is hiring a Senior Backend Engineer in Zurich ${runId}. Requirements: Distributed Systems, Node.js, PostgreSQL.`,
      },
    });
    expect(jobRes.statusCode).toBe(201);
    const job = JSON.parse(jobRes.body).data.job;
    createdJobIds.push(job.id);

    const appRes = await app.inject({
      method: 'POST',
      url: '/api/applications',
      payload: {
        jobId: job.id,
        source: 'DIRECT',
        nextAction: 'Wait for confirmation',
      },
    });
    expect(appRes.statusCode).toBe(201);
    const testApp = JSON.parse(appRes.body).data.application;
    createdAppIds.push(testApp.id);

    // Transition application to APPLIED so confirmation email can transition it to CONFIRMATION_RECEIVED
    const appliedRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${testApp.id}/mark-applied`,
      payload: {
        submissionMethod: 'COMPANY_SITE',
        externalReferenceId: 'APP-ACME-98421',
      },
    });
    expect(appliedRes.statusCode).toBe(200);

    // Now trigger sync on connected account
    const syncRes = await app.inject({
      method: 'POST',
      url: `/api/email/accounts/${connectedAccountId}/sync`,
      payload: {},
    });

    expect(syncRes.statusCode).toBe(200);
    const syncBody = JSON.parse(syncRes.body);
    expect(syncBody.data.messagesFound).toBeGreaterThanOrEqual(8);
    expect(syncBody.data.messagesIngested).toBeGreaterThanOrEqual(8);
    expect(syncBody.data.autoSyncedCount).toBeGreaterThanOrEqual(1);
    expect(syncBody.data.reviewItemsCreated).toBeGreaterThanOrEqual(1);

    // Verify application transitioned to CONFIRMATION_RECEIVED via sync!
    const updatedAppRes = await app.inject({
      method: 'GET',
      url: `/api/applications/${testApp.id}`,
    });
    expect(updatedAppRes.statusCode).toBe(200);
    const updatedApp = JSON.parse(updatedAppRes.body).data;
    expect([
      ApplicationLifecycleStatus.CONFIRMATION_RECEIVED,
      ApplicationLifecycleStatus.INTERVIEW,
    ]).toContain(updatedApp.application.status);
  });

  it('4. retrieves dashboard stats and lists messages', async () => {
    const statsRes = await app.inject({
      method: 'GET',
      url: '/api/email/stats',
    });
    expect(statsRes.statusCode).toBe(200);
    const stats = JSON.parse(statsRes.body).data;
    expect(stats.connectedAccountsCount).toBeGreaterThanOrEqual(1);
    expect(stats.totalMessagesIngested).toBeGreaterThanOrEqual(8);
    expect(stats.pendingReviewCount).toBeGreaterThanOrEqual(1);

    const msgsRes = await app.inject({
      method: 'GET',
      url: '/api/email/messages',
    });
    expect(msgsRes.statusCode).toBe(200);
    const msgs = JSON.parse(msgsRes.body).data;
    expect(msgs.length).toBeGreaterThanOrEqual(8);
  });

  it('5. retrieves review queue and resolves a review item', async () => {
    const queueRes = await app.inject({
      method: 'GET',
      url: '/api/email/review-queue',
    });
    expect(queueRes.statusCode).toBe(200);
    const items = JSON.parse(queueRes.body).data;
    expect(items.length).toBeGreaterThan(0);

    const itemToResolve = items[0];
    const resolveRes = await app.inject({
      method: 'POST',
      url: `/api/email/review-queue/${itemToResolve.id}/resolve`,
      payload: {
        resolution: 'APPROVED',
        resolutionNote: 'Approved by candidate during integration test verification',
      },
    });

    expect(resolveRes.statusCode).toBe(200);
    const resolveBody = JSON.parse(resolveRes.body);
    expect(resolveBody.data.status).toBe('APPROVED');
    expect(resolveBody.data.resolutionNote).toContain('Approved by candidate');
  });

  it('6. returns 409 Conflict when sync is concurrently triggered on an already syncing account', async () => {
    const db = getDb(config.DATABASE_URL);

    // Simulate an ongoing active sync lock on the account
    await db
      .update(emailAccounts)
      .set({
        isSyncing: true,
        syncLockedAt: new Date(),
      })
      .where(inArray(emailAccounts.id, [connectedAccountId]));

    try {
      const syncRes = await app.inject({
        method: 'POST',
        url: `/api/email/accounts/${connectedAccountId}/sync`,
        payload: {},
      });

      expect(syncRes.statusCode).toBe(409);
      const body = JSON.parse(syncRes.body);
      expect(body.error.message).toContain('already in progress');
    } finally {
      // Clear the simulated active sync lock
      await db
        .update(emailAccounts)
        .set({
          isSyncing: false,
          syncLockedAt: null,
        })
        .where(inArray(emailAccounts.id, [connectedAccountId]));
    }
  });

  it('7. safely disconnects account without deleting historical normalized messages and review items', async () => {
    // Check message count before disconnect
    const beforeMsgsRes = await app.inject({
      method: 'GET',
      url: '/api/email/messages',
    });
    const beforeCount = JSON.parse(beforeMsgsRes.body).data.length;
    expect(beforeCount).toBeGreaterThan(0);

    // Perform safe disconnect (without purge)
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/email/accounts/${connectedAccountId}`,
    });

    expect(deleteRes.statusCode).toBe(200);
    const deleteBody = JSON.parse(deleteRes.body);
    expect(deleteBody.data.status).toBe('DISCONNECTED');

    // Verify messages and history are still intact
    const afterMsgsRes = await app.inject({
      method: 'GET',
      url: '/api/email/messages',
    });
    const afterCount = JSON.parse(afterMsgsRes.body).data.length;
    expect(afterCount).toBe(beforeCount);

    // Verify account still exists with DISCONNECTED status in database
    const db = getDb(config.DATABASE_URL);
    const [persisted] = await db
      .select()
      .from(emailAccounts)
      .where(inArray(emailAccounts.id, [connectedAccountId]))
      .limit(1);

    expect(persisted).toBeDefined();
    expect(persisted!.status).toBe('DISCONNECTED');
    expect(persisted!.errorMessage).toBe('Account disconnected by user');
  });
});
