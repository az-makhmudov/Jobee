import {
  createDatabaseClient,
  assertSafeTestDatabase,
  assertSafeTestUser,
  jobs,
  users,
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
import { MATCH_ALGORITHM_VERSION } from '@job-agent/shared';
/** Explicit UI fixtures only. Never call this for real accounts or provider validation. */
export async function seedUiMatches(
  databaseUrl: string,
  userId: string,
  jobIds: string[],
  resetQueue = false,
  unknowns: string[] = [],
) {
  assertSafeTestDatabase(databaseUrl);
  assertSafeTestUser(userId);
  const client = createDatabaseClient(databaseUrl);
  try {
    const [user] = await client.db.select().from(users).where(eq(users.id, userId));
    if (user?.email !== 'alex.morgan@example.test')
      throw new Error('Synthetic preview account required');
    if (resetQueue)
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
    const fixtureJobs = await client.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.userId, userId), inArray(jobs.id, jobIds)));
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
        reasonCodes: unknowns.length
          ? ['MATCH_THRESHOLD_MET', 'POLICY_INFORMATION_MISSING']
          : ['MATCH_THRESHOLD_MET'],
        analysisMode: 'DETERMINISTIC_ONLY',
        summaryExplanation: 'Synthetic UI-only match fixture; not a live AI evaluation.',
        autoApplyEligible: false,
      });
  } finally {
    await client.close();
  }
}
