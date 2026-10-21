import { eq, and, desc, asc, ilike, or, isNotNull, count, inArray, lte, sql } from 'drizzle-orm';
import {
  getDb,
  type Database,
  applications,
  browserApplicationRuns,
  applicationIntents,
  applicationLifecycleEvents,
  applicationNotes,
  applicationContacts,
  applicationAssessments,
  applicationInterviews,
  applicationOffers,
  jobs,
  jobMatchAnalyses,
  applicationPackages,
  applicationPackageVersions,
  applicationArtifacts,
} from '@job-agent/database';
import {
  AppError,
  applicationAttention,
  createLogger,
  ApplicationLifecycleStatus,
  ApplicationEventType,
  type ApplicationSummaryDto,
  type ApplicationDetailDto,
  type ApplicationEventDto,
  type ApplicationNoteDto,
  type ApplicationContactDto,
  type ApplicationAssessmentDto,
  type ApplicationInterviewDto,
  type ApplicationOfferDto,
  type ApplicationCrmMetricsDto,
  type ApplicationCrmAnalyticsDto,
  type CreateApplicationRequest,
  type MarkAppliedRequest,
  type TransitionStatusRequest,
  type UpdateNextActionRequest,
  type AddNoteRequest,
  type CreateContactRequest,
  type UpdateContactRequest,
  type CreateAssessmentRequest,
  type UpdateAssessmentRequest,
  type CreateInterviewRequest,
  type UpdateInterviewRequest,
  type UpdateOfferRequest,
  type ListApplicationsQuery,
  type MatchDecision,
} from '@job-agent/shared';
import { ApplicationStateMachine } from './application-state-machine.js';
import { ApplicationAnalyticsEngine } from './application-analytics-engine.js';

const logger = createLogger({ service: 'api' });

