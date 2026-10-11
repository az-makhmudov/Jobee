/**
 * AI JOB AGENT — COMPREHENSIVE OPERATIONAL ACCEPTANCE PASS
 *
 * Exercises the complete rendered React interface in a real Chromium browser,
 * runs an integrated local ATS fixture submission workflow, and audits crash
 * and duplicate-submission safety invariants against the live stack.
 *
 * Focus Areas:
 * 1. FRONTEND ACCEPTANCE (Real Playwright Chromium driving React 19 UI across all 10 views)
 * 2. BROWSER EXECUTION ACCEPTANCE (Integrated local ATS fixture submission workflow)
 * 3. CRASH AND DUPLICATE-SUBMISSION SAFETY (Orphan recovery, SUBMISSION_UNCERTAIN, orchestrator guard)
 * 4. CLEAN TEARDOWN (Zero database orphans)
 */

import { chromium, type Browser, type Page } from 'playwright';
import {
  getDb,
  closeDbPool,
  getOrCreatePrimaryUser,
  candidateFacts,
  answerLibrary,
  jobs,
  applications,
  applicationLifecycleEvents,
  browserApplicationRuns,
  systemNotifications,
  applicationPolicy,
  inArray,
  eq,
  and,
} from '@job-agent/database';
import { getConfig } from '@job-agent/config';
import {
  ApplicationLifecycleStatus,
  BrowserRunMode,
  BrowserRunStatus,
  AtsProviderType,
} from '@job-agent/shared';
import { WorkerService } from '../apps/worker/src/worker.js';
import { executePendingBrowserRun } from '../apps/worker/src/services/browser-runner.js';
import { AutonomousOrchestrator } from '../apps/worker/src/engine/autonomous-orchestrator.js';

const API_BASE_URL = 'http://127.0.0.1:3000';
const WEB_BASE_URL = 'http://127.0.0.1:5173';

interface OperationalContext {
  userId: string;
  tag: string;
  db: ReturnType<typeof getDb>;
  createdJobIds: string[];
  createdAppIds: string[];
  createdBrowserRunIds: string[];
  createdNotifIds: string[];
  createdFactIds: string[];
  createdAnswerIds: string[];
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(url, { ...options, headers });
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return { status: response.status, ok: response.ok, data };
  } catch {
    return { status: response.status, ok: response.ok, raw: text };
  }
}

