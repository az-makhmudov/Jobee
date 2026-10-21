import { eq, and, desc, sql, gte } from 'drizzle-orm';
import {
  getDb,
  applications,
  jobs,
  applicationPolicy,
  applicationPackageVersions,
  browserApplicationRuns,
  type BrowserApplicationRun,
  type Database,
  applicationIntents,
} from '../index.js';
import {
  AppError,
  inferHostedAtsProvider,
  AtsProviderType,
  BrowserRunMode,
  BrowserRunStatus,
  type BrowserApplicationRunDto,
  type StartBrowserRunRequest,
} from '@job-agent/shared';
import { SubmissionAuthorizationService } from './submission-authorization-service.js';
import { assertApplicationIntent } from './application-intent-authorization.js';

export class BrowserWorkerService {
  /**
   * Infer ATS provider based on target application URL.
   */
  static inferAtsProvider(url: string): AtsProviderType {
    return inferHostedAtsProvider(url);
  }

  /**
   * Queue a new browser application run.
   */
  static async createBrowserRun(
    userId: string,
    applicationId: string,
    input: StartBrowserRunRequest,
    intentId?: string,
    dbInstance?: Database,
  ): Promise<BrowserApplicationRunDto> {
    const db = dbInstance ?? getDb();

    // 1. Verify application ownership and find target URL
    const [appRecord] = await db
      .select({
        application: applications,
        job: jobs,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)));

    if (!appRecord) {
      throw AppError.notFound('Application not found');
    }

    const targetUrl =
      input.targetUrl ||
      appRecord.application.applicationUrl ||
      appRecord.job.applicationUrl ||
      appRecord.job.originalUrl ||
      appRecord.job.canonicalUrl;

    if (!targetUrl) {
      throw AppError.badRequest(
        'Cannot start browser run: No valid application URL found. Please provide targetUrl in request or on the job posting.',
      );
    }

    if (
      input.mode === BrowserRunMode.SUBMIT &&
      input.targetUrl &&
      input.targetUrl !==
        (appRecord.application.applicationUrl ||
          appRecord.job.applicationUrl ||
          appRecord.job.originalUrl ||
          appRecord.job.canonicalUrl)
    )
      throw AppError.badRequest('The submission target changed. Review the application again.');
    const atsProvider = this.inferAtsProvider(targetUrl);
    const mode = input.mode ?? BrowserRunMode.DRY_RUN;

    let authorizationManifest: unknown = null;
    let verifiedManifestChecksum: string | null = null;
    let verifiedVersionId: string | null = null;

    // Strict Backend Authorization Guard for SUBMIT mode
    if (mode === BrowserRunMode.SUBMIT) {
      if (atsProvider === AtsProviderType.OTHER || atsProvider === AtsProviderType.UNKNOWN)
        throw AppError.badRequest('Use the employer website for this application method.');
      if (
        appRecord.application.appliedAt ||
        !['READY_TO_APPLY', 'NEEDS_REVIEW'].includes(appRecord.application.status)
      )
        throw AppError.badRequest(
          'This application is already submitted or is not ready to apply.',
        );
      if (
        appRecord.job.state === 'ARCHIVED' ||
        (appRecord.job.expirationDate && appRecord.job.expirationDate < new Date())
      )
        throw AppError.badRequest('This listing is no longer available.');
      if (intentId) {
        const intent = await assertApplicationIntent(db, userId, applicationId, intentId);
        const ticket = await SubmissionAuthorizationService.createSubmissionAuthorizationTicket(
          userId,
          applicationId,
          db,
          intentId,
        );
        const { manifest } = await SubmissionAuthorizationService.buildManifest(
          userId,
          applicationId,
          db,
        );
        authorizationManifest = {
          ...manifest,
          authorizedAt: Date.now(),
          authorizationMode: 'INTENT',
          ...(intent.autopilotGrant
            ? { autopilotPolicyVersion: intent.autopilotGrant.version }
            : {}),
          submissionToken: ticket.submissionToken,
          intentId,
          targetUrl,
        };
        verifiedManifestChecksum = manifest.manifestChecksum;
        verifiedVersionId = manifest.packageVersionId;
      } else {
        // Mode B: Supervised/Manual submission path
        // Invariant: MUST provide cryptographic submissionToken bound to the approved package manifest.
        // A simple userConfirmed=true boolean without a valid token is REJECTED.
        if (!input.submissionToken) {
          throw AppError.forbidden(
            'Automated submission is blocked: Direct external submission requires a cryptographic human submission authorization token bound to the approved package manifest. Raw unverified boolean confirmation is rejected.',
          );
        }

        const manifest = await SubmissionAuthorizationService.verifySubmissionAuthorization(
          userId,
          applicationId,
          input.submissionToken,
          db,
        );
        authorizationManifest = {
          ...manifest,
          authorizedAt: Date.now(),
          authorizationMode: 'TOKEN',
          targetUrl,
        };
        verifiedManifestChecksum = manifest.manifestChecksum;
        verifiedVersionId = manifest.packageVersionId;
      }
    }

