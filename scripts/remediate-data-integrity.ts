import {
  getDb,
  candidateProfiles,
  candidateFacts,
  jobPreferences,
  approvalRequests,
  applicationQuestions,
  applicationPackages,
  applications,
  jobs,
  eq,
  ne,
  and,
} from '@job-agent/database';
import { getConfig } from '@job-agent/config';

async function main() {
  console.log('=== Starting Candidate Data Remediation & Quarantine ===');
  const config = getConfig();
  const db = getDb(config.DATABASE_URL);
  const userId = '00000000-0000-0000-0000-000000000001';

  // 1. Restore Candidate Profile
  console.log('1. Restoring Candidate Profile from pre-cleanup backup...');
  await db
    .update(candidateProfiles)
    .set({
      preferredName: 'Asadbek',
      fullName: 'Asadbek Makhmudov',
      headline: 'Project Manager',
      email: 'asadbek.mzw@gmail.com',
      phone: '+48884665207',
      city: 'Warsaw',
      region: null,
      country: 'Poland',
      summary:
        'Project Management student with banking operations experience. Proficient in Agile/Scrum and process optimization, focused on delivering data-driven results',
      availability: '2 weeks notice',
      updatedAt: new Date(),
    })
    .where(eq(candidateProfiles.userId, userId));
  console.log('✓ Candidate profile restored to Asadbek Makhmudov.');

  // 2. Restore Original Job Preferences
  console.log('2. Restoring Job Preferences to original candidate settings...');
  await db
    .update(jobPreferences)
    .set({
      targetTitles: ['Project Manager', 'Operations Lead'],
      targetCategories: ['Software Development'],
      preferredLocations: ['Berlin', 'Remote EU'],
      workModes: ['remote', 'hybrid'],
      employmentTypes: ['full-time'],
      seniorityLevels: ['senior', 'lead'],
      minSalary: 80000,
      maxSalary: 130000,
      currency: 'EUR',
      preferredLanguages: ['English', 'German'],
      excludedCompanies: ['BlockedCorp_1791182677247', 'Casino Royale Ltd'],
      excludedKeywords: ['crypto-gambling', 'unpaid-equity-only'],
      acceptUnpaid: false,
      willingToRelocate: false,
      needsSponsorship: false,
      updatedAt: new Date(),
    })
    .where(eq(jobPreferences.userId, userId));
  console.log('✓ Job preferences restored to original candidate parameters.');

  // 3. Quarantine Candidate Facts (allowAiUse: false, status: UNVERIFIED)
  console.log('3. Quarantining agent-created candidate facts...');
  const quarantinedFacts = await db
    .update(candidateFacts)
    .set({
      verificationStatus: 'UNVERIFIED',
      allowAiUse: false,
      updatedAt: new Date(),
    })
    .where(eq(candidateFacts.userId, userId))
    .returning();
  console.log(
    `✓ Quarantined ${quarantinedFacts.length} candidate facts (allowAiUse: false, UNVERIFIED).`,
  );

  // 4. Invalidate Untrusted Approvals & Questions
  console.log('4. Invalidating untrusted approvals and resetting questions...');
  const packageId = 'd3ca7301-7f6e-441a-9b15-fb9d0e5a4923';
  const activeVersionId = 'fb860ac5-6f15-4778-8357-79f7555990c9';

  // Active version approvals require user reconfirmation
  const updatedActiveApprovals = await db
    .update(approvalRequests)
    .set({
      status: 'NEEDS_USER_RECONFIRMATION',
      resolvedBy: null,
      resolvedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(approvalRequests.packageId, packageId),
        eq(approvalRequests.versionId, activeVersionId),
      ),
    )
    .returning();

  // Superseded versions are marked CANCELLED
  const cancelledSupersededApprovals = await db
    .update(approvalRequests)
    .set({
      status: 'CANCELLED',
      resolvedBy: null,
      resolvedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(approvalRequests.packageId, packageId),
        ne(approvalRequests.versionId, activeVersionId),
      ),
    )
    .returning();

  console.log(
    `✓ Reverted ${updatedActiveApprovals.length} active approval requests to NEEDS_USER_RECONFIRMATION, cancelled ${cancelledSupersededApprovals.length} superseded requests.`,
  );

  const updatedQuestions = await db
    .update(applicationQuestions)
    .set({
      approvalState: 'PENDING',
      finalAnswer: null,
      humanEditedAnswer: null,
      updatedAt: new Date(),
    })
    .where(eq(applicationQuestions.packageId, packageId))
    .returning();
  console.log(`✓ Reset ${updatedQuestions.length} application questions to PENDING.`);

  // 5. Invalidate Application Package Readiness
  console.log('5. Invalidating Application Package readiness...');
  await db
    .update(applicationPackages)
    .set({
      status: 'NEEDS_REVIEW',
      isReady: false,
      readinessReason:
        '3 approval request(s) require explicit user reconfirmation; 2 required application question(s) require candidate approval',
      updatedAt: new Date(),
    })
    .where(eq(applicationPackages.id, packageId));
  console.log('✓ Package marked NEEDS_REVIEW and isReady=false.');

  // 6. Invalidate CRM Application
  console.log('6. Invalidating CRM Application status...');
  const appId = '83290dbc-7ab2-4abe-b9f5-43d6bfa083a7';
  await db
    .update(applications)
    .set({
      status: 'NEEDS_REVIEW',
      notes:
        'Associate Project Manager vacancy ingested via manual text input for testing/simulation. Not verified against live employer posting URL. Application package requires human approval before submission.',
      lastStatusChangeAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(applications.id, appId));
  console.log('✓ CRM application reverted to NEEDS_REVIEW.');

  // 7. Clarify Ingested Job Provenance
  console.log('7. Updating Revolut Job provenance...');
  const revolutJobId = '90d7c12d-41d0-415b-b88e-feca0a51b3e6';
  await db
    .update(jobs)
    .set({
      provider: 'MANUAL',
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, revolutJobId));
  console.log('✓ Revolut job verified as MANUAL text input.');

  console.log('\n=== Remediation Complete: Database Integrity Restored ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error during data integrity remediation:', err);
  process.exit(1);
});
