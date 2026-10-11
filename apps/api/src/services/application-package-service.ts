import crypto from 'node:crypto';
import type { Database, Job } from '@job-agent/database';
import {
  applicationPackages,
  applicationPackageVersions,
  applicationArtifacts,
  applicationQuestions,
  approvalRequests,
  applicationPackageEvents,
  jobs,
  jobMatchAnalyses,
  jobRequirementEvaluations,
  candidateProfiles,
  candidateExperiences,
  candidateEducation,
  candidateSkills,
  candidateLanguages,
  candidateCertifications,
  candidateProjects,
  candidateLinks,
  candidateFacts,
  candidateDocuments,
  answerLibrary,
  jobPreferences,
  applicationPolicy,
  eq,
  and,
  desc,
  inArray,
} from '@job-agent/database';
import {
  AppError,
  type FileStorageProvider,
  type ApplicationPackageDto,
  type ApplicationPackageVersionDto,
  type ApplicationArtifactDto,
  type ApplicationQuestionDto,
  type ApprovalRequestDto,
  type ApplicationStudioMetricsDto,
  type PackageReadinessResult,
  type QuestionCategory,
  type QuestionType,
  type TailoredCv,
} from '@job-agent/shared';
import { CvBaseSelector } from './cv-base-selector.js';
import { TailoringEngine, type CandidateContext } from './tailoring-engine.js';
import { DocxGeneratorService } from './docx-generator-service.js';
import { CoverLetterEngine } from './cover-letter-engine.js';
import { ApplicationQuestionEngine } from './application-question-engine.js';
import { PackageReadinessEngine } from './package-readiness-engine.js';

export class ApplicationPackageService {
  private readonly docxGenerator: DocxGeneratorService;

  constructor(
    private readonly db: Database,
    private readonly storage: FileStorageProvider,
  ) {
    this.docxGenerator = new DocxGeneratorService(this.storage);
  }

  /**
   * Creates an Application Package for a selected job and generates version 1.
   */
  public async createPackage(
    userId: string,
    jobId: string,
    manualBaseDocumentId?: string | null,
  ): Promise<{ package: ApplicationPackageDto; version: ApplicationPackageVersionDto }> {
    // 1. Verify Job exists
    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) {
      throw AppError.notFound(`Job with ID ${jobId} not found`);
    }

    // 2. Load latest Match Analysis
    const [matchAnalysis] = await this.db
      .select()
      .from(jobMatchAnalyses)
      .where(and(eq(jobMatchAnalyses.jobId, jobId), eq(jobMatchAnalyses.userId, userId)))
      .orderBy(desc(jobMatchAnalyses.createdAt))
      .limit(1);

    const hasHardBlocker = matchAnalysis
      ? (matchAnalysis.hardBlockers as string[]).length > 0 || matchAnalysis.decision === 'SKIP'
      : false;

    // Check if an active package already exists for this job
    const [existingPkg] = await this.db
      .select()
      .from(applicationPackages)
      .where(and(eq(applicationPackages.jobId, jobId), eq(applicationPackages.userId, userId)))
      .limit(1);

    let pkgId: string;
    if (existingPkg) {
      pkgId = existingPkg.id;
    } else {
      const [insertedPkg] = await this.db
        .insert(applicationPackages)
        .values({
          jobId,
          userId,
          matchAnalysisId: matchAnalysis?.id || null,
          status: 'DRAFT',
          currentVersionNumber: 1,
          hasPolicyBlocker: hasHardBlocker,
          blockerOverridden: false,
          isStale: matchAnalysis ? matchAnalysis.isStale : false,
        })
        .returning();

      pkgId = insertedPkg!.id;

      await this.logEvent(pkgId, 1, 'PACKAGE_CREATED', {
        jobId,
        matchAnalysisId: matchAnalysis?.id || null,
        hasHardBlocker,
      });
    }

    // Generate version 1
    const generatedVersion = await this.generateVersionInternal(pkgId, 1, manualBaseDocumentId);
    const fullPkg = await this.getPackage(pkgId, userId);

