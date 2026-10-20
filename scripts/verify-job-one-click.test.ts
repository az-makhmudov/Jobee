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
} from '@job-agent/database';
import { MatchService, DisabledAiProvider } from '@job-agent/database/matching';
import { APPLICATION_INTENT_TERMS } from '@job-agent/shared';
import { LocalStorageProvider } from '@job-agent/shared/storage';
import { getConfig } from '@job-agent/config';
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
    const intent = await create();
    await prepare();
    expect((await intents.get(userId, intent.id)).message).toContain('manual');
    await db
      .update(jobs)
      .set({ applicationUrl: 'https://boards.greenhouse.io/fixture/jobs/1' })
      .where(eq(jobs.id, jobId));
    await db
      .update(jobPreferences)
      .set({ excludedCompanies: ['Fixture Company'] })
      .where(eq(jobPreferences.userId, userId));
    await intents.resume(userId, intent.id);
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
