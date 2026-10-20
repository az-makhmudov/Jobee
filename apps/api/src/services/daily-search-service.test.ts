import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDb,
  users,
  jobSearchSettings,
  systemNotifications,
  eq,
  evaluateTestDatabaseSafety,
} from '@job-agent/database';
import { DEFAULT_SEARCH_SETTINGS } from '@job-agent/shared';
import { DailySearchService } from './daily-search-service.js';
import type { JobDiscoveryService } from './job-discovery-service.js';
import type { PreparationBatchService } from './preparation-batch-service.js';
import type { MatchService } from './match-service.js';
const db = getDb(process.env.DATABASE_URL);
let userId: string;
beforeEach(async () => {
  if (!evaluateTestDatabaseSafety().safe) throw new Error('Isolated database required');
  const [u] = await db
    .insert(users)
    .values({ name: 'Daily fixture', email: `daily-${crypto.randomUUID()}@example.test` })
    .returning();
  userId = u!.id;
});
afterEach(async () => {
  await db.delete(users).where(eq(users.id, userId));
});
describe('Opt-in daily assistance', () => {
  it('runs once per day under competing schedulers and sends only an in-app digest', async () => {
    await db
      .insert(jobSearchSettings)
      .values({ userId, settings: { ...DEFAULT_SEARCH_SETTINGS, dailyDiscovery: true } });
    const discoverForCandidate = vi.fn(async () => ({ sourcesSummary: [], newJobsIngested: 2 }));
    const create = vi.fn();
    const analyzeJob = vi.fn();
    const make = () =>
      new DailySearchService(
        db,
        { discoverForCandidate } as unknown as JobDiscoveryService,
        { create } as unknown as PreparationBatchService,
        { analyzeJob } as unknown as MatchService,
      );
    await Promise.all([make().runDue(), make().runDue()]);
    await make().runDue();
    expect(discoverForCandidate).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
    expect(analyzeJob).not.toHaveBeenCalled();
    expect(
      await db.select().from(systemNotifications).where(eq(systemNotifications.userId, userId)),
    ).toHaveLength(1);
  });
  it('resumes an expired daily lease after restart', async () => {
    await db.insert(jobSearchSettings).values({
      userId,
      settings: { ...DEFAULT_SEARCH_SETTINGS, dailyDiscovery: true },
      dailyLeaseAt: new Date(Date.now() - 16 * 60_000),
    });
    const discoverForCandidate = vi.fn(async () => ({ sourcesSummary: [], newJobsIngested: 0 }));
    await new DailySearchService(
      db,
      { discoverForCandidate } as unknown as JobDiscoveryService,
      {} as PreparationBatchService,
      {} as MatchService,
    ).runDue();
    expect(discoverForCandidate).toHaveBeenCalledTimes(1);
  });
  it('keeps discovery disabled until candidate opt-in', async () => {
    await db.insert(jobSearchSettings).values({ userId, settings: DEFAULT_SEARCH_SETTINGS });
    const discoverForCandidate = vi.fn();
    await new DailySearchService(
      db,
      { discoverForCandidate } as unknown as JobDiscoveryService,
      {} as PreparationBatchService,
      {} as MatchService,
    ).runDue();
    expect(discoverForCandidate).not.toHaveBeenCalled();
  });
});
