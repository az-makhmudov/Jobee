import { beforeAll, beforeEach, afterEach, afterAll, describe, it, expect, vi } from 'vitest';
import { getConfig } from '@job-agent/config';
import {
  getDb,
  closeDbPool,
  users,
  jobs,
  jobPreferences,
  applicationPolicy,
  candidateSkills,
  jobRequirements,
  jobMatchAnalyses,
  orchestrationRuns,
  eq,
  evaluateTestDatabaseSafety,
} from '@job-agent/database';
import { MatchService, DisabledAiProvider, type AiProvider } from '@job-agent/database/matching';
import { buildApp } from '../apps/api/src/app.js';
import { JobService } from '../apps/api/src/services/job-service.js';
import { AutonomousOrchestrator } from '../apps/worker/src/engine/autonomous-orchestrator.js';

const db = getDb(process.env.DATABASE_URL);
let userId: string, jobId: string;
let app: ReturnType<typeof buildApp>;
const match = new MatchService(db, new DisabledAiProvider());
const jobService = new JobService(db);
beforeAll(async () => {
  if (!evaluateTestDatabaseSafety(process.env.DATABASE_URL).safe)
    throw new Error('Isolated test database required');
  app = buildApp({
    config: { ...getConfig(), NODE_ENV: 'test', AI_PROVIDER: 'disabled' },
    db,
    matchService: match,
    aiProvider: new DisabledAiProvider(),
  });
  await app.ready();
});
beforeEach(async () => {
  const [user] = await db
    .insert(users)
    .values({ name: 'Matching fixture', email: `matching-${crypto.randomUUID()}@example.test` })
    .returning();
  userId = user!.id;
  await db.insert(jobPreferences).values({
    userId,
    targetTitles: ['Software Engineer'],
    workModes: ['remote'],
    employmentTypes: ['full-time'],
    workAuthorizationCountries: ['DE'],
    needsSponsorship: false,
    willingToRelocate: true,
  });
  await db
    .insert(applicationPolicy)
    .values({ userId, autoApplyEnabled: true, minScoreForReview: 50, autoApplyMinScore: 70 });
  await db.insert(candidateSkills).values(
    ['TypeScript', 'Node.js'].map((name) => ({
      userId,
      name,
      verificationStatus: 'VERIFIED',
      allowAiUse: true,
    })),
  );
  const [job] = await db
    .insert(jobs)
    .values({
      userId,
      title: 'Software Engineer',
      company: 'Fixture Company',
      description: 'Build software services with verified TypeScript and Node.js skills. '.repeat(
        14,
      ),
      country: 'Germany',
      locationText: 'Berlin, Germany',
      city: 'Berlin',
      workplaceType: 'REMOTE',
      employmentType: 'FULL_TIME',
      state: 'INGESTED',
      contentHash: crypto.randomUUID(),
    })
    .returning();
  jobId = job!.id;
  await db.insert(jobRequirements).values(
    ['TypeScript', 'Node.js'].map((name) => ({
      userId,
      jobId,
      rawText: `Must have ${name} skills`,
      category: 'SKILL',
      requirementStrength: 'MANDATORY',
    })),
  );
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete(users).where(eq(users.id, userId));
});
afterAll(async () => {
  await app.close();
  await closeDbPool();
});
const analyze = async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/jobs/${jobId}/analyze`,
    headers: { 'x-test-user-id': userId },
    payload: {},
  });
  expect(response.statusCode).toBe(200);
  return response.json().data;
};
const updateJob = async (values: Partial<typeof jobs.$inferInsert>) => {
  await db.update(jobs).set(values).where(eq(jobs.id, jobId));
};
const updatePreferences = async (values: Partial<typeof jobPreferences.$inferInsert>) => {
  await db.update(jobPreferences).set(values).where(eq(jobPreferences.userId, userId));
};

describe('Grounded matching across Explore and scheduled execution (JOB-P2-T02)', () => {
  it('reuses API evaluations in the worker, preserves ingestion state and re-evaluates changed preferences', async () => {
    const initial = await analyze();
    expect(initial.decision).toBe('MATCH');
    const worker = new AutonomousOrchestrator(db);
    await worker.executeRun(userId, 'MATCHING', 'MANUAL');
    expect(await match.findMatchedJobs(userId)).toHaveLength(1);
    expect(
      await db.select().from(jobMatchAnalyses).where(eq(jobMatchAnalyses.userId, userId)),
    ).toHaveLength(1);
    await updatePreferences({ excludedCompanies: ['Fixture Company'] });
    const list = await jobService.getJobs(userId);
    expect(list.items[0]!.matchSummary?.isStale).toBe(true);
    expect(await match.findMatchedJobs(userId)).toHaveLength(0);
    const runId = await worker.executeRun(userId, 'MATCHING', 'MANUAL');
    const run = (
      await db.select().from(orchestrationRuns).where(eq(orchestrationRuns.id, runId))
    )[0]!;
    expect((run.summary as { matching: { skipped: number } }).matching.skipped).toBe(1);
    const changed = await match.getJobAnalysis(jobId, userId);
    expect(changed!.decision).toBe('SKIP');
    expect(changed!.hardBlockers[0]).toContain('excluded');
    expect((await db.select().from(jobs).where(eq(jobs.id, jobId)))[0]!.state).toBe('INGESTED');
  });
  it('blocks an explicit work-mode conflict even when relocation is allowed', async () => {
    await updateJob({ workplaceType: 'ONSITE' });
    const analysis = await analyze();
    expect(analysis.decision).toBe('SKIP');
    expect(analysis.reasonCodes).toContain('WORK_MODE_NOT_ALLOWED');
  });
  it.each([null, 'Canada'])(
    'keeps remote jurisdiction %s unresolved instead of inferring global work rights from no sponsorship',
    async (country) => {
      await updateJob({ country });
      const analysis = await analyze();
      expect(analysis.decision).toBe('REVIEW');
      expect(analysis.autoApplyEligible).toBe(false);
      expect(analysis.hardBlockers).toEqual([]);
      expect(analysis.unknowns.join(' ')).toMatch(/authorization/);
    },
  );
  it('does not turn an equal-opportunity citizenship statement into a new eligibility requirement', async () => {
    await updateJob({
      description:
        'We consider all applicants without regard to citizenship. ' +
        'Build TypeScript services. '.repeat(30),
    });
    const analysis = await analyze();
    expect(analysis.decision).toBe('MATCH');
    expect(analysis.unknowns.join(' ')).not.toContain('Citizenship');
  });
  it('keeps a missing city unresolved rather than inventing a relocation conflict', async () => {
    await updatePreferences({
      workModes: ['onsite'],
      preferredLocations: ['Berlin'],
      willingToRelocate: false,
    });
    await updateJob({ workplaceType: 'ONSITE', city: null, locationText: 'Germany' });
    const analysis = await analyze();
    expect(analysis.decision).toBe('REVIEW');
    expect(analysis.reasonCodes).not.toContain('LOCATION_NOT_ALLOWED');
  });
  it('does not infer citizenship from country authorization', async () => {
    await updateJob({
      description: 'Must be a US citizen. ' + 'Build TypeScript services. '.repeat(30),
    });
    const analysis = await analyze();
    expect(analysis.decision).toBe('REVIEW');
    expect(analysis.autoApplyEligible).toBe(false);
    expect(analysis.unknowns.join(' ')).toMatch(/Citizenship/);
  });
  it('compares salary only with confirmed units and matching currency', async () => {
    await updatePreferences({ minSalary: 80000, currency: 'EUR', salaryPayPeriod: null });
    await updateJob({ maxSalary: 40, currency: 'EUR', payPeriod: 'HOUR' });
    const unknown = await analyze();
    expect(unknown.hardBlockers).toEqual([]);
    expect(unknown.decision).toBe('REVIEW');
    expect(unknown.autoApplyEligible).toBe(false);
    await updatePreferences({ salaryPayPeriod: 'YEAR' });
    expect((await analyze()).hardBlockers).toEqual([]);
    await updateJob({ payPeriod: 'YEAR', maxSalary: 65000, currency: 'USD' });
    expect((await analyze()).hardBlockers).toEqual([]);
    await updateJob({ currency: 'EUR' });
    const blocked = await analyze();
    expect(blocked.decision).toBe('SKIP');
    expect(blocked.reasonCodes).toContain('SALARY_BELOW_MINIMUM');
  });
  it('distinguishes unconfirmed internship eligibility from a confirmed blocker', async () => {
    await updatePreferences({ employmentTypes: ['internship'], internshipEligible: null });
    await updateJob({ employmentType: 'INTERNSHIP' });
    expect((await analyze()).decision).toBe('REVIEW');
    await updatePreferences({ internshipEligible: false });
    const blocked = await analyze();
    expect(blocked.decision).toBe('SKIP');
    expect(blocked.reasonCodes).toContain('INTERNSHIP_NOT_ALLOWED');
  });
  it('rejects invented AI evidence and free-form candidate claims without overriding eligibility uncertainty', async () => {
    await updateJob({ country: null });
    await db.insert(candidateSkills).values({
      userId,
      name: 'Unverified Kubernetes',
      verificationStatus: 'UNVERIFIED',
      allowAiUse: true,
    });
    const provider: AiProvider = {
      name: 'fixture',
      isAvailable: () => true,
      analyzeMatch: vi.fn(async (context) => {
        expect(
          context.candidateContext.skills.every((skill) => !skill.name.includes('Unverified')),
        ).toBe(true);
        return {
          evaluations: context.requirements.map((requirement) => ({
            requirementId: requirement.id,
            status: 'MET' as const,
            evidenceIds: ['invented-id'],
            confidence: 100,
            reason: 'Invented candidate credential',
          })),
          roleFitScore: 100,
          skillsFitScore: 100,
          strengths: ['Candidate has an invented PhD'],
          gaps: [],
          semanticSummary: 'Invented summary',
          provider: 'fixture',
          model: 'offline',
        };
      }),
    };
    const analysis = await new MatchService(db, provider).analyzeJob(jobId, userId, {
      force: true,
    });
    expect(analysis.decision).toBe('REVIEW');
    expect(analysis.autoApplyEligible).toBe(false);
    expect(analysis.strengths.join(' ')).not.toContain('PhD');
    expect(analysis.evaluations.flatMap((e) => e.evidenceIds)).not.toContain('invented-id');
  });
  it('ignores requirement row order and check-only timestamps when deciding freshness', async () => {
    const first = await analyze();
    await updateJob({ lastCheckedDate: new Date() });
    const second = await match.analyzeJob(jobId, userId);
    expect(second.id).toBe(first.id);
  });
  it('finds unseen jobs beyond the old batch scan window and never crosses tenant ownership', async () => {
    const older = await db
      .insert(jobs)
      .values(
        Array.from({ length: 22 }, (_, i) => ({
          userId,
          title: `Already analyzed ${i}`,
          company: 'Fixture',
          description: 'Historical fixture description',
          contentHash: crypto.randomUUID(),
        })),
      )
      .returning();
    await db.insert(jobMatchAnalyses).values(
      older.map((job) => ({
        userId,
        jobId: job.id,
        overallScore: 50,
        confidenceScore: 50,
        decision: 'REVIEW',
        analysisMode: 'DETERMINISTIC_ONLY',
        algorithmVersion: 'fixture',
        inputFingerprint: 'fixture',
        summaryExplanation: 'Older fixture',
      })),
    );
    const result = await match.batchAnalyzeJobs(userId, { limit: 1, unanalyzedOnly: true });
    expect(result.results.map((item) => item.jobId)).toEqual([jobId]);
    const [other] = await db
      .insert(users)
      .values({ name: 'Other fixture', email: `other-${crypto.randomUUID()}@example.test` })
      .returning();
    try {
      await expect(match.analyzeJob(jobId, other!.id)).rejects.toMatchObject({ statusCode: 404 });
      expect(await match.findMatchedJobs(other!.id)).toHaveLength(0);
    } finally {
      await db.delete(users).where(eq(users.id, other!.id));
    }
  });
});
