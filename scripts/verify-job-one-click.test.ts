import { AutopilotService } from '../apps/api/src/services/autopilot-service.js';
import { ApplicationCrmService } from '../apps/api/src/services/application-crm-service.js';
import { OrchestratorService } from '../apps/api/src/services/orchestrator/orchestrator-service.js';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  getDb,
  users,
  jobs,
  candidateProfiles,
  candidateSkills,
  jobPreferences,
  applicationPolicy,
  jobRequirements,
  applications,
  applicationIntents,
  browserApplicationRuns,
  answerLibrary,
  applicationArtifacts,
  eq,
  assertSafeTestDatabase,
  assertSafeTestUser,
  assertAutopilotGrant,
  BrowserWorkerService,
  orchestrationRuns,
  preparationBatches,
  preparationItems,
} from '@job-agent/database';
import { MatchService, DisabledAiProvider } from '@job-agent/database/matching';
import { AUTOPILOT_TERMS, APPLICATION_INTENT_TERMS } from '@job-agent/shared';
import { LocalStorageProvider } from '@job-agent/shared/storage';
import { getConfig, resetConfigCache } from '@job-agent/config';
import { buildApp } from '../apps/api/src/app.js';
import { ApplicationIntentService } from '../apps/api/src/services/application-intent-service.js';
import { ApplicationPackageService } from '../apps/api/src/services/application-package-service.js';
import { PreparationBatchService } from '../apps/api/src/services/preparation-batch-service.js';
import { executePendingBrowserRun } from '../apps/worker/src/services/browser-runner.js';
import { FixtureBrowserController } from '../apps/worker/src/browser/fixture-browser-controller.js';
import type { BrowserController } from '../apps/worker/src/browser/browser-controller.js';
import { WorkerService } from '../apps/worker/src/worker.js';

const db = getDb(process.env.DATABASE_URL);
let userId: string, otherId: string, jobId: string, directory: string;
let storage: LocalStorageProvider,
  packages: ApplicationPackageService,
  batches: PreparationBatchService,
  intents: ApplicationIntentService;
let app: ReturnType<typeof buildApp>;
const form = (custom = '') =>
  `<html><title>Software Engineer</title><form id="application_form"><label for="first_name">First Name</label><input id="first_name" name="first_name" required><label for="last_name">Last Name</label><input id="last_name" name="last_name" required><label for="email">Email</label><input id="email" name="email" type="email" required><input id="resume" name="resume" type="file" required>${custom}<button type="submit" id="submit_app">Submit Application</button></form></html>`;
const custom = (text: string) =>
  `<label for="job_application_answers_attributes_0_text_value">${text}</label><input id="job_application_answers_attributes_0_text_value" name="job_application[answers_attributes][0][text_value]" required>`;
