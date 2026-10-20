import crypto from 'node:crypto';
import { eq, and, inArray, desc } from 'drizzle-orm';
import type { Database } from '../client.js';
import {
  jobRequirements,
  jobMatchAnalyses,
  jobEvents,
  type Job,
  type JobRequirement,
} from '../schema/index.js';
import { MATCH_ALGORITHM_VERSION } from '@job-agent/shared';
import { MatchingContextBuilder } from './matching-context-builder.js';

export function matchingFingerprint(
  job: Job,
  requirements: JobRequirement[],
  candidateStateHash: string,
  algorithmVersion = MATCH_ALGORITHM_VERSION,
): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        algorithmVersion,
        candidateStateHash,
        job: [
          job.id,
          job.title,
          job.company,
          job.description,
          job.country,
          job.city,
          job.region,
          job.locationText,
          job.workplaceType,
          job.employmentType,
          job.seniority,
          job.minSalary,
          job.maxSalary,
          job.currency,
          job.payPeriod,
        ],
        requirements: [...requirements]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((r) => [r.id, r.category, r.requirementStrength, r.rawText]),
      }),
    )
    .digest('hex');
}
/** One freshness check for UI ranking, manual batches and worker selection. No AI/network calls. */
export async function currentMatchingInputs(db: Database, userId: string, jobList: Job[]) {
  const context = await new MatchingContextBuilder(db).buildContext(userId);
  const ids = jobList.map((job) => job.id);
  const [requirements, analyses] = ids.length
    ? await Promise.all([
        db
          .select()
          .from(jobRequirements)
          .where(
            and(
              eq(jobRequirements.userId, userId),
              eq(jobRequirements.isCurrent, true),
              inArray(jobRequirements.jobId, ids),
            ),
          ),
        db
          .select()
          .from(jobMatchAnalyses)
          .where(and(eq(jobMatchAnalyses.userId, userId), inArray(jobMatchAnalyses.jobId, ids)))
          .orderBy(desc(jobMatchAnalyses.createdAt)),
      ])
    : [[], []];
  const requirementsByJob = new Map<string, JobRequirement[]>();
  for (const requirement of requirements)
    requirementsByJob.set(requirement.jobId, [
      ...(requirementsByJob.get(requirement.jobId) ?? []),
      requirement,
    ]);
  const analysesByJob = new Map<string, (typeof analyses)[number]>();
  for (const analysis of analyses)
    if (!analysesByJob.has(analysis.jobId)) analysesByJob.set(analysis.jobId, analysis);
  const staleIds: string[] = [];
  for (const job of jobList) {
    const analysis = analysesByJob.get(job.id);
    if (
      analysis &&
      (analysis.isStale ||
        analysis.algorithmVersion !== MATCH_ALGORITHM_VERSION ||
        analysis.inputFingerprint !==
          matchingFingerprint(job, requirementsByJob.get(job.id) ?? [], context.candidateStateHash))
    ) {
      if (!analysis.isStale || analysis.autoApplyEligible) staleIds.push(analysis.id);
      analysis.isStale = true;
      analysis.autoApplyEligible = false;
    }
  }
  if (staleIds.length)
    await db.transaction(async (tx) => {
      await tx
        .update(jobMatchAnalyses)
        .set({ isStale: true, autoApplyEligible: false })
        .where(and(eq(jobMatchAnalyses.userId, userId), inArray(jobMatchAnalyses.id, staleIds)));
      await tx.insert(jobEvents).values(
        [...analysesByJob.values()]
          .filter((analysis) => staleIds.includes(analysis.id))
          .map((analysis) => ({
            userId,
            jobId: analysis.jobId,
            eventType: 'JOB_ANALYSIS_STALE',
            changedFields: [],
            metadata: {
              analysisId: analysis.id,
              reason: 'Candidate, posting or algorithm fingerprint changed',
            },
          })),
      );
    });
  return { context, requirementsByJob, analysesByJob };
}
