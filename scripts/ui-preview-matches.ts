import {
  createDatabaseClient,
  assertSafeTestDatabase,
  assertSafeTestUser,
  jobs,
  users,
  candidateProfiles,
  jobMatchAnalyses,
  orchestrationRuns,
  eq,
  and,
  inArray,
} from '@job-agent/database';
import {
  currentMatchingInputs,
  matchingFingerprint,
  RECOMMENDATION_TASK,
} from '@job-agent/database/matching';
import { notInArray } from 'drizzle-orm';
import { MATCH_ALGORITHM_VERSION } from '@job-agent/shared';
/** Explicit UI fixtures only. Never call this for real accounts or provider validation. */
export async function seedUiMatches(
  databaseUrl: string,
  userId: string,
  jobIds: string[],
  resetQueue = false,
  unknowns: string[] = [],
  salaryBlocker = '',
) {
  assertSafeTestDatabase(databaseUrl);
  assertSafeTestUser(userId);
  const client = createDatabaseClient(databaseUrl);
  try {
    const [user] = await client.db.select().from(users).where(eq(users.id, userId));
    if (user?.email !== 'alex.morgan@example.test')
      throw new Error('Synthetic preview account required');
    const fixtureJobs = await client.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.userId, userId), inArray(jobs.id, jobIds)));
    if (!fixtureJobs.length || fixtureJobs.length !== new Set(jobIds).size)
      throw new Error('Owned preview job IDs required');
    if (resetQueue) {
      const [profile] = await client.db
        .select()
        .from(candidateProfiles)
        .where(eq(candidateProfiles.userId, userId));
      if (!profile?.summary?.startsWith('Synthetic preview profile.'))
        throw new Error('Marked synthetic preview profile required');
      // Archive only leftover jobs owned by this disposable preview fixture, preserving original IDs/history.
      await client.db
        .update(jobs)
        .set({ state: 'ARCHIVED' })
        .where(and(eq(jobs.userId, userId), notInArray(jobs.id, jobIds)));
      await client.db
        .update(orchestrationRuns)
        .set({ status: 'CANCELLED', completedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(orchestrationRuns.userId, userId),
            eq(orchestrationRuns.taskType, RECOMMENDATION_TASK),
            inArray(orchestrationRuns.status, ['PENDING', 'RUNNING']),
          ),
        );
    }
    const inputs = await currentMatchingInputs(client.db, userId, fixtureJobs);
    for (const job of fixtureJobs)
      await client.db.insert(jobMatchAnalyses).values({
        userId,
        jobId: job.id,
        algorithmVersion: MATCH_ALGORITHM_VERSION,
        inputFingerprint: matchingFingerprint(
          job,
          inputs.requirementsByJob.get(job.id) ?? [],
          inputs.context.candidateStateHash,
        ),
        overallScore: 80,
        confidenceScore: 90,
        decision: 'MATCH',
        unknowns,
        hardBlockers: salaryBlocker ? [salaryBlocker] : [],
        reasonCodes: [
          'MATCH_THRESHOLD_MET',
          ...(unknowns.length ? ['POLICY_INFORMATION_MISSING'] : []),
          ...(salaryBlocker ? ['SALARY_BELOW_MINIMUM'] : []),
        ],
        analysisMode: 'DETERMINISTIC_ONLY',
        summaryExplanation: 'Synthetic UI-only match fixture; not a live AI evaluation.',
        autoApplyEligible: false,
      });
  } finally {
    await client.close();
  }
}
