import { assertAutopilotGrant } from './autopilot-authorization.js';
import crypto from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { applicationIntents } from '../schema/application-intents.js';
import { answerLibrary } from '../schema/answer-library.js';
import { applicationQuestions } from '../schema/application-questions.js';
import { applicationPackages } from '../schema/application-packages.js';
import { applicationPackageVersions } from '../schema/application-package-versions.js';
import { applications } from '../schema/applications.js';
import { jobs } from '../schema/jobs.js';
import { computePreparationFingerprint } from './preparation-fingerprint.js';
import { AppError, APPLICATION_INTENT_TERMS } from '@job-agent/shared';

export async function computeIntentFingerprint(
  db: Database,
  userId: string,
  jobId: string,
  cvId: string | null,
) {
  const preparation = await computePreparationFingerprint(db, userId, jobId, cvId);
  const job = await db.execute(
    sql`SELECT to_jsonb(j) - 'updated_at' - 'created_at' - 'last_checked_date' AS snapshot FROM jobs j WHERE id=${jobId} AND user_id=${userId}`,
  );
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ version: 1, preparation, job: job.rows }))
    .digest('hex');
}

export async function snapshotIntentAnswers(
  db: Database,
  userId: string,
): Promise<Record<string, string>> {
  const answers = await db.select().from(answerLibrary).where(eq(answerLibrary.userId, userId));
  return Object.fromEntries(
    answers.map((answer) => [
      answer.id,
      crypto.createHash('sha256').update(JSON.stringify(answer)).digest('hex'),
    ]),
  );
}
export function intentAnswerSources(intent: typeof applicationIntents.$inferSelect) {
  return [...intent.events].reverse().find((event) => event.answerSources)?.answerSources ?? {};
}

/** Reused at queue, worker claim and the final safe dispatch boundary. Never grants policy authority. */
export async function assertApplicationIntent(
  db: Database,
  userId: string,
  applicationId: string,
  intentId: string,
  expected?: { runId: string; checksum: string },
) {
  const [intent] = await db
    .select()
    .from(applicationIntents)
    .where(
      and(
        eq(applicationIntents.id, intentId),
        eq(applicationIntents.userId, userId),
        eq(applicationIntents.applicationId, applicationId),
      ),
    );
  if (!intent) throw AppError.notFound('Application permission not found.');
  if (
    intent.termsVersion !== APPLICATION_INTENT_TERMS ||
    intent.revokedAt ||
    intent.expiresAt.getTime() <= Date.now() ||
    !['AUTHORIZED', 'PREPARING', 'QUEUED'].includes(intent.status)
  )
    throw AppError.forbidden(
      'Application permission expired, paused or was cancelled. Review and resume to authorize a new attempt.',
    );
  const [record] = await db
    .select({ app: applications, job: jobs })
    .from(applications)
    .innerJoin(jobs, and(eq(jobs.id, applications.jobId), eq(jobs.userId, userId)))
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)));
  if (
    !record ||
    record.job.id !== intent.jobId ||
    record.app.appliedAt ||
    ['ARCHIVED', 'INVALID'].includes(record.job.state) ||
    (record.job.expirationDate && record.job.expirationDate < new Date())
  )
    throw AppError.badRequest('This application is already sent or the vacancy is unavailable.');
  if (intent.autopilotGrant)
    await assertAutopilotGrant(db, userId, intent.autopilotGrant, record.job);
  const target =
    record.app.applicationUrl ||
    record.job.applicationUrl ||
    record.job.originalUrl ||
    record.job.canonicalUrl ||
    '';
  if (
    target !== intent.targetUrl ||
    intent.inputFingerprint !==
      (await computeIntentFingerprint(db, userId, intent.jobId, intent.selectedCvId))
  )
    throw AppError.forbidden(
      'Profile, saved answers, documents or vacancy changed. Review and resume with the current information.',
    );
  if (
    expected &&
    (intent.runId !== expected.runId || intent.manifestChecksum !== expected.checksum)
  )
    throw AppError.forbidden('The application attempt or prepared materials changed.');
  if (record.app.currentPackageId) {
    const used = await db
      .select({ sourceId: applicationQuestions.sourceEntityId })
      .from(applicationQuestions)
      .innerJoin(
        applicationPackageVersions,
        eq(applicationPackageVersions.id, applicationQuestions.versionId),
      )
      .innerJoin(
        applicationPackages,
        and(
          eq(applicationPackages.id, applicationPackageVersions.packageId),
          eq(applicationPackages.currentVersionNumber, applicationPackageVersions.versionNumber),
        ),
      )
      .where(
        and(
          eq(applicationPackages.id, record.app.currentPackageId),
          eq(applicationQuestions.answerSource, 'ANSWER_LIBRARY'),
        ),
      );
    if (used.length) {
      const authorized = intentAnswerSources(intent),
        current = await snapshotIntentAnswers(db, userId);
      if (
        used.some(
          (q) =>
            !q.sourceId ||
            !authorized[q.sourceId] ||
            authorized[q.sourceId] !== current[q.sourceId],
        )
      )
        throw AppError.forbidden(
          'A used saved answer changed after permission was granted. Review and resume.',
        );
    }
  }
  return intent;
}