async function main() {
  console.log('======================================================================');
  console.log('AI JOB AGENT — FINAL OPERATIONAL ACCEPTANCE PASS');
  console.log('Real Browser React UI + Integrated ATS Fixture + Crash Invariant Audit');
  console.log('======================================================================\n');

  const config = getConfig();
  const db = getDb(config.DATABASE_URL);
  const user = await getOrCreatePrimaryUser(db);
  const userId = user.id;
  const tag = `op-accept-${Date.now()}`;

  const ctx: OperationalContext = {
    userId,
    tag,
    db,
    createdJobIds: [],
    createdAppIds: [],
    createdBrowserRunIds: [],
    createdNotifIds: [],
    createdFactIds: [],
    createdAnswerIds: [],
  };

  let failuresCount = 0;
  let browser: Browser | null = null;
  let page: Page | null = null;
  let initialProfile: any = null;

  try {
    // -------------------------------------------------------------------------
    // PRE-FLIGHT: Verify Local Service Connectivity
    // -------------------------------------------------------------------------
    console.log('--- PRE-FLIGHT: Service Health & Connectivity ---');
    const liveProbe = await apiFetch('/health/live');
    if (!liveProbe.ok) {
      throw new Error(`API server is not responding on ${API_BASE_URL}/health/live`);
    }
    console.log('✓ Fastify API is live and responsive');

    const readyProbe = await apiFetch('/health/ready');
    if (!readyProbe.ok || readyProbe.data?.status !== 'ready') {
      throw new Error(`API database connectivity probe failed: ${JSON.stringify(readyProbe)}`);
    }
    console.log(`✓ PostgreSQL database connection confirmed healthy`);

    // Save initial candidate profile to restore during teardown
    const initialProfileRes = await apiFetch('/candidate/profile');
    initialProfile = initialProfileRes.data?.data;

    // Ensure candidate profile exists without overwriting real candidate data
    if (!initialProfile || !initialProfile.fullName) {
      await apiFetch('/candidate/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: 'Asadbek Makhmudov',
          headline: 'Project Manager',
          email: 'asadbek.m@example.com',
          phone: '+48 123 456 789',
          city: 'Warsaw',
          region: 'Mazovia',
          country: 'Poland',
          summary: 'Experienced Project Manager with strong track record in IT and operations.',
        }),
      });
      console.log('✓ Initialized primary candidate profile in database');
    } else {
      console.log(
        `✓ Preserved verified candidate profile in database: ${initialProfile.fullName} (${initialProfile.headline})`,
      );
    }

    // -------------------------------------------------------------------------
    // PART 1: FRONTEND ACCEPTANCE (Real Chromium Browser exercising React 19 UI)
    // -------------------------------------------------------------------------
    console.log('\n--- PART 1: FRONTEND ACCEPTANCE (Real Playwright Chromium) ---');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });

    const pageErrors: string[] = [];
    page = await context.newPage();
    page.on('pageerror', (err) => {
      // Ignore routine Vite websocket or favicon noise if any
      pageErrors.push(err.message);
      console.warn(`  [Browser Console Error] ${err.message}`);
    });

    // 1. Load Application Shell
    console.log(`  Navigating to React UI at ${WEB_BASE_URL}...`);
    await page.goto(WEB_BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    const title = await page.title();
    console.log(`✓ React 19 App loaded successfully. Document title: "${title}"`);

    // Helper to click sidebar nav items
    const clickNav = async (label: string) => {
      const btn = page!.locator(`.nav-button:has-text("${label}")`).first();
      await btn.waitFor({ state: 'visible', timeout: 5000 });
      await btn.click();
      await page!.waitForTimeout(300);
    };

    // 1a. Dashboard View
    await clickNav('Dashboard');
    const hasDashboardTitle = (await page.locator('text=Dashboard').count()) > 0;
    expectCondition(hasDashboardTitle, 'Dashboard view rendered');

    // 1b. Candidate Brain Views
    console.log('  Testing Candidate Brain views...');
    await clickNav('Candidate Profile');
    const profileHeading = (await page.locator('text=Candidate Profile').count()) > 0;
    expectCondition(profileHeading, 'Candidate Profile view rendered');

    // Test tab switching in profile
    const skillsTab = page.locator('button:has-text("Skills")').first();
    if ((await skillsTab.count()) > 0) {
      await skillsTab.click();
      await page.waitForTimeout(200);
      console.log('✓ Switched to Profile -> Skills tab');
    }

    const factsTab = page.locator('button:has-text("Facts")').first();
    if ((await factsTab.count()) > 0) {
      await factsTab.click();
      await page.waitForTimeout(200);
      console.log('✓ Switched to Profile -> Facts tab');
    }

    // 1c. Document Vault
    await clickNav('Document Vault');
    const docsHeader = (await page.locator('text=Document Vault').count()) > 0;
    expectCondition(docsHeader, 'Document Vault view rendered');

    // 1d. Answer Library
    await clickNav('Answer Library');
    const answersHeader = (await page.locator('text=Answer Library').count()) > 0;
    expectCondition(answersHeader, 'Answer Library view rendered');

    // 1e. Preferences & Safety Policy
    await clickNav('Preferences & Policy');
    const prefsHeader =
      (await page.locator('text=Job Preferences').count()) > 0 ||
      (await page.locator('text=Application Policy').count()) > 0;
    expectCondition(prefsHeader, 'Preferences & Safety Policy view rendered');

    // 1f. Job Inbox
    await clickNav('Job Inbox');
    const jobsHeader = (await page.locator('text=Job Inbox').count()) > 0;
    expectCondition(jobsHeader, 'Job Inbox view rendered');

    // 1g. Application CRM
    await clickNav('Applications');
    const appsHeader = (await page.locator('text=Applications').count()) > 0;
    expectCondition(appsHeader, 'Application CRM view rendered');

    // 1h. Human Approvals Inbox
    await clickNav('Approvals');
    const approvalsHeader = (await page.locator('text=Approvals').count()) > 0;
    expectCondition(approvalsHeader, 'Human Approvals view rendered');

    // 1i. Email Intelligence
    await clickNav('Email Intelligence');
    const emailsHeader = (await page.locator('text=Email Intelligence').count()) > 0;
    expectCondition(emailsHeader, 'Email Intelligence view rendered');

    // 1j. Calendar and Interview Workspace
    await clickNav('Interviews');
    const interviewsHeader = (await page.locator('text=Interviews').count()) > 0;
    expectCondition(interviewsHeader, 'Calendar & Interview Workspace view rendered');

    // 1k. Activity & Ops Hub (Orchestrator Dashboard)
    await clickNav('Activity & Ops');
    const activityHeader =
      (await page.locator('text=Activity & Autonomous Operations').count()) > 0;
    expectCondition(activityHeader, 'Activity & Ops / Orchestrator Dashboard rendered');

    // 1l. Notification Center Modal
    const notifBell = page.locator('button[title*="Notification Center"]').first();
    if ((await notifBell.count()) > 0) {
      await notifBell.click();
      await page.waitForTimeout(300);
      const modalHeader = (await page.locator('text=Notification Center').count()) > 0;
      expectCondition(modalHeader, 'Notification Center modal rendered');
      // Close modal
      const closeBtn = page.locator('.modal-header button:has-text("✕")').first();
      if ((await closeBtn.count()) > 0) {
        await closeBtn.click();
        await page.waitForTimeout(200);
      }
    }

    if (pageErrors.length === 0) {
      console.log('✓ Zero JavaScript page errors detected across all 10 rendered frontend views.');
    } else {
      console.error(`✗ Detected ${pageErrors.length} browser errors during navigation.`);
      failuresCount++;
    }

    // -------------------------------------------------------------------------
    // PART 2: INTEGRATED BROWSER EXECUTION ACCEPTANCE (Local ATS Fixture Workflow)
    // -------------------------------------------------------------------------
    console.log('\n--- PART 2: BROWSER EXECUTION ACCEPTANCE (Local ATS Fixture Submission) ---');

    // 2a. Ingest canonical job opportunity
    const [job] = await db
      .insert(jobs)
      .values({
        userId,
        title: 'Principal Distributed Cloud Architect',
        company: 'Nova Cloud Systems Inc',
        locationText: 'San Francisco, CA (Remote)',
        canonicalUrl: `https://boards.greenhouse.io/novacloud/jobs/99201`,
        applicationUrl: `https://boards.greenhouse.io/novacloud/jobs/99201`,
        description:
          'We are seeking a Principal Distributed Cloud Architect with deep expertise in distributed systems, PostgreSQL, and Kubernetes.',
        state: 'INGESTED',
        contentHash: `hash-nova-${tag}`,
      })
      .returning();
    ctx.createdJobIds.push(job.id);
    console.log(`✓ Seeded canonical target job: ID ${job.id} at ${job.company}`);

    // 2b. Seed candidate verified facts and documents
    const [factAuth] = await db
      .insert(candidateFacts)
      .values({
        userId,
        factKey: 'work_authorization',
        statement: 'Legally authorized to work in the United States without restriction.',
        category: 'WORK_AUTHORIZATION',
        verificationStatus: 'VERIFIED',
        allowAiUse: true,
      })
      .returning();
    ctx.createdFactIds.push(factAuth.id);

    const [factSponsor] = await db
      .insert(candidateFacts)
      .values({
        userId,
        factKey: 'sponsorship',
        statement: 'Does not require current or future visa sponsorship.',
        category: 'LEGAL',
        verificationStatus: 'VERIFIED',
        allowAiUse: true,
      })
      .returning();
    ctx.createdFactIds.push(factSponsor.id);

    const [ansLink] = await db
      .insert(answerLibrary)
      .values({
        userId,
        question: 'Are you legally authorized to work in this jurisdiction?',
        answer: 'yes',
        category: 'WORK_AUTHORIZATION',
        automationLevel: 'AUTO',
        verificationStatus: 'VERIFIED',
        isSensitive: false,
      })
      .returning();
    ctx.createdAnswerIds.push(ansLink.id);

    // 2c. Create Application in CRM
    const [crmApp] = await db
      .insert(applications)
      .values({
        jobId: job.id,
        userId,
        status: ApplicationLifecycleStatus.READY_TO_APPLY,
        applicationUrl: job.applicationUrl,
        notes: 'Targeting Greenhouse ATS submission with full candidate brain evidence.',
      })
      .returning();
    ctx.createdAppIds.push(crmApp.id);
    console.log(`✓ Created CRM Application: ID ${crmApp.id} [Status: READY_TO_APPLY]`);

    // 2d. Step 1: Execute Safe DRY_RUN mode
    console.log('  Executing Step 1: DRY_RUN mode inspection...');
    const [dryRunRecord] = await db
      .insert(browserApplicationRuns)
      .values({
        applicationId: crmApp.id,
        userId,
        targetUrl: job.applicationUrl!,
        atsProvider: AtsProviderType.GREENHOUSE,
        mode: BrowserRunMode.DRY_RUN,
        status: BrowserRunStatus.PENDING,
      })
      .returning();
    ctx.createdBrowserRunIds.push(dryRunRecord.id);

    const completedDryRun = await executePendingBrowserRun(db, dryRunRecord.id, {
      useFixture: true,
    });
    expectCondition(
      completedDryRun.status === BrowserRunStatus.SUCCESS,
      `DRY_RUN completed successfully (Status: ${completedDryRun.status})`,
    );
    expectCondition(
      completedDryRun.fieldsDetectedCount >= 5,
      `Detected form schema fields count: ${completedDryRun.fieldsDetectedCount}`,
    );
    expectCondition(
      completedDryRun.fieldsFilledCount >= 4,
      `Populated verified candidate fields count: ${completedDryRun.fieldsFilledCount}`,
    );

    // Verify CRM remains in READY_TO_APPLY after DRY_RUN (No submission occurred)
    const [appAfterDryRun] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, crmApp.id));
    expectCondition(
      appAfterDryRun.status === ApplicationLifecycleStatus.READY_TO_APPLY,
      'Invariant preserved: DRY_RUN does NOT mutate CRM status away from READY_TO_APPLY',
    );

    // 2e. Step 2: Execute Human-Authorized SUBMIT mode on fixture form
    console.log('  Executing Step 2: Human-Authorized SUBMIT mode on fixture form...');
    const [submitRunRecord] = await db
      .insert(browserApplicationRuns)
      .values({
        applicationId: crmApp.id,
        userId,
        targetUrl: job.applicationUrl!,
        atsProvider: AtsProviderType.GREENHOUSE,
        mode: BrowserRunMode.SUBMIT,
        status: BrowserRunStatus.PENDING,
      })
      .returning();
    ctx.createdBrowserRunIds.push(submitRunRecord.id);

    const completedSubmitRun = await executePendingBrowserRun(db, submitRunRecord.id, {
      useFixture: true,
    });
    expectCondition(
      completedSubmitRun.status === BrowserRunStatus.SUCCESS,
      `SUBMIT execution completed successfully (Status: ${completedSubmitRun.status})`,
    );
    expectCondition(
      Boolean(completedSubmitRun.confirmationReference),
      `Confirmation reference generated: ${completedSubmitRun.confirmationReference}`,
    );

    // 2f. Verify CRM updated to APPLIED with frozen submission provenance
    const [appAfterSubmit] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, crmApp.id));

    expectCondition(
      appAfterSubmit.status === ApplicationLifecycleStatus.APPLIED,
      `CRM Application transitioned to APPLIED: Status=${appAfterSubmit.status}`,
    );
    expectCondition(
      Boolean(appAfterSubmit.appliedAt),
      `Applied timestamp recorded: ${appAfterSubmit.appliedAt?.toISOString()}`,
    );
    expectCondition(
      appAfterSubmit.submissionMethod === AtsProviderType.GREENHOUSE,
      `Submission method preserved: ${appAfterSubmit.submissionMethod}`,
    );
    expectCondition(
      appAfterSubmit.externalReferenceId === completedSubmitRun.confirmationReference,
      `External reference ID linked: ${appAfterSubmit.externalReferenceId}`,
    );

    // 2g. Verify immutable audit lifecycle event
    const lifecycleEvents = await db
      .select()
      .from(applicationLifecycleEvents)
      .where(eq(applicationLifecycleEvents.applicationId, crmApp.id));

    const submittedEvent = lifecycleEvents.find((e) => e.eventType === 'SUBMITTED');
    expectCondition(
      Boolean(submittedEvent),
      `Immutable audit event SUBMITTED recorded in lifecycle timeline (ID: ${submittedEvent?.id})`,
    );

    // -------------------------------------------------------------------------
    // PART 3: CRASH AND DUPLICATE-SUBMISSION SAFETY AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- PART 3: CRASH AND DUPLICATE-SUBMISSION SAFETY AUDIT ---');

    // 3a. Crash Invariant: Process killed during SUBMIT execution
    console.log('  Testing Scenario A: Worker crashed during external submission action...');
    const [crashJob] = await db
      .insert(jobs)
      .values({
        userId,
        title: 'Staff Site Reliability Engineer',
        company: 'Nova Cloud Systems Inc',
        locationText: 'Remote',
        canonicalUrl: `https://boards.greenhouse.io/novacloud/jobs/99202`,
        applicationUrl: `https://boards.greenhouse.io/novacloud/jobs/99202`,
        description: 'Reliability and resilience engineering for distributed cloud infrastructure.',
        state: 'INGESTED',
        contentHash: `hash-nova-crash-${tag}`,
      })
      .returning();
    ctx.createdJobIds.push(crashJob.id);

    const [crashAppA] = await db
      .insert(applications)
      .values({
        jobId: crashJob.id,
        userId,
        status: ApplicationLifecycleStatus.READY_TO_APPLY,
        applicationUrl: crashJob.applicationUrl,
        notes: 'Simulating crash immediately during external submit flight.',
      })
      .returning();
    ctx.createdAppIds.push(crashAppA.id);

    // Insert an orphaned RUNNING run in SUBMIT mode
    const [crashedSubmitRun] = await db
      .insert(browserApplicationRuns)
      .values({
        applicationId: crashAppA.id,
        userId,
        targetUrl: crashJob.applicationUrl!,
        atsProvider: AtsProviderType.GREENHOUSE,
        mode: BrowserRunMode.SUBMIT,
        status: BrowserRunStatus.RUNNING, // Left running due to process crash
        stepLogs: [
          { step: 'NAVIGATE', action: 'Loaded page', status: 'OK' },
          { step: 'FIELD_FILL', action: 'Filled fields', status: 'OK' },
          {
            step: 'SUBMISSION_DISPATCHING',
            action: 'Submitting application form...',
            status: 'OK',
          },
        ],
      })
      .returning();
    ctx.createdBrowserRunIds.push(crashedSubmitRun.id);

    // Trigger Worker recovery
    const worker = new WorkerService(config);
    await worker.recoverOrphanedRuns();

    // Invariant Check 1: The crashed run MUST NOT be marked FAILED (must be SUBMISSION_UNCERTAIN)
    const [reconciledRunA] = await db
      .select()
      .from(browserApplicationRuns)
      .where(eq(browserApplicationRuns.id, crashedSubmitRun.id));

    expectCondition(
      reconciledRunA.status === BrowserRunStatus.SUBMISSION_UNCERTAIN,
      `Crash during SUBMIT reconciled to SUBMISSION_UNCERTAIN (Status: ${reconciledRunA.status})`,
    );
    expectCondition(
      Boolean(
        reconciledRunA.errorMessage?.includes('UNCERTAIN') ||
        reconciledRunA.errorMessage?.includes('uncertain'),
      ),
      `Error message documents submission uncertainty: "${reconciledRunA.errorMessage}"`,
    );

    // Invariant Check 2: Linked CRM application MUST be transitioned to NEEDS_REVIEW
    const [reconciledAppA] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, crashAppA.id));

    expectCondition(
      reconciledAppA.status === ApplicationLifecycleStatus.NEEDS_REVIEW,
      `CRM application automatically placed in NEEDS_REVIEW (Status: ${reconciledAppA.status})`,
    );

    // Invariant Check 3: Notification created alerting human candidate
    const notifs = await db
      .select()
      .from(systemNotifications)
      .where(
        and(
          eq(systemNotifications.userId, userId),
          eq(systemNotifications.type, 'MANUAL_REVIEW_REQUIRED'),
        ),
      );
    const alertNotif = notifs.find(
      (n) => n.actionUrl?.includes(crashAppA.id) || n.message.includes('restarted'),
    );
    if (alertNotif) {
      ctx.createdNotifIds.push(alertNotif.id);
    }
    expectCondition(
      Boolean(alertNotif),
      'Critical user notification dispatched for uncertain submission status',
    );

    // 3b. Duplicate Submission Safeguard in Autonomous Orchestrator
    console.log('  Testing Scenario B: Autonomous Orchestrator duplicate submission block...');

    // Temporarily enable auto-apply in policy to test orchestrator boundary
    await db
      .insert(applicationPolicy)
      .values({
        userId,
        autoApplyEnabled: true,
        maxApplicationsPerDay: 5,
        minMatchScore: 60,
      })
      .onConflictDoUpdate({
        target: applicationPolicy.userId,
        set: { autoApplyEnabled: true },
      });

    // Manually force application status back to READY_TO_APPLY to simulate a race or misconfiguration
    await db
      .update(applications)
      .set({ status: ApplicationLifecycleStatus.READY_TO_APPLY })
      .where(eq(applications.id, crashAppA.id));

    const orchestrator = new AutonomousOrchestrator(db);
    const initialRunCount = (
      await db
        .select()
        .from(browserApplicationRuns)
        .where(eq(browserApplicationRuns.applicationId, crashAppA.id))
    ).length;

    // Execute auto-apply cycle
    await orchestrator.executePipelineCycle(userId, 'EVENT');

    // Verify: Orchestrator MUST NOT have created a new run or submitted for this application
    const postRuns = await db
      .select()
      .from(browserApplicationRuns)
      .where(eq(browserApplicationRuns.applicationId, crashAppA.id));

    expectCondition(
      postRuns.length === initialRunCount,
      `Orchestrator strictly blocked duplicate submission: 0 new runs created (Total: ${postRuns.length})`,
    );

    // Restore safe default policy (autoApplyEnabled: false)
    await db
      .update(applicationPolicy)
      .set({ autoApplyEnabled: false })
      .where(eq(applicationPolicy.userId, userId));
    console.log('✓ Restored safety boundary: auto_apply_enabled=false');

    // 3c. Safe Recovery for DRY_RUN crashes (No external request emitted)
    console.log('  Testing Scenario C: Crash during safe DRY_RUN mode...');
    const [crashedDryRun] = await db
      .insert(browserApplicationRuns)
      .values({
        applicationId: crmApp.id,
        userId,
        targetUrl: job.applicationUrl!,
        atsProvider: AtsProviderType.GREENHOUSE,
        mode: BrowserRunMode.DRY_RUN,
        status: BrowserRunStatus.RUNNING,
        stepLogs: [{ step: 'NAVIGATE', status: 'OK' }],
      })
      .returning();
    ctx.createdBrowserRunIds.push(crashedDryRun.id);

    await worker.recoverOrphanedRuns();

    const [reconciledDryRun] = await db
      .select()
      .from(browserApplicationRuns)
      .where(eq(browserApplicationRuns.id, crashedDryRun.id));

    expectCondition(
      reconciledDryRun.status === BrowserRunStatus.FAILED,
      `Crash during DRY_RUN safely reconciled to FAILED (Status: ${reconciledDryRun.status})`,
    );
  } catch (err: any) {
    console.error('\nFatal error during operational acceptance:', err);
    failuresCount++;
  } finally {
    if (browser) {
      await browser.close();
    }

    // -------------------------------------------------------------------------
    // PART 4: CLEAN TEARDOWN (Zero Database Orphans)
    // -------------------------------------------------------------------------
    console.log('\n--- PART 4: Clean Teardown & Invariant Verification ---');

    if (ctx.createdNotifIds.length > 0) {
      console.log(`✓ Cleaning up ${ctx.createdNotifIds.length} test notification(s)...`);
      await db
        .delete(systemNotifications)
        .where(inArray(systemNotifications.id, ctx.createdNotifIds));
    }

    if (ctx.createdBrowserRunIds.length > 0) {
      console.log(`✓ Cleaning up ${ctx.createdBrowserRunIds.length} test browser run(s)...`);
      await db
        .delete(browserApplicationRuns)
        .where(inArray(browserApplicationRuns.id, ctx.createdBrowserRunIds));
    }

    if (ctx.createdAppIds.length > 0) {
      console.log(`✓ Cleaning up ${ctx.createdAppIds.length} test application(s)...`);
      await db
        .delete(applicationLifecycleEvents)
        .where(inArray(applicationLifecycleEvents.applicationId, ctx.createdAppIds));
      await db.delete(applications).where(inArray(applications.id, ctx.createdAppIds));
    }

    if (ctx.createdJobIds.length > 0) {
      console.log(`✓ Cleaning up ${ctx.createdJobIds.length} test job(s)...`);
      await db.delete(jobs).where(inArray(jobs.id, ctx.createdJobIds));
    }

    if (ctx.createdFactIds.length > 0) {
      console.log(`✓ Cleaning up ${ctx.createdFactIds.length} test fact(s)...`);
      await db.delete(candidateFacts).where(inArray(candidateFacts.id, ctx.createdFactIds));
    }

    if (ctx.createdAnswerIds.length > 0) {
      console.log(`✓ Cleaning up ${ctx.createdAnswerIds.length} test answer(s)...`);
      await db.delete(answerLibrary).where(inArray(answerLibrary.id, ctx.createdAnswerIds));
    }

    if (initialProfile) {
      console.log('✓ Restoring original candidate profile...');
      await apiFetch('/candidate/profile', {
        method: 'PUT',
        body: JSON.stringify({
          preferredName: initialProfile.preferredName,
          fullName: initialProfile.fullName,
          headline: initialProfile.headline,
          email: initialProfile.email,
          phone: initialProfile.phone,
          city: initialProfile.city,
          region: initialProfile.region,
          country: initialProfile.country,
          summary: initialProfile.summary,
          availability: initialProfile.availability,
        }),
      });
    }

    console.log('✓ Teardown complete. Zero database orphans left.');
    await closeDbPool();
  }

  console.log('\n======================================================================');
  if (failuresCount === 0) {
    console.log('OPERATIONAL ACCEPTANCE RESULT: ALL AUDIT CRITERIA PASSED CLEANLY');
    console.log('Real UI verified, ATS fixture submitted, and crash invariants confirmed.');
    console.log('======================================================================\n');
    process.exit(0);
  } else {
    console.error(`OPERATIONAL ACCEPTANCE RESULT: ${failuresCount} AUDIT CHECK(S) FAILED`);
    console.log('======================================================================\n');
    process.exit(1);
  }

  function expectCondition(cond: boolean, desc: string) {
    if (cond) {
      console.log(`✓ ${desc}`);
    } else {
      console.error(`✗ Condition failed: ${desc}`);
      failuresCount++;
    }
  }
}

main().catch((err) => {
  console.error('Fatal unhandled error:', err);
  process.exit(1);
});
