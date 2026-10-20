import crypto from 'node:crypto';
import { getConfig } from '@job-agent/config';
import { createFileStorage } from '@job-agent/shared/storage';
import {
  type Database,
  browserApplicationRuns,
  candidateProfiles,
  candidateLinks,
  candidateDocuments,
  answerLibrary,
  applicationPackageVersions,
  applicationArtifacts,
  applicationQuestions,
  applicationPackages,
  SubmissionAuthorizationService,
  applicationPolicy,
  applicationIntents,
  applications,
  assertApplicationIntent,
  resolveRuntimeQuestions,
  intentAnswerSources,
  sql,
  eq,
  and,
} from '@job-agent/database';
import {
  BrowserRunMode,
  BrowserRunStatus,
  type ApplicationSubmissionPayload,
  type BrowserApplicationRunDto,
  type FileStorageProvider,
} from '@job-agent/shared';
import type { BrowserController } from '../browser/browser-controller.js';
import { FixtureBrowserController } from '../browser/fixture-browser-controller.js';
import { PlaywrightBrowserController } from '../browser/playwright-browser-controller.js';
import { BrowserApplicationEngine } from '../engine/browser-application-engine.js';
import { AtsAdapterRegistry } from '../adapters/ats-adapter-registry.js';

export interface RunExecutionOptions {
  controller?: BrowserController;
  useFixture?: boolean;
  storage?: FileStorageProvider;
}

/**
 * Executes a pending browser run by compiling Candidate Brain evidence and delegating
 * to the BrowserApplicationEngine.
 */
