import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import {
  closeDbPool,
  getDb,
  users,
  sessions,
  candidateProfiles,
  candidateFacts,
  jobs,
  applicationPackages,
  applicationPackageVersions,
  approvalRequests,
  applications,
  calendarAccounts,
  browserApplicationRuns,
  systemNotifications,
  eq,
  inArray,
} from '@job-agent/database';
import { ApplicationLifecycleStatus, BrowserRunMode, BrowserRunStatus } from '@job-agent/shared';

describe('Multi-Tenant Cross-User Isolation Penetration Test Suite (BL-01)', () => {
  const config = getConfig();
  let app: ReturnType<typeof buildApp>;
  const db = getDb(config.DATABASE_URL);

  const timestamp = Date.now();
  let userAId: string;
  let userBId: string;

  // Track created entities for clean teardown
  let aliceFactId: string;
  let aliceJobId: string;
  let alicePackageId: string;
  let aliceApprovalId: string;
  let aliceAppId: string;
  let aliceCalAccountId: string;
  let aliceBrowserRunId: string;
  let aliceNotifId: string;

  beforeAll(async () => {
    app = buildApp({ config });
    await app.ready();

    // 1. Create User A (Alice)
    const [userA] = await db
      .insert(users)
      .values({
        name: 'Alice Isolation Tester',
        email: `alice_iso_${timestamp}@example.com`,
        emailVerified: true,
        role: 'user',
        systemKey: `alice_iso_${timestamp}`,
      })
      .returning();
    if (!userA) throw new Error('Failed to create User A');
    userAId = userA.id;

    // 2. Create User B (Bob)
    const [userB] = await db
      .insert(users)
      .values({
        name: 'Bob Isolation Tester',
        email: `bob_iso_${timestamp}@example.com`,
        emailVerified: true,
        role: 'user',
        systemKey: `bob_iso_${timestamp}`,
      })
      .returning();
    if (!userB) throw new Error('Failed to create User B');
    userBId = userB.id;

    // 3. Seed Alice's Candidate Profile
    await db.insert(candidateProfiles).values({
      userId: userAId,
      fullName: 'Alice Isolation',
      email: userA.email,
      headline: 'Principal Distributed Systems Architect',
      city: 'Zurich',
      country: 'Switzerland',
    });

    // 4. Seed Bob's Candidate Profile
    await db.insert(candidateProfiles).values({
      userId: userBId,
      fullName: 'Bob Isolation',
      email: userB.email,
      headline: 'Junior Web Developer',
      city: 'Austin',
      country: 'USA',
    });

    // 5. Seed Alice's Private Candidate Fact
    const [fact] = await db
      .insert(candidateFacts)
      .values({
        userId: userAId,
        factKey: 'security_clearance',
        statement: 'Candidate holds Top Secret / SCI clearance.',
        category: 'LEGAL',
        verificationStatus: 'VERIFIED',
        allowAiUse: true,
      })
      .returning();
    aliceFactId = fact!.id;

    // 6. Seed Alice's Job
    const [job] = await db
      .insert(jobs)
      .values({
        userId: userAId,
        company: 'Confidential Defense Corp',
        title: 'Lead Systems Engineer',
        description: 'Requires Top Secret security clearance.',
        state: 'INGESTED',
        contentHash: `iso_job_hash_${timestamp}`,
      })
      .returning();
    aliceJobId = job!.id;

    // 7. Seed Alice's Application Package & Approval
    const [pkg] = await db
      .insert(applicationPackages)
      .values({
        userId: userAId,
        jobId: aliceJobId,
        status: 'NEEDS_REVIEW',
      })
      .returning();
    alicePackageId = pkg!.id;

    const [pkgVer] = await db
      .insert(applicationPackageVersions)
      .values({
        packageId: alicePackageId,
        versionNumber: 1,
        inputFingerprint: `iso_fp_${timestamp}`,
        tailoredCvContent: {},
        coverLetterContent: 'Alice confidential cover letter',
        status: 'DRAFT',
      })
      .returning();

    const [approval] = await db
      .insert(approvalRequests)
      .values({
        packageId: alicePackageId,
        versionId: pkgVer!.id,
        userId: userAId,
        approvalType: 'SENSITIVE_ANSWER',
        subject: 'Confirm minimum compensation requirement',
        reason: 'Salary question requires human review',
        proposedValue: '250000',
        status: 'PENDING',
      })
      .returning();
    aliceApprovalId = approval!.id;

    // 8. Seed Alice's CRM Application
    const [crmApp] = await db
      .insert(applications)
      .values({
        userId: userAId,
        jobId: aliceJobId,
        currentPackageId: alicePackageId,
        status: ApplicationLifecycleStatus.READY_TO_APPLY,
      })
      .returning();
    aliceAppId = crmApp!.id;

    // 9. Seed Alice's Calendar Account
    const [calAcc] = await db
      .insert(calendarAccounts)
      .values({
        userId: userAId,
        provider: 'FIXTURE',
        emailAddress: 'alice.private.cal@example.com',
        encryptedTokens: 'mock-encrypted-tokens',
        status: 'CONNECTED',
      })
      .returning();
    aliceCalAccountId = calAcc!.id;

    // 10. Seed Alice's Browser Run
    const [browserRun] = await db
      .insert(browserApplicationRuns)
      .values({
        userId: userAId,
        applicationId: aliceAppId,
        atsProvider: 'GREENHOUSE',
        targetUrl: 'https://boards.greenhouse.io/confidential/jobs/12345',
        mode: BrowserRunMode.DRY_RUN,
        status: BrowserRunStatus.PENDING,
      })
      .returning();
    aliceBrowserRunId = browserRun!.id;

    // 11. Seed Alice's Notification
    const [notif] = await db
      .insert(systemNotifications)
      .values({
        userId: userAId,
        type: 'APPROVAL_REQUIRED',
        title: 'Alice Private Approval Alert',
        message: 'High priority salary verification needed',
      })
      .returning();
    aliceNotifId = notif!.id;
  });

  afterAll(async () => {
    // Clean up all seeded test data
    const userIds = [userAId, userBId].filter(Boolean);
    if (userIds.length > 0) {
      await db.delete(systemNotifications).where(inArray(systemNotifications.userId, userIds));
      await db
        .delete(browserApplicationRuns)
        .where(inArray(browserApplicationRuns.userId, userIds));
      await db.delete(calendarAccounts).where(inArray(calendarAccounts.userId, userIds));
      await db.delete(applications).where(inArray(applications.userId, userIds));
      if (alicePackageId) {
        await db.delete(approvalRequests).where(eq(approvalRequests.id, aliceApprovalId));
        await db
          .delete(applicationPackageVersions)
          .where(eq(applicationPackageVersions.packageId, alicePackageId));
        await db.delete(applicationPackages).where(eq(applicationPackages.id, alicePackageId));
      }
      await db.delete(jobs).where(inArray(jobs.userId, userIds));
      await db.delete(candidateFacts).where(inArray(candidateFacts.userId, userIds));
      await db.delete(candidateProfiles).where(inArray(candidateProfiles.userId, userIds));
      await db.delete(sessions).where(inArray(sessions.userId, userIds));
      await db.delete(users).where(inArray(users.id, userIds));
    }

    await app.close();
    await closeDbPool();
  });

  describe('1. Candidate Brain Isolation', () => {
    it('prevents User B from accessing User A profile', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/candidate/profile',
        headers: { 'x-test-user-id': userBId },
      });
      expect(res.statusCode).toBe(200);
      const profile = JSON.parse(res.body).data;
      expect(profile.fullName).toBe('Bob Isolation');
      expect(profile.headline).toBe('Junior Web Developer');
      expect(profile.fullName).not.toBe('Alice Isolation');
    });

    it('prevents User B from viewing User A candidate facts', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/candidate/facts',
        headers: { 'x-test-user-id': userBId },
      });
      expect(res.statusCode).toBe(200);
      const facts = JSON.parse(res.body).data;
      expect(Array.isArray(facts)).toBe(true);
      expect(facts.some((f: any) => f.id === aliceFactId)).toBe(false);
      expect(facts.some((f: any) => f.factValue === 'Top Secret / SCI')).toBe(false);
    });

    it('blocks User B from updating User A candidate fact', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/candidate/facts/${aliceFactId}`,
        headers: { 'x-test-user-id': userBId },
        payload: { factValue: 'Compromised Fact' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('blocks User B from deleting User A candidate fact', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/candidate/facts/${aliceFactId}`,
        headers: { 'x-test-user-id': userBId },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('2. Job Opportunity Isolation', () => {
    it('prevents User B from listing User A private jobs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/jobs',
        headers: { 'x-test-user-id': userBId },
      });
      expect(res.statusCode).toBe(200);
      const jobsList = JSON.parse(res.body).data.items;
      expect(jobsList.some((j: any) => j.id === aliceJobId)).toBe(false);
      expect(jobsList.some((j: any) => j.company === 'Confidential Defense Corp')).toBe(false);
    });

    it('blocks User B from reading User A job detail directly', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/jobs/${aliceJobId}`,
        headers: { 'x-test-user-id': userBId },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('3. Application Package & Approval Isolation', () => {
    it('blocks User B from reading User A application package', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/application-packages/${alicePackageId}`,
        headers: { 'x-test-user-id': userBId },
      });
      expect(res.statusCode).toBe(404);
    });

    it('blocks User B from approving User A approval request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/approvals/${aliceApprovalId}/approve`,
        headers: { 'x-test-user-id': userBId },
        payload: { userEditedValue: 'Unauthorized' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('blocks User B from listing User A pending approvals', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/approvals',
        headers: { 'x-test-user-id': userBId },
      });
      expect(res.statusCode).toBe(200);
      const approvals = JSON.parse(res.body).data;
      expect(approvals.some((a: any) => a.id === aliceApprovalId)).toBe(false);
    });
  });

  describe('4. CRM Application Lifecycle Isolation', () => {
    it('blocks User B from reading User A CRM application detail', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${aliceAppId}`,
        headers: { 'x-test-user-id': userBId },
      });
      expect(res.statusCode).toBe(404);
    });

    it('blocks User B from mutating User A CRM application state', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/applications/${aliceAppId}/transition`,
        headers: { 'x-test-user-id': userBId },
        payload: { targetStatus: 'APPLIED' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('blocks User B from launching a browser application run on User A application', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/applications/${aliceAppId}/browser-runs`,
        headers: { 'x-test-user-id': userBId },
        payload: { mode: 'DRY_RUN' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('blocks User B from reading User A browser run execution trace', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/browser-runs/${aliceBrowserRunId}`,
        headers: { 'x-test-user-id': userBId },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('5. Calendar & Notification Isolation', () => {
    it('prevents User B from listing User A calendar accounts', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/calendar/accounts',
        headers: { 'x-test-user-id': userBId },
      });
      expect(res.statusCode).toBe(200);
      const accounts = JSON.parse(res.body).data;
      expect(accounts.some((a: any) => a.id === aliceCalAccountId)).toBe(false);
    });

    it('blocks User B from reading User A calendar account detail', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/calendar/accounts/${aliceCalAccountId}`,
        headers: { 'x-test-user-id': userBId },
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents User B from listing User A notifications', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/notifications',
        headers: { 'x-test-user-id': userBId },
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      const notifs = data.notifications || data.items || [];
      expect(notifs.some((n: any) => n.id === aliceNotifId)).toBe(false);
    });

    it('blocks User B from marking User A notification as read', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/notifications/${aliceNotifId}/read`,
        headers: { 'x-test-user-id': userBId },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