    const runId = crypto.randomUUID();
    const now = new Date();

    const initialStepLog = {
      step: 'QUEUED',
      action: verifiedManifestChecksum
        ? `Application form run queued in ${mode} mode for ${atsProvider} (${targetUrl}) [Manifest: ${verifiedManifestChecksum.slice(0, 12)}...]`
        : `Application form run queued in ${mode} mode for ${atsProvider} (${targetUrl})`,
      timestamp: now.toISOString(),
      status: 'OK',
    };

    let packageVersionId: string | null =
      verifiedVersionId ??
      input.packageVersionId ??
      appRecord.application.submittedPackageVersionId ??
      null;

    if (!packageVersionId && appRecord.application.currentPackageId) {
      const [latestVersion] = await db
        .select({ id: applicationPackageVersions.id })
        .from(applicationPackageVersions)
        .where(eq(applicationPackageVersions.packageId, appRecord.application.currentPackageId))
        .orderBy(desc(applicationPackageVersions.versionNumber))
        .limit(1);

      if (latestVersion) {
        packageVersionId = latestVersion.id;
      }
    }

    const inserted = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM users WHERE id=${userId} FOR UPDATE`);
      await tx.execute(sql`SELECT id FROM applications WHERE id=${applicationId} FOR UPDATE`);
      if (mode === BrowserRunMode.SUBMIT) {
        if (intentId) {
          const intent = await assertApplicationIntent(
            tx as unknown as Database,
            userId,
            applicationId,
            intentId,
          );
          if (intent.runId)
            throw AppError.badRequest('This application permission already has an attempt.');
          const { manifest } = await SubmissionAuthorizationService.buildManifest(
            userId,
            applicationId,
            tx as unknown as Database,
          );
          if (manifest.manifestChecksum !== verifiedManifestChecksum)
            throw AppError.badRequest('Application materials changed before queueing.');
        }
        const previous = await tx
          .select()
          .from(browserApplicationRuns)
          .where(
            and(
              eq(browserApplicationRuns.applicationId, applicationId),
              eq(browserApplicationRuns.mode, 'SUBMIT'),
            ),
          );
        if (
          previous.some((r) =>
            ['PENDING', 'RUNNING', 'SUCCESS', 'SUBMISSION_UNCERTAIN'].includes(r.status),
          )
        )
          throw AppError.badRequest(
            'An application attempt already exists. Check its progress before trying again.',
          );
        const daily = await tx
          .select({ id: browserApplicationRuns.id })
          .from(browserApplicationRuns)
          .where(
            and(
              eq(browserApplicationRuns.userId, userId),
              eq(browserApplicationRuns.mode, 'SUBMIT'),
              gte(
                browserApplicationRuns.createdAt,
                new Date(new Date().toISOString().slice(0, 10)),
              ),
            ),
          );
        const [currentPolicy] = await tx
          .select()
          .from(applicationPolicy)
          .where(eq(applicationPolicy.userId, userId));
        if (daily.length >= Math.min(20, currentPolicy?.maxApplicationsPerDay ?? 5))
          throw AppError.badRequest('Daily application limit reached. Continue tomorrow.');
      }
      const [created] = await tx
        .insert(browserApplicationRuns)
        .values({
          id: runId,
          applicationId,
          userId,
          packageVersionId,
          authorizationManifest,
          atsProvider,
          targetUrl,
          mode,
          status: BrowserRunStatus.PENDING,
          fieldsDetectedCount: 0,
          fieldsFilledCount: 0,
          unmatchedRequiredFields: [],
          stepLogs: [initialStepLog],
          screenshotPaths: [],
          startedAt: now,
        })
        .returning();
      if (intentId) {
        await tx
          .update(applications)
          .set({
            status: 'APPLYING',
            nextAction: 'Completing the employer application',
            nextActionType: 'EXECUTION',
            updatedAt: now,
          })
          .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)));
        await tx
          .update(applicationIntents)
          .set({
            runId,
            manifestChecksum: verifiedManifestChecksum,
            status: 'QUEUED',
            updatedAt: now,
            events: sql`${applicationIntents.events} || ${JSON.stringify([{ type: 'QUEUED', at: now.toISOString(), runId }])}::jsonb`,
          })
          .where(and(eq(applicationIntents.id, intentId), eq(applicationIntents.userId, userId)));
      }
      return created;
    });

    if (!inserted) {
      throw AppError.internal('Failed to create browser run record');
    }

    return this.mapToDto(inserted);
  }

  /**
   * List browser runs for an application.
   */
  static async listBrowserRuns(
    userId: string,
    applicationId: string,
  ): Promise<BrowserApplicationRunDto[]> {
    const db = getDb();

    // Verify application ownership
    const [app] = await db
      .select({ id: applications.id })
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)));

    if (!app) {
      throw AppError.notFound('Application not found');
    }

    const runs = await db
      .select()
      .from(browserApplicationRuns)
      .where(
        and(
          eq(browserApplicationRuns.applicationId, applicationId),
          eq(browserApplicationRuns.userId, userId),
        ),
      )
      .orderBy(desc(browserApplicationRuns.createdAt));

    return runs.map((r) => this.mapToDto(r));
  }

  /**
   * Get specific browser run details.
   */
  static async getBrowserRun(userId: string, runId: string): Promise<BrowserApplicationRunDto> {
    const db = getDb();

    const [run] = await db
      .select()
      .from(browserApplicationRuns)
      .where(and(eq(browserApplicationRuns.id, runId), eq(browserApplicationRuns.userId, userId)));

    if (!run) {
      throw AppError.notFound('Browser run not found');
    }

    return this.mapToDto(run);
  }

  static async reconcileNotSent(userId: string, runId: string, note: string) {
    const db = getDb();
    await db.transaction(async (tx) => {
      const [run] = await tx
        .select()
        .from(browserApplicationRuns)
        .where(and(eq(browserApplicationRuns.id, runId), eq(browserApplicationRuns.userId, userId)))
        .for('update');
      if (!run) throw AppError.notFound('Browser run not found');
      if (run.status !== 'SUBMISSION_UNCERTAIN' || !run.completedAt)
        throw AppError.badRequest('Only a completed uncertain attempt can be reconciled.');
      await tx
        .update(browserApplicationRuns)
        .set({
          status: 'FAILED',
          errorMessage:
            'Candidate checked the employer website and confirmed this attempt was not sent.',
          stepLogs: [
            ...(run.stepLogs ?? []),
            {
              step: 'USER_RECONCILIATION',
              action: 'Candidate confirmed not sent',
              status: 'OK',
              timestamp: new Date().toISOString(),
              details: note,
            },
          ],
          updatedAt: new Date(),
        })
        .where(eq(browserApplicationRuns.id, runId));
      await tx
        .update(applications)
        .set({ status: 'NEEDS_REVIEW', updatedAt: new Date() })
        .where(and(eq(applications.id, run.applicationId), eq(applications.userId, userId)));
    });
    return this.getBrowserRun(userId, runId);
  }

  private static mapToDto(run: BrowserApplicationRun): BrowserApplicationRunDto {
    return {
      id: run.id,
      applicationId: run.applicationId,
      userId: run.userId,
      packageVersionId: run.packageVersionId,
      atsProvider: run.atsProvider as AtsProviderType,
      targetUrl: run.targetUrl,
      mode: run.mode as BrowserRunMode,
      status: run.status as BrowserRunStatus,
      fieldsDetectedCount: run.fieldsDetectedCount,
      fieldsFilledCount: run.fieldsFilledCount,
      unmatchedRequiredFields: (run.unmatchedRequiredFields as unknown[]) ?? [],
      stepLogs: (run.stepLogs as any[]) ?? [],
      screenshotPaths: (run.screenshotPaths as string[]) ?? [],
      confirmationReference: run.confirmationReference,
      submissionObservation:
        run.submissionObservation as BrowserApplicationRunDto['submissionObservation'],
      errorMessage: run.errorMessage,
      startedAt: run.startedAt ? run.startedAt.toISOString() : null,
      completedAt: run.completedAt ? run.completedAt.toISOString() : null,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };
  }
}
