import crypto from 'node:crypto';
import {
  getDb,
  closeDbPool,
  users,
  jobs,
  applications,
  candidateProfiles,
  candidateLinks,
  candidateDocuments,
  answerLibrary,
  browserApplicationRuns,
  sessions,
  assertSafeTestDatabase,
  assertSafeTestUser,
  assertScopedCleanup,
} from '@job-agent/database';
import { inArray, eq } from 'drizzle-orm';
import {
  AtsProviderType,
  BrowserRunMode,
  BrowserRunStatus,
  type ApplicationSubmissionPayload,
} from '@job-agent/shared';
import { getConfig } from '@job-agent/config';
import { FixtureBrowserController } from '../apps/worker/src/browser/fixture-browser-controller.js';
import { AtsAdapterRegistry } from '../apps/worker/src/adapters/ats-adapter-registry.js';
import { BrowserApplicationEngine } from '../apps/worker/src/engine/browser-application-engine.js';
import { executePendingBrowserRun } from '../apps/worker/src/services/browser-runner.js';
import { WorkerService } from '../apps/worker/src/worker.js';
import { buildApp } from '../apps/api/src/app.js';

async function main() {
  console.log('===============================================================');
  console.log('JOB-P5-T01 — LIVE POSTGRESQL DETERMINISTIC VERIFICATION SUITE');
  console.log('Browser Application Worker & Initial ATS Adapters');
  console.log('===============================================================\n');

  const config = getConfig();
  const testDbUrl =
    process.env.TEST_DATABASE_URL ||
    (config.DATABASE_URL
      ? config.DATABASE_URL.replace(/\/[^/]+$/, '/jobee_test_isolated')
      : 'postgresql://bek@localhost:5432/jobee_test_isolated');
  assertSafeTestDatabase(testDbUrl);
  let db = getDb(testDbUrl);
  const tag = `live-p5t01-${Date.now()}`;

  // Isolation Guard: ALWAYS create a dedicated disposable test user
  const testUserId = crypto.randomUUID();
  const [testUser] = await db
    .insert(users)
    .values({
      id: testUserId,
      systemKey: `test_p5t01_${Date.now()}`,
      name: 'Dr. Jane Hopper',
      email: `test-jane-hopper-${Date.now()}@example.com`,
      emailVerified: true,
      role: 'user',
    })
    .returning();
  const userId = testUser.id;
  assertSafeTestUser(userId);

  const createdJobIds: string[] = [];
  const createdAppIds: string[] = [];
  const createdRunIds: string[] = [];
  const createdDocIds: string[] = [];
  const createdAnsIds: string[] = [];
  const createdLinkIds: string[] = [];

  let fastifyApp: ReturnType<typeof buildApp> | null = null;

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: Database Migration & Schema Hygiene
    // -------------------------------------------------------------------------
    console.log('--- SECTION 1: Database Migration & Schema Hygiene ---');
    const existingRuns = await db.select().from(browserApplicationRuns).limit(1);
    console.log(
      `✓ Table 'browser_application_runs' is queryable in PostgreSQL (current count check: ${existingRuns.length >= 0 ? 'OK' : 'FAIL'})`,
    );

    // -------------------------------------------------------------------------
    // SECTION 2: ATS Adapters & Registry Resolution
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 2: ATS Adapters & Registry Dispatch ---');
    const registry = new AtsAdapterRegistry();
    const ghAdapter = registry.resolveAdapter('https://boards.greenhouse.io/stripe/jobs/123');
    const leverAdapter = registry.resolveAdapter('https://jobs.lever.co/netflix/456');
    const ashbyAdapter = registry.resolveAdapter('https://jobs.ashbyhq.com/openai/789');
    const genericAdapter = registry.resolveAdapter('https://unknown-company.careers/apply');

    if (ghAdapter.provider !== AtsProviderType.GREENHOUSE)
      throw new Error('Greenhouse adapter resolution failed');
    if (leverAdapter.provider !== AtsProviderType.LEVER)
      throw new Error('Lever adapter resolution failed');
    if (ashbyAdapter.provider !== AtsProviderType.ASHBY)
      throw new Error('Ashby adapter resolution failed');
    if (genericAdapter.provider !== AtsProviderType.OTHER)
      throw new Error('Generic adapter fallback failed');
    console.log(`✓ Resolved ATS providers accurately: Greenhouse, Lever, Ashby, Other`);

    // -------------------------------------------------------------------------
    // SECTION 3: Fixture Form Extraction & Challenge Detection
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Form Extraction & Bot Challenge Detection ---');
    const controller = new FixtureBrowserController();
    const page = await controller.newPage();

    // 3A. Greenhouse form extraction
    await page.goto('https://boards.greenhouse.io/stripe/jobs/123');
    const ghSchema = await ghAdapter.extractForm(page);
    console.log(
      `✓ Greenhouse form extracted: ${ghSchema.fields.length} fields detected (resume upload: ${ghSchema.hasResumeUpload})`,
    );

    // 3B. Bot challenge detection
    await page.goto('https://example.com/captcha-test');
    const challenge = await ghAdapter.detectChallenge(page);
    if (!challenge.detected || challenge.type !== 'RECAPTCHA') {
      throw new Error(
        `Expected RECAPTCHA challenge detection, received: ${JSON.stringify(challenge)}`,
      );
    }
    console.log(
      `✓ Security invariant passed: Bot challenge detected (${challenge.type}: ${challenge.selector})`,
    );
    await page.close();

    // -------------------------------------------------------------------------
    // SECTION 4: Setup Candidate Brain Evidence in PostgreSQL
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Setup Candidate Brain Facts & Answer Library ---');
    // Ensure profile
    await db
      .insert(candidateProfiles)
      .values({
        userId,
        fullName: 'Dr. Jane Hopper',
        preferredName: 'Jane',
        email: 'jane.hopper@example.com',
        phone: '+1 555-0144',
        city: 'Seattle',
        region: 'WA',
        country: 'US',
      })
      .onConflictDoUpdate({
        target: candidateProfiles.userId,
        set: {
          fullName: 'Dr. Jane Hopper',
          email: 'jane.hopper@example.com',
          phone: '+1 555-0144',
        },
      });

    // Add candidate link
    const [link] = await db
      .insert(candidateLinks)
      .values({
        userId,
        label: 'LinkedIn',
        url: 'https://linkedin.com/in/janehopper',
      })
      .returning();
    createdLinkIds.push(link.id);

    // Add resume document
    const [doc] = await db
      .insert(candidateDocuments)
      .values({
        userId,
        documentType: 'MASTER_CV',
        displayName: 'Jane Hopper Resume',
        originalFilename: 'jane-hopper-resume.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10240,
        storageKey: 'vault/resumes/jane-hopper-resume.pdf',
      })
      .returning();
    createdDocIds.push(doc.id);

    // Add verified answer library entry for work authorization
    const [ans1] = await db
      .insert(answerLibrary)
      .values({
        userId,
        question: 'Are you legally authorized to work in this jurisdiction?',
        category: 'WORK_AUTHORIZATION',
        answer: 'yes',
        verificationStatus: 'VERIFIED',
      })
      .returning();
    createdAnsIds.push(ans1.id);

    const [ans2] = await db
      .insert(answerLibrary)
      .values({
        userId,
        question: 'Will you now or in the future require visa sponsorship?',
        category: 'SPONSORSHIP',
        answer: 'No',
        verificationStatus: 'VERIFIED',
      })
      .returning();
    createdAnsIds.push(ans2.id);

    console.log(
      `✓ Candidate Brain evidence established: Profile, Links, Resume vault item, and Answer Library`,
    );

    // -------------------------------------------------------------------------
    // SECTION 5: Create Test Job & Application in PostgreSQL
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Setup Tracked Job & Application ---');
    const [testJob] = await db
      .insert(jobs)
      .values({
        userId,
        title: 'Principal Systems Architect',
        company: 'Apex Cloud Solutions',
        description: 'Design resilient distributed infrastructure.',
        applicationUrl: 'https://boards.greenhouse.io/apexcloud/jobs/554433',
        contentHash: `${tag}-job-1`,
      })
      .returning();
    createdJobIds.push(testJob.id);

    const [testApp] = await db
      .insert(applications)
      .values({
        userId,
        jobId: testJob.id,
        status: 'READY_TO_APPLY',
        applicationUrl: 'https://boards.greenhouse.io/apexcloud/jobs/554433',
      })
      .returning();
    createdAppIds.push(testApp.id);
    console.log(`✓ Application established (ID: ${testApp.id}) targeting Greenhouse form`);

    // -------------------------------------------------------------------------
    // SECTION 6: DRY_RUN Mode Execution (Engine + PostgreSQL)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 6: DRY_RUN Mode Execution & Prime Directive Audit ---');
    const engine = new BrowserApplicationEngine(controller, registry, db);
    const dryRunPayload: ApplicationSubmissionPayload = {
      firstName: 'Jane',
      lastName: 'Hopper',
      fullName: 'Jane Hopper',
      email: 'jane.hopper@example.com',
      phone: '+1 555-0144',
      location: 'Seattle, WA',
      urls: {
        linkedin: 'https://linkedin.com/in/janehopper',
      },
      resumeFileName: 'jane-hopper-resume.pdf',
      answers: {
        work_authorization: {
          answerText: 'yes',
          isSensitive: false,
          verificationStatus: 'VERIFIED',
        },
      },
    };

    const dryRunResult = await engine.executeRun({
      applicationId: testApp.id,
      userId,
      targetUrl: 'https://boards.greenhouse.io/apexcloud/jobs/554433',
      mode: BrowserRunMode.DRY_RUN,
      payload: dryRunPayload,
      skipDb: false,
    });
    createdRunIds.push(dryRunResult.id);

    if (dryRunResult.status !== BrowserRunStatus.SUCCESS) {
      throw new Error(
        `Expected SUCCESS in DRY_RUN, got: ${dryRunResult.status} (${dryRunResult.errorMessage})`,
      );
    }
    if (dryRunResult.fieldsFilledCount === 0) {
      throw new Error('Expected at least 1 field filled');
    }
    const hasDryRunStep = dryRunResult.stepLogs.some((l) => l.step === 'DRY_RUN');
    const hasSubmitStep = dryRunResult.stepLogs.some((l) => l.step === 'SUBMISSION');
    if (!hasDryRunStep || hasSubmitStep) {
      throw new Error('DRY_RUN mode invariant violated: must complete without submission');
    }
    console.log(
      `✓ DRY_RUN completed: ${dryRunResult.fieldsFilledCount} fields filled, form validated without submission`,
    );

    // -------------------------------------------------------------------------
    // SECTION 7: Invariant Enforcement: Halt on Missing Required Facts
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 7: Prime Directive Invariant: Halt on Missing Required Facts ---');
    const incompletePayload: ApplicationSubmissionPayload = {
      ...dryRunPayload,
      answers: {}, // Stripped all answers
    };

    const haltedRunResult = await engine.executeRun({
      applicationId: testApp.id,
      userId,
      targetUrl: 'https://boards.greenhouse.io/apexcloud/jobs/554433',
      mode: BrowserRunMode.DRY_RUN,
      payload: incompletePayload,
      skipDb: false,
    });
    createdRunIds.push(haltedRunResult.id);

    if (haltedRunResult.status !== BrowserRunStatus.STOPPED_MANUAL_REVIEW) {
      throw new Error(`Expected STOPPED_MANUAL_REVIEW, got: ${haltedRunResult.status}`);
    }
    if (haltedRunResult.unmatchedRequiredFields.length === 0) {
      throw new Error('Expected unmatchedRequiredFields to list missing required fields');
    }
    console.log(
      `✓ Prime Directive invariant verified: Halts with STOPPED_MANUAL_REVIEW (${haltedRunResult.errorMessage})`,
    );

    // -------------------------------------------------------------------------
    // SECTION 8: Invariant Enforcement: Halt on Bot Challenge
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 8: Bot Challenge Invariant: Halt on Security Challenge ---');
    const challengeRunResult = await engine.executeRun({
      applicationId: testApp.id,
      userId,
      targetUrl: 'https://example.com/captcha-test',
      mode: BrowserRunMode.DRY_RUN,
      payload: dryRunPayload,
      skipDb: false,
    });
    createdRunIds.push(challengeRunResult.id);

    if (challengeRunResult.status !== BrowserRunStatus.STOPPED_CAPTCHA) {
      throw new Error(`Expected STOPPED_CAPTCHA, got: ${challengeRunResult.status}`);
    }
    console.log(
      `✓ Security invariant verified: Halts with STOPPED_CAPTCHA on encountering bot verification`,
    );

    // -------------------------------------------------------------------------
    // SECTION 9: Worker Service Background Polling & Runner Execution
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 9: Worker Background Service & Runner Pipeline ---');
    // Queue a pending run directly in database
    const [queuedRun] = await db
      .insert(browserApplicationRuns)
      .values({
        id: crypto.randomUUID(),
        applicationId: testApp.id,
        userId,
        atsProvider: AtsProviderType.GREENHOUSE,
        targetUrl: 'https://boards.greenhouse.io/apexcloud/jobs/554433',
        mode: BrowserRunMode.DRY_RUN,
        status: BrowserRunStatus.PENDING,
        fieldsDetectedCount: 0,
        fieldsFilledCount: 0,
        unmatchedRequiredFields: [],
        stepLogs: [
          {
            step: 'QUEUED',
            action: 'Queued via API',
            timestamp: new Date().toISOString(),
            status: 'OK',
          },
        ],
        screenshotPaths: [],
      })
      .returning();
    createdRunIds.push(queuedRun.id);

    // Execute via executePendingBrowserRun
    const processedRun = await executePendingBrowserRun(db, queuedRun.id, {
      controller,
      useFixture: true,
    });

    if (processedRun.status !== BrowserRunStatus.SUCCESS) {
      throw new Error(
        `Expected processed run SUCCESS, got: ${processedRun.status} (${processedRun.errorMessage})`,
      );
    }
    console.log(
      `✓ Runner pipeline executed pending run ${queuedRun.id.slice(0, 8)} -> status: ${processedRun.status}`,
    );

    // Verify WorkerService standby heartbeat
    const worker = new WorkerService({ ...config, DATABASE_URL: testDbUrl });
    await worker.start();
    const workerStatus = worker.getStatus();
    if (!workerStatus.isRunning) throw new Error('Expected worker service to be running');
    await worker.stop();
    console.log('✓ Background WorkerService lifecycle verified (standby start & graceful stop)');

    // Re-acquire db connection pool after worker shutdown
    db = getDb(testDbUrl);

    // -------------------------------------------------------------------------
    // SECTION 10: Fastify API Endpoints Verification
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 10: Fastify REST API Routes Verification ---');
    fastifyApp = buildApp({ config, db });
    await fastifyApp.ready();

    const testSessionToken = `p5t01-sess-${Date.now()}`;
    await db.insert(sessions).values({
      id: `sess-${Date.now()}`,
      userId,
      token: testSessionToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const sessionHeaders = {
      cookie: `better-auth.session_token=${testSessionToken}`,
    };

    // 10A. POST /api/applications/:id/browser-runs
    const postRes = await fastifyApp.inject({
      method: 'POST',
      url: `/api/applications/${testApp.id}/browser-runs`,
      headers: sessionHeaders,
      payload: { mode: BrowserRunMode.DRY_RUN },
    });
    if (postRes.statusCode !== 201) {
      throw new Error(`Expected 201, got ${postRes.statusCode}: ${postRes.body}`);
    }
    const postBody = postRes.json();
    const apiRunId = postBody.data.id;
    createdRunIds.push(apiRunId);
    console.log(
      `✓ POST /api/applications/:id/browser-runs returned 201 (Run ID: ${apiRunId.slice(0, 8)})`,
    );

    // 10B. GET /api/applications/:id/browser-runs
    const listRes = await fastifyApp.inject({
      method: 'GET',
      url: `/api/applications/${testApp.id}/browser-runs`,
      headers: sessionHeaders,
    });
    if (listRes.statusCode !== 200) {
      throw new Error(`Expected 200, got ${listRes.statusCode}: ${listRes.body}`);
    }
    const listBody = listRes.json();
    if (!Array.isArray(listBody.data) || listBody.data.length === 0) {
      throw new Error('Expected non-empty list of browser runs');
    }
    console.log(`✓ GET /api/applications/:id/browser-runs returned ${listBody.data.length} runs`);

    // 10C. GET /api/browser-runs/:runId
    const getRes = await fastifyApp.inject({
      method: 'GET',
      url: `/api/browser-runs/${apiRunId}`,
      headers: sessionHeaders,
    });
    if (getRes.statusCode !== 200) {
      throw new Error(`Expected 200, got ${getRes.statusCode}: ${getRes.body}`);
    }
    const getBody = getRes.json();
    if (getBody.data.id !== apiRunId) {
      throw new Error('Run ID mismatch in GET /api/browser-runs/:runId');
    }
    console.log(`✓ GET /api/browser-runs/:runId returned detailed run with audit step logs`);

    console.log('\n===============================================================');
    console.log('JOB-P5-T01 VERIFICATION SUCCESS: 10/10 SECTIONS PASSED CLEANLY');
    console.log('===============================================================');
  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED:', error);
    process.exitCode = 1;
  } finally {
    console.log('\n--- Teardown: Purging Isolated Test Records ---');
    if (fastifyApp) {
      await fastifyApp.close();
    }
    assertScopedCleanup({ userId, ids: createdJobIds.concat(createdAppIds, createdRunIds) });
    if (createdRunIds.length > 0) {
      await db
        .delete(browserApplicationRuns)
        .where(inArray(browserApplicationRuns.id, createdRunIds));
      console.log(`• Cleaned up ${createdRunIds.length} browser run records`);
    }
    if (createdAppIds.length > 0) {
      await db.delete(applications).where(inArray(applications.id, createdAppIds));
      console.log(`• Cleaned up ${createdAppIds.length} application records`);
    }
    if (createdJobIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
      console.log(`• Cleaned up ${createdJobIds.length} job records`);
    }
    if (createdAnsIds.length > 0) {
      await db.delete(answerLibrary).where(inArray(answerLibrary.id, createdAnsIds));
      console.log(`• Cleaned up ${createdAnsIds.length} answer library records`);
    }
    if (createdDocIds.length > 0) {
      await db.delete(candidateDocuments).where(inArray(candidateDocuments.id, createdDocIds));
      console.log(`• Cleaned up ${createdDocIds.length} document vault records`);
    }
    if (createdLinkIds.length > 0) {
      await db.delete(candidateLinks).where(inArray(candidateLinks.id, createdLinkIds));
      console.log(`• Cleaned up ${createdLinkIds.length} candidate link records`);
    }
    if (userId) {
      await db.delete(sessions).where(eq(sessions.userId, userId));
      await db.delete(candidateProfiles).where(eq(candidateProfiles.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
      console.log('• Cleaned up isolated test user, session, and test profile');
    }
    await closeDbPool();
    console.log('• Database pool closed successfully.');
  }
}

void main();