    return {
      package: fullPkg.package,
      version: generatedVersion,
    };
  }

  /**
   * Regenerates an Application Package by creating a new version.
   */
  public async regeneratePackage(
    packageId: string,
    userId: string,
    manualBaseDocumentId?: string | null,
  ): Promise<{ package: ApplicationPackageDto; version: ApplicationPackageVersionDto }> {
    const [pkg] = await this.db
      .select()
      .from(applicationPackages)
      .where(and(eq(applicationPackages.id, packageId), eq(applicationPackages.userId, userId)))
      .limit(1);

    if (!pkg) {
      throw AppError.notFound(`Application package ${packageId} not found`);
    }

    const nextVersionNumber = pkg.currentVersionNumber + 1;

    // Update current version number
    await this.db
      .update(applicationPackages)
      .set({
        currentVersionNumber: nextVersionNumber,
        isStale: false,
        updatedAt: new Date(),
      })
      .where(eq(applicationPackages.id, packageId));

    await this.logEvent(packageId, nextVersionNumber, 'PACKAGE_VERSION_CREATED', {
      previousVersion: pkg.currentVersionNumber,
      newVersion: nextVersionNumber,
    });

    const newVersion = await this.generateVersionInternal(
      packageId,
      nextVersionNumber,
      manualBaseDocumentId,
    );
    const updatedPkg = await this.getPackage(packageId, userId);

    return {
      package: updatedPkg.package,
      version: newVersion,
    };
  }

  /**
   * Internal generator for a specific package version.
   */
  private async generateVersionInternal(
    packageId: string,
    versionNumber: number,
    manualBaseDocumentId?: string | null,
  ): Promise<ApplicationPackageVersionDto> {
    const [pkg] = await this.db
      .select()
      .from(applicationPackages)
      .where(eq(applicationPackages.id, packageId))
      .limit(1);

    if (!pkg) throw AppError.notFound('Package not found');

    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, pkg.jobId)).limit(1);
    if (!job) throw AppError.notFound('Job not found');

    // Load Candidate Context
    const candidateCtx = await this.loadCandidateContext(pkg.userId);
    const allDocs = await this.db
      .select()
      .from(candidateDocuments)
      .where(eq(candidateDocuments.userId, pkg.userId));

    // Load Match Analysis & Evaluations
    const [matchAnalysis] = await this.db
      .select()
      .from(jobMatchAnalyses)
      .where(and(eq(jobMatchAnalyses.jobId, job.id), eq(jobMatchAnalyses.userId, pkg.userId)))
      .orderBy(desc(jobMatchAnalyses.createdAt))
      .limit(1);

    const evaluations = matchAnalysis
      ? await this.db
          .select()
          .from(jobRequirementEvaluations)
          .where(eq(jobRequirementEvaluations.analysisId, matchAnalysis.id))
      : [];

    // Select Base CV
    const baseSelection = CvBaseSelector.selectBase(allDocs, job, manualBaseDocumentId);

    // Build Tailored CV
    const tailoredCv = TailoringEngine.buildTailoredCv(
      candidateCtx,
      job,
      matchAnalysis,
      evaluations,
    );

    // Build Cover Letter
    const coverLetter = CoverLetterEngine.generateCoverLetter(candidateCtx, job, matchAnalysis);

    // Fingerprint calculation
    const inputFingerprint = this.calculatePackageFingerprint(
      candidateCtx,
      job,
      baseSelection.selectedDocumentId,
    );

    // Insert or update version record
    const [existingVer] = await this.db
      .select()
      .from(applicationPackageVersions)
      .where(
        and(
          eq(applicationPackageVersions.packageId, packageId),
          eq(applicationPackageVersions.versionNumber, versionNumber),
        ),
      )
      .limit(1);

    let versionId: string;
    if (existingVer) {
      await this.db
        .update(applicationPackageVersions)
        .set({
          baseDocumentId: baseSelection.selectedDocumentId,
          baseSelectionReason: baseSelection.reason,
          tailoredCvContent: tailoredCv,
          coverLetterContent: coverLetter.text,
          changeSummary: [...tailoredCv.changeExplanation, ...coverLetter.changeSummary],
          inputFingerprint,
          updatedAt: new Date(),
        })
        .where(eq(applicationPackageVersions.id, existingVer.id));
      versionId = existingVer.id;
    } else {
      const [insertedVer] = await this.db
        .insert(applicationPackageVersions)
        .values({
          packageId,
          versionNumber,
          status: 'DRAFT',
          inputFingerprint,
          baseDocumentId: baseSelection.selectedDocumentId,
          baseSelectionReason: baseSelection.reason,
          tailoredCvContent: tailoredCv,
          coverLetterContent: coverLetter.text,
          coverLetterEnabled: true,
          coverLetterApproved: false,
          changeSummary: [...tailoredCv.changeExplanation, ...coverLetter.changeSummary],
          generationMode: 'DETERMINISTIC_ONLY',
        })
        .returning();
      versionId = insertedVer!.id;
    }

    // Generate and store CV DOCX Artifact
    const cvDocxResult = await this.docxGenerator.generateTailoredCvDocx(tailoredCv, {
      packageId,
      versionNumber,
      candidateName: candidateCtx.profile.fullName || 'Candidate',
      jobTitle: job.title,
    });

    await this.db.insert(applicationArtifacts).values({
      packageId,
      versionId,
      artifactType: 'TAILORED_CV',
      storageKey: cvDocxResult.metadata.storageKey,
      filename: cvDocxResult.metadata.originalFilename,
      mimeType: cvDocxResult.metadata.mimeType,
      sizeBytes: cvDocxResult.metadata.sizeBytes,
      sha256Checksum: cvDocxResult.metadata.sha256Checksum,
      metadata: { generatedAt: new Date().toISOString() },
    });

    await this.logEvent(packageId, versionNumber, 'CV_GENERATED', {
      storageKey: cvDocxResult.metadata.storageKey,
      filename: cvDocxResult.metadata.originalFilename,
      sizeBytes: cvDocxResult.metadata.sizeBytes,
    });

    // Generate and store Cover Letter DOCX Artifact
    const clDocxResult = await this.docxGenerator.generateCoverLetterDocx(coverLetter.text, {
      packageId,
      versionNumber,
      candidateName: candidateCtx.profile.fullName || 'Candidate',
      jobTitle: job.title,
      company: job.company || 'Hiring Company',
    });

    await this.db.insert(applicationArtifacts).values({
      packageId,
      versionId,
      artifactType: 'COVER_LETTER',
      storageKey: clDocxResult.metadata.storageKey,
      filename: clDocxResult.metadata.originalFilename,
      mimeType: clDocxResult.metadata.mimeType,
      sizeBytes: clDocxResult.metadata.sizeBytes,
      sha256Checksum: clDocxResult.metadata.sha256Checksum,
      metadata: { generatedAt: new Date().toISOString() },
    });

    await this.logEvent(packageId, versionNumber, 'COVER_LETTER_GENERATED', {
      storageKey: clDocxResult.metadata.storageKey,
      filename: clDocxResult.metadata.originalFilename,
      sizeBytes: clDocxResult.metadata.sizeBytes,
    });

    // If regenerating from a previous version, carry forward questions & approved states
    if (versionNumber > 1) {
      const [prevVer] = await this.db
        .select()
        .from(applicationPackageVersions)
        .where(
          and(
            eq(applicationPackageVersions.packageId, packageId),
            eq(applicationPackageVersions.versionNumber, versionNumber - 1),
          ),
        )
        .limit(1);

      if (prevVer) {
        const prevQuestions = await this.db
          .select()
          .from(applicationQuestions)
          .where(eq(applicationQuestions.versionId, prevVer.id))
          .orderBy(applicationQuestions.displayOrder);

        for (const pq of prevQuestions) {
          const [insertedQ] = await this.db
            .insert(applicationQuestions)
            .values({
              packageId,
              versionId,
              questionText: pq.questionText,
              category: pq.category,
              questionType: pq.questionType,
              isRequired: pq.isRequired,
              options: pq.options,
              sensitivity: pq.sensitivity,
              answerSource: pq.answerSource,
              sourceEntityId: pq.sourceEntityId,
              proposedAnswer: pq.proposedAnswer,
              humanEditedAnswer: pq.humanEditedAnswer,
              finalAnswer: pq.finalAnswer,
              approvalState: pq.approvalState,
              displayOrder: pq.displayOrder,
            })
            .returning();

          // If there was an associated approval request in previous version, carry it forward
          const [prevAppr] = await this.db
            .select()
            .from(approvalRequests)
            .where(
              and(
                eq(approvalRequests.versionId, prevVer.id),
                eq(approvalRequests.questionId, pq.id),
              ),
            )
            .limit(1);

          if (prevAppr) {
            await this.db.insert(approvalRequests).values({
              packageId,
              versionId,
              userId: pkg.userId,
              questionId: insertedQ!.id,
              approvalType: prevAppr.approvalType,
              status: prevAppr.status,
              subject: prevAppr.subject,
              proposedValue: prevAppr.proposedValue,
              userEditedValue: prevAppr.userEditedValue,
              reason: prevAppr.reason,
              riskLevel: prevAppr.riskLevel,
              evidenceReferences: prevAppr.evidenceReferences,
              resolvedAt: prevAppr.resolvedAt,
              resolvedBy: prevAppr.resolvedBy,
            });

            // Supersede previous version's unresolved approval request so it does not linger
            if (['PENDING', 'NEEDS_USER_RECONFIRMATION'].includes(prevAppr.status)) {
              await this.db
                .update(approvalRequests)
                .set({ status: 'CANCELLED', updatedAt: new Date() })
                .where(eq(approvalRequests.id, prevAppr.id));
            }
          }
        }
      }
    }

    // Resolve or Populate Standard Questions for this job
    await this.populateStandardQuestions(pkg.userId, packageId, versionId, job);

    // Compute Readiness
    await this.refreshPackageReadiness(packageId, versionId);

    const [updatedVer] = await this.db
      .select()
      .from(applicationPackageVersions)
      .where(eq(applicationPackageVersions.id, versionId))
      .limit(1);

    return this.mapVersionDto(updatedVer!);
  }

  /**
   * Populates standard application questions (e.g. sponsorship, work auth, salary) and resolves them.
   */
  private async populateStandardQuestions(
    userId: string,
    packageId: string,
    versionId: string,
    _job: Job,
  ): Promise<void> {
    const candidate = await this.loadCandidateContext(userId);
    const answers = await this.db
      .select()
      .from(answerLibrary)
      .where(eq(answerLibrary.userId, userId));
    const facts = await this.db
      .select()
      .from(candidateFacts)
      .where(
        and(
          eq(candidateFacts.userId, userId),
          eq(candidateFacts.verificationStatus, 'VERIFIED'),
          eq(candidateFacts.allowAiUse, true),
        ),
      );
    const [preferences] = await this.db
      .select()
      .from(jobPreferences)
      .where(eq(jobPreferences.userId, userId))
      .limit(1);
    const [policy] = await this.db
      .select()
      .from(applicationPolicy)
      .where(eq(applicationPolicy.userId, userId))
      .limit(1);

    const standardQuestions = [
      {
        questionText:
          'Will you now or in the future require company sponsorship for employment visa status?',
        category: 'SPONSORSHIP' as QuestionCategory,
        questionType: 'SINGLE_SELECT' as QuestionType,
        options: ['Yes', 'No'],
        sensitivity: 'SENSITIVE' as const,
        isRequired: true,
      },
      {
        questionText:
          'Are you legally authorized to work in the country where this job is located?',
        category: 'WORK_AUTHORIZATION' as QuestionCategory,
        questionType: 'SINGLE_SELECT' as QuestionType,
        options: ['Yes', 'No'],
        sensitivity: 'SENSITIVE' as const,
        isRequired: true,
      },
      {
        questionText: 'What is your desired yearly compensation?',
        category: 'SALARY' as QuestionCategory,
        questionType: 'TEXT' as QuestionType,
        options: [],
        sensitivity: 'STANDARD' as const,
        isRequired: false,
      },
    ];

    for (let i = 0; i < standardQuestions.length; i++) {
      const qDef = standardQuestions[i]!;

      // Check if question already exists in this version
      const [existingQ] = await this.db
        .select()
        .from(applicationQuestions)
        .where(
          and(
            eq(applicationQuestions.versionId, versionId),
            eq(applicationQuestions.questionText, qDef.questionText),
          ),
        )
        .limit(1);

      if (existingQ) continue;

      const resolution = ApplicationQuestionEngine.resolveQuestion(qDef, {
        candidate,
        answerLibrary: answers,
        candidateFacts: facts,
        preferences,
        policy,
      });

      const [insertedQ] = await this.db
        .insert(applicationQuestions)
        .values({
          packageId,
          versionId,
          questionText: qDef.questionText,
          category: qDef.category,
          questionType: qDef.questionType,
          isRequired: qDef.isRequired,
          options: qDef.options,
          sensitivity: qDef.sensitivity,
          answerSource: resolution.answerSource,
          sourceEntityId: resolution.sourceEntityId,
          proposedAnswer: resolution.proposedAnswer,
          finalAnswer: resolution.approvalState === 'APPROVED' ? resolution.proposedAnswer : null,
          approvalState: resolution.approvalState,
          displayOrder: i,
        })
        .returning();

      if (resolution.needsApproval && resolution.approvalDetails) {
        await this.db.insert(approvalRequests).values({
          packageId,
          versionId,
          userId,
          questionId: insertedQ!.id,
          approvalType: resolution.approvalDetails.approvalType,
          status: 'PENDING',
          subject: resolution.approvalDetails.subject,
          proposedValue: resolution.approvalDetails.proposedValue,
          reason: resolution.approvalDetails.reason,
          riskLevel: resolution.approvalDetails.riskLevel,
          evidenceReferences: resolution.approvalDetails.evidenceReferences,
        });

        await this.logEvent(packageId, null, 'APPROVAL_REQUESTED', {
          questionId: insertedQ!.id,
          subject: resolution.approvalDetails.subject,
          approvalType: resolution.approvalDetails.approvalType,
        });
      }
    }
  }

  /**
   * Refreshes and updates package readiness state.
   */
  public async refreshPackageReadiness(
    packageId: string,
    versionId: string,
  ): Promise<PackageReadinessResult> {
    const [pkg] = await this.db
      .select()
      .from(applicationPackages)
      .where(eq(applicationPackages.id, packageId))
      .limit(1);
    const [version] = await this.db
      .select()
      .from(applicationPackageVersions)
      .where(eq(applicationPackageVersions.id, versionId))
      .limit(1);

    if (!pkg || !version) {
      throw AppError.notFound('Package or version not found');
    }

    const artifacts = await this.db
      .select()
      .from(applicationArtifacts)
      .where(eq(applicationArtifacts.versionId, versionId));

    const questions = await this.db
      .select()
      .from(applicationQuestions)
      .where(eq(applicationQuestions.versionId, versionId));

    const approvals = await this.db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.versionId, versionId));

    const readiness = PackageReadinessEngine.evaluateReadiness({
      pkg,
      version,
      artifacts,
      questions,
      approvals,
    });

    await this.db
      .update(applicationPackages)
      .set({
        status: readiness.status,
        readinessReason: readiness.isReady
          ? 'All package components verified, artifacts generated, and approvals granted.'
          : readiness.blockingIssues.join('; '),
        updatedAt: new Date(),
      })
      .where(eq(applicationPackages.id, packageId));

    await this.db
      .update(applicationPackageVersions)
      .set({
        status: readiness.status === 'READY' ? 'READY' : 'NEEDS_REVIEW',
        updatedAt: new Date(),
      })
      .where(eq(applicationPackageVersions.id, versionId));

    return readiness;
  }

  /**
   * Gets full package details including current version, artifacts, questions, and approvals.
   */
  public async getPackage(
    packageId: string,
    userId: string,
  ): Promise<{
    package: ApplicationPackageDto;
    currentVersion: ApplicationPackageVersionDto | null;
    artifacts: ApplicationArtifactDto[];
    questions: ApplicationQuestionDto[];
    approvals: ApprovalRequestDto[];
    readiness: PackageReadinessResult;
  }> {
    const [pkg] = await this.db
      .select({
        pkg: applicationPackages,
        job: jobs,
        match: jobMatchAnalyses,
      })
      .from(applicationPackages)
      .innerJoin(jobs, eq(applicationPackages.jobId, jobs.id))
      .leftJoin(jobMatchAnalyses, eq(applicationPackages.matchAnalysisId, jobMatchAnalyses.id))
      .where(and(eq(applicationPackages.id, packageId), eq(applicationPackages.userId, userId)))
      .limit(1);

    if (!pkg) {
      throw AppError.notFound(`Application package ${packageId} not found`);
    }

    // Load current version
    const [currentVer] = await this.db
      .select()
      .from(applicationPackageVersions)
      .where(
        and(
          eq(applicationPackageVersions.packageId, packageId),
          eq(applicationPackageVersions.versionNumber, pkg.pkg.currentVersionNumber),
        ),
      )
      .limit(1);

    const versionId = currentVer?.id;

    const artifacts = versionId
      ? await this.db
          .select()
          .from(applicationArtifacts)
          .where(eq(applicationArtifacts.versionId, versionId))
      : [];

    const questions = versionId
      ? await this.db
          .select()
          .from(applicationQuestions)
          .where(eq(applicationQuestions.versionId, versionId))
          .orderBy(applicationQuestions.displayOrder)
      : [];

    const approvals = versionId
      ? await this.db
          .select()
          .from(approvalRequests)
          .where(eq(approvalRequests.versionId, versionId))
          .orderBy(desc(approvalRequests.createdAt))
      : [];

    // Check dynamic staleness
    const candidateCtx = await this.loadCandidateContext(userId);
    const freshFingerprint = this.calculatePackageFingerprint(
      candidateCtx,
      pkg.job,
      currentVer?.baseDocumentId || null,
    );

    let isStale = pkg.pkg.isStale;
    if (currentVer && currentVer.inputFingerprint !== freshFingerprint) {
      isStale = true;
      if (!pkg.pkg.isStale) {
        await this.db
          .update(applicationPackages)
          .set({ isStale: true, updatedAt: new Date() })
          .where(eq(applicationPackages.id, packageId));
      }
    }

    const readiness = currentVer
      ? PackageReadinessEngine.evaluateReadiness({
          pkg: { ...pkg.pkg, isStale },
          version: currentVer,
          artifacts,
          questions,
          approvals,
        })
      : {
          status: 'DRAFT' as const,
          isReady: false,
          reasons: [],
          blockingIssues: ['No version created yet'],
          pendingApprovalsCount: 0,
          unresolvedQuestionsCount: 0,
        };

    const packageDto: ApplicationPackageDto = {
      id: pkg.pkg.id,
      jobId: pkg.pkg.jobId,
      userId: pkg.pkg.userId,
      matchAnalysisId: pkg.pkg.matchAnalysisId,
      status: readiness.status,
      currentVersionNumber: pkg.pkg.currentVersionNumber,
      hasPolicyBlocker: pkg.pkg.hasPolicyBlocker,
      blockerOverridden: pkg.pkg.blockerOverridden,
      blockerOverrideReason: pkg.pkg.blockerOverrideReason,
      blockerOverriddenAt: pkg.pkg.blockerOverriddenAt?.toISOString() || null,
      isStale,
      readinessReason: readiness.isReady
        ? 'Package ready for submission'
        : readiness.blockingIssues.join('; '),
      createdAt: pkg.pkg.createdAt.toISOString(),
      updatedAt: pkg.pkg.updatedAt.toISOString(),
      jobTitle: pkg.job.title,
      jobCompany: pkg.job.company,
      jobLocation:
        pkg.job.locationText ||
        [pkg.job.city, pkg.job.country].filter(Boolean).join(', ') ||
        undefined,
      matchScore: pkg.match?.overallScore || null,
      matchConfidence: pkg.match?.confidenceScore || null,
      matchDecision: (pkg.match?.decision as any) || null,
    };

    return {
      package: packageDto,
      currentVersion: currentVer ? this.mapVersionDto(currentVer) : null,
      artifacts: artifacts.map(this.mapArtifactDto),
      questions: questions.map(this.mapQuestionDto),
      approvals: approvals.map(this.mapApprovalDto),
      readiness,
    };
  }

  /**
   * Lists application packages with optional status filter.
   */
  public async listPackages(
    userId: string,
    filter?: { status?: string; jobId?: string },
  ): Promise<ApplicationPackageDto[]> {
    const conditions = [eq(applicationPackages.userId, userId)];

    if (filter?.status) {
      conditions.push(eq(applicationPackages.status, filter.status));
    }
    if (filter?.jobId) {
      conditions.push(eq(applicationPackages.jobId, filter.jobId));
    }

    const rows = await this.db
      .select({
        pkg: applicationPackages,
        job: jobs,
        match: jobMatchAnalyses,
      })
      .from(applicationPackages)
      .innerJoin(jobs, eq(applicationPackages.jobId, jobs.id))
      .leftJoin(jobMatchAnalyses, eq(applicationPackages.matchAnalysisId, jobMatchAnalyses.id))
      .where(and(...conditions))
      .orderBy(desc(applicationPackages.updatedAt));

    return rows.map((r) => ({
      id: r.pkg.id,
      jobId: r.pkg.jobId,
      userId: r.pkg.userId,
      matchAnalysisId: r.pkg.matchAnalysisId,
      status: r.pkg.status as any,
      currentVersionNumber: r.pkg.currentVersionNumber,
      hasPolicyBlocker: r.pkg.hasPolicyBlocker,
      blockerOverridden: r.pkg.blockerOverridden,
      blockerOverrideReason: r.pkg.blockerOverrideReason,
      blockerOverriddenAt: r.pkg.blockerOverriddenAt?.toISOString() || null,
      isStale: r.pkg.isStale,
      readinessReason: r.pkg.readinessReason,
      createdAt: r.pkg.createdAt.toISOString(),
      updatedAt: r.pkg.updatedAt.toISOString(),
      jobTitle: r.job.title,
      jobCompany: r.job.company,
      jobLocation:
        r.job.locationText || [r.job.city, r.job.country].filter(Boolean).join(', ') || undefined,
      matchScore: r.match?.overallScore || null,
      matchConfidence: r.match?.confidenceScore || null,
      matchDecision: (r.match?.decision as any) || null,
    }));
  }

  /**
   * Lists all versions of a package.
   */
  public async listVersions(
    packageId: string,
    userId: string,
  ): Promise<ApplicationPackageVersionDto[]> {
    const [pkg] = await this.db
      .select()
      .from(applicationPackages)
      .where(and(eq(applicationPackages.id, packageId), eq(applicationPackages.userId, userId)))
      .limit(1);

    if (!pkg) throw AppError.notFound(`Package ${packageId} not found`);

    const versions = await this.db
      .select()
      .from(applicationPackageVersions)
      .where(eq(applicationPackageVersions.packageId, packageId))
      .orderBy(desc(applicationPackageVersions.versionNumber));

    return versions.map(this.mapVersionDto);
  }

  /**
   * Updates CV summary and regenerates CV DOCX artifact.
   */
  public async updateCv(
    packageId: string,
    userId: string,
    summary: string,
  ): Promise<ApplicationPackageVersionDto> {
    const pkg = await this.getPackage(packageId, userId);
    if (!pkg.currentVersion) throw AppError.notFound('No current version found');

    const tailoredCv = pkg.currentVersion.tailoredCvContent as TailoredCv;
    if (!tailoredCv) throw AppError.badRequest('Tailored CV content missing');

    tailoredCv.summary = summary;
    tailoredCv.changeExplanation.push('Updated professional summary via manual candidate edit.');

    // Regenerate CV DOCX
    const cvDocxResult = await this.docxGenerator.generateTailoredCvDocx(tailoredCv, {
      packageId,
      versionNumber: pkg.currentVersion.versionNumber,
      candidateName: tailoredCv.header.fullName,
      jobTitle: pkg.package.jobTitle || 'Role',
    });

    // Save or update artifact
    await this.db.insert(applicationArtifacts).values({
      packageId,
      versionId: pkg.currentVersion.id,
      artifactType: 'TAILORED_CV',
      storageKey: cvDocxResult.metadata.storageKey,
      filename: cvDocxResult.metadata.originalFilename,
      mimeType: cvDocxResult.metadata.mimeType,
      sizeBytes: cvDocxResult.metadata.sizeBytes,
      sha256Checksum: cvDocxResult.metadata.sha256Checksum,
      metadata: { editedAt: new Date().toISOString() },
    });

    await this.db
      .update(applicationPackageVersions)
      .set({
        tailoredCvContent: tailoredCv,
        updatedAt: new Date(),
      })
      .where(eq(applicationPackageVersions.id, pkg.currentVersion.id));

    await this.refreshPackageReadiness(packageId, pkg.currentVersion.id);

    const [updatedVer] = await this.db
      .select()
      .from(applicationPackageVersions)
      .where(eq(applicationPackageVersions.id, pkg.currentVersion.id))
      .limit(1);

    return this.mapVersionDto(updatedVer!);
  }

  /**
   * Updates Cover Letter content and regenerates Cover Letter DOCX.
   */
  public async updateCoverLetter(
    packageId: string,
    userId: string,
    content: string,
  ): Promise<ApplicationPackageVersionDto> {
    const pkg = await this.getPackage(packageId, userId);
    if (!pkg.currentVersion) throw AppError.notFound('No current version found');

    // Regenerate Cover Letter DOCX
    const clDocxResult = await this.docxGenerator.generateCoverLetterDocx(content, {
      packageId,
      versionNumber: pkg.currentVersion.versionNumber,
      candidateName: pkg.currentVersion.tailoredCvContent?.header.fullName || 'Candidate',
      jobTitle: pkg.package.jobTitle || 'Role',
      company: pkg.package.jobCompany || 'Hiring Company',
    });

    await this.db.insert(applicationArtifacts).values({
      packageId,
      versionId: pkg.currentVersion.id,
      artifactType: 'COVER_LETTER',
      storageKey: clDocxResult.metadata.storageKey,
      filename: clDocxResult.metadata.originalFilename,
      mimeType: clDocxResult.metadata.mimeType,
      sizeBytes: clDocxResult.metadata.sizeBytes,
      sha256Checksum: clDocxResult.metadata.sha256Checksum,
      metadata: { editedAt: new Date().toISOString() },
    });

    await this.db
      .update(applicationPackageVersions)
      .set({
        coverLetterContent: content,
        coverLetterApproved: true,
        updatedAt: new Date(),
      })
      .where(eq(applicationPackageVersions.id, pkg.currentVersion.id));

    await this.refreshPackageReadiness(packageId, pkg.currentVersion.id);

    const [updatedVer] = await this.db
      .select()
      .from(applicationPackageVersions)
      .where(eq(applicationPackageVersions.id, pkg.currentVersion.id))
      .limit(1);

    return this.mapVersionDto(updatedVer!);
  }

  /**
   * Adds an application question to current package version.
   */
  public async addQuestion(
    packageId: string,
    userId: string,
    questionData: {
      questionText: string;
      category: QuestionCategory;
      questionType: QuestionType;
      options?: string[];
      isRequired?: boolean;
      sensitivity?: 'STANDARD' | 'SENSITIVE';
    },
  ): Promise<ApplicationQuestionDto> {
    const pkg = await this.getPackage(packageId, userId);
    if (!pkg.currentVersion) throw AppError.notFound('No current version found');

    const candidate = await this.loadCandidateContext(userId);
    const answers = await this.db
      .select()
      .from(answerLibrary)
      .where(eq(answerLibrary.userId, userId));
    const facts = await this.db
      .select()
      .from(candidateFacts)
      .where(
        and(
          eq(candidateFacts.userId, userId),
          eq(candidateFacts.verificationStatus, 'VERIFIED'),
          eq(candidateFacts.allowAiUse, true),
        ),
      );
    const [preferences] = await this.db
      .select()
      .from(jobPreferences)
      .where(eq(jobPreferences.userId, userId))
      .limit(1);
    const [policy] = await this.db
      .select()
      .from(applicationPolicy)
      .where(eq(applicationPolicy.userId, userId))
      .limit(1);

    const qDef = {
      questionText: questionData.questionText,
      category: questionData.category,
      questionType: questionData.questionType,
      options: questionData.options || [],
      sensitivity: questionData.sensitivity || 'STANDARD',
      isRequired: questionData.isRequired ?? true,
    };

    const resolution = ApplicationQuestionEngine.resolveQuestion(qDef, {
      candidate,
      answerLibrary: answers,
      candidateFacts: facts,
      preferences,
      policy,
    });

    const [insertedQ] = await this.db
      .insert(applicationQuestions)
      .values({
        packageId,
        versionId: pkg.currentVersion.id,
        questionText: qDef.questionText,
        category: qDef.category,
        questionType: qDef.questionType,
        isRequired: qDef.isRequired,
        options: qDef.options,
        sensitivity: qDef.sensitivity,
        answerSource: resolution.answerSource,
        sourceEntityId: resolution.sourceEntityId,
        proposedAnswer: resolution.proposedAnswer,
        finalAnswer: resolution.approvalState === 'APPROVED' ? resolution.proposedAnswer : null,
        approvalState: resolution.approvalState,
        displayOrder: pkg.questions.length,
      })
      .returning();

    if (resolution.needsApproval && resolution.approvalDetails) {
      await this.db.insert(approvalRequests).values({
        packageId,
        versionId: pkg.currentVersion.id,
        userId,
        questionId: insertedQ!.id,
        approvalType: resolution.approvalDetails.approvalType,
        status: 'PENDING',
        subject: resolution.approvalDetails.subject,
        proposedValue: resolution.approvalDetails.proposedValue,
        reason: resolution.approvalDetails.reason,
        riskLevel: resolution.approvalDetails.riskLevel,
        evidenceReferences: resolution.approvalDetails.evidenceReferences,
      });
    }

    await this.refreshPackageReadiness(packageId, pkg.currentVersion.id);

    return this.mapQuestionDto(insertedQ!);
  }

  /**
   * Answers or edits an application question directly.
   */
  public async answerQuestion(
    packageId: string,
    questionId: string,
    userId: string,
    answerText: string,
  ): Promise<ApplicationQuestionDto> {
    const pkg = await this.getPackage(packageId, userId);
    if (!pkg.currentVersion) throw AppError.notFound('No current version found');

    const [q] = await this.db
      .select()
      .from(applicationQuestions)
      .where(
        and(eq(applicationQuestions.id, questionId), eq(applicationQuestions.packageId, packageId)),
      )
      .limit(1);

    if (!q) throw AppError.notFound(`Question ${questionId} not found in package`);

    await this.db
      .update(applicationQuestions)
      .set({
        humanEditedAnswer: answerText,
        finalAnswer: answerText,
        approvalState: 'APPROVED',
        updatedAt: new Date(),
      })
      .where(eq(applicationQuestions.id, questionId));

    // Resolve any pending approval for this question
    await this.db
      .update(approvalRequests)
      .set({
        status: 'RESOLVED',
        userEditedValue: answerText,
        resolvedAt: new Date(),
        resolvedBy: 'USER',
        updatedAt: new Date(),
      })
      .where(
        and(eq(approvalRequests.questionId, questionId), eq(approvalRequests.status, 'PENDING')),
      );

    await this.refreshPackageReadiness(packageId, pkg.currentVersion.id);

    const [updatedQ] = await this.db
      .select()
      .from(applicationQuestions)
      .where(eq(applicationQuestions.id, questionId))
      .limit(1);

    return this.mapQuestionDto(updatedQ!);
  }

  /**
   * Approves an approval request.
   */
  public async approveRequest(
    approvalId: string,
    userId: string,
    userEditedValue?: string,
  ): Promise<ApprovalRequestDto> {
    const [req] = await this.db
      .select()
      .from(approvalRequests)
      .where(and(eq(approvalRequests.id, approvalId), eq(approvalRequests.userId, userId)))
      .limit(1);

    if (!req) throw AppError.notFound(`Approval request ${approvalId} not found`);

    const finalValue = userEditedValue !== undefined ? userEditedValue : req.proposedValue;

    await this.db
      .update(approvalRequests)
      .set({
        status: 'APPROVED',
        userEditedValue: userEditedValue || null,
        resolvedAt: new Date(),
        resolvedBy: 'USER',
        updatedAt: new Date(),
      })
      .where(eq(approvalRequests.id, approvalId));

    // If associated with a question, update question approval state
    if (req.questionId) {
      await this.db
        .update(applicationQuestions)
        .set({
          finalAnswer: finalValue,
          humanEditedAnswer: userEditedValue || null,
          approvalState: 'APPROVED',
          updatedAt: new Date(),
        })
        .where(eq(applicationQuestions.id, req.questionId));
    }

    await this.refreshPackageReadiness(req.packageId, req.versionId);

    const [updated] = await this.db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, approvalId))
      .limit(1);

    return this.mapApprovalDto(updated!);
  }

  /**
   * Rejects an approval request.
   */
  public async rejectRequest(approvalId: string, userId: string): Promise<ApprovalRequestDto> {
    const [req] = await this.db
      .select()
      .from(approvalRequests)
      .where(and(eq(approvalRequests.id, approvalId), eq(approvalRequests.userId, userId)))
      .limit(1);

    if (!req) throw AppError.notFound(`Approval request ${approvalId} not found`);

    await this.db
      .update(approvalRequests)
      .set({
        status: 'REJECTED',
        resolvedAt: new Date(),
        resolvedBy: 'USER',
        updatedAt: new Date(),
      })
      .where(eq(approvalRequests.id, approvalId));

    if (req.questionId) {
      await this.db
        .update(applicationQuestions)
        .set({
          approvalState: 'REJECTED',
          finalAnswer: null,
          updatedAt: new Date(),
        })
        .where(eq(applicationQuestions.id, req.questionId));
    }

    await this.refreshPackageReadiness(req.packageId, req.versionId);

    const [updated] = await this.db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, approvalId))
      .limit(1);

    return this.mapApprovalDto(updated!);
  }

  /**
   * Lists all pending approvals across all packages.
   */
  public async listApprovals(
    userId: string,
    filter?: { status?: string },
  ): Promise<ApprovalRequestDto[]> {
    const statusCondition =
      filter?.status && filter.status !== 'PENDING'
        ? eq(approvalRequests.status, filter.status)
        : inArray(approvalRequests.status, ['PENDING', 'NEEDS_USER_RECONFIRMATION']);

    const rows = await this.db
      .select({
        approval: approvalRequests,
        pkg: applicationPackages,
        job: jobs,
      })
      .from(approvalRequests)
      .innerJoin(applicationPackages, eq(approvalRequests.packageId, applicationPackages.id))
      .innerJoin(jobs, eq(applicationPackages.jobId, jobs.id))
      .innerJoin(
        applicationPackageVersions,
        eq(approvalRequests.versionId, applicationPackageVersions.id),
      )
      .where(
        and(
          eq(approvalRequests.userId, userId),
          statusCondition,
          eq(applicationPackages.currentVersionNumber, applicationPackageVersions.versionNumber),
        ),
      )
      .orderBy(desc(approvalRequests.createdAt));

    return rows.map((r) => ({
      ...this.mapApprovalDto(r.approval),
      jobTitle: r.job.title,
      jobCompany: r.job.company,
    }));
  }

  /**
   * Overrides hard policy blocker with an auditable reason.
   */
  public async overrideBlocker(
    packageId: string,
    userId: string,
    reason: string,
  ): Promise<ApplicationPackageDto> {
    if (!reason || reason.trim().length < 5) {
      throw AppError.badRequest('An auditable explanation is required to override policy blockers');
    }

    const [pkg] = await this.db
      .select()
      .from(applicationPackages)
      .where(and(eq(applicationPackages.id, packageId), eq(applicationPackages.userId, userId)))
      .limit(1);

    if (!pkg) throw AppError.notFound(`Package ${packageId} not found`);

    await this.db
      .update(applicationPackages)
      .set({
        blockerOverridden: true,
        blockerOverrideReason: reason.trim(),
        blockerOverriddenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(applicationPackages.id, packageId));

    await this.logEvent(packageId, pkg.currentVersionNumber, 'BLOCKER_OVERRIDDEN', {
      reason: reason.trim(),
    });

    const fullPkg = await this.getPackage(packageId, userId);
    return fullPkg.package;
  }

  /**
   * Downloads an artifact securely.
   */
  public async getArtifactFile(
    packageId: string,
    artifactId: string,
    userId: string,
  ): Promise<{ buffer: Buffer; artifact: ApplicationArtifactDto }> {
    const [pkg] = await this.db
      .select()
      .from(applicationPackages)
      .where(and(eq(applicationPackages.id, packageId), eq(applicationPackages.userId, userId)))
      .limit(1);

    if (!pkg) throw AppError.notFound(`Package ${packageId} not found`);

    const [artifact] = await this.db
      .select()
      .from(applicationArtifacts)
      .where(
        and(eq(applicationArtifacts.id, artifactId), eq(applicationArtifacts.packageId, packageId)),
      )
      .limit(1);

    if (!artifact) throw AppError.notFound(`Artifact ${artifactId} not found`);

    const file = await this.storage.getFile(artifact.storageKey);

    return {
      buffer: file.buffer,
      artifact: this.mapArtifactDto(artifact),
    };
  }

  /**
   * Gets Application Studio metrics.
   */
  public async getMetrics(userId: string): Promise<ApplicationStudioMetricsDto> {
    const pkgs = await this.db
      .select({ status: applicationPackages.status })
      .from(applicationPackages)
      .where(eq(applicationPackages.userId, userId));

    const pendingApprovals = await this.db
      .select({ id: approvalRequests.id })
      .from(approvalRequests)
      .where(and(eq(approvalRequests.userId, userId), eq(approvalRequests.status, 'PENDING')));

    const inPrep = pkgs.filter((p) => p.status === 'DRAFT' || p.status === 'GENERATING').length;
    const needReview = pkgs.filter((p) => p.status === 'NEEDS_REVIEW').length;
    const ready = pkgs.filter((p) => p.status === 'READY').length;

    return {
      packagesInPreparation: inPrep,
      packagesNeedingReview: needReview,
      packagesReady: ready,
      pendingApprovals: pendingApprovals.length,
    };
  }

  // ==========================================================================
  // Helper methods
  // ==========================================================================

  private async loadCandidateContext(userId: string): Promise<CandidateContext> {
    const [profile] = await this.db
      .select()
      .from(candidateProfiles)
      .where(eq(candidateProfiles.userId, userId))
      .limit(1);

    if (!profile) {
      throw AppError.notFound('Candidate profile not found. Please complete profile first.');
    }

    const experiences = await this.db
      .select()
      .from(candidateExperiences)
      .where(eq(candidateExperiences.userId, userId));

    const education = await this.db
      .select()
      .from(candidateEducation)
      .where(eq(candidateEducation.userId, userId));

    const skills = await this.db
      .select()
      .from(candidateSkills)
      .where(eq(candidateSkills.userId, userId));

    const languages = await this.db
      .select()
      .from(candidateLanguages)
      .where(eq(candidateLanguages.userId, userId));

    const certifications = await this.db
      .select()
      .from(candidateCertifications)
      .where(eq(candidateCertifications.userId, userId));

    const projects = await this.db
      .select()
      .from(candidateProjects)
      .where(eq(candidateProjects.userId, userId));

    const links = await this.db
      .select()
      .from(candidateLinks)
      .where(eq(candidateLinks.userId, userId));

    return {
      profile,
      experiences,
      education,
      skills,
      languages,
      certifications,
      projects,
      links,
    };
  }

  private calculatePackageFingerprint(
    candidate: CandidateContext,
    job: Job,
    baseDocumentId?: string | null,
  ): string {
    const payload = JSON.stringify({
      jobId: job.id,
      jobTitle: job.title,
      jobDescription: job.description,
      baseDocumentId: baseDocumentId || null,
      skills: candidate.skills.map((s) => s.name).sort(),
      experiences: candidate.experiences.map((e) => ({
        id: e.id,
        pos: e.position,
        org: e.organization,
        start: e.startDate,
        end: e.endDate,
      })),
      profileUpdated: candidate.profile.updatedAt?.toISOString(),
    });

    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  private async logEvent(
    packageId: string,
    versionNumber: number | null,
    eventType: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.db.insert(applicationPackageEvents).values({
      packageId,
      versionNumber,
      eventType,
      details,
    });
  }

  private mapVersionDto(v: any): ApplicationPackageVersionDto {
    return {
      id: v.id,
      packageId: v.packageId,
      versionNumber: v.versionNumber,
      status: v.status,
      inputFingerprint: v.inputFingerprint,
      baseDocumentId: v.baseDocumentId,
      baseSelectionReason: v.baseSelectionReason,
      tailoredCvContent: v.tailoredCvContent,
      coverLetterContent: v.coverLetterContent,
      coverLetterEnabled: v.coverLetterEnabled,
      coverLetterApproved: v.coverLetterApproved,
      changeSummary: v.changeSummary || [],
      generationMode: v.generationMode,
      aiModel: v.aiModel,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    };
  }

  private mapArtifactDto(a: any): ApplicationArtifactDto {
    return {
      id: a.id,
      packageId: a.packageId,
      versionId: a.versionId,
      artifactType: a.artifactType,
      storageKey: a.storageKey,
      filename: a.filename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      sha256Checksum: a.sha256Checksum,
      metadata: a.metadata || {},
      createdAt: a.createdAt.toISOString(),
    };
  }

  private mapQuestionDto(q: any): ApplicationQuestionDto {
    return {
      id: q.id,
      packageId: q.packageId,
      versionId: q.versionId,
      questionText: q.questionText,
      category: q.category,
      questionType: q.questionType,
      isRequired: q.isRequired,
      options: q.options || [],
      sensitivity: q.sensitivity,
      answerSource: q.answerSource,
      sourceEntityId: q.sourceEntityId,
      proposedAnswer: q.proposedAnswer,
      humanEditedAnswer: q.humanEditedAnswer,
      finalAnswer: q.finalAnswer,
      approvalState: q.approvalState,
      displayOrder: q.displayOrder,
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    };
  }

  private mapApprovalDto(a: any): ApprovalRequestDto {
    return {
      id: a.id,
      packageId: a.packageId,
      versionId: a.versionId,
      userId: a.userId,
      questionId: a.questionId,
      approvalType: a.approvalType,
      status: a.status,
      subject: a.subject,
      proposedValue: a.proposedValue,
      userEditedValue: a.userEditedValue,
      reason: a.reason,
      riskLevel: a.riskLevel,
      evidenceReferences: a.evidenceReferences || [],
      resolvedAt: a.resolvedAt?.toISOString() || null,
      resolvedBy: a.resolvedBy,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }
}
