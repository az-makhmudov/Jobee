import { beforeEach, afterEach, it, expect } from 'vitest';
import {
  getDb,
  users,
  jobs,
  applications,
  browserApplicationRuns,
  candidateDocuments,
  eq,
  assertSafeTestDatabase,
  assertSafeTestUser,
  assertDailyApplicationLimit,
} from '@job-agent/database';
import { SmartProfileImportService } from '../apps/api/src/services/import/smart-profile-import-service.js';
import { CandidateService } from '../apps/api/src/services/candidate-service.js';
import { PilotInvitationService } from '../apps/api/src/services/auth/pilot-invitation-service.js';
import { LocalStorageProvider } from '@job-agent/shared/storage';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const db = getDb();
let userId: string, adminId: string, appId: string, dir: string;
beforeEach(async () => {
  assertSafeTestDatabase();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jobee-limits-'));
  const rows = await db
    .insert(users)
    .values([
      { name: 'Limits fixture', email: `limits-${crypto.randomUUID()}@example.test` },
      {
        name: 'Limits admin fixture',
        email: `limits-admin-${crypto.randomUUID()}@example.test`,
        role: 'admin',
      },
    ])
    .returning();
  userId = rows[0]!.id;
  adminId = rows[1]!.id;
  const [job] = await db
    .insert(jobs)
    .values({
      userId,
      title: 'Fixture',
      company: 'Fixture',
      description: 'Synthetic fixture',
      contentHash: crypto.randomUUID(),
    })
    .returning();
  const [app] = await db.insert(applications).values({ userId, jobId: job!.id }).returning();
  appId = app!.id;
});
afterEach(async () => {
  for (const id of [userId, adminId]) {
    assertSafeTestUser(id);
    await db.delete(users).where(eq(users.id, id));
  }
  await fs.rm(dir, { recursive: true, force: true });
});
const reserve = (count: number) =>
  db.insert(browserApplicationRuns).values(
    Array.from({ length: count }, () => ({
      userId,
      applicationId: appId,
      targetUrl: 'https://example.test/fixture',
      mode: 'SUBMIT',
      status: 'FAILED',
    })),
  );