export async function executePendingBrowserRun(
  db: Database,
  runId: string,
  options: RunExecutionOptions = {},
): Promise<BrowserApplicationRunDto> {
  // Atomically claim the run from PENDING -> RUNNING to prevent concurrent worker duplicate runs
  const [claimed] = await db
    .update(browserApplicationRuns)
    .set({ status: BrowserRunStatus.RUNNING, startedAt: new Date() })
    .where(
      and(
        eq(browserApplicationRuns.id, runId),
        eq(browserApplicationRuns.status, BrowserRunStatus.PENDING),
      ),
    )
    .returning();

  const [run] = claimed
    ? [claimed]
    : await db.select().from(browserApplicationRuns).where(eq(browserApplicationRuns.id, runId));

  if (!run) {
    throw new Error(`Browser run not found: ${runId}`);
  }

  if (!claimed) {
    return run as unknown as BrowserApplicationRunDto;
  }

  const heartbeat = setInterval(() => {
    void db
      .update(browserApplicationRuns)
      .set({ updatedAt: new Date() })
      .where(
        and(eq(browserApplicationRuns.id, run.id), eq(browserApplicationRuns.status, 'RUNNING')),
      )
      .catch(() => {});
  }, 15000);
  heartbeat.unref();
  try {
    if (run.mode === BrowserRunMode.SUBMIT && !run.packageVersionId)
      throw new Error('A reviewed application version is required.');
    // 1. Compile Candidate Profile Facts
    const [profile] = await db
      .select()
      .from(candidateProfiles)
      .where(eq(candidateProfiles.userId, run.userId));

    const names = (profile?.fullName ?? '').trim().split(/\s+/);
    const firstName = names[0] || profile?.preferredName || '';
    const lastName = names.slice(1).join(' ') || '';

    // 2. Compile Links
    const links = await db
      .select()
      .from(candidateLinks)
      .where(eq(candidateLinks.userId, run.userId));

    const urls: Record<string, string> = {};
    for (const link of links) {
      urls[link.label.toLowerCase()] = link.url;
      urls[link.label] = link.url;
    }

    // 3. Compile Vault Documents
    const docs = await db
      .select()
      .from(candidateDocuments)
      .where(eq(candidateDocuments.userId, run.userId));

    const resumeDoc = docs.find(
      (d: (typeof docs)[number]) =>
        d.isActive &&
        (d.documentType === 'MASTER_CV' ||
          d.documentType === 'ROLE_CV' ||
          (d.documentType as string) === 'RESUME' ||
          (d.documentType as string) === 'DEFAULT_RESUME'),
    );

    // 4. Compile Answer Library
    const answersList = await db
      .select()
      .from(answerLibrary)
      .where(eq(answerLibrary.userId, run.userId));

    const answers: Record<
      string,
      { answerText: string; isSensitive?: boolean; verificationStatus?: string }
    > = {};
    for (const ans of answersList) {
      answers[ans.question] = {
        answerText: ans.answer,
        isSensitive: ans.isSensitive,
        verificationStatus: ans.verificationStatus,
      };
      answers[ans.category.toLowerCase()] = {
        answerText: ans.answer,
        isSensitive: ans.isSensitive,
        verificationStatus: ans.verificationStatus,
      };
    }

    // 5. Tailored Package Version if available
    let coverLetterText: string | undefined;
    if (run.packageVersionId) {
      const [pkgVer] = await db
        .select()
        .from(applicationPackageVersions)
        .where(eq(applicationPackageVersions.id, run.packageVersionId));
      if (pkgVer?.coverLetterContent) {
        coverLetterText = pkgVer.coverLetterContent;
      }
    }

    const payload: ApplicationSubmissionPayload = {
      firstName,
      lastName,
      fullName: profile?.fullName ?? `${firstName} ${lastName}`.trim(),
      email: profile?.email ?? '',
      phone: profile?.phone ?? undefined,
      location: profile?.city ? `${profile.city}, ${profile.region ?? ''}`.trim() : undefined,
      urls,
      resumeFileName: resumeDoc?.originalFilename ?? 'resume.pdf',
      coverLetterText,
      answers,
    };

    const storage = options.storage ?? createFileStorage(getConfig());
    if (run.packageVersionId) {
      const [version] = await db
        .select()
        .from(applicationPackageVersions)
        .where(eq(applicationPackageVersions.id, run.packageVersionId));
      const [pkg] = version
        ? await db
            .select()
            .from(applicationPackages)
            .where(
              and(
                eq(applicationPackages.id, version.packageId),
                eq(applicationPackages.userId, run.userId),
              ),
            )
        : [];
      if (!version || !pkg) throw new Error('Application materials are unavailable.');
      const artifacts = await db
        .select()
        .from(applicationArtifacts)
        .where(eq(applicationArtifacts.versionId, version.id));
      const questions = await db
        .select()
        .from(applicationQuestions)
        .where(eq(applicationQuestions.versionId, version.id));
      const cv = artifacts.find((a) => a.artifactType === 'TAILORED_CV');
      if (run.mode === BrowserRunMode.SUBMIT) {
        const snapshot = run.authorizationManifest as {
          manifestChecksum?: string;
          inputFingerprint?: string;
          authorizedAt?: number;
          authorizationMode?: string;
          targetUrl?: string;
          intentId?: string;
          submissionToken?: string;
        } | null;
        if (
          !snapshot ||
          snapshot.targetUrl !== run.targetUrl ||
          !snapshot.authorizedAt ||
          Date.now() - snapshot.authorizedAt > 15 * 60_000
        )
          throw new Error('Application authorization expired. Review and authorize it again.');
        if (snapshot.authorizationMode === 'POLICY') {
          const [policy] = await db
            .select()
            .from(applicationPolicy)
            .where(eq(applicationPolicy.userId, run.userId));
          if (!policy?.autoApplyEnabled)
            throw new Error('Automatic application permission was disabled.');
        }
        if (snapshot.authorizationMode === 'INTENT') {
          if (
            !getConfig().SELECTED_SUBMISSIONS_ENABLED ||
            !snapshot.intentId ||
            !snapshot.manifestChecksum
          )
            throw new Error('Application permission is unavailable.');
          await assertApplicationIntent(db, run.userId, run.applicationId, snapshot.intentId, {
            runId: run.id,
            checksum: snapshot.manifestChecksum,
          });
          await SubmissionAuthorizationService.verifySubmissionAuthorization(
            run.userId,
            run.applicationId,
            snapshot.submissionToken ?? '',
            db,
            snapshot.intentId,
          );
        }
        const { manifest, appRecord } = await SubmissionAuthorizationService.buildManifest(
          run.userId,
          run.applicationId,
          db,
        );
        if (
          appRecord.application.appliedAt ||
          appRecord.job.state === 'ARCHIVED' ||
          (appRecord.job.expirationDate && appRecord.job.expirationDate < new Date())
        )
          throw new Error('This application is already sent or its listing has expired.');
        if (
          manifest.packageVersionId !== version.id ||
          manifest.manifestChecksum !== snapshot.manifestChecksum ||
          manifest.inputFingerprint !== snapshot.inputFingerprint
        )
          throw new Error('Reviewed application inputs changed. Review and authorize it again.');
      }
      if (cv) {
        const file = await storage.getFile(cv.storageKey);
        if (crypto.createHash('sha256').update(file.buffer).digest('hex') !== cv.sha256Checksum)
          throw new Error('Application CV integrity check failed.');
        payload.resumeBuffer = file.buffer.toString('base64');
        payload.resumeFileName = cv.filename;
        payload.resumeMimeType = cv.mimeType;
      }
      const letter = version.coverLetterEnabled
        ? artifacts.find((a) => a.artifactType === 'COVER_LETTER')
        : undefined;
      if (letter) {
        const file = await storage.getFile(letter.storageKey);
        if (crypto.createHash('sha256').update(file.buffer).digest('hex') !== letter.sha256Checksum)
          throw new Error('Application letter integrity check failed.');
        payload.coverLetterBuffer = file.buffer.toString('base64');
        payload.coverLetterFileName = letter.filename;
        payload.coverLetterMimeType = letter.mimeType;
      }
      payload.coverLetterText = version.coverLetterEnabled
        ? (version.coverLetterContent ?? undefined)
        : undefined;
      payload.answers = {};
      for (const q of questions)
        if (q.finalAnswer && ['APPROVED', 'RESOLVED'].includes(q.approvalState))
          payload.answers[q.questionText] = {
            answerText: q.finalAnswer,
            isSensitive: q.sensitivity === 'SENSITIVE',
            verificationStatus: 'VERIFIED',
            approvedQuestionText: q.questionText,
          };
    } else if (resumeDoc) {
      const file = await storage.getFile(resumeDoc.storageKey);
      payload.resumeBuffer = file.buffer.toString('base64');
      payload.resumeFileName = resumeDoc.originalFilename;
      payload.resumeMimeType = resumeDoc.mimeType;
    }

    let controller: BrowserController;
    if (options.controller) controller = options.controller;
    else if (
      options.useFixture ||
      process.env.USE_FIXTURE_BROWSER === 'true' ||
      process.env.NODE_ENV === 'test'
    ) {
      if (process.env.NODE_ENV === 'production')
        throw new Error('Fixture browsers cannot execute production applications.');
      controller = new FixtureBrowserController();
    } else controller = new PlaywrightBrowserController({ headless: true });
    const engine = new BrowserApplicationEngine(controller, new AtsAdapterRegistry(), db, storage);
    try {
      return await engine.executeRun({
        id: run.id,
        applicationId: run.applicationId,
        userId: run.userId,
        packageVersionId: run.packageVersionId,
        targetUrl: run.targetUrl,
        mode: run.mode as BrowserRunMode,
        payload,
        skipDb: false,
        onFormExtracted: async (schema) => {
          const snapshot = run.authorizationManifest as {
            authorizationMode?: string;
            intentId?: string;
            manifestChecksum?: string;
          } | null;
          if (
            snapshot?.authorizationMode !== 'INTENT' ||
            !snapshot.intentId ||
            !snapshot.manifestChecksum ||
            !run.packageVersionId
          )
            return;
          const intentId = snapshot.intentId,
            checksum = snapshot.manifestChecksum;
          await db.transaction(async (tx) => {
            await tx.execute(sql`SELECT id FROM users WHERE id=${run.userId} FOR UPDATE`);
            const intent = await assertApplicationIntent(
              tx as unknown as Database,
              run.userId,
              run.applicationId,
              intentId,
              { runId: run.id, checksum },
            );
            const { manifest: before } = await SubmissionAuthorizationService.buildManifest(
              run.userId,
              run.applicationId,
              tx as unknown as Database,
            );
            if (before.manifestChecksum !== checksum)
              throw new Error('Application materials changed during form inspection.');
            const resolved = await resolveRuntimeQuestions(
              tx as unknown as Database,
              run.userId,
              run.applicationId,
              run.packageVersionId!,
              schema.fields,
              intentAnswerSources(intent),
            );
            if (resolved.needsReview) return;
            if (resolved.changed) {
              const { manifest } = await SubmissionAuthorizationService.buildManifest(
                run.userId,
                run.applicationId,
                tx as unknown as Database,
              );
              if (
                manifest.packageVersionId !== before.packageVersionId ||
                manifest.inputFingerprint !== before.inputFingerprint ||
                JSON.stringify(manifest.artifacts) !== JSON.stringify(before.artifacts)
              )
                throw new Error('Application documents changed during form inspection.');
              const rebound = { ...(run.authorizationManifest as object), ...manifest };
              const ticket =
                await SubmissionAuthorizationService.createSubmissionAuthorizationTicket(
                  run.userId,
                  run.applicationId,
                  tx as unknown as Database,
                  intentId,
                );
              const signedRebound = { ...rebound, submissionToken: ticket.submissionToken };
              await tx
                .update(browserApplicationRuns)
                .set({ authorizationManifest: signedRebound })
                .where(eq(browserApplicationRuns.id, run.id));
              await tx
                .update(applicationIntents)
                .set({
                  manifestChecksum: manifest.manifestChecksum,
                  events: sql`${applicationIntents.events} || ${JSON.stringify([{ type: 'FORM_ANSWERS_BOUND', at: new Date().toISOString(), runId: run.id }])}::jsonb`,
                })
                .where(eq(applicationIntents.id, intentId));
              run.authorizationManifest = signedRebound;
            }
          });
          const questions = await db
            .select()
            .from(applicationQuestions)
            .where(eq(applicationQuestions.versionId, run.packageVersionId));
          payload.answers = {};
          for (const q of questions)
            if (q.finalAnswer && ['APPROVED', 'RESOLVED'].includes(q.approvalState))
              payload.answers[q.questionText] = {
                answerText: q.finalAnswer,
                isSensitive: q.sensitivity === 'SENSITIVE',
                verificationStatus: 'VERIFIED',
                approvedQuestionText: q.questionText,
              };
        },
        beforeSubmit: async () => {
          const snapshot = run.authorizationManifest as {
            manifestChecksum?: string;
            authorizedAt?: number;
            authorizationMode?: string;
            intentId?: string;
            submissionToken?: string;
          } | null;
          if (!snapshot?.authorizedAt || Date.now() - snapshot.authorizedAt > 15 * 60_000)
            throw new Error('Application authorization expired. Review it again.');
          const { manifest, appRecord } = await SubmissionAuthorizationService.buildManifest(
            run.userId,
            run.applicationId,
            db,
          );
          if (
            appRecord.application.appliedAt ||
            appRecord.job.state === 'ARCHIVED' ||
            (appRecord.job.expirationDate && appRecord.job.expirationDate < new Date())
          )
            throw new Error('Application is already sent or the listing has expired.');
          if (snapshot.authorizationMode === 'POLICY') {
            const [policy] = await db
              .select()
              .from(applicationPolicy)
              .where(eq(applicationPolicy.userId, run.userId));
            if (!policy?.autoApplyEnabled)
              throw new Error('Automatic application permission was disabled.');
          }
          if (manifest.manifestChecksum !== snapshot.manifestChecksum)
            throw new Error('Reviewed application changed before dispatch. Review it again.');
          if (snapshot.authorizationMode === 'INTENT') {
            if (
              !getConfig().SELECTED_SUBMISSIONS_ENABLED ||
              !snapshot.intentId ||
              !snapshot.manifestChecksum
            )
              throw new Error('Application permission is unavailable.');
            const intentId = snapshot.intentId,
              checksum = snapshot.manifestChecksum;
            // Cancellation and dispatch serialize on the same owner lock. After this reservation,
            // a cancellation must report that the external action may already be in flight.
            await db.transaction(async (tx) => {
              await tx.execute(sql`SELECT id FROM users WHERE id=${run.userId} FOR UPDATE`);
              await tx.execute(
                sql`SELECT id FROM applications WHERE id=${run.applicationId} FOR UPDATE`,
              );
              const intent = await assertApplicationIntent(
                tx as unknown as Database,
                run.userId,
                run.applicationId,
                intentId,
                { runId: run.id, checksum },
              );
              await SubmissionAuthorizationService.verifySubmissionAuthorization(
                run.userId,
                run.applicationId,
                snapshot.submissionToken ?? '',
                tx as unknown as Database,
                intentId,
              );
              const { manifest: current } = await SubmissionAuthorizationService.buildManifest(
                run.userId,
                run.applicationId,
                tx as unknown as Database,
              );
              if (current.manifestChecksum !== checksum || intent.dispatchStartedAt)
                throw new Error('Application dispatch is already reserved or materials changed.');
              await tx
                .update(applicationIntents)
                .set({
                  dispatchStartedAt: new Date(),
                  updatedAt: new Date(),
                  events: [
                    ...intent.events,
                    { type: 'DISPATCH_RESERVED', at: new Date().toISOString(), runId: run.id },
                  ],
                })
                .where(eq(applicationIntents.id, intent.id));
            });
          }
        },
      });
    } finally {
      await controller.close();
    }
  } catch (error) {
    const [current] = await db
      .select()
      .from(browserApplicationRuns)
      .where(eq(browserApplicationRuns.id, run.id));
    const dispatched = (current?.stepLogs as Array<{ step: string }> | null)?.some(
      (s) => s.step === 'SUBMISSION_DISPATCHING',
    );
    await db
      .update(browserApplicationRuns)
      .set({
        status: dispatched ? BrowserRunStatus.SUBMISSION_UNCERTAIN : BrowserRunStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Application worker failed.',
        completedAt: new Date(),
      })
      .where(eq(browserApplicationRuns.id, run.id));
    throw error;
  } finally {
    clearInterval(heartbeat);
    const snapshot = run.authorizationManifest as { authorizationMode?: string } | null;
    if (snapshot?.authorizationMode === 'INTENT') {
      const [final] = await db
        .select()
        .from(browserApplicationRuns)
        .where(eq(browserApplicationRuns.id, run.id));
      if (final && !['PENDING', 'RUNNING'].includes(final.status)) {
        await db
          .update(applications)
          .set(
            final.status === 'SUCCESS'
              ? { nextAction: null, nextActionType: null, updatedAt: new Date() }
              : {
                  status: 'NEEDS_REVIEW',
                  nextAction:
                    final.status === 'SUBMISSION_UNCERTAIN'
                      ? 'Check employer confirmation and reconcile before retrying'
                      : final.errorMessage || 'Review the employer application',
                  nextActionType: 'REVIEW',
                  updatedAt: new Date(),
                },
          )
          .where(and(eq(applications.id, run.applicationId), eq(applications.userId, run.userId)));
      }
    }
  }
}
