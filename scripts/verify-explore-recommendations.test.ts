import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  getDb,
  users,
  jobs,
  jobPreferences,
  jobMatchAnalyses,
  orchestrationRuns,
  eq,
  and,
  assertSafeTestDatabase,
} from '@job-agent/database';
import {
  RecommendationService,
  RECOMMENDATION_TASK,
  currentMatchingInputs,
  matchingFingerprint,
  matchesPreferredLocation,
} from '@job-agent/database/matching';
import { MATCH_ALGORITHM_VERSION } from '@job-agent/shared';
import { JobService } from '../apps/api/src/services/job-service.js';
const db = getDb();
let userId: string;
const matcher = { analyzeJob: vi.fn() };
const service = new RecommendationService(db, matcher);
const library = new JobService(db);
let jobId: string;
async function insertAnalysis(id: string, decision = 'MATCH') {
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.userId, userId), eq(jobs.id, id)));
  const inputs = await currentMatchingInputs(db, userId, [job!]);
  await db.insert(jobMatchAnalyses).values({
    userId,
    jobId: id,
    algorithmVersion: MATCH_ALGORITHM_VERSION,
    inputFingerprint: matchingFingerprint(job!, [], inputs.context.candidateStateHash),
    overallScore: 85,
    confidenceScore: 90,
    decision,
    analysisMode: 'DETERMINISTIC_ONLY',
    summaryExplanation: 'Explicit synthetic recommendation fixture.',
    autoApplyEligible: false,
  });
}
beforeEach(async () => {
  assertSafeTestDatabase();
  const [user] = await db
    .insert(users)
    .values({
      name: 'Recommendation fixture',
      email: `recommendation-${crypto.randomUUID()}@example.test`,
    })
    .returning();
  userId = user!.id;
  await db.insert(jobPreferences).values({
    userId,
    preferredLocations: ['Warsaw'],
    seniorityLevels: ['ENTRY'],
    willingToRelocate: true,
  });
  const rows = await db
    .insert(jobs)
    .values(
      [
        { title: 'Junior Developer', city: 'Warsaw', country: 'Poland' },
        { title: 'Junior Developer', city: 'London', country: 'United Kingdom' },
        { title: 'Senior Developer', city: 'Warsaw', country: 'Poland' },
      ].map((item) => ({
        ...item,
        userId,
        company: 'Synthetic fixture',
        description: 'Synthetic job description.',
        contentHash: crypto.randomUUID(),
      })),
    )
    .returning();
  jobId = rows[0]!.id;
  matcher.analyzeJob.mockReset();
  matcher.analyzeJob.mockImplementation(async (id: string) => insertAnalysis(id));
});
afterEach(async () => {
  await db.delete(users).where(eq(users.id, userId));
});
const recommended = () => library.getJobs(userId, { recommendationsOnly: true });
it('withholds unanalyzed jobs, analyzes automatically from the durable queue and publishes only current MATCH results', async () => {
  expect((await recommended()).items).toEqual([]);
  await Promise.all([service.request(userId), service.request(userId), service.request(userId)]);
  expect(
    await db.select().from(orchestrationRuns).where(eq(orchestrationRuns.userId, userId)),
  ).toHaveLength(1);
  expect((await service.status(userId)).pending).toBe(1);
  await service.processOne(userId);
  expect(matcher.analyzeJob).toHaveBeenCalledExactlyOnceWith(jobId, userId);
  expect((await recommended()).items.map((job) => job.id)).toEqual([jobId]);
  await service.request(userId);
  expect(
    await db.select().from(orchestrationRuns).where(eq(orchestrationRuns.userId, userId)),
  ).toHaveLength(1);
  await db
    .update(jobPreferences)
    .set({ seniorityLevels: ['ENTRY', 'INTERNSHIP'] })
    .where(eq(jobPreferences.userId, userId));
  expect((await recommended()).items).toEqual([]);
});
it('never publishes REVIEW or stale results and preserves the raw saved library', async () => {
  await insertAnalysis(jobId, 'REVIEW');
  expect((await recommended()).total).toBe(0);
  expect((await library.getJobs(userId)).total).toBe(3);
  await insertAnalysis(jobId);
  expect((await recommended()).total).toBe(1);
  await db
    .update(jobMatchAnalyses)
    .set({ isStale: true })
    .where(eq(jobMatchAnalyses.userId, userId));
  expect((await recommended()).total).toBe(0);
});
it('does not let relocation or country qualifiers broaden a Warsaw recommendation', async () => {
  await db
    .update(jobPreferences)
    .set({ preferredLocations: ['Warsaw', 'Poland'] })
    .where(eq(jobPreferences.userId, userId));
  await db.update(jobs).set({ city: 'Krakow' }).where(eq(jobs.id, jobId));
  expect((await service.request(userId)).pending).toBe(0);
  expect(matcher.analyzeJob).not.toHaveBeenCalled();
});
it('fences concurrent workers so one queued job produces one analysis', async () => {
  let finish!: () => void;
  const held = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  matcher.analyzeJob.mockImplementation(async (id: string) => {
    entered();
    await held;
    await insertAnalysis(id);
  });
  await service.request(userId);
  const first = service.processOne(userId);
  await started;
  expect(await service.processOne(userId)).toBe(false);
  finish();
  await first;
  expect(matcher.analyzeJob).toHaveBeenCalledTimes(1);
});
it('does not retry failed analyses on reload; retry is explicit and current successes stay cached', async () => {
  matcher.analyzeJob.mockRejectedValueOnce(
    new Error('Synthetic provider failure with private details'),
  );
  await service.request(userId);
  await service.processOne(userId);
  expect((await service.request(userId)).state).toBe('FAILED');
  expect(
    await db.select().from(orchestrationRuns).where(eq(orchestrationRuns.userId, userId)),
  ).toHaveLength(1);
  expect((await service.status(userId)).message).not.toContain('private details');
  await service.request(userId, true);
  await service.processOne(userId);
  expect((await recommended()).total).toBe(1);
});
it('cancels queued work when preferences change before analysis', async () => {
  await service.request(userId);
  await db
    .update(jobPreferences)
    .set({ preferredLocations: ['Berlin'] })
    .where(eq(jobPreferences.userId, userId));
  await service.processOne(userId);
  expect(matcher.analyzeJob).not.toHaveBeenCalled();
  const [run] = await db
    .select()
    .from(orchestrationRuns)
    .where(
      and(
        eq(orchestrationRuns.userId, userId),
        eq(orchestrationRuns.taskType, RECOMMENDATION_TASK),
      ),
    );
  expect(run!.status).toBe('CANCELLED');
});
it('continues beyond the first bounded batch without reanalyzing completed jobs', async () => {
  await db.insert(jobs).values(
    Array.from({ length: 11 }, (_, i) => ({
      userId,
      title: `Junior Developer ${i}`,
      city: 'Warsaw',
      country: 'Poland',
      company: 'Synthetic fixture',
      description: 'Synthetic job.',
      contentHash: crypto.randomUUID(),
    })),
  );
  await service.request(userId);
  for (let i = 0; i < 10; i++) await service.processOne(userId);
  expect((await service.status(userId)).pending).toBe(2);
  await service.request(userId);
  await service.processOne(userId);
  await service.processOne(userId);
  expect((await service.status(userId)).pending).toBe(0);
  expect((await recommended()).total).toBe(12);
  expect(matcher.analyzeJob).toHaveBeenCalledTimes(12);
});