it('enforces ten attempts even when failures consumed slots, without trusting a client role', async () => {
  await reserve(9);
  await expect(
    db.transaction((tx) => assertDailyApplicationLimit(tx, userId)),
  ).resolves.toBeUndefined();
  await reserve(1);
  await expect(db.transaction((tx) => assertDailyApplicationLimit(tx, userId))).rejects.toThrow(
    '10/day',
  );
});
it.each(['admin', 'tester'])('exempts a persisted %s from the platform cap', async (role) => {
  await reserve(12);
  await db.update(users).set({ role }).where(eq(users.id, userId));
  await expect(
    db.transaction((tx) => assertDailyApplicationLimit(tx, userId)),
  ).resolves.toBeUndefined();
});
it('keeps ordinary pilot users capped and only allows an admin to designate a tester', async () => {
  const invitations = new PilotInvitationService(db);
  await expect(
    invitations.createInvitation({ inviterUserId: userId, role: 'tester' }),
  ).rejects.toThrow('administrators');
  expect(
    (await invitations.createInvitation({ inviterUserId: adminId, role: 'tester' })).role,
  ).toBe('tester');
});
it('serializes concurrent uploads at ten and removes the rejected file', async () => {
  const storage = new LocalStorageProvider({ baseDir: dir });
  const service = new CandidateService(db, storage);
  const upload = () =>
    service.uploadDocument(
      userId,
      Buffer.from('Synthetic document'),
      { originalFilename: 'fixture.txt', mimeType: 'text/plain' },
      { documentType: 'MASTER_CV' },
    );
  for (let i = 0; i < 9; i++) await upload();
  const outcomes = await Promise.allSettled([upload(), upload()]);
  expect(outcomes.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  expect(
    await db.select().from(candidateDocuments).where(eq(candidateDocuments.userId, userId)),
  ).toHaveLength(10);
  expect(await fs.readdir(dir)).toHaveLength(10);
});

it('shares the ten-document cap across concurrent profile imports and vault uploads', async () => {
  const storage = new LocalStorageProvider({ baseDir: dir });
  const candidate = new CandidateService(db, storage);
  const imports = new SmartProfileImportService(db, storage, candidate);
  const file = Buffer.from('Synthetic import document');
  const meta = { originalFilename: 'fixture.txt', mimeType: 'text/plain' };
  for (let i = 0; i < 9; i++)
    await candidate.uploadDocument(userId, file, meta, { documentType: 'CV' });
  const outcomes = await Promise.allSettled([
    imports.createSession(userId, file, meta),
    candidate.uploadDocument(userId, file, meta, { documentType: 'CV' }),
  ]);
  expect(outcomes.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  expect(
    await db.select().from(candidateDocuments).where(eq(candidateDocuments.userId, userId)),
  ).toHaveLength(10);
  expect(await fs.readdir(dir)).toHaveLength(10);
});

it('grants the tester exemption only after an invitation is atomically redeemed', async () => {
  const invitations = new PilotInvitationService(db);
  const invitation = await invitations.createInvitation({ inviterUserId: adminId, role: 'tester' });
  const [other] = await db
    .insert(users)
    .values({
      name: 'Other limit fixture',
      email: `other-limit-${crypto.randomUUID()}@example.test`,
    })
    .returning();
  try {
    const results = await Promise.allSettled([
      invitations.redeemInvitation(invitation.code, userId),
      invitations.redeemInvitation(invitation.code, other!.id),
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const [first] = await db.select().from(users).where(eq(users.id, userId));
    const [second] = await db.select().from(users).where(eq(users.id, other!.id));
    expect([first!.role, second!.role].filter((role) => role === 'tester')).toHaveLength(1);
  } finally {
    await db.delete(users).where(eq(users.id, other!.id));
  }
});
it('persists the tester role through the actual registration endpoint without trusting a submitted role', async () => {
  const { buildApp } = await import('../apps/api/src/app.js');
  const { getConfig } = await import('@job-agent/config');
  const config = {
    ...getConfig(),
    NODE_ENV: 'test' as const,
    AI_PROVIDER: 'disabled' as const,
    INVITE_ONLY_REGISTRATION: true,
  };
  const email = `tester-signup-${crypto.randomUUID()}@example.test`;
  const invitation = await new PilotInvitationService(db).createInvitation({
    inviterUserId: adminId,
    invitedEmail: email,
    role: 'tester',
  });
  const app = buildApp({ db, config });
  await app.ready();
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { origin: config.WEB_ORIGIN },
      payload: {
        name: 'Tester signup fixture',
        email,
        password: 'FixturePassword123!',
        invitationCode: invitation.code,
        role: 'admin',
      },
    });
    expect(response.statusCode).toBe(400);
    const accepted = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { origin: config.WEB_ORIGIN },
      payload: {
        name: 'Tester signup fixture',
        email,
        password: 'FixturePassword123!',
        invitationCode: invitation.code,
      },
    });
    expect(accepted.statusCode, accepted.json().message).toBe(200);
    const [account] = await db.select().from(users).where(eq(users.email, email));
    expect(account!.role).toBe('tester');
  } finally {
    await app.close();
    const [account] = await db.select().from(users).where(eq(users.email, email));
    if (account) {
      assertSafeTestUser(account.id);
      await db.delete(users).where(eq(users.id, account.id));
    }
  }
});

it('finds an older owned application for its exact job instead of offering a duplicate apply', async () => {
  const { buildApp } = await import('../apps/api/src/app.js');
  const { getConfig } = await import('@job-agent/config');
  const [original] = await db.select().from(applications).where(eq(applications.id, appId));
  await db
    .update(applications)
    .set({ updatedAt: new Date(Date.now() - 86400_000) })
    .where(eq(applications.id, appId));
  const [newJob] = await db
    .insert(jobs)
    .values({
      userId,
      title: 'Newer fixture',
      company: 'Fixture',
      description: 'Synthetic fixture',
      contentHash: crypto.randomUUID(),
    })
    .returning();
  await db.insert(applications).values({ userId, jobId: newJob!.id });
  const app = buildApp({
    db,
    config: { ...getConfig(), NODE_ENV: 'test', AI_PROVIDER: 'disabled' },
  });
  await app.ready();
  try {
    const response = await app.inject({
      method: 'GET',
      url: `/api/jobs/${original!.jobId}/application`,
      headers: { 'x-test-user-id': userId },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.id).toBe(appId);
    const foreign = await app.inject({
      method: 'GET',
      url: `/api/jobs/${original!.jobId}/application`,
      headers: { 'x-test-user-id': adminId },
    });
    expect(foreign.json().data).toBeNull();
  } finally {
    await app.close();
  }
});
