import { isDeepStrictEqual } from 'node:util';
import { getConfig } from '@job-agent/config';
import { and, eq, inArray } from 'drizzle-orm';
import { AppError, AUTOPILOT_TERMS, type AutopilotGrant } from '@job-agent/shared';
import type { Database } from '../client.js';
import { approvalRequests } from '../schema/approval-requests.js';
import { applicationPolicy } from '../schema/application-policy.js';
import type { Job } from '../schema/jobs.js';
import { computePreparationFingerprint } from './preparation-fingerprint.js';

// Empty job key produces a candidate-only fingerprint using the existing verified input boundary.
export const autopilotCandidateFingerprint = (db: Database, userId: string) =>
  computePreparationFingerprint(db, userId, '00000000-0000-0000-0000-000000000000', null);

export function autopilotJobInScope(grant: AutopilotGrant, job: Job): boolean {
  const p = grant.preferences;
  const normalize = (s: string) => s.toLowerCase().replace(/[-_]/g, ' ').trim();
  const contains = (text: string, values: string[]) =>
    values.some((v) => normalize(text).includes(normalize(v)));
  if (!p.targetTitles.length || !contains(job.title, p.targetTitles)) return false;
  if (
    p.preferredLocations.length &&
    !contains(
      [job.locationText, job.city, job.region, job.country].filter(Boolean).join(' '),
      p.preferredLocations,
    )
  )
    return false;
  if (p.workModes.length && !p.workModes.some((v) => normalize(v) === normalize(job.workplaceType)))
    return false;
  if (
    p.employmentTypes.length &&
    !p.employmentTypes.some((v) => normalize(v) === normalize(job.employmentType))
  )
    return false;
  if (
    contains(job.company, p.excludedCompanies) ||
    contains(job.title + ' ' + job.description, p.excludedKeywords)
  )
    return false;
  if (
    p.minSalary != null &&
    (job.minSalary == null ||
      job.minSalary < p.minSalary ||
      job.currency !== p.currency ||
      !p.salaryPayPeriod ||
      job.payPeriod !== p.salaryPayPeriod)
  )
    return false;
  if (!p.acceptUnpaid && /\bunpaid\b/i.test(job.description)) return false;
  if (job.employmentType === 'INTERNSHIP' && p.internshipEligible !== true) return false;
  return (
    !job.isDuplicate &&
    !['ARCHIVED', 'INVALID', 'DUPLICATE'].includes(job.state) &&
    (!job.expirationDate || job.expirationDate > new Date())
  );
}

export async function assertAutopilotGrant(
  db: Database,
  userId: string,
  grant: AutopilotGrant,
  job?: Job,
) {
  const [policy] = await db
    .select()
    .from(applicationPolicy)
    .where(and(eq(applicationPolicy.userId, userId)));
  if (
    !getConfig().AUTOPILOT_ENABLED ||
    !policy?.autoApplyEnabled ||
    !policy.autopilotGrant ||
    policy.autopilotVersion !== grant.version ||
    !isDeepStrictEqual(policy.autopilotGrant, grant) ||
    grant.termsVersion !== AUTOPILOT_TERMS ||
    policy.maxApplicationsPerDay !== grant.maxPerDay ||
    policy.autoApplyMinScore !== grant.minScore ||
    !policy.blockOnUnresolvedReview ||
    !policy.blockOnManual ||
    !policy.blockOnUnknownSensitive ||
    grant.candidateFingerprint !== (await autopilotCandidateFingerprint(db, userId))
  )
    throw AppError.forbidden(
      'Autopilot permission is paused or its inputs changed. Review and explicitly authorize a new policy.',
    );
  if (job) {
    const [pending] = await db
      .select({ id: approvalRequests.id })
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.userId, userId),
          inArray(approvalRequests.status, ['PENDING', 'NEEDS_USER_RECONFIRMATION']),
        ),
      )
      .limit(1);
    if (pending)
      throw AppError.forbidden('Resolve pending candidate reviews before Autopilot can continue.');
  }
  if (job && !autopilotJobInScope(grant, job))
    throw AppError.forbidden('This vacancy is outside the accepted Autopilot policy.');
}
