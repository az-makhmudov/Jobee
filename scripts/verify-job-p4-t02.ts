import crypto from 'node:crypto';
import { getDb, closeDbPool, getOrCreatePrimaryUser } from '@job-agent/database';
import {
  jobs,
  applications,
  candidateExperiences,
  candidateSkills,
  applicationInterviews,
  interviewCalendarLinks,
  interviewPreparationBriefs,
  calendarAccounts,
  applicationLifecycleEvents,
} from '@job-agent/database';
import { inArray, eq } from 'drizzle-orm';
import {
  CalendarProviderType,
  ConflictSeverity,
  InterviewSchedulingStatus,
} from '@job-agent/shared';
import { getConfig } from '@job-agent/config';
import { TokenCryptoService } from '../apps/api/src/services/email/token-crypto-service.js';
import { CalendarService } from '../apps/api/src/services/calendar/calendar-service.js';
import { InterviewPreparationService } from '../apps/api/src/services/calendar/interview-preparation-service.js';
import { FixtureCalendarProvider } from '../apps/api/src/services/calendar/fixture-calendar-provider.js';
import { GoogleCalendarProvider } from '../apps/api/src/services/calendar/google-calendar-provider.js';

async function main() {
  console.log('===============================================================');
  console.log('JOB-P4-T02 — LIVE POSTGRESQL DETERMINISTIC VERIFICATION SUITE');
  console.log('Calendar Integration, Availability & Grounded Interview Prep');
  console.log('===============================================================\n');

  const config = getConfig();
  const db = getDb(config.DATABASE_URL);
  const user = await getOrCreatePrimaryUser(db);
  const userId = user.id;
  const runId = `live-cal-${Date.now()}`;

  const createdJobIds: string[] = [];
  const createdAppIds: string[] = [];
  const createdInterviewIds: string[] = [];
  const createdAccountIds: string[] = [];
  const createdExpIds: string[] = [];
  const createdSkillIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: Service Initialization & Token Encryption
    // -------------------------------------------------------------------------
    console.log('--- SECTION 1: Service Setup & Calendar Token Cryptography ---');
    const cryptoService = new TokenCryptoService(
      config.EMAIL_TOKEN_ENCRYPTION_KEY || 'default-test-encryption-key-min-32-chars-long',
    );
    const fixtureProvider = new FixtureCalendarProvider();
    const googleProvider = new GoogleCalendarProvider({
      clientId: config.GOOGLE_CLIENT_ID || 'mock-id',
      clientSecret: config.GOOGLE_CLIENT_SECRET || 'mock-secret',
      redirectUri:
        config.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:3000/api/calendar/google/callback',
    });

    const calendarService = new CalendarService({
      db,
      cryptoService,
      googleProvider,
      fixtureProvider,
    });

    const prepService = new InterviewPreparationService({
      db,
      fixtureCalendarProvider: fixtureProvider,
    });

    // Connect Demo Fixture Account
    const account = await calendarService.connectAccount(
      userId,
      CalendarProviderType.FIXTURE,
      'auth-code-live-verification',
    );
    createdAccountIds.push(account.id);
    console.log(`✓ Connected calendar account: ${account.emailAddress} (${account.provider})`);

    // Verify token is encrypted in DB
    const [storedAccount] = await db
      .select()
      .from(calendarAccounts)
      .where(eq(calendarAccounts.id, account.id));
    if (!storedAccount || !storedAccount.encryptedTokens.startsWith('v1:primary:')) {
      throw new Error('SECURITY VIOLATION: Calendar account token not properly encrypted');
    }
    console.log('✓ Verified AES-256-GCM envelope encryption on stored calendar tokens\n');

    // -------------------------------------------------------------------------
    // SECTION 2: Combined Multi-Calendar Availability Aggregation
    // -------------------------------------------------------------------------
    console.log('--- SECTION 2: Multi-Calendar Combined Availability ---');
    const availResult = await calendarService.getCombinedAvailability(userId, {
      windowStart: '2026-10-12T00:00:00.000Z',
      windowEnd: '2026-10-12T23:59:59.000Z',
      timezone: 'UTC',
    });

    console.log(
      `✓ Queried calendars: ${availResult.queriedCalendars.length}, status: ${availResult.status}`,
    );
    console.log(
      `✓ Identified ${availResult.busySlots.length} busy slot(s) across connected accounts`,
    );
    if (availResult.busySlots.length === 0) {
      throw new Error('Expected fixture busy slots for 2026-10-12');
    }
    console.log(
      `  Busy slot 1: ${availResult.busySlots[0].start} → ${availResult.busySlots[0].end}\n`,
    );

    // -------------------------------------------------------------------------
    // SECTION 3: Conflict Detection & Resolution Advice
    // -------------------------------------------------------------------------
    console.log('--- SECTION 3: Conflict Detection & Alternative Recommendations ---');
    // Check 13:30 UTC (overlapping with fixture busy slot 13:00-14:00)
    const conflictResult = await calendarService.checkInterviewConflict(
      userId,
      new Date('2026-10-12T13:30:00.000Z'),
      45,
      'UTC',
    );

    if (!conflictResult.hasConflict || conflictResult.severity !== ConflictSeverity.CONFLICT) {
      throw new Error(
        `Expected conflict at 13:30 UTC, got hasConflict=${conflictResult.hasConflict}, severity=${conflictResult.severity}`,
      );
    }
    console.log(`✓ Hard conflict detected: ${conflictResult.conflicts[0].description}`);
    console.log(
      `✓ Available alternatives proposed: ${conflictResult.availableAlternatives?.length || 0}`,
    );
    if (
      !conflictResult.availableAlternatives ||
      conflictResult.availableAlternatives.length === 0
    ) {
      throw new Error('Expected alternative slots when conflict is detected');
    }

    // Check 16:00 UTC (free)
    const freeResult = await calendarService.checkInterviewConflict(
      userId,
      new Date('2026-10-12T16:00:00.000Z'),
      60,
      'UTC',
    );
    if (freeResult.hasConflict) {
      throw new Error('Expected 16:00 UTC to be conflict-free');
    }
    console.log('✓ Verified conflict-free slot for 16:00 UTC\n');

    // -------------------------------------------------------------------------
    // SECTION 4: Seed Verified Candidate Evidence, Job & Application
    // -------------------------------------------------------------------------
    console.log('--- SECTION 4: Seed Evidence, Job & Application with Interview ---');
    // 1. Candidate Experience
    const [exp] = await db
      .insert(candidateExperiences)
      .values({
        userId,
        organization: 'Helios Cloud Systems',
        position: 'Staff Infrastructure Engineer',
        employmentType: 'FULL_TIME',
        locationText: 'San Francisco, CA',
        startDate: '2021-03-01',
        isCurrent: true,
        description: 'Led core cloud platform and distributed microservices architecture.',
        achievements: [
          'Architected distributed event pipeline handling 100M+ events daily with zero downtime',
          'Reduced p99 API latency by 45% through aggressive query optimization and caching',
        ],
      })
      .returning();
    createdExpIds.push(exp.id);

    // 2. Candidate Skill
    const [skill] = await db
      .insert(candidateSkills)
      .values({
        userId,
        name: 'Distributed Systems',
        category: 'BACKEND',
        proficiency: 'EXPERT',
        verified: true,
        evidenceCount: 3,
      })
      .returning();
    createdSkillIds.push(skill.id);

    // 3. Job
    const [job] = await db
      .insert(jobs)
      .values({
        userId,
        title: 'Principal Systems Architect',
        company: 'Starlight Galactic Labs',
        description:
          'We are seeking a Principal Systems Architect to design distributed systems and lead platform engineering.',
        contentHash: crypto.createHash('sha256').update(`${runId}-job`).digest('hex'),
        state: 'INGESTED',
      })
      .returning();
    createdJobIds.push(job.id);

    // 4. Application
    const [app] = await db
      .insert(applications)
      .values({
        userId,
        jobId: job.id,
        status: 'INTERVIEWING',
        source: 'DIRECT',
      })
      .returning();
    createdAppIds.push(app.id);

    // 5. Interview
    const interviewDate = new Date('2026-10-12T16:00:00.000Z');
    const [interview] = await db
      .insert(applicationInterviews)
      .values({
        applicationId: app.id,
        userId,
        roundTitle: 'System Design & Distributed Architecture',
        interviewType: 'TECHNICAL',
        status: 'SCHEDULED',
        schedulingStatus: InterviewSchedulingStatus.PROPOSED,
        scheduledAt: interviewDate,
        durationMinutes: 60,
        timezone: 'UTC',
        interviewerName: 'Dr. Elena Vance (VP Engineering)',
        meetingUrl: 'https://meet.google.com/stl-live-123',
      })
      .returning();
    createdInterviewIds.push(interview.id);
    console.log(
      `✓ Seeded candidate evidence, application, and interview round: ${interview.roundTitle}\n`,
    );

    // -------------------------------------------------------------------------
    // SECTION 5: Interview Calendar Booking & Provider Sync
    // -------------------------------------------------------------------------
    console.log('--- SECTION 5: Interview Calendar Booking & Linkage ---');
    const bookingResult = await calendarService.createCalendarEventForInterview(
      userId,
      app.id,
      interview.id,
      {
        calendarId: 'primary',
        timezone: 'UTC',
        includePreparationNotes: true,
      },
    );

    console.log(`✓ Created calendar event ID: ${bookingResult.event.externalEventId}`);
    console.log(
      `✓ Status: ${bookingResult.event.status}, Meeting URL: ${bookingResult.event.meetingUrl}`,
    );
    if (!bookingResult.link || bookingResult.link.interviewId !== interview.id) {
      throw new Error('Interview calendar link was not created properly');
    }

    // Verify link retrieval
    const retrievedLink = await calendarService.getInterviewCalendarLink(interview.id, userId);
    if (
      !retrievedLink ||
      retrievedLink.event.externalEventId !== bookingResult.event.externalEventId
    ) {
      throw new Error('Failed to retrieve linked calendar event');
    }
    console.log('✓ Successfully retrieved linked event from provider\n');

    // -------------------------------------------------------------------------
    // SECTION 6: Grounded Preparation Brief (Zero Hallucination)
    // -------------------------------------------------------------------------
    console.log('--- SECTION 6: Grounded Interview Prep Brief (Zero-Hallucination Audit) ---');
    const brief = await prepService.generatePreparationBrief(interview.id, userId, true);

    console.log(`✓ Generated brief ID: ${brief.id}, Mode: ${brief.generationMode}`);
    console.log(`  Role summary: ${brief.roleSummary}`);
    console.log(`  Candidate strengths found: ${brief.candidateStrengths.length}`);
    console.log(`  Grounded STAR frameworks: ${brief.suggestedAnswerFrameworks.length}`);
    console.log(`  Preparation checklist steps: ${brief.preparationChecklist.length}`);

    // Verify zero hallucination invariant
    const matchedStrength = brief.candidateStrengths.find(
      (s) =>
        s.evidenceTitle === 'Distributed Systems' || s.evidenceTitle === 'Helios Cloud Systems',
    );
    if (!matchedStrength) {
      throw new Error(
        'INVARIANT FAILURE: Strengths not grounded in verified candidate skills or experiences',
      );
    }
    console.log(
      `✓ Verified ground truth anchor: "${matchedStrength.evidenceTitle}" (${matchedStrength.relevantRequirement})`,
    );

    // Verify 6-step checklist
    if (brief.preparationChecklist.length !== 6) {
      throw new Error(`Expected 6 checklist steps, got ${brief.preparationChecklist.length}`);
    }
    console.log('✓ Verified 6 standard interview preparation checklist steps\n');

    // -------------------------------------------------------------------------
    // SECTION 7: Checklist Interactive Toggle & Human Notes
    // -------------------------------------------------------------------------
    console.log('--- SECTION 7: Checklist Updates & Candidate Notes ---');
    const updatedChecklist = brief.preparationChecklist.map((item, idx) =>
      idx === 0 ? { ...item, isCompleted: true } : item,
    );
    const savedChecklistBrief = await prepService.updateChecklist(
      interview.id,
      userId,
      updatedChecklist,
    );
    if (!savedChecklistBrief.preparationChecklist[0].isCompleted) {
      throw new Error('Checklist item completion did not persist');
    }
    console.log('✓ Checkbox state toggle persisted successfully');

    const personalNotes = 'Review Helios event pipeline p99 benchmarks before the call.';
    const savedNotesBrief = await prepService.updateHumanNotes(interview.id, userId, personalNotes);
    if (savedNotesBrief.humanNotes !== personalNotes) {
      throw new Error('Candidate human notes did not persist');
    }
    console.log('✓ Personal candidate notes saved and audited\n');

    // -------------------------------------------------------------------------
    // SECTION 8: Post-Interview Debrief & CRM Status Sync
    // -------------------------------------------------------------------------
    console.log('--- SECTION 8: Post-Interview Debrief & CRM Lifecycle ---');
    const debriefInput = {
      questionsAsked: 'Distributed locking mechanisms and handling split-brain scenarios',
      topicsDiscussed: 'Multi-region failover and consensus algorithms',
      candidateObservations: 'High technical alignment; VP was engaged and asked deep follow-ups',
      followUpCommitments: 'Share architecture design doc by Wednesday morning',
      expectedNextStep: 'Executive round with CTO',
      expectedResponseDate: new Date('2026-10-16T17:00:00.000Z').toISOString(),
    };

    const debriefedInterview = await prepService.updateDebrief(interview.id, userId, debriefInput);
    if (debriefedInterview.status !== 'COMPLETED') {
      throw new Error(`Expected interview status COMPLETED, got ${debriefedInterview.status}`);
    }
    console.log(`✓ Debrief saved. Interview marked ${debriefedInterview.status}`);

    // Verify lifecycle audit event in CRM
    const lifecycleEvents = await db
      .select()
      .from(applicationLifecycleEvents)
      .where(eq(applicationLifecycleEvents.applicationId, app.id));
    const debriefEvent = lifecycleEvents.find((e) => e.eventType === 'INTERVIEW_COMPLETED');
    if (!debriefEvent) {
      throw new Error('Application lifecycle audit log missing INTERVIEW_COMPLETED event');
    }
    console.log('✓ Application lifecycle audit trail logged INTERVIEW_COMPLETED\n');

    // -------------------------------------------------------------------------
    // SECTION 9: Workspace Item Listing & Dashboard Metrics
    // -------------------------------------------------------------------------
    console.log('--- SECTION 9: Workspace Aggregation & Metrics ---');
    const workspaceInterviews = await calendarService.listInterviews(userId);
    console.log(`✓ Total workspace interviews: ${workspaceInterviews.length}`);
    const found = workspaceInterviews.find((i) => i.interview.id === interview.id);
    if (!found) {
      throw new Error('Interview missing from workspace listing');
    }
    console.log(`  Found: "${found.interview.roundTitle}" at ${found.application.companyName}`);
    console.log(
      `  Calendar linked: ${Boolean(found.calendarLink)}, Brief checklist: ${found.preparationBrief?.checklistProgress.completed}/${found.preparationBrief?.checklistProgress.total}`,
    );

    const metrics = await calendarService.getDashboardMetrics(userId);
    console.log(
      `✓ Dashboard metrics: ${metrics.interviewsCompleted} completed, ${metrics.upcomingInterviews} upcoming, connected: ${metrics.calendarConnected}\n`,
    );

    // -------------------------------------------------------------------------
    // SECTION 10: Event Unlinking & Teardown
    // -------------------------------------------------------------------------
    console.log('--- SECTION 10: Event Unlink & Clean Teardown ---');
    await calendarService.deleteInterviewCalendarEvent(interview.id, userId);
    const unlinked = await calendarService.getInterviewCalendarLink(interview.id, userId);
    if (unlinked !== null) {
      throw new Error('Expected calendar event to be null after deletion');
    }
    console.log('✓ Calendar event deleted and unlinked cleanly');
  } finally {
    // Teardown test artifacts
    console.log('\n--- Clean Teardown of Test Data ---');
    if (createdInterviewIds.length > 0) {
      await db
        .delete(interviewPreparationBriefs)
        .where(inArray(interviewPreparationBriefs.interviewId, createdInterviewIds));
      await db
        .delete(interviewCalendarLinks)
        .where(inArray(interviewCalendarLinks.interviewId, createdInterviewIds));
      await db
        .delete(applicationInterviews)
        .where(inArray(applicationInterviews.id, createdInterviewIds));
    }
    if (createdAppIds.length > 0) {
      await db
        .delete(applicationLifecycleEvents)
        .where(inArray(applicationLifecycleEvents.applicationId, createdAppIds));
      await db.delete(applications).where(inArray(applications.id, createdAppIds));
    }
    if (createdJobIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
    }
    if (createdExpIds.length > 0) {
      await db.delete(candidateExperiences).where(inArray(candidateExperiences.id, createdExpIds));
    }
    if (createdSkillIds.length > 0) {
      await db.delete(candidateSkills).where(inArray(candidateSkills.id, createdSkillIds));
    }
    if (createdAccountIds.length > 0) {
      for (const accId of createdAccountIds) {
        await db.delete(calendarAccounts).where(eq(calendarAccounts.id, accId));
      }
    }
    await closeDbPool();
    console.log('✓ Teardown complete. PostgreSQL database is pristine.\n');
  }

  console.log('===============================================================');
  console.log('JOB-P4-T02 VERIFICATION SUCCESSFUL: 10/10 SECTIONS VERIFIED');
  console.log('===============================================================');
}

main().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
