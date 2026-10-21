import { it, expect } from 'vitest';
import {
  getDb,
  users,
  jobs,
  applications,
  browserApplicationRuns,
  eq,
  assertSafeTestDatabase,
  assertSafeTestUser,
} from '@job-agent/database';
import { LocalStorageProvider } from '@job-agent/shared/storage';
import { pruneBrowserEvidence } from './browser-evidence-retention.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
it('prunes only expired owned run-prefixed bytes and preserves failed/unrecognized references for review', async () => {
  assertSafeTestDatabase();
  const db = getDb();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jobee-retention-'));
  const storage = new LocalStorageProvider({ baseDir: dir });
  let userId = '';
  try {
    const [user] = await db
      .insert(users)
      .values({ name: 'Retention fixture', email: `retention-${crypto.randomUUID()}@example.test` })
      .returning();
    userId = user!.id;
    assertSafeTestUser(userId);
    const [job] = await db
      .insert(jobs)
      .values({
        userId,
        title: 'Fixture role',
        company: 'Fixture',
        description: 'Synthetic fixture',
        contentHash: crypto.randomUUID(),
      })
      .returning();
    const [app] = await db.insert(applications).values({ userId, jobId: job!.id }).returning();
    const expired = crypto.randomUUID(),
      fresh = crypto.randomUUID();
    const deleted = `browser-${expired}-deleted.png`,
      failed = `browser-${expired}-retry.png`,
      kept = `browser-${fresh}-keep.png`;
    for (const key of [deleted, failed, kept])
      await fs.writeFile(path.join(dir, key), Buffer.from('fixture-png'));
    await db.insert(browserApplicationRuns).values([
      {
        id: expired,
        userId,
        applicationId: app!.id,
        targetUrl: 'https://example.test',
        createdAt: new Date(Date.now() - 31 * 86400_000),
        screenshotPaths: [deleted, failed, 'unrecognized-fixture.png'],
      },
      {
        id: fresh,
        userId,
        applicationId: app!.id,
        targetUrl: 'https://example.test',
        screenshotPaths: [kept],
      },
    ]);
    const remove = storage.deleteFile.bind(storage);
    storage.deleteFile = async (key) => {
      if (key === failed) throw Error('fixture temporary failure');
      await remove(key);
    };
    const result = await pruneBrowserEvidence(db, storage, userId);
    expect(result.failures).toBeGreaterThanOrEqual(1);
    expect(await storage.exists(deleted)).toBe(false);
    expect(await storage.exists(kept)).toBe(true);
    expect(
      (
        await db.select().from(browserApplicationRuns).where(eq(browserApplicationRuns.id, expired))
      )[0]!.screenshotPaths,
    ).toEqual([failed, 'unrecognized-fixture.png']);
    storage.deleteFile = remove;
    await pruneBrowserEvidence(db, storage, userId);
    expect(await storage.exists(failed)).toBe(false);
  } finally {
    if (userId) await db.delete(users).where(eq(users.id, userId));
    await fs.rm(dir, { recursive: true, force: true });
  }
});
