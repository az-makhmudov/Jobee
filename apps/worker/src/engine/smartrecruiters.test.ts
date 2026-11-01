import { describe, it, expect, vi } from 'vitest';
import { FixtureBrowserPage } from '../browser/fixture-browser-controller.js';
import { BrowserApplicationEngine } from './browser-application-engine.js';
import { SmartRecruitersAdapter } from '../adapters/smartrecruiters-adapter.js';
import { assessApplicationCapability, BrowserRunMode } from '@job-agent/shared';
const url = 'https://jobs.smartrecruiters.com/Fixture/744000123-junior';
const contact =
  '<form><label for="firstName">First name</label><input id="firstName" name="firstName" required><label for="email">Email</label><input id="email" name="email" type="email" required><button id="next" type="button">Next</button></form>';
const documents =
  '<form><label for="resume">Resume</label><input id="resume" type="file" required><button id="submit" type="submit">Submit application</button></form>';
const receipt =
  '<div data-test="application-confirmation" data-application-id="test-receipt">Your application has been received</div>';
const payload = {
  fullName: 'Alex Morgan',
  firstName: 'Alex',
  lastName: 'Morgan',
  email: 'alex@example.test',
  urls: {},
  answers: {},
  resumeBuffer: Buffer.from('fixture resume').toString('base64'),
  resumeFileName: 'cv.pdf',
  resumeMimeType: 'application/pdf',
};
async function run(pages: string[], options: Record<string, unknown> = {}, destination = url) {
  const page = new FixtureBrowserPage(new Map([[url, pages[0]!]]));
  let index = 0;
  const clicks: string[] = [];
  const original = page.recordClick.bind(page);
  page.recordClick = (selector) => {
    clicks.push(selector);
    original(selector);
    if (pages[index + 1]) page.setHtml(pages[++index]!, destination);
  };
  const beforeSubmit = vi.fn(async () => {}),
    beforeStep = vi.fn(async () => {});
  const result = await new BrowserApplicationEngine({
    newPage: async () => page,
    close: async () => {},
  }).executeRun({
    applicationId: 'test-app',
    userId: 'test-user',
    targetUrl: url,
    mode: BrowserRunMode.SUBMIT,
    payload,
    skipDb: true,
    smartRecruitersEnabled: true,
    beforeSubmit,
    beforeStep,
    ...options,
  });
  return { result, clicks, beforeSubmit, beforeStep };
}
describe('SmartRecruiters bounded execution JOB-P5-T01', () => {
  it('keeps rollout off by default and capability consistent', async () => {
    expect(assessApplicationCapability(url).method).toBe('EMPLOYER_SITE');
    expect(assessApplicationCapability(url, true).method).toBe('JOBEE');
    const { result, clicks } = await run([contact], { smartRecruitersEnabled: false });
    expect(result.status).toBe('FAILED');
    expect(clicks).toEqual([]);
  });
  it('advances, uploads and reserves final dispatch only once, then observes receipt', async () => {
    const { result, clicks, beforeSubmit, beforeStep } = await run([contact, documents, receipt]);
    expect(result.status).toBe('SUCCESS');
    expect(result.confirmationReference).toBe('test-receipt');
    expect(clicks).toHaveLength(2);
    expect(beforeSubmit).toHaveBeenCalledTimes(1);
    expect(beforeStep.mock.calls.length).toBeGreaterThan(2);
  });
  it('does not treat Next as submission or a repeated step as success', async () => {
    const { result, beforeSubmit } = await run([contact]);
    expect(result.status).toBe('FAILED');
    expect(beforeSubmit).not.toHaveBeenCalled();
  });
  it('pauses at job-specific consent without dispatch', async () => {
    const { result, beforeSubmit } = await run([
      contact,
      '<form><label for="consent">I consent to processing my personal data</label><input id="consent" type="checkbox" required><button id="submit">Submit application</button></form>',
    ]);
    expect(result.status).toBe('STOPPED_MANUAL_REVIEW');
    expect(result.unmatchedRequiredFields[0]).toMatchObject({ id: 'consent' });
    expect(beforeSubmit).not.toHaveBeenCalled();
  });
  it('honors cancellation between steps', async () => {
    let calls = 0;
    const { result, beforeSubmit } = await run([contact, documents], {
      beforeStep: async () => {
        if (++calls > 1) throw Error('Cancelled');
      },
    });
    expect(result.status).toBe('FAILED');
    expect(beforeSubmit).not.toHaveBeenCalled();
  });
  it.each([
    '<input type="password">',
    '<input autocomplete="one-time-code">',
    '<div class="g-recaptcha"></div>',
    '<form><input required role="combobox" name="city"></form>',
    '<h1>Job closed</h1>',
  ])('hands off challenges and unsupported forms without dispatch: %s', async (html) => {
    const { result, beforeSubmit } = await run([html]);
    expect(result.status).not.toBe('SUCCESS');
    expect(beforeSubmit).not.toHaveBeenCalled();
  });
  it('rejects a different employer or posting after navigation', async () => {
    const { result, beforeSubmit } = await run(
      [contact, documents],
      {},
      url.replace('Fixture', 'OtherEmployer'),
    );
    expect(result.status).toBe('FAILED');
    expect(beforeSubmit).not.toHaveBeenCalled();
  });
  it('keeps a dispatched attempt uncertain without employer confirmation', async () => {
    const { result } = await run([documents]);
    expect(result.status).toBe('SUBMISSION_UNCERTAIN');
  });
  it('does not accept success from an unexpected destination', async () => {
    const { result } = await run(
      [documents, receipt],
      {},
      'https://jobs.smartrecruiters.com/Other/999',
    );
    expect(result.status).toBe('SUBMISSION_UNCERTAIN');
  });
  it('binds supported entry and one-click paths to the same employer and posting', () => {
    const a = new SmartRecruitersAdapter();
    expect(() =>
      a.assertDestination(
        url,
        'https://jobs.smartrecruiters.com/oneclick-ui/company/Fixture/publication/744000123',
      ),
    ).not.toThrow();
    expect(() =>
      a.assertDestination(url, 'https://jobs.smartrecruiters.com.evil.test/Fixture/744000123'),
    ).toThrow();
  });
  it('inspects newly required screening questions before final dispatch', async () => {
    const { result, beforeSubmit } = await run([
      contact,
      '<form><label for="authorization">Are you authorized to work in Poland?</label><input id="authorization" required><button id="submit">Submit application</button></form>',
    ]);
    expect(result.status).toBe('STOPPED_MANUAL_REVIEW');
    expect(beforeSubmit).not.toHaveBeenCalled();
  });
  it('continues with exact, verified job-specific consent', async () => {
    const consent =
      '<form><label for="consent">I consent to processing my personal data</label><input id="consent" type="checkbox" required><button id="submit">Submit application</button></form>';
    const { result } = await run([consent, receipt], {
      payload: {
        ...payload,
        answers: {
          consent: {
            answerText: 'yes',
            verificationStatus: 'VERIFIED',
            isSensitive: true,
            approvedQuestionText: 'I consent to processing my personal data',
          },
        },
      },
    });
    expect(result.status).toBe('SUCCESS');
  });
  it('stops after eight distinct steps without reserving submission', async () => {
    const forms = Array.from(
      { length: 9 },
      (_, i) =>
        `<form><label for="email${i}">Email</label><input id="email${i}" type="email" required><button id="next">Next</button></form>`,
    );
    const { result, clicks, beforeSubmit } = await run(forms);
    expect(result.status).toBe('FAILED');
    expect(clicks).toHaveLength(7);
    expect(beforeSubmit).not.toHaveBeenCalled();
  });
  it('stops when the two-minute deadline expires between actions', async () => {
    const clock = vi.spyOn(Date, 'now');
    let n = 0;
    clock.mockImplementation(() => (++n < 4 ? 1000 : 121001));
    try {
      const { result, beforeSubmit } = await run([contact, documents]);
      expect(result.status).toBe('FAILED');
      expect(beforeSubmit).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  });
  it('does not mistake a validation error for a receipt', async () => {
    const { result } = await run([
      documents,
      '<p class="application-error">Required answer missing</p>',
    ]);
    expect(result.status).toBe('VALIDATION_FAILED');
  });
  it('handles public entry and unnamed navigation controls without early dispatch', async () => {
    const entry =
      '<a id="entry" href="/oneclick-ui/company/Fixture/publication/744000123">Apply now</a>';
    const { result, clicks, beforeSubmit } = await run([
      entry,
      contact.replace('id="next"', ''),
      documents.replace('id="submit"', ''),
      receipt,
    ]);
    expect(result.status).toBe('SUCCESS');
    expect(clicks).toHaveLength(3);
    expect(beforeSubmit).toHaveBeenCalledTimes(1);
  });
  it('rechecks late employer questions after authorization and before dispatch', async () => {
    const page = new FixtureBrowserPage(new Map([[url, documents]]));
    const result = await new BrowserApplicationEngine({
      newPage: async () => page,
      close: async () => {},
    }).executeRun({
      applicationId: 'test-app',
      userId: 'test-user',
      targetUrl: url,
      mode: BrowserRunMode.SUBMIT,
      payload,
      skipDb: true,
      smartRecruitersEnabled: true,
      beforeSubmit: async () => {
        page.setHtml(documents.replace('</form>', '<input id="new-answer" required></form>'), url);
      },
    });
    expect(result.status).toBe('FAILED');
    expect(page.getClicks()).toHaveLength(0);
  });
});
