import { and, eq } from 'drizzle-orm';
import {
  type Database,
  applicationQuestions,
  approvalRequests,
  applicationPackages,
  applicationPackageVersions,
  applications,
  candidateProfiles,
  candidateLinks,
  answerLibrary,
  candidateFacts,
  jobPreferences,
  applicationPolicy,
} from '../index.js';
import { ApplicationQuestionEngine } from './application-question-engine.js';
import { snapshotIntentAnswers } from '../submission/application-intent-authorization.js';
import {
  AtsFormFieldType,
  requiresApplicationQuestionConsent,
  type AtsFormField,
  type QuestionCategory,
  type QuestionType,
} from '@job-agent/shared';

/** Only actual provider fields create interventions in the one-click flow. */
export async function resolveRuntimeQuestions(
  db: Database,
  userId: string,
  applicationId: string,
  versionId: string,
  fields: AtsFormField[],
  authorizedSources: Record<string, string>,
) {
  const [app] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)));
  const [version] = await db
    .select()
    .from(applicationPackageVersions)
    .where(eq(applicationPackageVersions.id, versionId));
  if (!app || !version || app.currentPackageId !== version.packageId)
    throw new Error('Application materials changed.');
  const [profile] = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, userId));
  if (!profile) throw new Error('Complete your candidate profile first.');
  const links = await db.select().from(candidateLinks).where(eq(candidateLinks.userId, userId));
  const currentSources = await snapshotIntentAnswers(db, userId);
  const library = (
    await db.select().from(answerLibrary).where(eq(answerLibrary.userId, userId))
  ).filter(
    (answer) =>
      authorizedSources[answer.id] && authorizedSources[answer.id] === currentSources[answer.id],
  );
  const facts = await db.select().from(candidateFacts).where(eq(candidateFacts.userId, userId));
  const [preferences] = await db
    .select()
    .from(jobPreferences)
    .where(eq(jobPreferences.userId, userId));
  const [policy] = await db
    .select()
    .from(applicationPolicy)
    .where(eq(applicationPolicy.userId, userId));
  const stable = new Set([
    'firstName',
    'lastName',
    'fullName',
    'email',
    'phone',
    'location',
    'linkedin',
    'github',
    'resume',
    'coverLetter',
  ]);
  let changed = false,
    needsReview = false;
  for (const field of fields) {
    if (
      (stable.has(field.mappedConcept ?? '') &&
        !requiresApplicationQuestionConsent(field.label, field.type)) ||
      [AtsFormFieldType.FILE_RESUME, AtsFormFieldType.FILE_COVER_LETTER].includes(
        field.type as 'FILE_RESUME' | 'FILE_COVER_LETTER',
      )
    )
      continue;
    // Optional unanswered custom questions may be left blank; required and known saved questions are explicit.
    const text = field.label.replace(/\s*\*\s*$/, '').trim();
    if (
      !field.required &&
      !library.some((a) => a.question.toLowerCase().trim() === text.toLowerCase())
    )
      continue;
    const [existing] = await db
      .select()
      .from(applicationQuestions)
      .where(
        and(
          eq(applicationQuestions.versionId, versionId),
          eq(applicationQuestions.questionText, text),
        ),
      );
    if (existing) continue;
    const lower = text.toLowerCase();
    const category: QuestionCategory = /sponsor|visa/.test(lower)
      ? 'SPONSORSHIP'
      : /authoriz|citizen|legally|clearance/.test(lower)
        ? 'WORK_AUTHORIZATION'
        : /salary|compensation|pay/.test(lower)
          ? 'SALARY'
          : 'GENERAL';
    const sensitive =
      category !== 'GENERAL' || requiresApplicationQuestionConsent(text, field.type);
    const questionType: QuestionType =
      field.type === AtsFormFieldType.SELECT
        ? 'SINGLE_SELECT'
        : field.type === AtsFormFieldType.CHECKBOX
          ? 'BOOLEAN'
          : 'TEXT';
    const definition = {
      questionText: text,
      category,
      questionType,
      options: field.options ?? [],
      sensitivity: sensitive ? ('SENSITIVE' as const) : ('STANDARD' as const),
      isRequired: field.required,
    };
    const resolution = ApplicationQuestionEngine.resolveQuestion(definition, {
      candidate: { profile, links },
      answerLibrary: library,
      candidateFacts: facts,
      preferences,
      policy,
    });
    // Optional unanswered/sensitive fields stay blank instead of manufacturing an intervention.
    if (!field.required && resolution.needsApproval) continue;
    const [question] = await db
      .insert(applicationQuestions)
      .values({
        packageId: version.packageId,
        versionId,
        ...definition,
        answerSource: resolution.answerSource,
        sourceEntityId: resolution.sourceEntityId,
        proposedAnswer: resolution.proposedAnswer,
        finalAnswer: resolution.approvalState === 'APPROVED' ? resolution.proposedAnswer : null,
        approvalState: resolution.approvalState,
      })
      .returning();
    if (resolution.needsApproval && resolution.approvalDetails) {
      const details = resolution.approvalDetails;
      await db.insert(approvalRequests).values({
        userId,
        packageId: version.packageId,
        versionId,
        questionId: question!.id,
        approvalType: details.approvalType,
        subject: details.subject,
        proposedValue: details.proposedValue,
        reason: details.reason,
        riskLevel: details.riskLevel,
        evidenceReferences: details.evidenceReferences,
      });
      needsReview = true;
    }
    changed = true;
  }
  if (needsReview) {
    await db
      .update(applicationPackages)
      .set({ status: 'NEEDS_REVIEW', updatedAt: new Date() })
      .where(eq(applicationPackages.id, version.packageId));
    await db
      .update(applicationPackageVersions)
      .set({ status: 'NEEDS_REVIEW', updatedAt: new Date() })
      .where(eq(applicationPackageVersions.id, versionId));
    await db
      .update(applications)
      .set({
        status: 'NEEDS_REVIEW',
        nextAction: 'Resolve employer application questions',
        nextActionType: 'QUESTIONS',
        updatedAt: new Date(),
      })
      .where(eq(applications.id, applicationId));
  }
  return { changed, needsReview };
}
