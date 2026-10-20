import { and, eq, inArray, desc, asc, sql, gte, lt } from 'drizzle-orm';
import {
  type Database,
  preparationBatches,
  preparationItems,
  jobs,
  candidateDocuments,
  applicationPackages,
  applicationPackageVersions,
  applications,
  applicationQuestions,
  browserApplicationRuns,
  computePreparationFingerprint,
  createPreparationFingerprintReader,
  type PreparationFingerprintReader,
  BrowserWorkerService,
  SubmissionAuthorizationService,
} from '@job-agent/database';
import {
  AppError,
  BrowserRunMode,
  type PreparationBatchDto,
  type PreparationStatus,
  type SubmissionAuthorizationTicketDto,
} from '@job-agent/shared';
import type { ApplicationPackageService } from './application-package-service.js';
import { JobSearchSettingsService } from './job-search-settings-service.js';
export class PreparationBatchService {
  constructor(
    private readonly db: Database,
    private readonly packages: ApplicationPackageService,
  ) {}
  async create(
    userId: string,
    jobIds: string[],
    selectedCvId?: string | null,
  ): Promise<PreparationBatchDto> {
    const ids = [...new Set(jobIds)];
    if (!ids.length || ids.length > 10) throw AppError.badRequest('Select between 1 and 10 jobs.');
    const settings = await new JobSearchSettingsService(this.db).get(userId);
    const cvId = selectedCvId === undefined ? settings.selectedCvId : selectedCvId;
    if (cvId) {
      const [doc] = await this.db
        .select()
        .from(candidateDocuments)
        .where(and(eq(candidateDocuments.id, cvId), eq(candidateDocuments.userId, userId)));
      if (!doc?.isActive || !['MASTER_CV', 'ROLE_CV'].includes(doc.documentType))
        throw AppError.badRequest('Choose an active CV from your documents.');
    }
    const owned = await this.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.userId, userId), inArray(jobs.id, ids)));
    if (owned.length !== ids.length)
      throw AppError.notFound('One or more selected jobs are unavailable.');
    if (
      owned.some(
        (j) =>
          ['ARCHIVED', 'INVALID'].includes(j.state) ||
          (j.expirationDate && j.expirationDate < new Date()),
      )
    )
      throw AppError.badRequest('Remove expired or archived jobs from the selection.');
    const readFingerprint = await createPreparationFingerprintReader(this.db, userId);
    const fingerprints = await Promise.all(ids.map((id) => readFingerprint(id, cvId)));
    const batchId = await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM users WHERE id=${userId} FOR UPDATE`);
      const active = await tx
        .select()
        .from(preparationItems)
        .where(
          and(
            eq(preparationItems.userId, userId),
            inArray(preparationItems.jobId, ids),
            inArray(preparationItems.status, ['QUEUED', 'PREPARING']),
          ),
        );
      if (active.length === ids.length && new Set(active.map((i) => i.batchId)).size === 1)
        return active[0]!.batchId;
      if (active.length)
        throw AppError.badRequest(
          'Some selected jobs are already being prepared. Check the current batch first.',
        );
      const today = await tx
        .select()
        .from(preparationItems)
        .where(
          and(
            eq(preparationItems.userId, userId),
            gte(preparationItems.createdAt, new Date(new Date().toISOString().slice(0, 10))),
          ),
        );
      const reuse: Array<typeof applicationPackages.$inferSelect | undefined> = [];
      for (let index = 0; index < ids.length; index++) {
        const [previous] = await tx
          .select()
          .from(preparationItems)
          .where(
            and(
              eq(preparationItems.userId, userId),
              eq(preparationItems.jobId, ids[index]!),
              eq(preparationItems.inputFingerprint, fingerprints[index]!),
              inArray(preparationItems.status, ['READY', 'NEEDS_REVIEW']),
            ),
          )
          .orderBy(desc(preparationItems.createdAt))
          .limit(1);
        const [pkg] = previous?.packageId
          ? await tx
              .select()
              .from(applicationPackages)
              .where(eq(applicationPackages.id, previous.packageId))
          : [];
        reuse.push(pkg && !pkg.isStale ? pkg : undefined);
      }
      const used = today.filter(
        (i) => i.attempts > 0 || ['QUEUED', 'PREPARING'].includes(i.status),
      ).length;
      if (used + reuse.filter((p) => !p).length > settings.dailyLimit)
        throw AppError.badRequest(
          `Daily preparation budget reached (${settings.dailyLimit}). Change the limit in search settings or continue tomorrow.`,
        );
      const [batch] = await tx.insert(preparationBatches).values({ userId }).returning();
      await tx.insert(preparationItems).values(
        ids.map((jobId, index) => ({
          userId,
          jobId,
          batchId: batch!.id,
          inputFingerprint: fingerprints[index]!,
          selectedCvId: cvId,
          packageId: reuse[index]?.id ?? null,
          status: reuse[index]
            ? reuse[index]!.status === 'READY'
              ? 'READY'
              : 'NEEDS_REVIEW'
            : 'QUEUED',
          finishedAt: reuse[index] ? new Date() : null,
        })),
      );
      return batch!.id;
    });
    return this.get(userId, batchId);
  }
  async list(userId: string) {
    const batches = await this.db
      .select()
      .from(preparationBatches)
      .where(eq(preparationBatches.userId, userId))
      .orderBy(desc(preparationBatches.createdAt))
      .limit(10);
    let reader: Promise<PreparationFingerprintReader> | undefined;
    const fingerprint: PreparationFingerprintReader = async (jobId, cvId) => {
      reader ??= createPreparationFingerprintReader(this.db, userId);
      return (await reader)(jobId, cvId);
    };
    return Promise.all(batches.map((b) => this.get(userId, b.id, fingerprint)));
  }
  async get(
    userId: string,
    batchId: string,
    readFingerprint?: PreparationFingerprintReader,
  ): Promise<PreparationBatchDto> {
    const [batch] = await this.db
      .select()
      .from(preparationBatches)
      .where(and(eq(preparationBatches.id, batchId), eq(preparationBatches.userId, userId)));
    if (!batch) throw AppError.notFound('Preparation batch not found.');
    const items = await this.db
      .select({
        item: preparationItems,
        job: jobs,
        pkg: applicationPackages,
        application: applications,
      })
      .from(preparationItems)
      .innerJoin(jobs, eq(preparationItems.jobId, jobs.id))
      .leftJoin(applicationPackages, eq(preparationItems.packageId, applicationPackages.id))
      .leftJoin(
        applications,
        and(eq(applications.jobId, preparationItems.jobId), eq(applications.userId, userId)),
      )
      .where(and(eq(preparationItems.batchId, batchId), eq(preparationItems.userId, userId)))
      .orderBy(asc(preparationItems.createdAt));
    let reader: Promise<PreparationFingerprintReader> | undefined;
    const fingerprint: PreparationFingerprintReader =
      readFingerprint ??
      (async (jobId, cvId) => {
        reader ??= createPreparationFingerprintReader(this.db, userId);
        return (await reader)(jobId, cvId);
      });
    const projected = await Promise.all(
      items.map(async ({ item, job, pkg, application }) => {
        const [version] = pkg
          ? await this.db
              .select()
              .from(applicationPackageVersions)
              .where(
                and(
                  eq(applicationPackageVersions.packageId, pkg.id),
                  eq(applicationPackageVersions.versionNumber, pkg.currentVersionNumber),
                ),
              )
          : [];
        const questions = version
          ? await this.db
              .select()
              .from(applicationQuestions)
              .where(eq(applicationQuestions.versionId, version.id))
          : [];
        const [run] = application
          ? await this.db
              .select()
              .from(browserApplicationRuns)
              .where(
                and(
                  eq(browserApplicationRuns.applicationId, application.id),
                  eq(browserApplicationRuns.mode, 'SUBMIT'),
                ),
              )
              .orderBy(desc(browserApplicationRuns.createdAt))
              .limit(1)
          : [];
        const provider = BrowserWorkerService.inferAtsProvider(
          job.applicationUrl ?? job.originalUrl ?? '',
        );
        const automatic = ['GREENHOUSE', 'LEVER', 'ASHBY'].includes(provider);
        const inputsCurrent =
          version && pkg
            ? version.inputFingerprint === (await fingerprint(job.id, version.baseDocumentId))
            : false;
        return {
          id: item.id,
          jobId: job.id,
          title: job.title,
          company: job.company,
          status: (['READY', 'NEEDS_REVIEW'].includes(item.status) && pkg
            ? pkg.status === 'READY' && !pkg.isStale && inputsCurrent
              ? 'READY'
              : 'NEEDS_REVIEW'
            : item.status) as PreparationStatus,
          packageId: pkg?.id ?? null,
          applicationId: application?.id ?? null,
          error: item.error,
          versionNumber: version?.versionNumber ?? null,
          outstandingQuestions: questions.filter(
            (q) => q.isRequired && !['APPROVED', 'RESOLVED'].includes(q.approvalState),
          ).length,
          method: automatic ? ('AUTOMATIC_FORM' as const) : ('MANUAL' as const),
          methodNote: automatic
            ? `${provider.toLowerCase()} form: checked during execution; custom fields and bot challenges may require you.`
            : 'Apply on the employer website.',
          runStatus: run?.status ?? null,
        };
      }),
    );
    return {
      id: batch.id,
      createdAt: batch.createdAt.toISOString(),
      cancelledAt: batch.cancelledAt?.toISOString() ?? null,
      items: projected,
    };
  }
  async cancel(userId: string, batchId: string) {
    await this.get(userId, batchId);
    await this.db
      .update(preparationBatches)
      .set({ cancelledAt: new Date() })
      .where(and(eq(preparationBatches.id, batchId), eq(preparationBatches.userId, userId)));
    await this.db
      .update(preparationItems)
      .set({ status: 'CANCELLED', finishedAt: new Date() })
      .where(
        and(
          eq(preparationItems.batchId, batchId),
          eq(preparationItems.userId, userId),
          eq(preparationItems.status, 'QUEUED'),
        ),
      );
    // Completed work and in-flight attempts are retained. Cancellation never invents a safe retry point.
    const items = await this.db
      .select()
      .from(preparationItems)
      .where(and(eq(preparationItems.batchId, batchId), eq(preparationItems.userId, userId)));
    for (const item of items) {
      const apps = await this.db
        .select()
        .from(applications)
        .where(and(eq(applications.jobId, item.jobId), eq(applications.userId, userId)));
      for (const app of apps)
        await this.db
          .update(browserApplicationRuns)
          .set({
            status: 'FAILED',
            errorMessage: 'Cancelled before execution.',
            completedAt: new Date(),
          })
          .where(
            and(
              eq(browserApplicationRuns.applicationId, app.id),
              eq(browserApplicationRuns.status, 'PENDING'),
            ),
          );
    }
    return this.get(userId, batchId);
  }
  async retry(userId: string, batchId: string) {
    const batch = await this.get(userId, batchId);
    const failed = batch.items.filter((i) => i.status === 'FAILED');
    if (!failed.length) throw AppError.badRequest('There are no failed items to retry.');
    const [original] = await this.db
      .select()
      .from(preparationItems)
      .where(and(eq(preparationItems.batchId, batchId), eq(preparationItems.userId, userId)))
      .limit(1);
    return this.create(
      userId,
      failed.map((i) => i.jobId),
      original?.selectedCvId ?? null,
    );
  }
  async reviewTickets(userId: string, batchId: string, itemIds: string[]) {
    const batch = await this.get(userId, batchId);
    const tickets: Array<SubmissionAuthorizationTicketDto & { itemId: string }> = [];
    for (const id of [...new Set(itemIds)]) {
      const item = batch.items.find((i) => i.id === id);
      if (!item?.applicationId || item.status !== 'READY' || item.method !== 'AUTOMATIC_FORM')
        throw AppError.badRequest('Select only ready applications with a supported form.');
      tickets.push({
        ...(await SubmissionAuthorizationService.createSubmissionAuthorizationTicket(
          userId,
          item.applicationId,
          this.db,
        )),
        itemId: id,
      });
    }
    return tickets;
  }
  async submit(
    userId: string,
    batchId: string,
    items: Array<{ itemId: string; submissionToken: string }>,
  ) {
    const batch = await this.get(userId, batchId);
    const results = [];
    for (const input of items) {
      const item = batch.items.find((i) => i.id === input.itemId);
      if (!item?.applicationId)
        throw AppError.notFound('Selected application not found in this batch.');
      try {
        const run = await BrowserWorkerService.createBrowserRun(userId, item.applicationId, {
          mode: BrowserRunMode.SUBMIT,
          submissionToken: input.submissionToken,
        });
        results.push({ itemId: item.id, runId: run.id, error: null });
      } catch (error) {
        results.push({
          itemId: item.id,
          runId: null,
          error: error instanceof Error ? error.message : 'Application could not be queued.',
        });
      }
    }
    return results;
  }
  async reviewQuestions(userId: string, batchId: string) {
    const batch = await this.get(userId, batchId);
    const groups = new Map<
      string,
      {
        question: string;
        items: Array<{
          itemId: string;
          packageId: string;
          questionId: string;
          title: string;
          company: string;
        }>;
      }
    >();
    for (const item of batch.items) {
      if (!item.packageId) continue;
      const detail = await this.packages.getPackage(item.packageId, userId);
      for (const q of detail.questions.filter(
        (q) => q.isRequired && !['APPROVED', 'RESOLVED'].includes(q.approvalState),
      )) {
        // Display grouping only: each decision stays on its original package. Sensitive/contextual questions are never merged.
        const key =
          q.sensitivity === 'SENSITIVE'
            ? q.id
            : JSON.stringify([q.questionText.trim().toLowerCase(), q.category, q.options]);
        const group = groups.get(key) ?? { question: q.questionText, items: [] };
        group.items.push({
          itemId: item.id,
          packageId: item.packageId,
          questionId: q.id,
          title: item.title,
          company: item.company,
        });
        groups.set(key, group);
      }
    }
    return [...groups.values()];
  }
  async processOne(): Promise<boolean> {
    // A lost preparation is recoverable, but requires a deliberate retry rather than competing generation processes.
    await this.db
      .update(preparationItems)
      .set({
        status: 'FAILED',
        error: 'Preparation was interrupted. Retry this item to recover its materials.',
        finishedAt: new Date(),
      })
      .where(
        and(
          eq(preparationItems.status, 'PREPARING'),
          lt(preparationItems.updatedAt, new Date(Date.now() - 15 * 60_000)),
        ),
      );
    const claimed = await this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(preparationItems)
        .where(eq(preparationItems.status, 'QUEUED'))
        .orderBy(asc(preparationItems.createdAt))
        .limit(1)
        .for('update', { skipLocked: true });
      if (!rows[0]) return undefined;
      const [item] = await tx
        .update(preparationItems)
        .set({
          status: 'PREPARING',
          attempts: sql`${preparationItems.attempts}+1`,
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(preparationItems.id, rows[0].id))
        .returning();
      return item;
    });
    if (!claimed) return false;
    const heartbeat = setInterval(() => {
      void this.db
        .update(preparationItems)
        .set({ updatedAt: new Date() })
        .where(and(eq(preparationItems.id, claimed.id), eq(preparationItems.status, 'PREPARING')))
        .catch(() => {});
    }, 15000);
    heartbeat.unref();
    try {
      const fresh = await computePreparationFingerprint(
        this.db,
        claimed.userId,
        claimed.jobId,
        claimed.selectedCvId,
      );
      if (fresh !== claimed.inputFingerprint)
        throw new Error(
          'Profile, documents or job preferences changed. Prepare this item again using the latest inputs.',
        );
      const [existing] = await this.db
        .select()
        .from(applicationPackages)
        .where(
          and(
            eq(applicationPackages.userId, claimed.userId),
            eq(applicationPackages.jobId, claimed.jobId),
          ),
        );
      const previous = existing
        ? await this.db
            .select()
            .from(preparationItems)
            .where(
              and(
                eq(preparationItems.packageId, existing.id),
                inArray(preparationItems.status, ['READY', 'NEEDS_REVIEW']),
              ),
            )
            .orderBy(desc(preparationItems.finishedAt))
            .limit(1)
        : [];
      const existingDetail = existing
        ? await this.packages.getPackage(existing.id, claimed.userId)
        : null;
      const result =
        existing &&
        (existingDetail?.package.isStale ||
          (previous[0] && previous[0].inputFingerprint !== fresh) ||
          (claimed.selectedCvId &&
            existingDetail?.currentVersion?.baseDocumentId !== claimed.selectedCvId))
          ? await this.packages.regeneratePackage(existing.id, claimed.userId, claimed.selectedCvId)
          : await this.packages.createPackage(claimed.userId, claimed.jobId, claimed.selectedCvId);
      const after = await computePreparationFingerprint(
        this.db,
        claimed.userId,
        claimed.jobId,
        claimed.selectedCvId,
      );
      if (after !== fresh) {
        await this.db
          .update(applicationPackages)
          .set({ isStale: true, status: 'NEEDS_REVIEW' })
          .where(eq(applicationPackages.id, result.package.id));
        throw new Error('Inputs changed during preparation. Review and prepare again.');
      }
      await this.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT id FROM users WHERE id=${claimed.userId} FOR UPDATE`);
        const [app] = await tx
          .select()
          .from(applications)
          .where(
            and(eq(applications.userId, claimed.userId), eq(applications.jobId, claimed.jobId)),
          );
        if (!app)
          await tx.insert(applications).values({
            userId: claimed.userId,
            jobId: claimed.jobId,
            currentPackageId: result.package.id,
            status: result.package.status === 'READY' ? 'READY_TO_APPLY' : 'NEEDS_REVIEW',
            source: 'DIRECT',
          });
        else if (!app.appliedAt)
          await tx
            .update(applications)
            .set({
              currentPackageId: result.package.id,
              status: result.package.status === 'READY' ? 'READY_TO_APPLY' : 'NEEDS_REVIEW',
            })
            .where(eq(applications.id, app.id));
        await tx
          .update(preparationItems)
          .set({
            packageId: result.package.id,
            status: result.package.status === 'READY' ? 'READY' : 'NEEDS_REVIEW',
            finishedAt: new Date(),
            updatedAt: new Date(),
            error: null,
          })
          .where(
            and(eq(preparationItems.id, claimed.id), eq(preparationItems.status, 'PREPARING')),
          );
      });
    } catch (error) {
      await this.db
        .update(preparationItems)
        .set({
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Materials could not be prepared.',
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(preparationItems.id, claimed.id), eq(preparationItems.status, 'PREPARING')));
    } finally {
      clearInterval(heartbeat);
    }
    return true;
  }
}
