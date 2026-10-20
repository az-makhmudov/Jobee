import { describe, it, expect, vi } from 'vitest';
import {
  FixtureBrowserController,
  FixtureBrowserPage,
} from '../browser/fixture-browser-controller.js';
import { BrowserApplicationEngine } from './browser-application-engine.js';
import { AtsAdapterRegistry } from '../adapters/ats-adapter-registry.js';
import { BrowserRunMode, BrowserRunStatus, type FileStorageProvider } from '@job-agent/shared';
const form =
  '<form id="application_form"><div class="field"><label for="email">Email</label><input id="email" name="email" required></div><button type="submit">Submit application</button></form>';
const url = 'https://boards.greenhouse.io/fixture/jobs/100';
const payload = {
  firstName: 'Alex',
  lastName: 'Morgan',
  fullName: 'Alex Morgan',
  email: 'alex@example.test',
  urls: {},
  answers: {},
};
const run = {
  applicationId: 'fixture-app',
  userId: 'fixture-user',
  targetUrl: url,
  mode: BrowserRunMode.SUBMIT,
  payload,
  skipDb: true,
};
describe('Observed employer outcomes', () => {
  it('revalidates immediately before dispatch and stops changed authorizations without a click', async () => {
    const controller = new FixtureBrowserController();
    controller.registerPage('greenhouse.io', form);
    const result = await new BrowserApplicationEngine(controller).executeRun({
      ...run,
      beforeSubmit: async () => {
        throw new Error('Reviewed materials changed.');
      },
    });
    expect(result.status).toBe(BrowserRunStatus.FAILED);
    expect(result.stepLogs.some((s) => s.step === 'SUBMISSION_DISPATCHING')).toBe(false);
  });
  it('keeps a click without a receipt uncertain and advertises no imaginary screenshot', async () => {
    const controller = new FixtureBrowserController();
    controller.registerPage('greenhouse.io', form);
    const result = await new BrowserApplicationEngine(controller).executeRun(run);
    expect(result.status).toBe(BrowserRunStatus.SUBMISSION_UNCERTAIN);
    expect(result.confirmationReference).toBeNull();
    expect(result.screenshotPaths).toEqual([]);
  });
  it('records post-click validation as rejected rather than submitted', async () => {
    const controller = new FixtureBrowserController();
    controller.registerPage('greenhouse.io', form);
    controller.registerSubmission(
      'greenhouse.io',
      form + '<p class="application-error">Application could not be sent</p>',
    );
    const result = await new BrowserApplicationEngine(controller).executeRun(run);
    expect(result.status).toBe(BrowserRunStatus.VALIDATION_FAILED);
    expect(result.submissionObservation?.outcome).toBe('REJECTED');
  });
  it('waits for delayed employer evidence', async () => {
    const page = new FixtureBrowserPage(new Map([['greenhouse.io', form]]));
    let ticks = 0;
    page.waitForTimeout = async () => {
      if (++ticks === 3)
        page.setHtml(
          '<div id="application_confirmation">Thank you, your application was received.</div>',
          url,
        );
    };
    const result = await new BrowserApplicationEngine({
      newPage: async () => page,
      close: async () => {},
    }).executeRun(run);
    expect(ticks).toBe(3);
    expect(result.status).toBe(BrowserRunStatus.SUCCESS);
    expect(result.confirmationReference).toBeNull();
    expect(result.submissionObservation?.outcome).toBe('ACCEPTED');
  });
  it('stores real captured bytes before returning protected evidence keys', async () => {
    const controller = new FixtureBrowserController();
    controller.registerPage('greenhouse.io', form);
    controller.registerSubmission(
      'greenhouse.io',
      '<div id="application_confirmation">Application submitted successfully</div>',
    );
    const files = new Map<string, Buffer>();
    const putFile = vi.fn(async (key: string, buffer: Buffer) => {
      files.set(key, buffer);
    });
    const storage = {
      putFile,
      exists: async (key: string) => files.has(key),
    } as unknown as FileStorageProvider;
    const result = await new BrowserApplicationEngine(
      controller,
      new AtsAdapterRegistry(),
      undefined,
      storage,
    ).executeRun(run);
    expect(result.status).toBe(BrowserRunStatus.SUCCESS);
    expect(result.screenshotPaths.length).toBe(2);
    for (const key of result.screenshotPaths)
      expect(files.get(key)?.subarray(1, 4).toString()).toBe('PNG');
  });
  it('does not accept an existing success banner as proof of a new application', async () => {
    const controller = new FixtureBrowserController();
    controller.registerPage(
      'greenhouse.io',
      form + '<div id="application_confirmation">Application submitted</div>',
    );
    const result = await new BrowserApplicationEngine(controller).executeRun(run);
    expect(result.status).toBe(BrowserRunStatus.SUBMISSION_UNCERTAIN);
  });
  it('does not dispatch through the generic form adapter', async () => {
    const controller = new FixtureBrowserController();
    controller.registerPage('example.test', form);
    const result = await new BrowserApplicationEngine(controller).executeRun({
      ...run,
      targetUrl: 'https://example.test/apply',
    });
    expect(result.status).toBe(BrowserRunStatus.FAILED);
    expect(result.stepLogs.some((s) => s.step === 'SUBMISSION_DISPATCHING')).toBe(false);
  });
  it.each([
    [
      'https://boards.greenhouse.io/a/jobs/1',
      '<div id="application_confirmation">Thank you for applying</div>',
    ],
    [
      'https://jobs.lever.co/a/1',
      '<div class="application-confirmation">Application received</div>',
    ],
    [
      'https://jobs.ashbyhq.com/a/1',
      '<div data-testid="application-success">Your application was successfully submitted.</div>',
    ],
  ])('observes provider-specific confirmation at %s', async (target, receipt) => {
    const page = new FixtureBrowserPage();
    page.setHtml(receipt, target);
    const adapter = new AtsAdapterRegistry().resolveAdapter(target, '');
    expect((await adapter.observeSubmission(page, form)).outcome).toBe('ACCEPTED');
  });
});