export class ApplicationCrmService {
  /**
   * Create a new tracked application or return existing one (idempotent).
   */
  static async createOrGetApplication(
    userId: string,
    input: CreateApplicationRequest,
  ): Promise<{ application: ApplicationSummaryDto; isExisting: boolean }> {
    const db = getDb();

    // 1. Check if application already exists for this user + job
    const [existing] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.userId, userId), eq(applications.jobId, input.jobId)))
      .limit(1);

    if (existing) {
      // If caller provided a packageId and existing record didn't have one, update it safely
      let updated = existing;
      if (input.packageId && !existing.currentPackageId) {
        const [patched] = await db
          .update(applications)
          .set({ currentPackageId: input.packageId, updatedAt: new Date() })
          .where(eq(applications.id, existing.id))
          .returning();
        if (patched) {
          updated = patched;
        }
      }

      logger.info('Returning existing application record for job', {
        applicationId: existing.id,
        jobId: input.jobId,
      });

      const summary = await this.getApplicationSummary(userId, updated.id);
      return { application: summary, isExisting: true };
    }

    // 2. Verify job exists
    const [job] = await db.select().from(jobs).where(eq(jobs.id, input.jobId)).limit(1);
    if (!job) {
      throw AppError.notFound(`Job ${input.jobId} not found`);
    }

    // 3. If packageId provided, verify it exists
    let linkedPkg: typeof applicationPackages.$inferSelect | null = null;
    if (input.packageId) {
      const [pkg] = await db
        .select()
        .from(applicationPackages)
        .where(eq(applicationPackages.id, input.packageId))
        .limit(1);
      if (!pkg) {
        throw AppError.notFound(`Application package ${input.packageId} not found`);
      }
      linkedPkg = pkg;
    }

    // 4. Initial status determination conforming to canonical creation semantics
    let initialStatus: ApplicationLifecycleStatus;
    if (input.status) {
      initialStatus = input.status as ApplicationLifecycleStatus;
    } else if (linkedPkg) {
      if (linkedPkg.status === 'READY') {
        initialStatus = ApplicationLifecycleStatus.READY_TO_APPLY;
      } else if (linkedPkg.status === 'NEEDS_REVIEW') {
        initialStatus = ApplicationLifecycleStatus.NEEDS_REVIEW;
      } else {
        initialStatus = ApplicationLifecycleStatus.READY_TO_APPLY;
      }
    } else {
      // Check if job match analysis exists
      const [match] = await db
        .select()
        .from(jobMatchAnalyses)
        .where(and(eq(jobMatchAnalyses.jobId, input.jobId), eq(jobMatchAnalyses.userId, userId)))
        .limit(1);

      if (match) {
        if (match.decision === 'MATCH') {
          initialStatus = ApplicationLifecycleStatus.MATCHED;
        } else if (match.decision === 'SKIP') {
          initialStatus = ApplicationLifecycleStatus.SKIPPED;
        } else if (match.decision === 'REVIEW') {
          initialStatus = ApplicationLifecycleStatus.NEEDS_REVIEW;
        } else {
          initialStatus = ApplicationLifecycleStatus.ANALYZED;
        }
      } else {
        initialStatus = ApplicationLifecycleStatus.READY_TO_APPLY;
      }
    }

    const isApplied = initialStatus === ApplicationLifecycleStatus.APPLIED;
    const appliedAtDate = input.appliedAt
      ? new Date(input.appliedAt)
      : isApplied
        ? new Date()
        : null;

    // 5. Insert application
    const [created] = await db
      .insert(applications)
      .values({
        userId,
        jobId: input.jobId,
        currentPackageId: input.packageId || null,
        status: initialStatus,
        source: input.source || 'DIRECT',
        applicationUrl:
          input.applicationUrl || job.applicationUrl || job.originalUrl || job.canonicalUrl || null,
        submissionMethod: input.submissionMethod || null,
        externalReferenceId: input.externalReferenceId || null,
        appliedAt: appliedAtDate,
        lastStatusChangeAt: new Date(),
        nextAction: input.nextAction || null,
        nextActionType: input.nextActionType || null,
        followUpAt: input.followUpAt ? new Date(input.followUpAt) : null,
        notes: input.notes || null,
      })
      .returning();

    if (!created) {
      throw AppError.internal('Failed to create application record');
    }

    // 6. Record creation event
    await db.insert(applicationLifecycleEvents).values({
      applicationId: created.id,
      userId,
      eventType: ApplicationEventType.APPLICATION_CREATED,
      newStatus: initialStatus,
      actor: 'USER',
      note: input.notes ? 'Application created with initial notes' : 'Application tracked in CRM',
      safeMetadata: {
        jobId: input.jobId,
        initialStatus,
        hasPackage: Boolean(input.packageId),
        source: input.source || 'DIRECT',
      },
    });

    // If starting directly as APPLIED, also record MARKED_APPLIED event
    if (isApplied) {
      await db.insert(applicationLifecycleEvents).values({
        applicationId: created.id,
        userId,
        eventType: ApplicationEventType.MARKED_APPLIED,
        previousStatus: null,
        newStatus: ApplicationLifecycleStatus.APPLIED,
        actor: 'USER',
        note: 'Application recorded directly as applied',
        safeMetadata: {
          submissionMethod: input.submissionMethod || 'OTHER',
          externalReferenceId: input.externalReferenceId || null,
          appliedAt: appliedAtDate?.toISOString(),
        },
      });
    }

    logger.info('Application tracked in CRM', {
      applicationId: created.id,
      jobId: input.jobId,
      status: initialStatus,
    });

    const summary = await this.getApplicationSummary(userId, created.id);
    return { application: summary, isExisting: false };
  }

  /**
   * Mark application as applied with frozen package/artifact provenance.
   */
  static async markApplied(
    userId: string,
    applicationId: string,
    input: MarkAppliedRequest,
  ): Promise<ApplicationSummaryDto> {
    const db = getDb();

    const [app] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1);

    if (!app) {
      throw AppError.notFound(`Application ${applicationId} not found`);
    }

    // Idempotency: if already APPLIED and no new version specified, safely update metadata
    if (app.status === ApplicationLifecycleStatus.APPLIED) {
      const updates: Partial<typeof applications.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.submissionMethod) updates.submissionMethod = input.submissionMethod;
      if (input.externalReferenceId) updates.externalReferenceId = input.externalReferenceId;
      if (input.applicationUrl) updates.applicationUrl = input.applicationUrl;
      if (input.notes) updates.notes = input.notes;

      await db.update(applications).set(updates).where(eq(applications.id, applicationId));

      logger.info('Application already marked applied, updated submission metadata', {
        applicationId,
      });
      return this.getApplicationSummary(userId, applicationId);
    }

    // Validate transition
    const validation = ApplicationStateMachine.validateTransition(
      app.status as ApplicationLifecycleStatus,
      ApplicationLifecycleStatus.APPLIED,
    );
    if (!validation.allowed) {
      throw AppError.badRequest(validation.reason || 'Invalid transition to APPLIED');
    }

    // Resolve frozen package version & artifacts
    let submittedVersionId = input.packageVersionId || app.submittedPackageVersionId || null;
    let submittedCvArtifactId = input.cvArtifactId || app.submittedCvArtifactId || null;
    let submittedCoverLetterArtifactId =
      input.coverLetterArtifactId || app.submittedCoverLetterArtifactId || null;

    // If package exists but version not specified, resolve latest package version
    if (!submittedVersionId && app.currentPackageId) {
      const [latestVersion] = await db
        .select()
        .from(applicationPackageVersions)
        .where(eq(applicationPackageVersions.packageId, app.currentPackageId))
        .orderBy(desc(applicationPackageVersions.versionNumber))
        .limit(1);

      if (latestVersion) {
        submittedVersionId = latestVersion.id;

        // Fetch artifacts of this version
        const artifacts = await db
          .select()
          .from(applicationArtifacts)
          .where(eq(applicationArtifacts.versionId, latestVersion.id));

        const cvArt = artifacts.find((a) => a.artifactType === 'TAILORED_CV');
        const clArt = artifacts.find((a) => a.artifactType === 'COVER_LETTER');
        if (cvArt && !submittedCvArtifactId) submittedCvArtifactId = cvArt.id;
        if (clArt && !submittedCoverLetterArtifactId) submittedCoverLetterArtifactId = clArt.id;
      }
    }

    const appliedAtDate = input.appliedAt ? new Date(input.appliedAt) : new Date();

    // Update application
    await db
      .update(applications)
      .set({
        status: ApplicationLifecycleStatus.APPLIED,
        appliedAt: appliedAtDate,
        lastStatusChangeAt: new Date(),
        submittedPackageVersionId: submittedVersionId,
        submittedCvArtifactId,
        submittedCoverLetterArtifactId,
        submissionMethod: input.submissionMethod || app.submissionMethod || 'OTHER',
        externalReferenceId: input.externalReferenceId || app.externalReferenceId || null,
        applicationUrl: input.applicationUrl || app.applicationUrl || null,
        notes: input.notes || app.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(applications.id, applicationId));

    // Record MARKED_APPLIED event
    await db.insert(applicationLifecycleEvents).values({
      applicationId,
      userId,
      eventType: ApplicationEventType.MARKED_APPLIED,
      previousStatus: app.status,
      newStatus: ApplicationLifecycleStatus.APPLIED,
      actor: 'USER',
      note: input.notes || 'Marked as applied by candidate',
      safeMetadata: {
        submittedPackageVersionId: submittedVersionId,
        submittedCvArtifactId,
        submittedCoverLetterArtifactId,
        submissionMethod: input.submissionMethod || 'OTHER',
        externalReferenceId: input.externalReferenceId || null,
        appliedAt: appliedAtDate.toISOString(),
      },
    });

    logger.info('Application marked applied successfully', {
      applicationId,
      submittedVersionId,
      submissionMethod: input.submissionMethod,
    });

    return this.getApplicationSummary(userId, applicationId);
  }

  /**
   * Transition application lifecycle status.
   */
  static async transitionStatus(
    userId: string,
    applicationId: string,
    input: TransitionStatusRequest,
    dbInstance?: Database,
  ): Promise<ApplicationSummaryDto> {
    if (!dbInstance)
      return getDb().transaction((tx) => this.transitionStatus(userId, applicationId, input, tx));
    const db = dbInstance;

    const [app] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1)
      .for('update');

    if (!app) {
      throw AppError.notFound(`Application ${applicationId} not found`);
    }

    const validation = ApplicationStateMachine.validateTransition(
      app.status as ApplicationLifecycleStatus,
      input.targetStatus,
      {
        isCorrection: input.isCorrection,
        correctionReason: input.correctionReason,
      },
    );

    if (!validation.allowed) {
      throw AppError.badRequest(validation.reason || 'Invalid transition');
    }

    if (validation.isNoOp) {
      return this.getApplicationSummary(userId, applicationId, db);
    }

    const isTerminal = ApplicationStateMachine.isTerminal(input.targetStatus);
    const wasTerminal = ApplicationStateMachine.isTerminal(
      app.status as ApplicationLifecycleStatus,
    );

    const updates: Partial<typeof applications.$inferInsert> = {
      status: input.targetStatus,
      lastStatusChangeAt: new Date(),
      updatedAt: new Date(),
    };

    if (isTerminal) {
      updates.closedAt = new Date();
      updates.terminalReason = input.reason || null;
      updates.terminalStage = app.status;
    } else if (wasTerminal && validation.isCorrection) {
      // Reopening via correction
      updates.closedAt = null;
      updates.terminalReason = null;
      updates.terminalStage = null;
    }

    await db.update(applications).set(updates).where(eq(applications.id, applicationId));

    // Record lifecycle event
    await db.insert(applicationLifecycleEvents).values({
      applicationId,
      userId,
      eventType: validation.mappedEventType,
      previousStatus: app.status,
      newStatus: input.targetStatus,
      actor: input.actor || 'USER',
      note: input.note || input.reason || input.correctionReason || null,
      safeMetadata: {
        previousStatus: app.status,
        newStatus: input.targetStatus,
        isCorrection: validation.isCorrection,
        reason: input.reason || input.correctionReason || null,
      },
    });

    logger.info('Application status transitioned', {
      applicationId,
      from: app.status,
      to: input.targetStatus,
      isCorrection: validation.isCorrection,
    });

    return this.getApplicationSummary(userId, applicationId, db);
  }

  /**
   * Update next action and follow-up date.
   */
  static async updateNextAction(
    userId: string,
    applicationId: string,
    input: UpdateNextActionRequest,
  ): Promise<ApplicationSummaryDto> {
    const db = getDb();

    const [app] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1);

    if (!app) {
      throw AppError.notFound(`Application ${applicationId} not found`);
    }

    const followUpDate = input.followUpAt ? new Date(input.followUpAt) : null;

    await db
      .update(applications)
      .set({
        nextAction: input.nextAction !== undefined ? input.nextAction : app.nextAction,
        nextActionType:
          input.nextActionType !== undefined ? input.nextActionType : app.nextActionType,
        followUpAt: input.followUpAt !== undefined ? followUpDate : app.followUpAt,
        updatedAt: new Date(),
      })
      .where(eq(applications.id, applicationId));

    await db.insert(applicationLifecycleEvents).values({
      applicationId,
      userId,
      eventType: ApplicationEventType.FOLLOW_UP_SET,
      actor: 'USER',
      note: input.nextAction ? `Next action: ${input.nextAction}` : 'Follow-up cleared',
      safeMetadata: {
        nextAction: input.nextAction,
        nextActionType: input.nextActionType,
        followUpAt: followUpDate?.toISOString(),
      },
    });

    return this.getApplicationSummary(userId, applicationId);
  }

  /**
   * Archive application (soft-hide from active pipeline while preserving all history and provenance).
   */
  static async archiveApplication(
    userId: string,
    applicationId: string,
  ): Promise<ApplicationSummaryDto> {
    const db = getDb();
    const [app] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1);

    if (!app) {
      throw AppError.notFound(`Application ${applicationId} not found`);
    }

    const now = new Date();
    await db
      .update(applications)
      .set({
        isArchived: true,
        archivedAt: now,
        updatedAt: now,
      })
      .where(eq(applications.id, applicationId));

    await db.insert(applicationLifecycleEvents).values({
      applicationId,
      userId,
      eventType: ApplicationEventType.APPLICATION_ARCHIVED,
      actor: 'USER',
      note: 'Application archived',
      safeMetadata: {
        archivedAt: now.toISOString(),
      },
    });

    return this.getApplicationSummary(userId, applicationId);
  }

  /**
   * Unarchive application (restore to active pipeline).
   */
  static async unarchiveApplication(
    userId: string,
    applicationId: string,
  ): Promise<ApplicationSummaryDto> {
    const db = getDb();
    const [app] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1);

    if (!app) {
      throw AppError.notFound(`Application ${applicationId} not found`);
    }

    const now = new Date();
    await db
      .update(applications)
      .set({
        isArchived: false,
        archivedAt: null,
        updatedAt: now,
      })
      .where(eq(applications.id, applicationId));

    await db.insert(applicationLifecycleEvents).values({
      applicationId,
      userId,
      eventType: ApplicationEventType.APPLICATION_UNARCHIVED,
      actor: 'USER',
      note: 'Application restored from archive',
      safeMetadata: {
        unarchivedAt: now.toISOString(),
      },
    });

    return this.getApplicationSummary(userId, applicationId);
  }

  /**
   * Hard purge application record (deliberately destructive privacy/cleanup action).
   */
  static async purgeApplication(
    userId: string,
    applicationId: string,
  ): Promise<{ id: string; purged: boolean }> {
    const db = getDb();
    const [app] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1);

    if (!app) {
      throw AppError.notFound(`Application ${applicationId} not found`);
    }

    // Cascade delete in PostgreSQL deletes all sub-entities cleanly
    await db.delete(applications).where(eq(applications.id, applicationId));

    logger.warn('Application permanently purged', {
      applicationId,
      userId,
    });

    return { id: applicationId, purged: true };
  }

  /**
   * List applications with filters, search, and pagination.
   */
  static async listApplications(
    userId: string,
    query: ListApplicationsQuery,
  ): Promise<{ items: ApplicationSummaryDto[]; total: number }> {
    const db = getDb();
    const now = new Date();

    const conditions = [eq(applications.userId, userId)];

    if (query.isArchived !== undefined) {
      conditions.push(eq(applications.isArchived, query.isArchived));
    } else {
      conditions.push(eq(applications.isArchived, false));
    }

    if (query.status) {
      conditions.push(eq(applications.status, query.status));
    }

    if (query.source) {
      conditions.push(eq(applications.source, query.source));
    }

    if (query.hasFollowUp) {
      conditions.push(isNotNull(applications.followUpAt));
      conditions.push(lte(applications.followUpAt, new Date(now.getTime() + 24 * 60 * 60 * 1000)));
      conditions.push(sql`${applications.closedAt} is null`);
    }

    // Search by title or company
    if (query.search || query.company) {
      const searchTerms = [];
      if (query.search) {
        searchTerms.push(ilike(jobs.title, `%${query.search}%`));
        searchTerms.push(ilike(jobs.company, `%${query.search}%`));
      }
      if (query.company) {
        searchTerms.push(ilike(jobs.company, `%${query.company}%`));
      }
      if (searchTerms.length > 0) {
        conditions.push(or(...searchTerms)!);
      }
    }

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(whereClause);
    const total = Number(countResult?.count || 0);

    // Order by
    let orderColumn = desc(applications.lastStatusChangeAt);
    if (query.sortBy === 'appliedAt') {
      orderColumn =
        query.sortOrder === 'asc' ? asc(applications.appliedAt) : desc(applications.appliedAt);
    } else if (query.sortBy === 'followUpAt') {
      orderColumn =
        query.sortOrder === 'asc' ? asc(applications.followUpAt) : desc(applications.followUpAt);
    } else if (query.sortBy === 'createdAt') {
      orderColumn =
        query.sortOrder === 'asc' ? asc(applications.createdAt) : desc(applications.createdAt);
    } else if (query.sortBy === 'company') {
      orderColumn = query.sortOrder === 'asc' ? asc(jobs.company) : desc(jobs.company);
    } else if (query.sortBy === 'title') {
      orderColumn = query.sortOrder === 'asc' ? asc(jobs.title) : desc(jobs.title);
    }

    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const rowsQuery = db
      .select({
        app: applications,
        job: jobs,
        match: jobMatchAnalyses,
        pkgVer: applicationPackageVersions,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .leftJoin(
        jobMatchAnalyses,
        and(
          eq(jobMatchAnalyses.jobId, jobs.id),
          eq(jobMatchAnalyses.userId, userId),
          eq(jobMatchAnalyses.isStale, false),
        ),
      )
      .leftJoin(
        applicationPackageVersions,
        eq(applications.submittedPackageVersionId, applicationPackageVersions.id),
      )
      .where(whereClause)
      .orderBy(orderColumn);
    // Attention is filtered before pagination so a later actionable record is never hidden.
    const rows = await (query.needsAttention ? rowsQuery : rowsQuery.limit(limit).offset(offset));
    const runRows = rows.length
      ? await db
          .select()
          .from(browserApplicationRuns)
          .where(
            and(
              eq(browserApplicationRuns.userId, userId),
              inArray(
                browserApplicationRuns.applicationId,
                rows.map((r) => r.app.id),
              ),
            ),
          )
          .orderBy(
            sql`CASE WHEN ${browserApplicationRuns.mode} = 'SUBMIT' AND ${browserApplicationRuns.status} = 'SUBMISSION_UNCERTAIN' THEN 0 WHEN ${browserApplicationRuns.mode} = 'SUBMIT' THEN 1 ELSE 2 END`,
            desc(browserApplicationRuns.createdAt),
            desc(browserApplicationRuns.id),
          )
      : [];
    const intentRows = rows.length
      ? await db
          .select()
          .from(applicationIntents)
          .where(
            and(
              eq(applicationIntents.userId, userId),
              inArray(
                applicationIntents.applicationId,
                rows.map((r) => r.app.id),
              ),
            ),
          )
          .orderBy(desc(applicationIntents.createdAt))
      : [];
    const latestIntents = new Map<string, (typeof intentRows)[number]>();
    for (const intent of intentRows)
      if (!latestIntents.has(intent.applicationId)) latestIntents.set(intent.applicationId, intent);
    const latestRuns = new Map<string, (typeof runRows)[number]>();
    for (const run of runRows)
      if (!latestRuns.has(run.applicationId)) latestRuns.set(run.applicationId, run);

    // Fetch counts for notes, contacts, interviews in parallel
    const seenAppIds = new Set<string>();
    const items: ApplicationSummaryDto[] = [];
    for (const r of rows) {
      const appId = r.app.id;
      if (seenAppIds.has(appId)) continue;
      seenAppIds.add(appId);

      const [notesC, contactsC, interviewsC] = await Promise.all([
        db
          .select({ count: count() })
          .from(applicationNotes)
          .where(eq(applicationNotes.applicationId, appId)),
        db
          .select({ count: count() })
          .from(applicationContacts)
          .where(eq(applicationContacts.applicationId, appId)),
        db
          .select({ count: count() })
          .from(applicationInterviews)
          .where(eq(applicationInterviews.applicationId, appId)),
      ]);

      const followUpTime = r.app.followUpAt?.getTime() || null;
      const nowTime = now.getTime();
      const isFollowUpOverdue = Boolean(followUpTime && followUpTime < nowTime && !r.app.closedAt);
      const isFollowUpDue = Boolean(
        followUpTime &&
        followUpTime >= nowTime &&
        followUpTime <= nowTime + 24 * 60 * 60 * 1000 &&
        !r.app.closedAt,
      );

      const run = latestRuns.get(appId);
      const execution = run
        ? {
            runId: run.id,
            mode: run.mode,
            status: run.status,
            createdAt: run.createdAt.toISOString(),
          }
        : null;
      const intent = latestIntents.get(appId);
      const preparation = intent
        ? {
            intentId: intent.id,
            status: intent.status,
            message: intent.message,
            expiresAt: intent.expiresAt.toISOString(),
          }
        : null;
      const attention = applicationAttention(
        {
          ...r.app,
          status: r.app.status as ApplicationLifecycleStatus,
          appliedAt: r.app.appliedAt?.toISOString(),
          closedAt: r.app.closedAt?.toISOString(),
          isFollowUpDue,
          isFollowUpOverdue,
        },
        execution,
        preparation,
      );
      items.push({
        preparation,
        execution,
        attention,
        id: r.app.id,
        jobId: r.app.jobId,
        jobTitle: r.job.title,
        company: r.job.company,
        location: r.job.locationText,
        workplaceType: r.job.workplaceType,
        status: r.app.status as ApplicationLifecycleStatus,
        source: r.app.source,
        submissionMethod: r.app.submissionMethod,
        applicationUrl: r.app.applicationUrl,
        appliedAt: r.app.appliedAt?.toISOString() || null,
        lastStatusChangeAt: r.app.lastStatusChangeAt.toISOString(),
        closedAt: r.app.closedAt?.toISOString() || null,
        terminalReason: r.app.terminalReason,
        terminalStage: r.app.terminalStage,
        nextAction: r.app.nextAction,
        nextActionType: r.app.nextActionType,
        followUpAt: r.app.followUpAt?.toISOString() || null,
        notes: r.app.notes,
        isFollowUpDue,
        isFollowUpOverdue,
        matchScore: r.match?.overallScore ?? null,
        matchDecision: (r.match?.decision as MatchDecision) ?? null,
        packageId: r.app.currentPackageId,
        submittedVersionNumber: r.pkgVer?.versionNumber ?? null,
        notesCount: Number(notesC[0]?.count || 0),
        contactsCount: Number(contactsC[0]?.count || 0),
        interviewsCount: Number(interviewsC[0]?.count || 0),
        isArchived: r.app.isArchived,
        archivedAt: r.app.archivedAt?.toISOString() || null,
        createdAt: r.app.createdAt.toISOString(),
        updatedAt: r.app.updatedAt.toISOString(),
      });
    }

    if (query.needsAttention) {
      const actionable = items.filter((item) => item.attention);
      return { items: actionable.slice(offset, offset + limit), total: actionable.length };
    }
    return { items, total };
  }

  /**
   * Get single application summary.
   */
  static async getApplicationSummary(
    userId: string,
    applicationId: string,
    dbInstance?: Database,
  ): Promise<ApplicationSummaryDto> {
    // Fetch directly
    const db = dbInstance ?? getDb();
    const [row] = await db
      .select({
        app: applications,
        job: jobs,
        match: jobMatchAnalyses,
        pkgVer: applicationPackageVersions,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .leftJoin(
        jobMatchAnalyses,
        and(eq(jobMatchAnalyses.jobId, jobs.id), eq(jobMatchAnalyses.userId, userId)),
      )
      .leftJoin(
        applicationPackageVersions,
        eq(applications.submittedPackageVersionId, applicationPackageVersions.id),
      )
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1);

    if (!row) {
      throw AppError.notFound(`Application ${applicationId} not found`);
    }

    const [notesC, contactsC, interviewsC] = await Promise.all([
      db
        .select({ count: count() })
        .from(applicationNotes)
        .where(eq(applicationNotes.applicationId, applicationId)),
      db
        .select({ count: count() })
        .from(applicationContacts)
        .where(eq(applicationContacts.applicationId, applicationId)),
      db
        .select({ count: count() })
        .from(applicationInterviews)
        .where(eq(applicationInterviews.applicationId, applicationId)),
    ]);

    const now = new Date();
    const followUpTime = row.app.followUpAt?.getTime() || null;
    const nowTime = now.getTime();
    const isFollowUpOverdue = Boolean(followUpTime && followUpTime < nowTime && !row.app.closedAt);
    const isFollowUpDue = Boolean(
      followUpTime &&
      followUpTime >= nowTime &&
      followUpTime <= nowTime + 24 * 60 * 60 * 1000 &&
      !row.app.closedAt,
    );

    const [run] = await db
      .select()
      .from(browserApplicationRuns)
      .where(
        and(
          eq(browserApplicationRuns.userId, userId),
          eq(browserApplicationRuns.applicationId, applicationId),
        ),
      )
      .orderBy(
        sql`CASE WHEN ${browserApplicationRuns.mode} = 'SUBMIT' AND ${browserApplicationRuns.status} = 'SUBMISSION_UNCERTAIN' THEN 0 WHEN ${browserApplicationRuns.mode} = 'SUBMIT' THEN 1 ELSE 2 END`,
        desc(browserApplicationRuns.createdAt),
        desc(browserApplicationRuns.id),
      )
      .limit(1);
    const execution = run
      ? {
          runId: run.id,
          mode: run.mode,
          status: run.status,
          createdAt: run.createdAt.toISOString(),
        }
      : null;
    const [intent] = await db
      .select()
      .from(applicationIntents)
      .where(
        and(
          eq(applicationIntents.userId, userId),
          eq(applicationIntents.applicationId, applicationId),
        ),
      )
      .orderBy(desc(applicationIntents.createdAt))
      .limit(1);
    const preparation = intent
      ? {
          intentId: intent.id,
          status: intent.status,
          message: intent.message,
          expiresAt: intent.expiresAt.toISOString(),
        }
      : null;
    const attention = applicationAttention(
      {
        ...row.app,
        status: row.app.status as ApplicationLifecycleStatus,
        appliedAt: row.app.appliedAt?.toISOString(),
        closedAt: row.app.closedAt?.toISOString(),
        isFollowUpDue,
        isFollowUpOverdue,
      },
      execution,
      preparation,
    );
    return {
      preparation,
      execution,
      attention,
      id: row.app.id,
      jobId: row.app.jobId,
      jobTitle: row.job.title,
      company: row.job.company,
      location: row.job.locationText,
      workplaceType: row.job.workplaceType,
      status: row.app.status as ApplicationLifecycleStatus,
      source: row.app.source,
      submissionMethod: row.app.submissionMethod,
      applicationUrl: row.app.applicationUrl,
      appliedAt: row.app.appliedAt?.toISOString() || null,
      lastStatusChangeAt: row.app.lastStatusChangeAt.toISOString(),
      closedAt: row.app.closedAt?.toISOString() || null,
      terminalReason: row.app.terminalReason,
      terminalStage: row.app.terminalStage,
      nextAction: row.app.nextAction,
      nextActionType: row.app.nextActionType,
      followUpAt: row.app.followUpAt?.toISOString() || null,
      notes: row.app.notes,
      isFollowUpDue,
      isFollowUpOverdue,
      matchScore: row.match?.overallScore ?? null,
      matchDecision: (row.match?.decision as MatchDecision) ?? null,
      packageId: row.app.currentPackageId,
      submittedVersionNumber: row.pkgVer?.versionNumber ?? null,
      notesCount: Number(notesC[0]?.count || 0),
      contactsCount: Number(contactsC[0]?.count || 0),
      interviewsCount: Number(interviewsC[0]?.count || 0),
      isArchived: row.app.isArchived,
      archivedAt: row.app.archivedAt?.toISOString() || null,
      createdAt: row.app.createdAt.toISOString(),
      updatedAt: row.app.updatedAt.toISOString(),
    };
  }

  /**
   * Get complete application detail.
   */
  static async getApplicationDetail(
    userId: string,
    applicationId: string,
  ): Promise<ApplicationDetailDto> {
    const db = getDb();

    const [row] = await db
      .select({
        app: applications,
        job: jobs,
        match: jobMatchAnalyses,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .leftJoin(
        jobMatchAnalyses,
        and(eq(jobMatchAnalyses.jobId, jobs.id), eq(jobMatchAnalyses.userId, userId)),
      )
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1);

    if (!row) {
      throw AppError.notFound(`Application ${applicationId} not found`);
    }

    const summary = await this.getApplicationSummary(userId, applicationId);

    // Current package
    let currentPackage = null;
    if (row.app.currentPackageId) {
      const [pkg] = await db
        .select()
        .from(applicationPackages)
        .where(eq(applicationPackages.id, row.app.currentPackageId))
        .limit(1);
      if (pkg) {
        currentPackage = {
          packageId: pkg.id,
          status: pkg.status,
          currentVersionNumber: pkg.currentVersionNumber,
          isStale: pkg.isStale,
        };
      }
    }

    // Submitted package version
    let submittedPackage = null;
    if (row.app.submittedPackageVersionId) {
      const [ver] = await db
        .select()
        .from(applicationPackageVersions)
        .where(eq(applicationPackageVersions.id, row.app.submittedPackageVersionId))
        .limit(1);

      if (ver) {
        let cvArtifact = null;
        let coverLetterArtifact = null;

        if (row.app.submittedCvArtifactId) {
          const [cv] = await db
            .select()
            .from(applicationArtifacts)
            .where(eq(applicationArtifacts.id, row.app.submittedCvArtifactId))
            .limit(1);
          if (cv) {
            cvArtifact = {
              artifactId: cv.id,
              artifactType: cv.artifactType,
              filename: cv.filename,
              mimeType: cv.mimeType,
              sizeBytes: cv.sizeBytes,
              sha256Checksum: cv.sha256Checksum,
              downloadUrl: `/api/application-packages/${ver.packageId}/versions/${ver.versionNumber}/artifacts/${cv.id}/download`,
            };
          }
        }

        if (row.app.submittedCoverLetterArtifactId) {
          const [cl] = await db
            .select()
            .from(applicationArtifacts)
            .where(eq(applicationArtifacts.id, row.app.submittedCoverLetterArtifactId))
            .limit(1);
          if (cl) {
            coverLetterArtifact = {
              artifactId: cl.id,
              artifactType: cl.artifactType,
              filename: cl.filename,
              mimeType: cl.mimeType,
              sizeBytes: cl.sizeBytes,
              sha256Checksum: cl.sha256Checksum,
              downloadUrl: `/api/application-packages/${ver.packageId}/versions/${ver.versionNumber}/artifacts/${cl.id}/download`,
            };
          }
        }

        submittedPackage = {
          packageId: ver.packageId,
          versionNumber: ver.versionNumber,
          versionId: ver.id,
          cvArtifact,
          coverLetterArtifact,
          submittedAt: row.app.appliedAt
            ? row.app.appliedAt.toISOString()
            : row.app.createdAt.toISOString(),
          submissionMethod: row.app.submissionMethod,
          externalReferenceId: row.app.externalReferenceId,
        };
      }
    }

    // Events timeline ordered ascending
    const eventsList = await db
      .select()
      .from(applicationLifecycleEvents)
      .where(eq(applicationLifecycleEvents.applicationId, applicationId))
      .orderBy(asc(applicationLifecycleEvents.createdAt));

    const events: ApplicationEventDto[] = eventsList.map((e) => ({
      id: e.id,
      applicationId: e.applicationId,
      eventType: e.eventType,
      previousStatus: e.previousStatus,
      newStatus: e.newStatus,
      actor: e.actor,
      note: e.note,
      safeMetadata: (e.safeMetadata as Record<string, unknown>) || {},
      createdAt: e.createdAt.toISOString(),
    }));

    // Contacts
    const contactsList = await db
      .select()
      .from(applicationContacts)
      .where(eq(applicationContacts.applicationId, applicationId))
      .orderBy(desc(applicationContacts.isPrimary), asc(applicationContacts.createdAt));

    const contacts: ApplicationContactDto[] = contactsList.map((c) => ({
      id: c.id,
      applicationId: c.applicationId,
      name: c.name,
      email: c.email,
      phone: c.phone,
      title: c.title,
      company: c.company,
      linkedinUrl: c.linkedinUrl,
      isPrimary: c.isPrimary,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    // Notes
    const notesList = await db
      .select()
      .from(applicationNotes)
      .where(eq(applicationNotes.applicationId, applicationId))
      .orderBy(desc(applicationNotes.createdAt));

    const notes: ApplicationNoteDto[] = notesList.map((n) => ({
      id: n.id,
      applicationId: n.applicationId,
      content: n.content,
      author: n.author,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }));

    // Assessments
    const assessmentsList = await db
      .select()
      .from(applicationAssessments)
      .where(eq(applicationAssessments.applicationId, applicationId))
      .orderBy(desc(applicationAssessments.createdAt));

    const assessments: ApplicationAssessmentDto[] = assessmentsList.map((a) => ({
      id: a.id,
      applicationId: a.applicationId,
      title: a.title,
      assessmentType: a.assessmentType,
      provider: a.provider,
      status: a.status,
      receivedAt: a.receivedAt?.toISOString() || null,
      dueAt: a.dueAt?.toISOString() || null,
      completedAt: a.completedAt?.toISOString() || null,
      url: a.url,
      score: a.score,
      notes: a.notes,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));

    // Interviews
    const interviewsList = await db
      .select({
        interview: applicationInterviews,
        contact: applicationContacts,
      })
      .from(applicationInterviews)
      .leftJoin(applicationContacts, eq(applicationInterviews.contactId, applicationContacts.id))
      .where(eq(applicationInterviews.applicationId, applicationId))
      .orderBy(asc(applicationInterviews.scheduledAt));

    const interviews: ApplicationInterviewDto[] = interviewsList.map((i) => ({
      id: i.interview.id,
      applicationId: i.interview.applicationId,
      roundTitle: i.interview.roundTitle,
      interviewType: i.interview.interviewType,
      status: i.interview.status,
      scheduledAt: i.interview.scheduledAt.toISOString(),
      durationMinutes: i.interview.durationMinutes,
      timezone: i.interview.timezone,
      locationOrUrl: i.interview.locationOrUrl,
      interviewerName: i.interview.interviewerName,
      contactId: i.interview.contactId,
      contactName: i.contact?.name || null,
      notes: i.interview.notes,
      feedback: i.interview.feedback,
      createdAt: i.interview.createdAt.toISOString(),
      updatedAt: i.interview.updatedAt.toISOString(),
    }));

    // Offer
    const [offerRow] = await db
      .select()
      .from(applicationOffers)
      .where(eq(applicationOffers.applicationId, applicationId))
      .limit(1);

    const offer: ApplicationOfferDto | null = offerRow
      ? {
          id: offerRow.id,
          applicationId: offerRow.applicationId,
          baseSalary: offerRow.baseSalary,
          totalComp: offerRow.totalComp,
          currency: offerRow.currency,
          employmentType: offerRow.employmentType,
          proposedStartDate: offerRow.proposedStartDate,
          deadlineAt: offerRow.deadlineAt?.toISOString() || null,
          status: offerRow.status,
          notes: offerRow.notes,
          createdAt: offerRow.createdAt.toISOString(),
          updatedAt: offerRow.updatedAt.toISOString(),
        }
      : null;

    return {
      application: summary,
      job: {
        id: row.job.id,
        title: row.job.title,
        company: row.job.company,
        location: row.job.locationText,
        workplaceType: row.job.workplaceType,
        employmentType: row.job.employmentType,
        seniorityLevel: row.job.seniority,
        sourceUrl: row.job.applicationUrl || row.job.originalUrl || row.job.canonicalUrl || null,
        provider: row.job.provider,
        rawText: row.job.description,
      },
      matchAnalysis: row.match
        ? {
            id: row.match.id,
            overallScore: row.match.overallScore,
            decision: row.match.decision as MatchDecision,
            confidence: row.match.confidenceScore,
            isStale: row.match.isStale,
          }
        : null,
      submittedPackage,
      currentPackage,
      events,
      contacts,
      notes,
      assessments,
      interviews,
      offer,
    };
  }

  // --- Sub-entity CRUD ---

  static async addNote(
    userId: string,
    applicationId: string,
    input: AddNoteRequest,
  ): Promise<ApplicationNoteDto> {
    const db = getDb();
    const [app] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1);
    if (!app) throw AppError.notFound(`Application ${applicationId} not found`);

    const [note] = await db
      .insert(applicationNotes)
      .values({
        applicationId,
        userId,
        content: input.content,
        author: input.author || 'USER',
      })
      .returning();

    if (!note) throw AppError.internal('Failed to create note');

    await db.insert(applicationLifecycleEvents).values({
      applicationId,
      userId,
      eventType: ApplicationEventType.NOTE_ADDED,
      actor: input.author || 'USER',
      note: 'Added application note',
      safeMetadata: { noteId: note.id },
    });

    return {
      id: note.id,
      applicationId: note.applicationId,
      content: note.content,
      author: note.author,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  }

  static async deleteNote(userId: string, applicationId: string, noteId: string): Promise<void> {
    const db = getDb();
    const [deleted] = await db
      .delete(applicationNotes)
      .where(
        and(
          eq(applicationNotes.id, noteId),
          eq(applicationNotes.applicationId, applicationId),
          eq(applicationNotes.userId, userId),
        ),
      )
      .returning();
    if (!deleted) throw AppError.notFound(`Note ${noteId} not found`);
  }

  static async addContact(
    userId: string,
    applicationId: string,
    input: CreateContactRequest,
  ): Promise<ApplicationContactDto> {
    const db = getDb();
    const [app] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1);
    if (!app) throw AppError.notFound(`Application ${applicationId} not found`);

    // If marked primary, unset other primaries
    if (input.isPrimary) {
      await db
        .update(applicationContacts)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(applicationContacts.applicationId, applicationId));
    }

    const [contact] = await db
      .insert(applicationContacts)
      .values({
        applicationId,
        userId,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        title: input.title || null,
        company: input.company || null,
        linkedinUrl: input.linkedinUrl || null,
        isPrimary: input.isPrimary ?? false,
        notes: input.notes || null,
      })
      .returning();

    if (!contact) throw AppError.internal('Failed to create contact');

    await db.insert(applicationLifecycleEvents).values({
      applicationId,
      userId,
      eventType: ApplicationEventType.CONTACT_LINKED,
      actor: 'USER',
      note: `Linked contact: ${contact.name}`,
      safeMetadata: { contactId: contact.id, isPrimary: contact.isPrimary },
    });

    return {
      id: contact.id,
      applicationId: contact.applicationId,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      title: contact.title,
      company: contact.company,
      linkedinUrl: contact.linkedinUrl,
      isPrimary: contact.isPrimary,
      notes: contact.notes,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    };
  }

  static async updateContact(
    userId: string,
    applicationId: string,
    contactId: string,
    input: UpdateContactRequest,
  ): Promise<ApplicationContactDto> {
    const db = getDb();

    if (input.isPrimary) {
      await db
        .update(applicationContacts)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(applicationContacts.applicationId, applicationId));
    }

    const updates: Partial<typeof applicationContacts.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) updates.name = input.name;
    if (input.email !== undefined) updates.email = input.email;
    if (input.phone !== undefined) updates.phone = input.phone;
    if (input.title !== undefined) updates.title = input.title;
    if (input.company !== undefined) updates.company = input.company;
    if (input.linkedinUrl !== undefined) updates.linkedinUrl = input.linkedinUrl;
    if (input.isPrimary !== undefined) updates.isPrimary = input.isPrimary;
    if (input.notes !== undefined) updates.notes = input.notes;

    const [updated] = await db
      .update(applicationContacts)
      .set(updates)
      .where(
        and(
          eq(applicationContacts.id, contactId),
          eq(applicationContacts.applicationId, applicationId),
          eq(applicationContacts.userId, userId),
        ),
      )
      .returning();

    if (!updated) throw AppError.notFound(`Contact ${contactId} not found`);

    return {
      id: updated.id,
      applicationId: updated.applicationId,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      title: updated.title,
      company: updated.company,
      linkedinUrl: updated.linkedinUrl,
      isPrimary: updated.isPrimary,
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  static async deleteContact(
    userId: string,
    applicationId: string,
    contactId: string,
  ): Promise<void> {
    const db = getDb();
    const [deleted] = await db
      .delete(applicationContacts)
      .where(
        and(
          eq(applicationContacts.id, contactId),
          eq(applicationContacts.applicationId, applicationId),
          eq(applicationContacts.userId, userId),
        ),
      )
      .returning();
    if (!deleted) throw AppError.notFound(`Contact ${contactId} not found`);
  }

  static async addAssessment(
    userId: string,
    applicationId: string,
    input: CreateAssessmentRequest,
  ): Promise<ApplicationAssessmentDto> {
    const db = getDb();
    const [app] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1);
    if (!app) throw AppError.notFound(`Application ${applicationId} not found`);

    const [assessment] = await db
      .insert(applicationAssessments)
      .values({
        applicationId,
        userId,
        title: input.title,
        assessmentType: input.assessmentType,
        provider: input.provider || null,
        status: input.status || 'RECEIVED',
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
        url: input.url || null,
        score: input.score || null,
        notes: input.notes || null,
      })
      .returning();

    if (!assessment) throw AppError.internal('Failed to create assessment');

    await db.insert(applicationLifecycleEvents).values({
      applicationId,
      userId,
      eventType: ApplicationEventType.ASSESSMENT_RECEIVED,
      actor: 'USER',
      note: `Added assessment: ${assessment.title}`,
      safeMetadata: { assessmentId: assessment.id, type: assessment.assessmentType },
    });

    return {
      id: assessment.id,
      applicationId: assessment.applicationId,
      title: assessment.title,
      assessmentType: assessment.assessmentType,
      provider: assessment.provider,
      status: assessment.status,
      receivedAt: assessment.receivedAt?.toISOString() || null,
      dueAt: assessment.dueAt?.toISOString() || null,
      completedAt: assessment.completedAt?.toISOString() || null,
      url: assessment.url,
      score: assessment.score,
      notes: assessment.notes,
      createdAt: assessment.createdAt.toISOString(),
      updatedAt: assessment.updatedAt.toISOString(),
    };
  }

  static async updateAssessment(
    userId: string,
    applicationId: string,
    assessmentId: string,
    input: UpdateAssessmentRequest,
  ): Promise<ApplicationAssessmentDto> {
    const db = getDb();
    const updates: Partial<typeof applicationAssessments.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.title !== undefined) updates.title = input.title;
    if (input.assessmentType !== undefined) updates.assessmentType = input.assessmentType;
    if (input.provider !== undefined) updates.provider = input.provider;
    if (input.status !== undefined) updates.status = input.status;
    if (input.receivedAt !== undefined)
      updates.receivedAt = input.receivedAt ? new Date(input.receivedAt) : null;
    if (input.dueAt !== undefined) updates.dueAt = input.dueAt ? new Date(input.dueAt) : null;
    if (input.completedAt !== undefined)
      updates.completedAt = input.completedAt ? new Date(input.completedAt) : null;
    if (input.url !== undefined) updates.url = input.url;
    if (input.score !== undefined) updates.score = input.score;
    if (input.notes !== undefined) updates.notes = input.notes;

    const [updated] = await db
      .update(applicationAssessments)
      .set(updates)
      .where(
        and(
          eq(applicationAssessments.id, assessmentId),
          eq(applicationAssessments.applicationId, applicationId),
          eq(applicationAssessments.userId, userId),
        ),
      )
      .returning();

    if (!updated) throw AppError.notFound(`Assessment ${assessmentId} not found`);

    return {
      id: updated.id,
      applicationId: updated.applicationId,
      title: updated.title,
      assessmentType: updated.assessmentType,
      provider: updated.provider,
      status: updated.status,
      receivedAt: updated.receivedAt?.toISOString() || null,
      dueAt: updated.dueAt?.toISOString() || null,
      completedAt: updated.completedAt?.toISOString() || null,
      url: updated.url,
      score: updated.score,
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  static async deleteAssessment(
    userId: string,
    applicationId: string,
    assessmentId: string,
  ): Promise<void> {
    const db = getDb();
    const [deleted] = await db
      .delete(applicationAssessments)
      .where(
        and(
          eq(applicationAssessments.id, assessmentId),
          eq(applicationAssessments.applicationId, applicationId),
          eq(applicationAssessments.userId, userId),
        ),
      )
      .returning();
    if (!deleted) throw AppError.notFound(`Assessment ${assessmentId} not found`);
  }

  static async addInterview(
    userId: string,
    applicationId: string,
    input: CreateInterviewRequest,
  ): Promise<ApplicationInterviewDto> {
    const db = getDb();
    const [app] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1);
    if (!app) throw AppError.notFound(`Application ${applicationId} not found`);

    const scheduledDate = new Date(input.scheduledAt);

    const [interview] = await db
      .insert(applicationInterviews)
      .values({
        applicationId,
        userId,
        roundTitle: input.roundTitle,
        interviewType: input.interviewType,
        status: input.status || 'SCHEDULED',
        scheduledAt: scheduledDate,
        durationMinutes: input.durationMinutes || null,
        timezone: input.timezone || null,
        locationOrUrl: input.locationOrUrl || null,
        interviewerName: input.interviewerName || null,
        contactId: input.contactId || null,
        notes: input.notes || null,
        feedback: input.feedback || null,
      })
      .returning();

    if (!interview) throw AppError.internal('Failed to create interview');

    await db.insert(applicationLifecycleEvents).values({
      applicationId,
      userId,
      eventType: ApplicationEventType.INTERVIEW_SCHEDULED_MANUALLY,
      actor: 'USER',
      note: `Scheduled interview: ${interview.roundTitle}`,
      safeMetadata: {
        interviewId: interview.id,
        scheduledAt: scheduledDate.toISOString(),
        roundTitle: interview.roundTitle,
      },
    });

    return {
      id: interview.id,
      applicationId: interview.applicationId,
      roundTitle: interview.roundTitle,
      interviewType: interview.interviewType,
      status: interview.status,
      scheduledAt: interview.scheduledAt.toISOString(),
      durationMinutes: interview.durationMinutes,
      timezone: interview.timezone,
      locationOrUrl: interview.locationOrUrl,
      interviewerName: interview.interviewerName,
      contactId: interview.contactId,
      notes: interview.notes,
      feedback: interview.feedback,
      createdAt: interview.createdAt.toISOString(),
      updatedAt: interview.updatedAt.toISOString(),
    };
  }

  static async updateInterview(
    userId: string,
    applicationId: string,
    interviewId: string,
    input: UpdateInterviewRequest,
  ): Promise<ApplicationInterviewDto> {
    const db = getDb();
    const updates: Partial<typeof applicationInterviews.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.roundTitle !== undefined) updates.roundTitle = input.roundTitle;
    if (input.interviewType !== undefined) updates.interviewType = input.interviewType;
    if (input.status !== undefined) updates.status = input.status;
    if (input.scheduledAt !== undefined) updates.scheduledAt = new Date(input.scheduledAt);
    if (input.durationMinutes !== undefined) updates.durationMinutes = input.durationMinutes;
    if (input.timezone !== undefined) updates.timezone = input.timezone;
    if (input.locationOrUrl !== undefined) updates.locationOrUrl = input.locationOrUrl;
    if (input.interviewerName !== undefined) updates.interviewerName = input.interviewerName;
    if (input.contactId !== undefined) updates.contactId = input.contactId;
    if (input.notes !== undefined) updates.notes = input.notes;
    if (input.feedback !== undefined) updates.feedback = input.feedback;

    const [updated] = await db
      .update(applicationInterviews)
      .set(updates)
      .where(
        and(
          eq(applicationInterviews.id, interviewId),
          eq(applicationInterviews.applicationId, applicationId),
          eq(applicationInterviews.userId, userId),
        ),
      )
      .returning();

    if (!updated) throw AppError.notFound(`Interview ${interviewId} not found`);

    return {
      id: updated.id,
      applicationId: updated.applicationId,
      roundTitle: updated.roundTitle,
      interviewType: updated.interviewType,
      status: updated.status,
      scheduledAt: updated.scheduledAt.toISOString(),
      durationMinutes: updated.durationMinutes,
      timezone: updated.timezone,
      locationOrUrl: updated.locationOrUrl,
      interviewerName: updated.interviewerName,
      contactId: updated.contactId,
      notes: updated.notes,
      feedback: updated.feedback,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  static async deleteInterview(
    userId: string,
    applicationId: string,
    interviewId: string,
  ): Promise<void> {
    const db = getDb();
    const [deleted] = await db
      .delete(applicationInterviews)
      .where(
        and(
          eq(applicationInterviews.id, interviewId),
          eq(applicationInterviews.applicationId, applicationId),
          eq(applicationInterviews.userId, userId),
        ),
      )
      .returning();
    if (!deleted) throw AppError.notFound(`Interview ${interviewId} not found`);
  }

  static async updateOffer(
    userId: string,
    applicationId: string,
    input: UpdateOfferRequest,
  ): Promise<ApplicationOfferDto> {
    const db = getDb();
    const [app] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1);
    if (!app) throw AppError.notFound(`Application ${applicationId} not found`);

    const [existing] = await db
      .select()
      .from(applicationOffers)
      .where(eq(applicationOffers.applicationId, applicationId))
      .limit(1);

    const deadline = input.deadlineAt ? new Date(input.deadlineAt) : null;

    let offer;
    if (existing) {
      const [updated] = await db
        .update(applicationOffers)
        .set({
          baseSalary: input.baseSalary !== undefined ? input.baseSalary : existing.baseSalary,
          totalComp: input.totalComp !== undefined ? input.totalComp : existing.totalComp,
          currency: input.currency !== undefined ? input.currency : existing.currency,
          employmentType:
            input.employmentType !== undefined ? input.employmentType : existing.employmentType,
          proposedStartDate:
            input.proposedStartDate !== undefined
              ? input.proposedStartDate
              : existing.proposedStartDate,
          deadlineAt: input.deadlineAt !== undefined ? deadline : existing.deadlineAt,
          status: input.status !== undefined ? input.status : existing.status,
          notes: input.notes !== undefined ? input.notes : existing.notes,
          updatedAt: new Date(),
        })
        .where(eq(applicationOffers.id, existing.id))
        .returning();
      if (!updated) throw AppError.internal('Failed to update offer');
      offer = updated;
    } else {
      const [created] = await db
        .insert(applicationOffers)
        .values({
          applicationId,
          userId,
          baseSalary: input.baseSalary || null,
          totalComp: input.totalComp || null,
          currency: input.currency || 'USD',
          employmentType: input.employmentType || null,
          proposedStartDate: input.proposedStartDate || null,
          deadlineAt: deadline,
          status: input.status || 'PENDING',
          notes: input.notes || null,
        })
        .returning();
      if (!created) throw AppError.internal('Failed to create offer');
      offer = created;

      await db.insert(applicationLifecycleEvents).values({
        applicationId,
        userId,
        eventType: ApplicationEventType.OFFER_RECEIVED,
        actor: 'USER',
        note: 'Offer details recorded',
        safeMetadata: { offerId: offer.id, currency: offer.currency },
      });
    }

    return {
      id: offer.id,
      applicationId: offer.applicationId,
      baseSalary: offer.baseSalary,
      totalComp: offer.totalComp,
      currency: offer.currency,
      employmentType: offer.employmentType,
      proposedStartDate: offer.proposedStartDate,
      deadlineAt: offer.deadlineAt?.toISOString() || null,
      status: offer.status,
      notes: offer.notes,
      createdAt: offer.createdAt.toISOString(),
      updatedAt: offer.updatedAt.toISOString(),
    };
  }

  // --- Metrics & Analytics ---

  static async getMetrics(userId: string): Promise<ApplicationCrmMetricsDto> {
    const db = getDb();
    const rows = await db
      .select({
        id: applications.id,
        status: applications.status,
        source: applications.source,
        submissionMethod: applications.submissionMethod,
        appliedAt: applications.appliedAt,
        closedAt: applications.closedAt,
        followUpAt: applications.followUpAt,
        createdAt: applications.createdAt,
        updatedAt: applications.updatedAt,
      })
      .from(applications)
      .where(and(eq(applications.userId, userId), eq(applications.isArchived, false)));

    return ApplicationAnalyticsEngine.computeMetrics(rows);
  }

  static async getAnalytics(userId: string): Promise<ApplicationCrmAnalyticsDto> {
    const db = getDb();

    const [apps, events] = await Promise.all([
      db
        .select({
          id: applications.id,
          status: applications.status,
          source: applications.source,
          submissionMethod: applications.submissionMethod,
          appliedAt: applications.appliedAt,
          closedAt: applications.closedAt,
          followUpAt: applications.followUpAt,
          createdAt: applications.createdAt,
          updatedAt: applications.updatedAt,
        })
        .from(applications)
        .where(eq(applications.userId, userId)),
      db
        .select({
          applicationId: applicationLifecycleEvents.applicationId,
          eventType: applicationLifecycleEvents.eventType,
          previousStatus: applicationLifecycleEvents.previousStatus,
          newStatus: applicationLifecycleEvents.newStatus,
          createdAt: applicationLifecycleEvents.createdAt,
        })
        .from(applicationLifecycleEvents)
        .where(eq(applicationLifecycleEvents.userId, userId)),
    ]);

    return ApplicationAnalyticsEngine.computeAnalytics(apps, events);
  }
}
