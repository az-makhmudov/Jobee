import crypto from 'node:crypto';
import {
  getDb,
  closeDbPool,
  users,
  jobs,
  applicationPackages,
  assertSafeTestDatabase,
  assertSafeTestUser,
  assertScopedCleanup,
} from '@job-agent/database';
import { inArray, eq } from 'drizzle-orm';
import { getConfig } from '@job-agent/config';
import {
  ApplicationLifecycleStatus,
  SubmissionMethod,
  AssessmentType,
  AssessmentStatus,
  InterviewType,
  InterviewStatus,
  OfferStatus,
} from '@job-agent/shared';
import { ApplicationCrmService } from '../apps/api/src/services/application-crm-service';
import { ApplicationStateMachine } from '../apps/api/src/services/application-state-machine';

async function main() {
  console.log('===============================================================');
  console.log('JOB-P3-T02 — LIVE POSTGRESQL DETERMINISTIC VERIFICATION SUITE');
  console.log('Canonical Lifecycle & Audit Finalization');
  console.log('===============================================================\n');

  const config = getConfig();
  const connectionString =
    process.env.TEST_DATABASE_URL ||
    (config.DATABASE_URL
      ? config.DATABASE_URL.replace(/\/[^/]+$/, '/jobee_test_isolated')
      : 'postgresql://bek@localhost:5432/jobee_test_isolated');
  assertSafeTestDatabase(connectionString);
  const db = getDb(connectionString);

  const testUserId = crypto.randomUUID();
  const [testUser] = await db
    .insert(users)
    .values({
      id: testUserId,
      systemKey: `test_crm_${Date.now()}`,
      name: 'Disposable CRM Tester',
      email: `test-crm-${Date.now()}@example.com`,
      emailVerified: true,
      role: 'user',
    })
    .returning();
  const userId = testUser.id;
  assertSafeTestUser(userId);
  const runId = `live-crm-${Date.now()}`;

  const createdJobIds: string[] = [];
  const createdPackageIds: string[] = [];
  const createdAppIds: string[] = [];

  try {
    // Helper to create a fake job
    async function createFakeJob(title: string) {
      const hash = crypto
        .createHash('sha256')
        .update(title + runId + Math.random().toString())
        .digest('hex');
      const [job] = await db
        .insert(jobs)
        .values({
          userId,
          title: `${title} [${runId}]`,
          company: `Acme Corp ${runId}`,
          description: `Role description for ${title}`,
          locationText: 'Berlin / Remote',
          employmentType: 'FULL_TIME',
          workplaceType: 'HYBRID',
          originalUrl: `https://example.com/jobs/${runId}/${Math.random().toString(36).substring(7)}`,
          contentHash: hash,
          state: 'INGESTED',
        })
        .returning();
      createdJobIds.push(job.id);
      return job;
    }

    // =========================================================================
    // 1. CREATION PATHS VERIFICATION
    // =========================================================================
    console.log('--- Step 1: Verification of Canonical Creation Paths ---');

    // Path 1: Prepared Package Creation -> READY_TO_APPLY
    const job1 = await createFakeJob('Senior Backend Engineer');
    const [pkg1] = await db
      .insert(applicationPackages)
      .values({
        userId,
        jobId: job1.id,
        status: 'READY',
        selectedCvDocumentId: null,
        targetRole: 'Senior Backend Engineer',
      })
      .returning();
    createdPackageIds.push(pkg1.id);

    const appFromPkg = await ApplicationCrmService.createOrGetApplication(userId, {
      jobId: job1.id,
      packageId: pkg1.id,
      source: 'STUDIO',
    });
    createdAppIds.push(appFromPkg.application.id);
    console.log(
      `[PASS] Path 1 (Package-based): Created app ${appFromPkg.application.id} with status = ${appFromPkg.application.status}`,
    );
    if (appFromPkg.application.status !== ApplicationLifecycleStatus.READY_TO_APPLY) {
      throw new Error(`Expected READY_TO_APPLY, got ${appFromPkg.application.status}`);
    }

    // Path 2: Direct Manual Application -> APPLIED with submission metadata
    const job2 = await createFakeJob('Staff Systems Architect');
    const appliedDate = new Date();
    const appManual = await ApplicationCrmService.createOrGetApplication(userId, {
      jobId: job2.id,
      status: ApplicationLifecycleStatus.APPLIED,
      submissionMethod: SubmissionMethod.COMPANY_SITE,
      externalReferenceId: `REF-${runId}-123`,
      applicationUrl: 'https://careers.example.com/status/123',
      appliedAt: appliedDate.toISOString(),
      notes: 'Applied via company careers workday portal',
    });
    createdAppIds.push(appManual.application.id);
    console.log(
      `[PASS] Path 2 (Direct Manual): Created app ${appManual.application.id} with status = ${appManual.application.status}, submissionMethod = ${appManual.application.submissionMethod}`,
    );
    if (appManual.application.status !== ApplicationLifecycleStatus.APPLIED) {
      throw new Error(`Expected APPLIED, got ${appManual.application.status}`);
    }
    if (appManual.application.submissionMethod !== SubmissionMethod.COMPANY_SITE) {
      throw new Error(
        `Expected submissionMethod COMPANY_SITE, got ${appManual.application.submissionMethod}`,
      );
    }

    // Path 3: Raw Job Tracked Without Package -> READY_TO_APPLY or explicit DISCOVERED
    const job3 = await createFakeJob('Frontend Engineer');
    const appRaw = await ApplicationCrmService.createOrGetApplication(userId, {
      jobId: job3.id,
      status: ApplicationLifecycleStatus.DISCOVERED,
    });
    createdAppIds.push(appRaw.application.id);
    console.log(
      `[PASS] Path 3 (Explicit DISCOVERED): Created app with status = ${appRaw.application.status}`,
    );
    if (appRaw.application.status !== ApplicationLifecycleStatus.DISCOVERED) {
      throw new Error(`Expected DISCOVERED, got ${appRaw.application.status}`);
    }

    // Path 4: Duplicate Idempotency
    const appDuplicate = await ApplicationCrmService.createOrGetApplication(userId, {
      jobId: job1.id,
    });
    console.log(
      `[PASS] Path 4 (Duplicate Idempotency): isExisting = ${appDuplicate.isExisting}, appId matches = ${appDuplicate.application.id === appFromPkg.application.id}`,
    );
    if (!appDuplicate.isExisting || appDuplicate.application.id !== appFromPkg.application.id) {
      throw new Error('Duplicate application creation failed idempotency invariant');
    }

    // =========================================================================
    // 2. SCENARIO A — Standard Full Pipeline Progression
    // READY_TO_APPLY -> APPLIED -> CONFIRMATION_RECEIVED -> SCREENING -> INTERVIEW -> FINAL_INTERVIEW -> OFFER
    // =========================================================================
    console.log('\n--- Step 2: Scenario A — Standard Full Pipeline Progression ---');
    const jobA = await createFakeJob('Scenario A Engineer');
    const appA = await ApplicationCrmService.createOrGetApplication(userId, {
      jobId: jobA.id,
      status: ApplicationLifecycleStatus.READY_TO_APPLY,
    });
    createdAppIds.push(appA.application.id);

    // Apply
    await ApplicationCrmService.markApplied(userId, appA.application.id, {
      submissionMethod: SubmissionMethod.LINKEDIN,
      externalReferenceId: `LINKEDIN-${runId}`,
      notes: 'Applied via LinkedIn Easy Apply',
    });

    // Progression
    const stagesA = [
      ApplicationLifecycleStatus.CONFIRMATION_RECEIVED,
      ApplicationLifecycleStatus.SCREENING,
      ApplicationLifecycleStatus.INTERVIEW,
      ApplicationLifecycleStatus.FINAL_INTERVIEW,
      ApplicationLifecycleStatus.OFFER,
    ];

    let currentAppA = appA.application;
    for (const targetStage of stagesA) {
      currentAppA = await ApplicationCrmService.transitionStatus(userId, appA.application.id, {
        targetStatus: targetStage,
        note: `Progressing to ${targetStage}`,
      });
      console.log(`  -> Transitioned to ${currentAppA.status}`);
      if (currentAppA.status !== targetStage) {
        throw new Error(`Failed to transition to ${targetStage}`);
      }
    }

    // Verify lifecycle events
    const detailA = await ApplicationCrmService.getApplicationDetail(userId, appA.application.id);
    const timelineA = detailA.events;
    console.log(`[PASS] Scenario A Complete. Recorded ${timelineA.length} timeline events.`);
    if (timelineA.length < 6) {
      throw new Error(`Expected at least 6 timeline events, found ${timelineA.length}`);
    }

    // =========================================================================
    // 3. SCENARIO B — Stage Skipping (Accelerated Path)
    // READY_TO_APPLY -> APPLYING -> APPLIED -> ASSESSMENT -> INTERVIEW -> OFFER
    // =========================================================================
    console.log('\n--- Step 3: Scenario B — Stage Skipping Progression ---');
    const jobB = await createFakeJob('Scenario B Engineer');
    const appB = await ApplicationCrmService.createOrGetApplication(userId, {
      jobId: jobB.id,
      status: ApplicationLifecycleStatus.READY_TO_APPLY,
    });
    createdAppIds.push(appB.application.id);

    await ApplicationCrmService.transitionStatus(userId, appB.application.id, {
      targetStatus: ApplicationLifecycleStatus.APPLYING,
      note: 'Starting application process',
    });
    await ApplicationCrmService.markApplied(userId, appB.application.id, {
      submissionMethod: SubmissionMethod.COMPANY_SITE,
    });
    // Skip Confirmation & Screening straight to Assessment
    await ApplicationCrmService.transitionStatus(userId, appB.application.id, {
      targetStatus: ApplicationLifecycleStatus.ASSESSMENT,
      note: 'Received take-home assessment directly',
    });
    // Skip to Interview
    await ApplicationCrmService.transitionStatus(userId, appB.application.id, {
      targetStatus: ApplicationLifecycleStatus.INTERVIEW,
      note: 'Passed assessment, invited to interview',
    });
    // Skip Final Interview straight to Offer
    const finalAppB = await ApplicationCrmService.transitionStatus(userId, appB.application.id, {
      targetStatus: ApplicationLifecycleStatus.OFFER,
      note: 'Direct offer received',
    });
    console.log(`[PASS] Scenario B Complete. Final Status = ${finalAppB.status}`);
    if (finalAppB.status !== ApplicationLifecycleStatus.OFFER) {
      throw new Error(`Expected final status OFFER, got ${finalAppB.status}`);
    }

    // =========================================================================
    // 4. SCENARIO C — Skipped Job Distinction & Reopening
    // ANALYZED -> SKIPPED (non-terminal, distinct from REJECTED) -> READY_TO_APPLY
    // =========================================================================
    console.log('\n--- Step 4: Scenario C — Skipped Status Semantics ---');
    const jobC = await createFakeJob('Scenario C Engineer');
    const appC = await ApplicationCrmService.createOrGetApplication(userId, {
      jobId: jobC.id,
      status: ApplicationLifecycleStatus.ANALYZED,
    });
    createdAppIds.push(appC.application.id);

    const skippedAppC = await ApplicationCrmService.transitionStatus(userId, appC.application.id, {
      targetStatus: ApplicationLifecycleStatus.SKIPPED,
      reason: 'Low salary band',
      note: 'Candidate chose not to pursue',
    });
    console.log(`[PASS] Scenario C: Status transitioned to ${skippedAppC.status}`);
    if (skippedAppC.status !== ApplicationLifecycleStatus.SKIPPED) {
      throw new Error(`Expected SKIPPED, got ${skippedAppC.status}`);
    }

    // Verify SKIPPED is NOT terminal in state machine
    const isSkippedTerminal = ApplicationStateMachine.isTerminal(
      ApplicationLifecycleStatus.SKIPPED,
    );
    console.log(`[PASS] Scenario C: Is SKIPPED terminal? ${isSkippedTerminal} (Must be false)`);
    if (isSkippedTerminal) {
      throw new Error('SKIPPED must not be terminal');
    }

    // Reopen SKIPPED to READY_TO_APPLY without correction flag
    const reopenedAppC = await ApplicationCrmService.transitionStatus(userId, appC.application.id, {
      targetStatus: ApplicationLifecycleStatus.READY_TO_APPLY,
      note: 'Reopened after compensation band adjusted',
    });
    console.log(
      `[PASS] Scenario C: Reopened to ${reopenedAppC.status} without correction override.`,
    );
    if (reopenedAppC.status !== ApplicationLifecycleStatus.READY_TO_APPLY) {
      throw new Error(`Expected READY_TO_APPLY, got ${reopenedAppC.status}`);
    }

    // =========================================================================
    // 5. SCENARIO D & E — Standard Terminal Rejection & Withdrawal
    // =========================================================================
    console.log('\n--- Step 5: Scenario D & E — Rejection and Withdrawal ---');
    const jobD = await createFakeJob('Scenario D Engineer');
    const appD = await ApplicationCrmService.createOrGetApplication(userId, {
      jobId: jobD.id,
      status: ApplicationLifecycleStatus.READY_TO_APPLY,
    });
    createdAppIds.push(appD.application.id);
    await ApplicationCrmService.markApplied(userId, appD.application.id, {
      submissionMethod: SubmissionMethod.OTHER,
    });
    const rejectedAppD = await ApplicationCrmService.transitionStatus(userId, appD.application.id, {
      targetStatus: ApplicationLifecycleStatus.REJECTED,
      reason: 'POSITION_FILLED',
      note: 'Received automated rejection email',
    });
    console.log(`[PASS] Scenario D: Status transitioned to ${rejectedAppD.status}`);

    const jobE = await createFakeJob('Scenario E Engineer');
    const appE = await ApplicationCrmService.createOrGetApplication(userId, {
      jobId: jobE.id,
      status: ApplicationLifecycleStatus.READY_TO_APPLY,
    });
    createdAppIds.push(appE.application.id);
    await ApplicationCrmService.markApplied(userId, appE.application.id, {
      submissionMethod: SubmissionMethod.OTHER,
    });
    const withdrawnAppE = await ApplicationCrmService.transitionStatus(
      userId,
      appE.application.id,
      {
        targetStatus: ApplicationLifecycleStatus.WITHDRAWN,
        reason: 'ACCEPTED_ANOTHER_OFFER',
        note: 'Withdrawn by candidate',
      },
    );
    console.log(`[PASS] Scenario E: Status transitioned to ${withdrawnAppE.status}`);

    // =========================================================================
    // 6. SCENARIO F — Terminal Transition Enforcement & Correction Override
    // REJECTED -> SCREENING fails normally; succeeds with isCorrection: true
    // =========================================================================
    console.log('\n--- Step 6: Scenario F — Terminal Enforcement & Correction Override ---');
    let normalTransitionFailed = false;
    try {
      await ApplicationCrmService.transitionStatus(userId, appD.application.id, {
        targetStatus: ApplicationLifecycleStatus.SCREENING,
        note: 'Attempting to move from REJECTED to SCREENING without correction',
      });
    } catch (err: any) {
      normalTransitionFailed = true;
      console.log(
        `[PASS] Scenario F: Normal transition from REJECTED was blocked as expected: "${err.message}"`,
      );
    }

    if (!normalTransitionFailed) {
      throw new Error('Terminal status transition should have failed without isCorrection: true');
    }

    // Now execute with correction override
    const correctedAppD = await ApplicationCrmService.transitionStatus(
      userId,
      appD.application.id,
      {
        targetStatus: ApplicationLifecycleStatus.INTERVIEW,
        isCorrection: true,
        correctionReason: 'Recruiter reached out explaining rejection was sent in error',
        note: 'Restored to INTERVIEW via human correction',
      },
    );
    console.log(
      `[PASS] Scenario F: Transition succeeded with isCorrection=true. New status = ${correctedAppD.status}`,
    );
    if (correctedAppD.status !== ApplicationLifecycleStatus.INTERVIEW) {
      throw new Error(`Expected INTERVIEW after correction, got ${correctedAppD.status}`);
    }

    // Verify audit event contains isCorrection
    const detailD = await ApplicationCrmService.getApplicationDetail(userId, appD.application.id);
    const lastEvent = detailD.events[detailD.events.length - 1];
    console.log(
      `[PASS] Scenario F: Last audit event type = ${lastEvent.eventType}, isCorrection = ${(lastEvent.safeMetadata as any)?.isCorrection}`,
    );
    if (!(lastEvent.safeMetadata as any)?.isCorrection) {
      throw new Error('Audit event did not record isCorrection metadata flag');
    }

    // =========================================================================
    // 7. SOFT ARCHIVING & PURGE BEHAVIOR
    // =========================================================================
    console.log('\n--- Step 7: Soft Archiving & Filter Behavior ---');
    // Archive appE
    const archivedAppE = await ApplicationCrmService.archiveApplication(
      userId,
      appE.application.id,
    );
    console.log(
      `[PASS] appE archived: isArchived = ${archivedAppE.isArchived}, archivedAt = ${archivedAppE.archivedAt}`,
    );
    if (!archivedAppE.isArchived || !archivedAppE.archivedAt) {
      throw new Error('archiveApplication did not set isArchived or archivedAt');
    }

    // Verify default list excludes archived
    const activeList = await ApplicationCrmService.listApplications(userId, {
      isArchived: false,
      limit: 100,
    });
    const foundInActive = activeList.items.some((a) => a.id === appE.application.id);
    console.log(`[PASS] Is archived app in default active list? ${foundInActive} (Must be false)`);
    if (foundInActive) {
      throw new Error('Archived application appeared in default active list');
    }

    // Verify archived list includes it
    const archivedList = await ApplicationCrmService.listApplications(userId, {
      isArchived: true,
      limit: 100,
    });
    const foundInArchived = archivedList.items.some((a) => a.id === appE.application.id);
    console.log(`[PASS] Is archived app in archived list? ${foundInArchived} (Must be true)`);
    if (!foundInArchived) {
      throw new Error('Archived application did not appear in archived list');
    }

    // Unarchive appE
    const unarchivedAppE = await ApplicationCrmService.unarchiveApplication(
      userId,
      appE.application.id,
    );
    console.log(
      `[PASS] appE unarchived: isArchived = ${unarchivedAppE.isArchived}, archivedAt = ${unarchivedAppE.archivedAt}`,
    );
    if (unarchivedAppE.isArchived || unarchivedAppE.archivedAt !== null) {
      throw new Error('unarchiveApplication did not clear isArchived or archivedAt');
    }

    // =========================================================================
    // 8. CRM SUB-ENTITIES & ANALYTICS
    // =========================================================================
    console.log('\n--- Step 8: CRM Sub-Entities & Analytics Verification ---');
    // Notes
    const note = await ApplicationCrmService.addNote(userId, appA.application.id, {
      content: 'Strong technical screener completed with engineering manager.',
      author: 'Bek',
    });
    console.log(`[PASS] Created note ${note.id}`);

    // Contacts
    const contact = await ApplicationCrmService.addContact(userId, appA.application.id, {
      name: 'Sarah Connor',
      title: 'Lead Tech Recruiter',
      email: 'sarah.connor@example.com',
      isPrimary: true,
    });
    console.log(`[PASS] Created recruiter contact ${contact.id} (${contact.name})`);

    // Assessments
    const assessment = await ApplicationCrmService.addAssessment(userId, appB.application.id, {
      title: 'Distributed Systems Coding Challenge',
      assessmentType: AssessmentType.TAKE_HOME_PROJECT,
      status: AssessmentStatus.SUBMITTED,
    });
    console.log(`[PASS] Created assessment ${assessment.id} (${assessment.title})`);

    // Interviews
    const interview = await ApplicationCrmService.addInterview(userId, appA.application.id, {
      roundTitle: 'Architecture & Scalability Round',
      interviewType: InterviewType.SYSTEM_DESIGN,
      status: InterviewStatus.COMPLETED,
      scheduledAt: new Date().toISOString(),
    });
    console.log(`[PASS] Created interview ${interview.id} (${interview.roundTitle})`);

    // Offers
    const offer = await ApplicationCrmService.updateOffer(userId, appA.application.id, {
      status: OfferStatus.RECEIVED,
      baseSalary: 135000,
      currency: 'EUR',
      totalComp: 150000,
      notes: 'Includes 15k bonus',
    });
    console.log(
      `[PASS] Created offer record ${offer.id} (Base: ${offer.baseSalary} ${offer.currency})`,
    );

    // Analytics computation
    const metrics = await ApplicationCrmService.getMetrics(userId);
    const analytics = await ApplicationCrmService.getAnalytics(userId);
    console.log(`[PASS] Analytics Metrics computed successfully:`, {
      totalTracked: metrics.totalTracked,
      activeProcesses: metrics.activeProcesses,
      interviews: metrics.interviews,
      offers: metrics.offers,
      skipped: metrics.skipped,
    });
    console.log(`[PASS] Analytics Funnel computed successfully:`, {
      totalApplications: analytics.funnel.totalApplications,
      applied: analytics.funnel.applied,
      offer: analytics.funnel.offer,
    });
    if (metrics.totalTracked < 5 || metrics.offers < 1) {
      throw new Error('Analytics calculations did not reflect live CRM entities');
    }

    console.log('\n===============================================================');
    console.log('ALL LIVE POSTGRESQL VERIFICATION SCENARIOS PASSED WITH 100% SUCCESS');
    console.log('===============================================================\n');
  } finally {
    // =========================================================================
    // 9. 100% CLEAN TEARDOWN
    // =========================================================================
    console.log('--- Step 9: Clean Teardown of Temporary Test Data ---');
    assertScopedCleanup({ userId, ids: createdJobIds.concat(createdAppIds, createdPackageIds) });
    if (createdAppIds.length > 0) {
      for (const appId of createdAppIds) {
        await ApplicationCrmService.purgeApplication(userId, appId);
      }
      console.log(`[CLEANUP] Purged ${createdAppIds.length} test applications and cascades.`);
    }

    if (createdPackageIds.length > 0) {
      await db
        .delete(applicationPackages)
        .where(inArray(applicationPackages.id, createdPackageIds));
      console.log(`[CLEANUP] Deleted ${createdPackageIds.length} test application packages.`);
    }

    if (createdJobIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
      console.log(`[CLEANUP] Deleted ${createdJobIds.length} test jobs.`);
    }

    await db.delete(users).where(eq(users.id, userId));
    await closeDbPool();
    console.log('[CLEANUP] Database pool closed cleanly.');
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n[FATAL ERROR IN LIVE VERIFICATION]:', err);
    process.exit(1);
  });