function controller(
  html = form(),
  confirmation = '<html><div id="application_confirmation" data-application-id="fixture-employer-receipt">Thank you for applying! Your application has been received.</div></html>',
) {
  const browser = new FixtureBrowserController();
  browser.registerPage('greenhouse.io', html);
  if (confirmation) browser.registerSubmission('greenhouse.io', confirmation);
  return browser;
}
const post = (
  url: string,
  payload: unknown = { termsVersion: APPLICATION_INTENT_TERMS },
  owner = userId,
) => app.inject({ method: 'POST', url, headers: { 'x-test-user-id': owner }, payload });
const create = async () => {
  const response = await post(`/api/jobs/${jobId}/apply`);
  expect(response.statusCode, response.body).toBe(202);
  return response.json().data;
};
async function prepare() {
  await intents.processPending();
  await batches.processOne(userId);
  await intents.processPending();
}
async function queued() {
  const intent = await create();
  await prepare();
  const state = await intents.get(userId, intent.id);
  expect(state.runId, state.message).toBeTruthy();
  return state;
}
beforeEach(async () => {
  assertSafeTestDatabase();
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jobee-intent-'));
  storage = new LocalStorageProvider({ baseDir: directory });
  const created = await db
    .insert(users)
    .values([
      { name: 'Intent fixture', email: `intent-${crypto.randomUUID()}@example.test` },
      { name: 'Other fixture', email: `other-${crypto.randomUUID()}@example.test` },
    ])
    .returning();
  userId = created[0]!.id;
  otherId = created[1]!.id;
  assertSafeTestUser(userId);
  assertSafeTestUser(otherId);
  await db.insert(candidateProfiles).values({
    userId,
    fullName: 'Alex Morgan',
    email: 'alex@example.test',
    headline: 'Software Engineer',
  });
  await db.insert(candidateSkills).values(
    ['TypeScript', 'Node.js'].map((name) => ({
      userId,
      name,
      verificationStatus: 'VERIFIED',
      allowAiUse: true,
    })),
  );
  await db.insert(jobPreferences).values({
    userId,
    targetTitles: ['Software Engineer'],
    workModes: ['remote'],
    employmentTypes: ['full-time'],
    workAuthorizationCountries: ['DE'],
    needsSponsorship: false,
    willingToRelocate: true,
  });
  await db
    .insert(applicationPolicy)
    .values({ userId, autoApplyEnabled: false, minScoreForReview: 50, autoApplyMinScore: 70 });
  const [job] = await db
    .insert(jobs)
    .values({
      userId,
      title: 'Software Engineer',
      company: 'Fixture Company',
      description: 'Build software services with verified TypeScript and Node.js skills. '.repeat(
        14,
      ),
      country: 'Germany',
      city: 'Berlin',
      locationText: 'Berlin, Germany',
      workplaceType: 'REMOTE',
      employmentType: 'FULL_TIME',
      state: 'INGESTED',
      contentHash: crypto.randomUUID(),
      applicationUrl: `https://boards.greenhouse.io/fixture/jobs/${crypto.randomUUID()}`,
    })
    .returning();
  jobId = job!.id;
  await db.insert(jobRequirements).values(
    ['TypeScript', 'Node.js'].map((name) => ({
      userId,
      jobId,
      rawText: `Must have ${name} skills`,
      category: 'SKILL',
      requirementStrength: 'MANDATORY',
    })),
  );
  const match = new MatchService(db, new DisabledAiProvider());
  packages = new ApplicationPackageService(db, storage);
  batches = new PreparationBatchService(db, packages);
  intents = new ApplicationIntentService(db, batches, packages, match);
  app = buildApp({
    config: { ...getConfig(), NODE_ENV: 'test', AI_PROVIDER: 'disabled' },
    db,
    matchService: match,
    aiProvider: new DisabledAiProvider(),
    storage,
    packageService: packages,
  });
  await app.ready();
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  resetConfigCache();
  await app?.close();
  // Explicitly remove owned permission references before cascading fixture users and runs.
  if (userId) {
    await db.delete(applicationIntents).where(eq(applicationIntents.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }
  if (otherId) await db.delete(users).where(eq(users.id, otherId));
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

describe('One-click preparation and provider execution (JOB-P3-T01 / JOB-P5-T01)', () => {
  it('keeps a secondary salary conflict in recommendations while pausing application execution', async () => {
    await db
      .update(jobPreferences)
      .set({ minSalary: 100000, currency: 'EUR', salaryPayPeriod: 'YEAR' })
      .where(eq(jobPreferences.userId, userId));
    await db
      .update(jobs)
      .set({ maxSalary: 30000, currency: 'EUR', payPeriod: 'YEAR' })
      .where(eq(jobs.id, jobId));
    const analysis = await new MatchService(db, new DisabledAiProvider()).analyzeJob(jobId, userId);
    expect(analysis.decision).toBe('MATCH');
    expect(analysis.reasonCodes).toContain('SALARY_BELOW_MINIMUM');
    const intent = await create();
    await intents.processPending();
    const state = await intents.get(userId, intent.id);
    expect(state.status).toBe('NEEDS_USER_ACTION');
    expect(state.runId).toBeNull();
  });
  it('continues user-authorized preparation with unknown salary while Autopilot remains ineligible', async () => {
    await db
      .update(jobPreferences)
      .set({ minSalary: 80000, currency: 'EUR', salaryPayPeriod: null })
      .where(eq(jobPreferences.userId, userId));
    const analysis = await new MatchService(db, new DisabledAiProvider()).analyzeJob(jobId, userId);
    expect(analysis.decision).toBe('MATCH');
    expect(analysis.autoApplyEligible).toBe(false);
    expect(analysis.reasonCodes).toContain('POLICY_INFORMATION_MISSING');
    const intent = await create();
    await intents.processPending();
    const state = await intents.get(userId, intent.id);
    expect(state.status).toBe('PREPARING');
    expect(state.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'COMPENSATION_UNCONFIRMED', severity: 'WARNING' }),
      ]),
    );
    expect(state.runId).toBeNull();
    await prepare();
    const ready = await intents.get(userId, intent.id);
    expect(ready.runId).toBeTruthy();
    const result = await executePendingBrowserRun(db, ready.runId!, {
      controller: controller(),
      storage,
    });
    expect(result.status).toBe('SUCCESS');
  });

  it('persists owned permission and application before generation, deduplicates concurrent clicks, and survives service replacement', async () => {
    const [a, b] = await Promise.all([create(), create()]);
    expect(a.id).toBe(b.id);
    expect(
      await db.select().from(applications).where(eq(applications.userId, userId)),
    ).toHaveLength(1);
    expect(
      await db.select().from(applicationIntents).where(eq(applicationIntents.userId, userId)),
    ).toHaveLength(1);
    expect(a.packageId).toBeNull();
    expect((await post(`/api/jobs/${jobId}/apply`, {}, userId)).statusCode).toBe(400);
    expect(
      (await post(`/api/jobs/${jobId}/apply`, { termsVersion: APPLICATION_INTENT_TERMS }, otherId))
        .statusCode,
    ).toBe(404);
    expect((await post(`/api/application-intents/${a.id}/cancel`, {}, otherId)).statusCode).toBe(
      404,
    );
    await expect(intents.get(otherId, a.id)).rejects.toThrow('not found');
    const replaced = new ApplicationIntentService(
      db,
      batches,
      packages,
      new MatchService(db, new DisabledAiProvider()),
    );
    expect((await replaced.get(userId, a.id)).applicationId).toBe(a.applicationId);
  });
  it('keeps status and cancellation available when rollout flags disable new preparation and submissions', async () => {
    const intent = await create();
    const paused = buildApp({
      config: {
        ...getConfig(),
        NODE_ENV: 'test',
        BATCH_PREPARATION_ENABLED: false,
        SELECTED_SUBMISSIONS_ENABLED: false,
      },
      db,
      storage,
      packageService: packages,
      matchService: new MatchService(db, new DisabledAiProvider()),
      aiProvider: new DisabledAiProvider(),
    });
    await paused.ready();
    const headers = { 'x-test-user-id': userId };
    try {
      expect(
        (await paused.inject({ url: `/api/application-intents/${intent.id}`, headers })).statusCode,
      ).toBe(200);
      expect(
        (
          await paused.inject({
            method: 'POST',
            url: `/api/application-intents/${intent.id}/cancel`,
            headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await paused.inject({
            method: 'POST',
            url: `/api/jobs/${jobId}/apply`,
            headers,
            payload: { termsVersion: APPLICATION_INTENT_TERMS },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await paused.inject({
            method: 'POST',
            url: `/api/application-intents/${intent.id}/resume`,
            headers,
            payload: { termsVersion: APPLICATION_INTENT_TERMS },
          })
        ).statusCode,
      ).toBe(403);
    } finally {
      await paused.close();
    }
  });
  it('prepares real document bytes and completes one authorized fixture application through API and worker without enabling Autopilot', async () => {
    const intent = await queued();
    const artifacts = await db.select().from(applicationArtifacts);
    const own = artifacts.filter((a) => a.packageId === intent.packageId);
    expect(own.length).toBeGreaterThan(0);
    for (const artifact of own)
      expect((await storage.getFile(artifact.storageKey)).buffer.length).toBeGreaterThan(100);
    await executePendingBrowserRun(db, intent.runId!, { controller: controller(), storage });
    const result = await intents.get(userId, intent.id);
    expect(result.status).toBe('SUCCEEDED');
    const [application] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, intent.applicationId));
    expect(application!.appliedAt).not.toBeNull();
    expect(application!.submittedPackageVersionId).toBeTruthy();
    const [run] = await db
      .select()
      .from(browserApplicationRuns)
      .where(eq(browserApplicationRuns.id, intent.runId!));
    expect(run!.screenshotPaths.length).toBeGreaterThan(0);
    expect((await storage.getFile(run!.screenshotPaths[0]!)).buffer.length).toBeGreaterThan(0);
    expect(run!.confirmationReference).not.toBe(run!.id);
    expect((await create()).runId).toBe(intent.runId);
    expect((await post(`/api/application-intents/${intent.id}/resume`)).statusCode).toBe(400);
  });
  it('automatically reuses an exact verified routine answer found in the real form and binds the expanded manifest', async () => {
    await db.insert(answerLibrary).values({
      userId,
      question: 'Which engineering tool do you use?',
      answer: 'TypeScript',
      category: 'GENERAL',
      verificationStatus: 'VERIFIED',
      automationLevel: 'AUTO',
    });
    const intent = await queued();
    const result = await executePendingBrowserRun(db, intent.runId!, {
      controller: controller(form(custom('Which engineering tool do you use?'))),
      storage,
    });
    expect(result.status).toBe('SUCCESS');
    expect(
      (await intents.get(userId, intent.id)).events.some((e) => e.type === 'FORM_ANSWERS_BOUND'),
    ).toBe(true);
  });
  it('pauses for a real missing question, exposes that question in the existing workspace, and resumes after candidate input', async () => {
    const intent = await queued();
    const html = form(custom('Which engineering tool do you use?'));
    const stopped = await executePendingBrowserRun(db, intent.runId!, {
      controller: controller(html),
      storage,
    });
    expect(stopped.status).toBe('STOPPED_MANUAL_REVIEW');
    const detail = await packages.getPackage(intent.packageId!, userId);
    expect(detail.questions).toHaveLength(1);
    expect(detail.questions[0]!.questionText).toBe('Which engineering tool do you use?');
    const response = await app.inject({
      method: 'PUT',
      url: `/api/application-packages/${intent.packageId}/questions/${detail.questions[0]!.id}`,
      headers: { 'x-test-user-id': userId },
      payload: { answerText: 'TypeScript' },
    });
    expect(response.statusCode, response.body).toBe(200);
    expect((await post(`/api/application-intents/${intent.id}/resume`)).statusCode).toBe(200);
    await prepare();
    const resumed = await intents.get(userId, intent.id);
    expect(resumed.runId).not.toBe(intent.runId);
    expect(
      (
        await executePendingBrowserRun(db, resumed.runId!, {
          controller: controller(html),
          storage,
        })
      ).status,
    ).toBe('SUCCESS');
  });
  it('requires question-specific sensitive consent even for a verified AUTO library answer', async () => {
    await db.insert(answerLibrary).values({
      userId,
      question: 'Are you legally authorized to work in Germany?',
      answer: 'Yes',
      category: 'WORK_AUTHORIZATION',
      verificationStatus: 'VERIFIED',
      automationLevel: 'AUTO',
      isSensitive: true,
    });
    const intent = await queued();
    expect(
      (
        await executePendingBrowserRun(db, intent.runId!, {
          controller: controller(form(custom('Are you legally authorized to work in Germany?'))),
          storage,
        })
      ).status,
    ).toBe('STOPPED_MANUAL_REVIEW');
    const detail = await packages.getPackage(intent.packageId!, userId);
    expect(detail.approvals[0]!.status).toBe('PENDING');
  });
  it('does not silently use a saved answer changed after the initial application permission', async () => {
    const [answer] = await db
      .insert(answerLibrary)
      .values({
        userId,
        question: 'Which engineering tool do you use?',
        answer: 'TypeScript',
        category: 'GENERAL',
        verificationStatus: 'VERIFIED',
        automationLevel: 'AUTO',
      })
      .returning();
    const intent = await queued();
    await db
      .update(answerLibrary)
      .set({ answer: 'Node.js', updatedAt: new Date() })
      .where(eq(answerLibrary.id, answer!.id));
    expect(
      (
        await executePendingBrowserRun(db, intent.runId!, {
          controller: controller(form(custom('Which engineering tool do you use?'))),
          storage,
        })
      ).status,
    ).toBe('STOPPED_MANUAL_REVIEW');
  });
  it('does not invalidate permission when an unrelated saved answer is added', async () => {
    const intent = await queued();
    await db
      .insert(answerLibrary)
      .values({ userId, question: 'Unrelated source?', answer: 'Fixture', category: 'GENERAL' });
    expect(
      (await executePendingBrowserRun(db, intent.runId!, { controller: controller(), storage }))
        .status,
    ).toBe('SUCCESS');
  });
  it('never maps contact details into a required consent question that mentions email', async () => {
    const intent = await queued();
    expect(
      (
        await executePendingBrowserRun(db, intent.runId!, {
          controller: controller(form(custom('Do you consent to email processing?'))),
          storage,
        })
      ).status,
    ).toBe('STOPPED_MANUAL_REVIEW');
    const detail = await packages.getPackage(intent.packageId!, userId);
    expect(detail.questions[0]!.proposedAnswer).toBeNull();
    expect(detail.approvals[0]!.status).toBe('PENDING');
  });
  it('leaves optional sensitive questions blank without blocking a routine application', async () => {
    await db.insert(answerLibrary).values({
      userId,
      question: 'Do you consent to email processing?',
      answer: 'Yes',
      category: 'GENERAL',
      automationLevel: 'AUTO',
      verificationStatus: 'VERIFIED',
    });
    const intent = await queued();
    const optional = custom('Do you consent to email processing?').replace(' required', '');
    expect(
      (
        await executePendingBrowserRun(db, intent.runId!, {
          controller: controller(form(optional)),
          storage,
        })
      ).status,
    ).toBe('SUCCESS');
    expect((await packages.getPackage(intent.packageId!, userId)).questions).toHaveLength(0);
  });
  it.each(['profile', 'target', 'expired'] as const)(
    'rejects %s changes between preparation and worker claim',
    async (change) => {
      const intent = await queued();
      if (change === 'profile')
        await db
          .update(candidateProfiles)
          .set({ fullName: 'Changed Fixture Name' })
          .where(eq(candidateProfiles.userId, userId));
      if (change === 'target')
        await db
          .update(jobs)
          .set({ applicationUrl: 'https://boards.greenhouse.io/other/jobs/changed' })
          .where(eq(jobs.id, jobId));
      if (change === 'expired')
        await db
          .update(applicationIntents)
          .set({ expiresAt: new Date(0) })
          .where(eq(applicationIntents.id, intent.id));
      const browser = controller();
      const spy = vi.spyOn(browser, 'newPage');
      await expect(
        executePendingBrowserRun(db, intent.runId!, { controller: browser, storage }),
      ).rejects.toThrow();
      expect(spy).not.toHaveBeenCalled();
    },
  );
  it('serializes cancellation against queueing and prevents a cancelled pending run from dispatching', async () => {
    const first = await create();
    await intents.cancel(userId, first.id);
    await prepare();
    expect((await intents.get(userId, first.id)).status).toBe('CANCELLED');
    expect((await intents.get(userId, first.id)).message).toContain('cancelled');
    expect(
      await db
        .select()
        .from(browserApplicationRuns)
        .where(eq(browserApplicationRuns.userId, userId)),
    ).toHaveLength(0);
    await intents.resume(userId, first.id);
    await prepare();
    const queued = await intents.get(userId, first.id);
    await intents.cancel(userId, first.id);
    await executePendingBrowserRun(db, queued.runId!, { controller: controller(), storage });
    expect((await intents.get(userId, first.id)).status).toBe('CANCELLED');
  });
  it('checks revocation at the final safe boundary while a worker is filling the form', async () => {
    const intent = await queued();
    const fixture = controller();
    const blocking: BrowserController = {
      close: () => fixture.close(),
      newPage: async () => {
        const page = await fixture.newPage();
        const original = page.screenshot.bind(page);
        let cancelled = false;
        page.screenshot = async (options) => {
          if (!cancelled) {
            cancelled = true;
            await intents.cancel(userId, intent.id);
          }
          return original(options);
        };
        return page;
      },
    };
    const result = await executePendingBrowserRun(db, intent.runId!, {
      controller: blocking,
      storage,
    });
    expect(result.status).toBe('FAILED');
    expect(result.stepLogs.some((s) => s.step === 'SUBMISSION_DISPATCHING')).toBe(false);
  });
  it.each([
    [
      'captcha',
      '<html><iframe src="https://www.google.com/recaptcha/api2/anchor"></iframe></html>',
      '',
      'STOPPED_CAPTCHA',
    ],
    ['changed form', '<html><h1>This vacancy has closed</h1></html>', '', 'FAILED'],
    [
      'unsupported required field',
      form('<input required name="unsupported_custom_control">'),
      '',
      'FAILED',
    ],
    [
      'identity verification',
      '<html><form><input type="password" name="password" required><button type="submit">Sign in</button></form></html>',
      '',
      'FAILED',
    ],
    ['missing confirmation', form(), '', 'SUBMISSION_UNCERTAIN'],
    [
      'provider rejection',
      form(),
      '<html><div class="application-error">There was an error submitting your application. Please correct the required fields.</div></html>',
      'VALIDATION_FAILED',
    ],
  ])(
    'records %s truthfully without marking Applied',
    async (_name, html, confirmation, expected) => {
      const intent = await queued();
      const result = await executePendingBrowserRun(db, intent.runId!, {
        controller: controller(html, confirmation),
        storage,
      });
      expect(result.status).toBe(expected);
      const [application] = await db
        .select()
        .from(applications)
        .where(eq(applications.id, intent.applicationId));
      expect(application!.appliedAt).toBeNull();
      if (expected === 'SUBMISSION_UNCERTAIN')
        expect((await post(`/api/application-intents/${intent.id}/resume`)).statusCode).toBe(400);
    },
  );
  it('halts an unsupported provider and confirmed eligibility blocker without generating submission permission', async () => {
    await db
      .update(jobs)
      .set({ applicationUrl: 'https://employer.example.test/apply' })
      .where(eq(jobs.id, jobId));
    await expect(create()).rejects.toThrow('manual');
    expect(
      await db.select().from(applicationIntents).where(eq(applicationIntents.userId, userId)),
    ).toHaveLength(0);
    await db
      .update(jobs)
      .set({ applicationUrl: 'https://boards.greenhouse.io/fixture/jobs/1' })
      .where(eq(jobs.id, jobId));
    await db
      .update(jobPreferences)
      .set({ excludedCompanies: ['Fixture Company'] })
      .where(eq(jobPreferences.userId, userId));
    const intent = await create();
    await prepare();
    expect((await intents.get(userId, intent.id)).message).toContain('blocker');
  });
  it('does not turn a recommendation score threshold into a hard blocker for a deliberate manual application', async () => {
    await db
      .update(applicationPolicy)
      .set({ autoApplyMinScore: 100, minScoreForReview: 100 })
      .where(eq(applicationPolicy.userId, userId));
    const intent = await queued();
    expect(
      (await executePendingBrowserRun(db, intent.runId!, { controller: controller(), storage }))
        .status,
    ).toBe('SUCCESS');
  });
  it('rejects a duplicate vacancy record pointing at the same provider destination', async () => {
    await create();
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    const [duplicate] = await db
      .insert(jobs)
      .values({
        userId,
        title: job!.title,
        company: job!.company,
        description: job!.description,
        contentHash: crypto.randomUUID(),
        applicationUrl: job!.applicationUrl,
      })
      .returning();
    expect((await post(`/api/jobs/${duplicate!.id}/apply`)).statusCode).toBe(400);
  });
  it('retains owner-scoped application purge with linked permission and browser history', async () => {
    const intent = await queued();
    await intents.cancel(userId, intent.id);
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/applications/${intent.applicationId}/purge`,
      headers: { 'x-test-user-id': userId },
    });
    expect(response.statusCode, response.body).toBe(200);
    await expect(intents.get(userId, intent.id)).rejects.toThrow('not found');
  });
  it('allows tenant deletion to cascade permission and attempt records together', async () => {
    const intent = await queued();
    await intents.cancel(userId, intent.id);
    await db.delete(users).where(eq(users.id, userId));
    expect(
      await db.select().from(applicationIntents).where(eq(applicationIntents.userId, userId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(browserApplicationRuns)
        .where(eq(browserApplicationRuns.userId, userId)),
    ).toHaveLength(0);
  });
  it('claims a queued attempt only once under concurrent workers', async () => {
    const intent = await queued();
    const fixture = controller();
    const open = vi.spyOn(fixture, 'newPage');
    await Promise.all([
      executePendingBrowserRun(db, intent.runId!, { controller: fixture, storage }),
      executePendingBrowserRun(db, intent.runId!, { controller: fixture, storage }),
    ]);
    expect(open).toHaveBeenCalledTimes(1);
    expect((await intents.get(userId, intent.id)).status).toBe('SUCCEEDED');
  });
  it('waits for delayed provider confirmation and refuses cancellation after the durable dispatch boundary', async () => {
    const intent = await queued();
    const fixture = controller(form(), '');
    const browser: BrowserController = {
      close: () => fixture.close(),
      newPage: async () => {
        const page = await fixture.newPage();
        const original = page.locator.bind(page);
        let submitted = false;
        page.locator = (selector) => {
          const locator = original(selector);
          const first = locator.first.bind(locator);
          locator.first = () => {
            const selected = first();
            const click = selected.click.bind(selected);
            selected.click = async () => {
              await expect(intents.cancel(userId, intent.id)).rejects.toThrow('cannot be recalled');
              submitted = true;
              await click();
            };
            return selected;
          };
          return locator;
        };
        page.waitForTimeout = async () => {
          if (submitted)
            page.setHtml(
              '<div id="application_confirmation">Your application was received.</div>',
              page.url(),
            );
        };
        return page;
      },
    };
    expect(
      (await executePendingBrowserRun(db, intent.runId!, { controller: browser, storage })).status,
    ).toBe('SUCCESS');
  });
  it('keeps a connection loss after clicking uncertain and requires employer reconciliation before a new attempt', async () => {
    const intent = await queued();
    const fixture = controller();
    const browser: BrowserController = {
      close: () => fixture.close(),
      newPage: async () => {
        const page = await fixture.newPage();
        const original = page.locator.bind(page);
        page.locator = (selector) => {
          const locator = original(selector);
          const first = locator.first.bind(locator);
          locator.first = () => {
            const selected = first();
            if (selector.includes('submit'))
              selected.click = async () => {
                throw new Error('Fixture connection lost after dispatch');
              };
            return selected;
          };
          return locator;
        };
        return page;
      },
    };
    expect(
      (await executePendingBrowserRun(db, intent.runId!, { controller: browser, storage })).status,
    ).toBe('SUBMISSION_UNCERTAIN');
    expect((await post(`/api/application-intents/${intent.id}/resume`)).statusCode).toBe(400);
    expect(
      (
        await post(`/api/browser-runs/${intent.runId}/reconcile-not-sent`, {
          checkedEmployerWebsite: true,
          note: 'Synthetic employer portal confirms no application was received.',
        })
      ).statusCode,
    ).toBe(200);
    expect((await post(`/api/application-intents/${intent.id}/resume`)).statusCode).toBe(200);
    await prepare();
    expect((await intents.get(userId, intent.id)).runId).not.toBe(intent.runId);
  });
  it('pauses preparation failures instead of automatically repeating generation', async () => {
    const intent = await create();
    await intents.processPending();
    const generate = vi
      .spyOn(packages, 'createPackage')
      .mockRejectedValue(new Error('Fixture generation interrupted'));
    await batches.processOne(userId);
    await intents.processPending();
    await intents.processPending();
    expect(generate).toHaveBeenCalledTimes(1);
    expect((await intents.get(userId, intent.id)).status).toBe('NEEDS_USER_ACTION');
  });
  it('retains cryptographic material authorization and rejects a tampered one-click proof before opening a browser', async () => {
    const intent = await queued();
    const [run] = await db
      .select()
      .from(browserApplicationRuns)
      .where(eq(browserApplicationRuns.id, intent.runId!));
    await db
      .update(browserApplicationRuns)
      .set({
        authorizationManifest: {
          ...(run!.authorizationManifest as object),
          submissionToken: 'invalid.signature',
        },
      })
      .where(eq(browserApplicationRuns.id, intent.runId!));
    const fixture = controller();
    const open = vi.spyOn(fixture, 'newPage');
    await expect(
      executePendingBrowserRun(db, intent.runId!, { controller: fixture, storage }),
    ).rejects.toThrow('signature');
    expect(open).not.toHaveBeenCalled();
  });
  it('recovers an orphaned one-click worker as uncertain without automatically issuing a replacement attempt', async () => {
    const intent = await queued();
    await db
      .update(browserApplicationRuns)
      .set({ status: 'RUNNING', updatedAt: new Date(Date.now() - 20 * 60_000) })
      .where(eq(browserApplicationRuns.id, intent.runId!));
    await new WorkerService(getConfig()).recoverOrphanedRuns();
    expect((await intents.get(userId, intent.id)).status).toBe('UNKNOWN_RESULT');
    expect((await post(`/api/application-intents/${intent.id}/resume`)).statusCode).toBe(400);
    await intents.processPending();
    expect(
      await db
        .select()
        .from(browserApplicationRuns)
        .where(eq(browserApplicationRuns.userId, userId)),
    ).toHaveLength(1);
  });
});

describe('Applications convergence and bounded Autopilot (JOB-P3-T02 / JOB-P5-T02)', () => {
  async function autopilot() {
    vi.stubEnv('AUTOPILOT_ENABLED', 'true');
    resetConfigCache();
    const match = new MatchService(db, new DisabledAiProvider());
    // Deterministic high-score matcher fixture; all normal hard checks/material gates still run.
    const analyze = match.analyzeJob.bind(match);
    vi.spyOn(match, 'analyzeJob').mockImplementation(async (...args) => ({
      ...(await analyze(...args)),
      overallScore: 95,
      decision: 'MATCH',
    }));
    intents = new ApplicationIntentService(db, batches, packages, match);
    const service = new AutopilotService(db, intents, match, true);
    const state = await service.state(userId);
    await service.authorize(userId, {
      expectedCandidateFingerprint: state.candidateFingerprint,
      intervalHours: 24,
      maxPerDay: 2,
      minScore: 90,
    });
    return service;
  }
  it('restores owned execution and attention without moving the employer pipeline, including unknown attempts older than previews', async () => {
    const intent = await queued();
    await db
      .update(browserApplicationRuns)
      .set({ status: 'SUBMISSION_UNCERTAIN' })
      .where(eq(browserApplicationRuns.id, intent.runId!));
    await db.insert(browserApplicationRuns).values({
      userId,
      applicationId: intent.applicationId,
      targetUrl: 'https://example.test',
      mode: 'DRY_RUN',
      status: 'SUCCESS',
    });
    const summary = await ApplicationCrmService.getApplicationSummary(userId, intent.applicationId);
    expect(summary.execution?.status).toBe('SUBMISSION_UNCERTAIN');
    expect(summary.attention?.kind).toBe('VERIFY_SUBMISSION');
    expect(summary.appliedAt).toBeNull();
    expect(
      (await ApplicationCrmService.listApplications(userId, { needsAttention: true, limit: 1 }))
        .total,
    ).toBe(1);
    expect(
      (await ApplicationCrmService.listApplications(otherId, { needsAttention: true })).items,
    ).toHaveLength(0);
    await expect(
      ApplicationCrmService.getApplicationSummary(otherId, intent.applicationId),
    ).rejects.toThrow('not found');
  });
  it('never uses a legacy enabled flag as employer-submit permission', async () => {
    const intent = await queued();
    await db
      .update(browserApplicationRuns)
      .set({ status: 'FAILED' })
      .where(eq(browserApplicationRuns.id, intent.runId!));
    await db
      .update(applications)
      .set({ status: 'READY_TO_APPLY' })
      .where(eq(applications.id, intent.applicationId));
    await db
      .update(applicationPolicy)
      .set({ autoApplyEnabled: true })
      .where(eq(applicationPolicy.userId, userId));
    await expect(
      BrowserWorkerService.createBrowserRun(userId, intent.applicationId, { mode: 'SUBMIT' }),
    ).rejects.toThrow('cryptographic');
  });
  it('does not turn a high-scoring recommendation with unknown salary into an Autopilot attempt', async () => {
    await db
      .update(jobPreferences)
      .set({ minSalary: 80000, currency: 'EUR', salaryPayPeriod: null })
      .where(eq(jobPreferences.userId, userId));
    const service = await autopilot();
    const result = await service.run(userId);
    expect(result.prepared).toBe(0);
    expect(
      await db.select().from(applicationIntents).where(eq(applicationIntents.userId, userId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(browserApplicationRuns)
        .where(eq(browserApplicationRuns.userId, userId)),
    ).toHaveLength(0);
  });
  it('persists the accepted version and uses the same preparation and fixture worker pipeline', async () => {
    const service = await autopilot();
    expect((await service.run(userId)).prepared).toBe(1);
    await prepare();
    const intent = await intents.forJob(userId, jobId);
    expect(intent?.runId, intent?.message).toBeTruthy();
    const [saved] = await db
      .select()
      .from(applicationIntents)
      .where(eq(applicationIntents.id, intent!.id));
    expect(saved!.autopilotGrant?.termsVersion).toBe(AUTOPILOT_TERMS);
    expect(
      (await executePendingBrowserRun(db, intent!.runId!, { controller: controller(), storage }))
        .status,
    ).toBe('SUCCESS');
    expect((await service.run(userId)).prepared).toBe(0);
  });
  it('serializes simultaneous scheduler/manual starts and survives a service restart without duplicate intents', async () => {
    const service = await autopilot();
    await Promise.all([service.run(userId), service.run(userId, 'SCHEDULED')]);
    expect(
      await db.select().from(applicationIntents).where(eq(applicationIntents.userId, userId)),
    ).toHaveLength(1);
    expect(
      (
        await new AutopilotService(
          db,
          intents,
          new MatchService(db, new DisabledAiProvider()),
          true,
        ).run(userId)
      ).prepared,
    ).toBe(0);
  });
  it('rejects stale policy previews and requires a new version after pause', async () => {
    const service = await autopilot();
    const before = await service.state(userId);
    await service.pause(userId);
    expect((await service.state(userId)).current).toBe(false);
    await expect(assertAutopilotGrant(db, userId, before.grant!)).rejects.toThrow('paused');
    await db
      .update(candidateProfiles)
      .set({ headline: 'Updated verified profile' })
      .where(eq(candidateProfiles.userId, userId));
    await expect(
      service.authorize(userId, {
        expectedCandidateFingerprint: before.candidateFingerprint,
        intervalHours: 24,
        maxPerDay: 2,
        minScore: 90,
      }),
    ).rejects.toThrow('changed');
  });
  it('stops queued permission after pause before worker claim', async () => {
    const service = await autopilot();
    await service.run(userId);
    await prepare();
    const intent = await intents.forJob(userId, jobId);
    await service.pause(userId);
    await expect(
      executePendingBrowserRun(db, intent!.runId!, { controller: controller(), storage }),
    ).rejects.toThrow('paused');
    expect((await intents.get(userId, intent!.id)).status).toBe('NEEDS_USER_ACTION');
  });
  it('stops at the last safe dispatch boundary when Autopilot is paused while filling', async () => {
    const service = await autopilot();
    await service.run(userId);
    await prepare();
    const intent = await intents.forJob(userId, jobId);
    const fixture = controller();
    const browser: BrowserController = {
      close: () => fixture.close(),
      newPage: async () => {
        const page = await fixture.newPage();
        const screenshot = page.screenshot.bind(page);
        let paused = false;
        page.screenshot = async (options) => {
          if (!paused) {
            paused = true;
            await service.pause(userId);
          }
          return screenshot(options);
        };
        return page;
      },
    };
    await executePendingBrowserRun(db, intent!.runId!, { controller: browser, storage });
    const [run] = await db
      .select()
      .from(browserApplicationRuns)
      .where(eq(browserApplicationRuns.id, intent!.runId!));
    expect(run!.status).not.toBe('SUCCESS');
    expect(
      (run!.stepLogs as { step: string }[]).some((s) => s.step === 'SUBMISSION_DISPATCHING'),
    ).toBe(false);
  });
  it('invalidates the global grant after profile/preferences change, including pending preparation', async () => {
    const service = await autopilot();
    await service.run(userId);
    await db
      .update(jobPreferences)
      .set({ excludedCompanies: ['Fixture Company'] })
      .where(eq(jobPreferences.userId, userId));
    expect((await service.state(userId)).current).toBe(false);
    await prepare();
    expect((await intents.forJob(userId, jobId))?.status).toBe('NEEDS_USER_ACTION');
    expect(
      await db
        .select()
        .from(browserApplicationRuns)
        .where(eq(browserApplicationRuns.userId, userId)),
    ).toHaveLength(0);
  });
  it('reclaims an expired scheduling lease and does not reauthorize a stopped application', async () => {
    const service = await autopilot();
    await db.insert(orchestrationRuns).values({
      userId,
      taskType: 'AUTO_APPLY',
      trigger: 'SCHEDULED',
      status: 'RUNNING',
      startedAt: new Date(Date.now() - 16 * 60_000),
    });
    expect((await service.run(userId)).prepared).toBe(1);
    const intent = await intents.forJob(userId, jobId);
    await intents.cancel(userId, intent!.id);
    expect((await service.run(userId)).prepared).toBe(0);
    expect((await intents.forJob(userId, jobId))?.status).toBe('CANCELLED');
  });
  it('reports queue reservations consistently even when a failed attempt consumes the slot', async () => {
    await queued();
    await db
      .update(browserApplicationRuns)
      .set({ status: 'FAILED' })
      .where(eq(browserApplicationRuns.userId, userId));
    const metrics = await new OrchestratorService(db, getConfig()).getMetrics(userId);
    expect(metrics.applicationsToday).toBe(1);
    expect(metrics.dailyQuotaRemaining).toBe(metrics.maxApplicationsPerDay - 1);
  });
  it('atomically reserves the last daily slot across applications and includes failed attempts in quota metrics', async () => {
    const first = await queued();
    await db
      .update(applicationPolicy)
      .set({ maxApplicationsPerDay: 1 })
      .where(eq(applicationPolicy.userId, userId));
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    const [secondJob] = await db
      .insert(jobs)
      .values({
        userId,
        title: job!.title,
        company: 'Other fixture',
        description: job!.description,
        country: job!.country,
        city: job!.city,
        locationText: job!.locationText,
        workplaceType: job!.workplaceType,
        employmentType: job!.employmentType,
        state: 'INGESTED',
        contentHash: crypto.randomUUID(),
        applicationUrl: `https://boards.greenhouse.io/other/jobs/${crypto.randomUUID()}`,
      })
      .returning();
    await db.insert(jobRequirements).values(
      ['TypeScript', 'Node.js'].map((name) => ({
        userId,
        jobId: secondJob!.id,
        rawText: `Must have ${name} skills`,
        category: 'SKILL',
        requirementStrength: 'MANDATORY',
      })),
    );
    const second = await intents.create(userId, secondJob!.id);
    // Nine synthetic failed reservations plus the queued attempt consume the platform's ten slots.
    await db.insert(browserApplicationRuns).values(
      Array.from({ length: 9 }, () => ({
        userId,
        applicationId: first.applicationId,
        targetUrl: 'https://example.test/fixture',
        mode: 'SUBMIT',
        status: 'FAILED',
      })),
    );
    await prepare();
    await batches.processOne(userId);
    await intents.processPending();
    expect((await intents.get(userId, second.id)).message).toContain('Daily application limit');
    await db
      .update(browserApplicationRuns)
      .set({ status: 'FAILED' })
      .where(eq(browserApplicationRuns.id, first.runId!));
    await db
      .update(applications)
      .set({ status: 'READY_TO_APPLY' })
      .where(eq(applications.id, first.applicationId));
    await intents.resume(userId, first.id);
    await expect(
      BrowserWorkerService.createBrowserRun(
        userId,
        first.applicationId,
        { mode: 'SUBMIT' },
        first.id,
        db,
      ),
    ).rejects.toThrow('Daily application limit');
    expect(
      (await new OrchestratorService(db, getConfig()).getMetrics(userId)).dailyQuotaRemaining,
    ).toBe(0);
    // Move only this fixture's old reservation to the preceding UTC day, then race two ready packages.
    await db
      .update(browserApplicationRuns)
      .set({ createdAt: new Date(Date.now() - 24 * 60 * 60_000) })
      .where(eq(browserApplicationRuns.id, first.runId!));
    await intents.resume(userId, second.id);
    const outcomes = await Promise.allSettled([
      BrowserWorkerService.createBrowserRun(
        userId,
        first.applicationId,
        { mode: 'SUBMIT' },
        first.id,
        db,
      ),
      BrowserWorkerService.createBrowserRun(
        userId,
        second.applicationId,
        { mode: 'SUBMIT' },
        second.id,
        db,
      ),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(
      (await new OrchestratorService(db, getConfig()).getMetrics(userId)).applicationsToday,
    ).toBe(10);
  });
  it('consumes legacy preparation requests with durable batch acknowledgement and no submission authority', async () => {
    const [request] = await db
      .insert(orchestrationRuns)
      .values({
        userId,
        taskType: 'PREPARATION',
        trigger: 'MANUAL',
        status: 'COMPLETED',
        summary: { preparation: { requestedJobIds: [jobId], status: 'PENDING' } },
      })
      .returning();
    await Promise.all([
      batches.processOrchestrationRequests(userId),
      batches.processOrchestrationRequests(userId),
    ]);
    const [saved] = await db
      .select()
      .from(orchestrationRuns)
      .where(eq(orchestrationRuns.id, request!.id));
    expect((saved!.summary.preparation as { status: string }).status).toBe('QUEUED');
    expect(
      await db.select().from(preparationBatches).where(eq(preparationBatches.userId, userId)),
    ).toHaveLength(1);
    expect(
      await db.select().from(preparationItems).where(eq(preparationItems.userId, userId)),
    ).toHaveLength(1);
    expect(
      await db.select().from(applicationIntents).where(eq(applicationIntents.userId, userId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(browserApplicationRuns)
        .where(eq(browserApplicationRuns.userId, userId)),
    ).toHaveLength(0);
  });
  it('keeps active preparation out of the attention queue, then exposes expired permission', async () => {
    const intent = await create();
    expect(
      (await ApplicationCrmService.getApplicationSummary(userId, intent.applicationId)).attention,
    ).toBeNull();
    await db
      .update(applicationIntents)
      .set({
        expiresAt: new Date(Date.now() - 1000),
        message: 'Permission expired. Review before resuming.',
      })
      .where(eq(applicationIntents.id, intent.id));
    expect(
      (await ApplicationCrmService.getApplicationSummary(userId, intent.applicationId)).attention
        ?.kind,
    ).toBe('REVIEW');
  });
  it('exposes validated policy endpoints with tenant-scoped acceptance, pause and read-only restoration', async () => {
    vi.stubEnv('AUTOPILOT_ENABLED', 'true');
    resetConfigCache();
    const local = buildApp({
      config: {
        ...getConfig(),
        AUTOPILOT_ENABLED: true,
        NODE_ENV: 'test',
        AI_PROVIDER: 'disabled',
      },
      db,
      storage,
      packageService: packages,
      matchService: new MatchService(db, new DisabledAiProvider()),
      aiProvider: new DisabledAiProvider(),
    });
    await local.ready();
    try {
      const read = await local.inject({
        url: '/api/autopilot',
        headers: { 'x-test-user-id': userId },
      });
      const state = read.json().data;
      expect(state.enabled).toBe(false);
      expect(
        (
          await local.inject({
            method: 'POST',
            url: '/api/autopilot/authorize',
            headers: { 'x-test-user-id': userId },
            payload: { termsVersion: AUTOPILOT_TERMS },
          })
        ).statusCode,
      ).toBe(400);
      const accepted = await local.inject({
        method: 'POST',
        url: '/api/autopilot/authorize',
        headers: { 'x-test-user-id': userId },
        payload: {
          expectedCandidateFingerprint: state.candidateFingerprint,
          termsVersion: AUTOPILOT_TERMS,
          intervalHours: 24,
          maxPerDay: 2,
          minScore: 90,
          reviewMode: 'PAUSE',
        },
      });
      expect(accepted.statusCode, accepted.body).toBe(200);
      expect(accepted.json().data.current).toBe(true);
      expect(
        (
          await local.inject({ url: '/api/autopilot', headers: { 'x-test-user-id': otherId } })
        ).json().data.grant,
      ).toBeNull();
      expect(
        (
          await local.inject({
            method: 'POST',
            url: '/api/autopilot/pause',
            headers: { 'x-test-user-id': userId },
            payload: {},
          })
        ).json().data.current,
      ).toBe(false);
    } finally {
      await local.close();
    }
  });
});