it('does not infer remote scope from relocation, but respects an explicit Remote target', async () => {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  const [prefs] = await db.select().from(jobPreferences).where(eq(jobPreferences.userId, userId));
  const remote = {
    ...job!,
    city: 'London',
    country: 'United Kingdom',
    locationText: 'London, United Kingdom',
    workplaceType: 'REMOTE',
  };
  expect(matchesPreferredLocation(remote, prefs!)).toBe(false);
  expect(
    matchesPreferredLocation(remote, { ...prefs!, preferredLocations: ['Warsaw', 'Remote'] }),
  ).toBe(true);
  expect(
    matchesPreferredLocation(remote, {
      ...prefs!,
      preferredLocations: ['Warsaw', 'Poland', 'Remote'],
    }),
  ).toBe(false);
});

it('clears an old queue failure once a current analysis has resolved the pending job', async () => {
  matcher.analyzeJob.mockRejectedValueOnce(new Error('Synthetic failure'));
  await service.request(userId);
  await service.processOne(userId);
  expect((await service.status(userId)).state).toBe('FAILED');
  await insertAnalysis(jobId);
  expect((await service.status(userId)).state).toBe('IDLE');
  expect((await service.status(userId)).ready).toBe(1);
});

it('queues and publishes primary matches even when a secondary salary policy blocks applying', async () => {
  await db
    .update(jobPreferences)
    .set({ minSalary: 100000, currency: 'PLN', salaryPayPeriod: 'YEAR' })
    .where(eq(jobPreferences.userId, userId));
  await db
    .update(jobs)
    .set({ maxSalary: 50000, currency: 'PLN', payPeriod: 'YEAR' })
    .where(eq(jobs.id, jobId));
  await service.request(userId);
  expect((await service.status(userId)).pending).toBe(1);
  await service.processOne(userId);
  expect((await recommended()).items.map((job) => job.id)).toEqual([jobId]);
});
