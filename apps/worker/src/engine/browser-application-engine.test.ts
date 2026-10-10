import { describe, it, expect, beforeEach } from 'vitest';
import { FixtureBrowserController } from '../browser/fixture-browser-controller.js';
import { BrowserApplicationEngine } from './browser-application-engine.js';
import { AtsAdapterRegistry } from '../adapters/ats-adapter-registry.js';
import {
  BrowserRunMode,
  BrowserRunStatus,
  AtsProviderType,
  type ApplicationSubmissionPayload,
} from '@job-agent/shared';

describe('BrowserApplicationEngine (JOB-P5-T01)', () => {
  let controller: FixtureBrowserController;
  let engine: BrowserApplicationEngine;

  const validPayload: ApplicationSubmissionPayload = {
    firstName: 'Alex',
    lastName: 'Morgan',
    fullName: 'Alex Morgan',
    email: 'alex.morgan@example.com',
    phone: '+1 555-0199',
    location: 'San Francisco, CA',
    urls: {
      linkedin: 'https://linkedin.com/in/alexmorgan',
      github: 'https://github.com/alexmorgan',
    },
    resumeFileName: 'alex-morgan-resume.pdf',
    coverLetterText: 'I am excited to apply for this engineering role.',
    answers: {
      work_authorization: {
        answerText: 'yes',
        isSensitive: false,
        verificationStatus: 'VERIFIED',
      },
      sponsorship: {
        answerText: 'No',
        isSensitive: false,
        verificationStatus: 'VERIFIED',
      },
    },
  };

  beforeEach(() => {
    controller = new FixtureBrowserController();
    engine = new BrowserApplicationEngine(controller, new AtsAdapterRegistry());
  });

  it('executes DRY_RUN successfully on Greenhouse without submitting', async () => {
    const result = await engine.executeRun({
      applicationId: 'app-gh-1',
      userId: 'user-1',
      targetUrl: 'https://boards.greenhouse.io/acme/jobs/12345',
      mode: BrowserRunMode.DRY_RUN,
      payload: validPayload,
      skipDb: true,
    });

    expect(result.status).toBe(BrowserRunStatus.SUCCESS);
    expect(result.mode).toBe(BrowserRunMode.DRY_RUN);
    expect(result.atsProvider).toBe(AtsProviderType.GREENHOUSE);
    expect(result.fieldsDetectedCount).toBeGreaterThan(0);
    expect(result.fieldsFilledCount).toBeGreaterThan(0);
    expect(result.unmatchedRequiredFields).toHaveLength(0);

    // Verify step logs audit trail
    const steps = result.stepLogs.map((s) => s.step);
    expect(steps).toContain('NAVIGATION');
    expect(steps).toContain('ADAPTER_RESOLUTION');
    expect(steps).toContain('FORM_EXTRACTION');
    expect(steps).toContain('INVARIANT_CHECK');
    expect(steps).toContain('FIELD_FILL');
    expect(steps).toContain('DRY_RUN');

    // Confirm submit was NOT triggered in DRY_RUN
    expect(steps).not.toContain('SUBMISSION');
  });

  it('executes PREFILL_ONLY successfully on Lever', async () => {
    const result = await engine.executeRun({
      applicationId: 'app-lever-1',
      userId: 'user-1',
      targetUrl: 'https://jobs.lever.co/acme/67890',
      mode: BrowserRunMode.PREFILL_ONLY,
      payload: validPayload,
      skipDb: true,
    });

    expect(result.status).toBe(BrowserRunStatus.SUCCESS);
    expect(result.mode).toBe(BrowserRunMode.PREFILL_ONLY);
    expect(result.atsProvider).toBe(AtsProviderType.LEVER);
    expect(result.fieldsFilledCount).toBeGreaterThan(0);

    const steps = result.stepLogs.map((s) => s.step);
    expect(steps).toContain('PREFILL_ONLY');
  });

  it('executes SUBMIT mode on Ashby with confirmation reference', async () => {
    const ashbyPayload: ApplicationSubmissionPayload = {
      ...validPayload,
      answers: {
        ...validPayload.answers,
        workAuthorization: {
          answerText: 'true',
          isSensitive: false,
          verificationStatus: 'VERIFIED',
        },
      },
    };

    const result = await engine.executeRun({
      applicationId: 'app-ashby-1',
      userId: 'user-1',
      targetUrl: 'https://jobs.ashbyhq.com/novatech/abcde',
      mode: BrowserRunMode.SUBMIT,
      payload: ashbyPayload,
      skipDb: true,
    });

    expect(result.status).toBe(BrowserRunStatus.SUCCESS);
    expect(result.mode).toBe(BrowserRunMode.SUBMIT);
    expect(result.atsProvider).toBe(AtsProviderType.ASHBY);
    expect(result.confirmationReference).toBeDefined();
    expect(result.confirmationReference).toContain('SUBMITTED-');

    const steps = result.stepLogs.map((s) => s.step);
    expect(steps).toContain('SUBMISSION');
  });

  it('halts with STOPPED_CAPTCHA when bot verification challenge is encountered', async () => {
    const result = await engine.executeRun({
      applicationId: 'app-captcha-1',
      userId: 'user-1',
      targetUrl: 'https://example.com/captcha-test',
      mode: BrowserRunMode.DRY_RUN,
      payload: validPayload,
      skipDb: true,
    });

    expect(result.status).toBe(BrowserRunStatus.STOPPED_CAPTCHA);
    expect(result.errorMessage).toBeDefined();
    expect(result.errorMessage).toContain('reCAPTCHA');

    const steps = result.stepLogs.map((s) => s.step);
    expect(steps).toContain('CHALLENGE_DETECTION');
    expect(steps).not.toContain('FIELD_FILL');
  });

  it('Prime Invariant: halts with STOPPED_MANUAL_REVIEW when required question has no candidate fact', async () => {
    // Missing required work authorization answer
    const incompletePayload: ApplicationSubmissionPayload = {
      ...validPayload,
      answers: {}, // no answers provided!
    };

    const result = await engine.executeRun({
      applicationId: 'app-gh-missing-answer',
      userId: 'user-1',
      targetUrl: 'https://boards.greenhouse.io/acme/jobs/12345',
      mode: BrowserRunMode.DRY_RUN,
      payload: incompletePayload,
      skipDb: true,
    });

    // Zero-hallucination invariant check: must NOT guess or invent an answer
    expect(result.status).toBe(BrowserRunStatus.STOPPED_MANUAL_REVIEW);
    expect(result.unmatchedRequiredFields.length).toBeGreaterThan(0);
    expect(result.errorMessage).toContain('Missing verified answers for required fields');

    const steps = result.stepLogs.map((s) => s.step);
    expect(steps).toContain('INVARIANT_CHECK');
    // Field fill was aborted due to unmatched required field
    expect(steps).not.toContain('FIELD_FILL');
  });
});
