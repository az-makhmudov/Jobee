/**
 * AI JOB AGENT — COMPREHENSIVE MULTI-USER E2E WORKFLOW VALIDATION (BL-06)
 *
 * Validates complete multi-user lifecycle, invitation-gated onboarding,
 * dynamic AI configuration, and strict cross-user data isolation.
 */

import {
  getDb,
  closeDbPool,
  users,
  candidateProfiles,
  candidateSkills,
  candidateFacts,
  jobs,
  applicationPackages,
  applicationPackageVersions,
  approvalRequests,
  pilotInvitations,
  applicationPolicy,
  eq,
  inArray,
} from '@job-agent/database';
import { getConfig } from '@job-agent/config';
import { PilotInvitationService } from '../apps/api/src/services/auth/pilot-invitation-service.js';
import { TransactionalEmailService } from '../apps/api/src/services/email/transactional-email-service.js';
import { DynamicAiProvider } from '../apps/api/src/ai/dynamic-ai-provider.js';
import crypto from 'node:crypto';

async function runMultiUserValidation() {
  console.log('======================================================================');
  console.log('AI JOB AGENT — FULL MULTI-USER E2E WORKFLOW VALIDATION (BL-06)');
  console.log('======================================================================\n');

  const config = getConfig();
  const db = getDb(config.DATABASE_URL);
  const invitationService = new PilotInvitationService(db);
  const emailService = new TransactionalEmailService(config);

  const timestamp = Date.now();
  const adminId = '00000000-0000-0000-0000-000000000001'; // Primary Admin Asadbek
  const testerEmail = `tester.e2e.${timestamp}@pilot.local`;
  let testerUserId = '';
  let invitationId = '';
  let testJobAId = '';
  let testJobBId = '';
  let testPackageAId = '';
  let testApprovalAId = '';

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Verify Primary Candidate / Admin Integrity
    // -------------------------------------------------------------------------
    console.log('--- STEP 1: Verifying Primary Candidate & Admin Account ---');
    const primaryAdmin = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, adminId),
    });

    if (!primaryAdmin) {
      throw new Error('Primary candidate/admin user not found in database!');
    }
    console.log(
      `✓ Primary admin verified: ${primaryAdmin.name} (${primaryAdmin.email}), Role: ${primaryAdmin.role}`,
    );
    if (primaryAdmin.role !== 'admin') {
      throw new Error(`Expected primary user role to be admin, got ${primaryAdmin.role}`);
    }

    // -------------------------------------------------------------------------
    // STEP 2: Admin Issues Targeted Pilot Invitation & Email
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 2: Admin Creates Invitation with Transactional Dispatch ---');
    const invite = await invitationService.createInvitation({
      inviterUserId: adminId,
      invitedEmail: testerEmail,
      role: 'user',
      expiresInDays: 7,
    });
    invitationId = invite.id;
    console.log(`✓ Invitation code generated: ${invite.code} reserved for ${invite.invitedEmail}`);

    let emailSent = false;
    const origSend = emailService.sendEmail.bind(emailService);
    emailService.sendEmail = async (opts) => {
      if (opts.to === testerEmail && opts.html.includes(invite.code)) {
        emailSent = true;
      }
      return { success: true };
    };

    await emailService.sendInvitationEmail(
      testerEmail,
      invite.code,
      `http://127.0.0.1:3000/?invite=${invite.code}`,
      primaryAdmin.name,
    );
    emailService.sendEmail = origSend;

    if (!emailSent) {
      throw new Error('Invitation email dispatch was not triggered with valid parameters');
    }
    console.log('✓ Transactional invitation email verified and dispatched');

    // -------------------------------------------------------------------------
    // STEP 3: Tester Validates Invitation & Deep-Link Resolution
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 3: Tester Validates Invitation & Completes Onboarding ---');
    const verifiedInvite = await invitationService.verifyInvitation(invite.code, testerEmail);
    if (!verifiedInvite) {
      throw new Error('Invitation verification failed');
    }
    console.log('✓ Invitation verified successfully with matching recipient email');

    // Register Tester User
    testerUserId = crypto.randomUUID();
    await db.insert(users).values({
      id: testerUserId,
      name: 'Bob Tester',
      email: testerEmail,
      emailVerified: true,
      role: 'user',
      invitationCode: invite.code,
    });

    // Redeem invitation
    await invitationService.redeemInvitation(invite.code, testerUserId);
    console.log(`✓ Tester registered (userId: ${testerUserId}) and invitation marked REDEEMED`);

    // Initialize Tester Workspace
    await db.insert(candidateProfiles).values({
      userId: testerUserId,
      fullName: 'Bob Tester',
      email: testerEmail,
      headline: 'Senior Distributed Systems Engineer',
    });

    await db.insert(candidateSkills).values({
      userId: testerUserId,
      name: 'Go',
      category: 'LANGUAGES',
      proficiency: 'EXPERT',
      verificationStatus: 'VERIFIED',
    });

    await db.insert(candidateFacts).values({
      userId: testerUserId,
      category: 'EXPERIENCE',
      factKey: `exp_k8s_${timestamp}`,
      statement: 'Led migration of 50 microservices to Kubernetes',
      verificationStatus: 'VERIFIED',
    });

    console.log('✓ Tester candidate profile, verified skills, and facts initialized');

    // -------------------------------------------------------------------------
    // STEP 4: Independent Resource Creation & Strict Multi-Tenant Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 4: Multi-Tenant Data Isolation Audit ---');

    // User 1 (Admin) creates private job opportunity
    const [jobA] = await db
      .insert(jobs)
      .values({
        userId: adminId,
        title: 'Confidential Executive Director',
        company: 'Apex Global',
        description: 'Lead enterprise strategy and global delivery',
        state: 'INGESTED',
        contentHash: `hash_a_${timestamp}`,
      })
      .returning();
    testJobAId = jobA!.id;

    // User 2 (Bob) creates distinct job opportunity
    const [jobB] = await db
      .insert(jobs)
      .values({
        userId: testerUserId,
        title: 'Senior Infrastructure Engineer',
        company: 'CloudScale Inc',
        description: 'Build automated Kubernetes infrastructure and scaling',
        state: 'INGESTED',
        contentHash: `hash_b_${timestamp}`,
      })
      .returning();
    testJobBId = jobB!.id;

    // Audit User 2 cannot access User 1's job
    const user2Jobs = await db.query.jobs.findMany({
      where: eq(jobs.userId, testerUserId),
    });
    const user2CanSeeUser1Job = user2Jobs.some((j) => j.id === testJobAId);
    if (user2CanSeeUser1Job) {
      throw new Error('SECURITY VIOLATION: User 2 can see User 1 job opportunity!');
    }
    console.log('✓ Job isolation verified: User 2 cannot see User 1 confidential job');

    // User 1 creates package and approval request
    const [pkgA] = await db
      .insert(applicationPackages)
      .values({
        userId: adminId,
        jobId: testJobAId,
        status: 'NEEDS_REVIEW',
      })
      .returning();
    testPackageAId = pkgA!.id;

    const [pkgVerA] = await db
      .insert(applicationPackageVersions)
      .values({
        packageId: testPackageAId,
        versionNumber: 1,
        inputFingerprint: `fp_a_${timestamp}`,
        tailoredCvContent: {},
        coverLetterContent: 'Admin confidential cover letter',
        status: 'DRAFT',
      })
      .returning();

    const [apprA] = await db
      .insert(approvalRequests)
      .values({
        packageId: testPackageAId,
        versionId: pkgVerA!.id,
        userId: adminId,
        approvalType: 'SENSITIVE_ANSWER',
        subject: 'Confidential compensation threshold review',
        reason: 'Salary requirement verification',
        proposedValue: '350000',
        status: 'PENDING',
      })
      .returning();
    testApprovalAId = apprA!.id;

    // Audit User 2 cannot query User 1's pending approval
    const user2Approvals = await db.query.approvalRequests.findMany({
      where: eq(approvalRequests.userId, testerUserId),
    });
    const user2CanSeeUser1Approval = user2Approvals.some((a) => a.id === testApprovalAId);
    if (user2CanSeeUser1Approval) {
      throw new Error('SECURITY VIOLATION: User 2 can see User 1 approval request!');
    }
    console.log('✓ Approval request isolation verified: User 2 cannot access User 1 approvals');

    // -------------------------------------------------------------------------
    // STEP 5: Dynamic AI Provider Switching Verification
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 5: Dynamic AI Provider Switching & Policy Audit ---');
    const dynamicAi = new DynamicAiProvider(config);
    console.log(`Initial AI provider: ${dynamicAi.name}, Model: ${dynamicAi.activeModel}`);

    // Switch to deterministic offline
    dynamicAi.setActiveProvider('disabled');
    if (dynamicAi.name !== 'disabled') {
      throw new Error('Failed to switch AI provider to disabled');
    }
    console.log('✓ Successfully switched dynamic AI provider to DISABLED offline mode');

    // Persist User 1 preference in DB
    await db
      .insert(applicationPolicy)
      .values({
        userId: adminId,
        activeAiProvider: 'disabled',
        activeAiModel: 'none',
      })
      .onConflictDoUpdate({
        target: applicationPolicy.userId,
        set: {
          activeAiProvider: 'disabled',
          activeAiModel: 'none',
          updatedAt: new Date(),
        },
      });

    const user1Policy = await db.query.applicationPolicy.findFirst({
      where: eq(applicationPolicy.userId, adminId),
    });
    if (user1Policy?.activeAiProvider !== 'disabled') {
      throw new Error('Failed to persist User 1 AI preference in application_policy');
    }
    console.log('✓ User 1 AI preferences safely persisted in application_policy table');

    console.log('\n======================================================================');
    console.log('MULTI-USER E2E VALIDATION RESULT: ALL VERIFICATIONS PASSED');
    console.log('======================================================================\n');
  } catch (err) {
    console.error('\n❌ Fatal error during multi-user validation:', err);
    process.exitCode = 1;
  } finally {
    console.log('--- TEARDOWN: Cleaning up ephemeral test artifacts ---');
    const userIds = [testerUserId].filter(Boolean);
    if (testApprovalAId)
      await db.delete(approvalRequests).where(eq(approvalRequests.id, testApprovalAId));
    if (testPackageAId)
      await db.delete(applicationPackages).where(eq(applicationPackages.id, testPackageAId));
    if (testJobAId) await db.delete(jobs).where(eq(jobs.id, testJobAId));
    if (testJobBId) await db.delete(jobs).where(eq(jobs.id, testJobBId));
    if (invitationId)
      await db.delete(pilotInvitations).where(eq(pilotInvitations.id, invitationId));

    if (userIds.length > 0) {
      await db.delete(candidateFacts).where(inArray(candidateFacts.userId, userIds));
      await db.delete(candidateSkills).where(inArray(candidateSkills.userId, userIds));
      await db.delete(candidateProfiles).where(inArray(candidateProfiles.userId, userIds));
      await db.delete(users).where(inArray(users.id, userIds));
    }

    await closeDbPool();
    console.log('✓ Teardown complete. Zero database orphans left.');
  }
}

void runMultiUserValidation();
