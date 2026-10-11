import { eq, and, desc } from 'drizzle-orm';
import {
  getDb,
  applications,
  jobs,
  applicationPolicy,
  applicationPackages,
  approvalRequests,
  browserApplicationRuns,
  type BrowserApplicationRun,
} from '@job-agent/database';
import {
  AppError,
  AtsProviderType,
  BrowserRunMode,
  BrowserRunStatus,
  type BrowserApplicationRunDto,
  type StartBrowserRunRequest,
} from '@job-agent/shared';

export class BrowserWorkerService {
  /**
   * Infer ATS provider based on target application URL.
   */
  static inferAtsProvider(url: string): AtsProviderType {
    const u = url.toLowerCase();
    if (u.includes('greenhouse.io') || u.includes('gh_jid')) {
      return AtsProviderType.GREENHOUSE;
    }
    if (u.includes('lever.co')) {
      return AtsProviderType.LEVER;
    }
    if (u.includes('ashbyhq.com') || u.includes('ashby')) {
      return AtsProviderType.ASHBY;
    }
    return AtsProviderType.OTHER;
  }

  /**
   * Queue a new browser application run.
   */
  static async createBrowserRun(
    userId: string,
    applicationId: string,
    input: StartBrowserRunRequest,
  ): Promise<BrowserApplicationRunDto> {
    const db = getDb();

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

    const atsProvider = this.inferAtsProvider(targetUrl);
    const mode = input.mode ?? BrowserRunMode.DRY_RUN;

    // Strict Backend Authorization Guard for SUBMIT mode
    if (mode === BrowserRunMode.SUBMIT) {
      const [policy] = await db
        .select()
        .from(applicationPolicy)
        .where(eq(applicationPolicy.userId, userId))
        .limit(1);

      if (!policy?.autoApplyEnabled && !input.userConfirmed) {
        throw AppError.forbidden(
          'Automated submission is blocked: Direct external submission requires explicit candidate confirmation or autoApplyEnabled authorization.',
        );
      }

      // Verify associated Application Package
      const packageId = appRecord.application.currentPackageId;
      const [pkg] = packageId
        ? await db
            .select()
            .from(applicationPackages)
            .where(eq(applicationPackages.id, packageId))
            .limit(1)
        : await db
            .select()
            .from(applicationPackages)
            .where(
              and(
                eq(applicationPackages.jobId, appRecord.application.jobId),
                eq(applicationPackages.userId, userId),
              ),
            )
            .limit(1);

      if (!pkg || pkg.status !== 'READY') {
        throw AppError.badRequest(
          `Cannot execute browser submission: Application package is not ready (status: ${pkg?.status ?? 'MISSING'}). Human preparation and review required.`,
        );
      }

      if (pkg.hasPolicyBlocker && !pkg.blockerOverridden) {
        throw AppError.badRequest(
          'Cannot execute browser submission: Job matching has active hard policy blocker not overridden by candidate.',
        );
      }

      // Verify all package approvals are resolved by human user
      const pkgApprovals = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.packageId, pkg.id));

      const unverified = pkgApprovals.filter(
        (a) =>
          a.status === 'PENDING' ||
          a.status === 'NEEDS_USER_RECONFIRMATION' ||
          ((a.status === 'APPROVED' || a.status === 'RESOLVED') && a.resolvedBy !== 'USER'),
      );

      if (unverified.length > 0) {
        throw AppError.badRequest(
          `Cannot execute browser submission: ${unverified.length} approval request(s) require human authorization or reconfirmation.`,
        );
      }
    }

    const runId = crypto.randomUUID();
    const now = new Date();

    const initialStepLog = {
      step: 'QUEUED',
      action: `Application form run queued in ${mode} mode for ${atsProvider} (${targetUrl})`,
      timestamp: now.toISOString(),
      status: 'OK',
    };

    const [inserted] = await db
      .insert(browserApplicationRuns)
      .values({
        id: runId,
        applicationId,
        userId,
        packageVersionId:
          input.packageVersionId ?? appRecord.application.submittedPackageVersionId ?? null,
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
      errorMessage: run.errorMessage,
      startedAt: run.startedAt ? run.startedAt.toISOString() : null,
      completedAt: run.completedAt ? run.completedAt.toISOString() : null,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };
  }
}
