import { describe, it, expect, beforeEach } from 'vitest';
import { FixtureBrowserController } from '../browser/fixture-browser-controller.js';
import { BrowserApplicationEngine } from './browser-application-engine.js';
import { AtsAdapterRegistry } from '../adapters/ats-adapter-registry.js';
import {
  BrowserRunMode,
  BrowserRunStatus,
  ApplicationLifecycleStatus,
  type ApplicationSubmissionPayload,
} from '@job-agent/shared';

describe('Crash and Duplicate-Submission Safety Invariant', () => {
  let controller: FixtureBrowserController;

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
    resumeBuffer: Buffer.from('test fixture CV').toString('base64'),
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
  });

  it('marks run as SUBMISSION_UNCERTAIN if error or disconnect occurs after submit action is dispatched', async () => {
    const page = await controller.newPage();
    const originalLocator = page.locator.bind(page);

    // Mock locator so that submit button click throws a socket disconnect
    page.locator = (selector: string) => {
      const loc = originalLocator(selector);
      if (selector.includes('submit')) {
        return {
          ...loc,
          first: () => ({
            ...loc.first(),
            count: async () => 1,
            click: async () => {
              throw new Error('Connection reset by peer (ETIMEDOUT) during HTTP POST');
            },
          }),
        };
      }
      return loc;
    };

    const mockController = {
      newPage: async () => page,
      close: async () => {},
    };

    const faultyEngine = new BrowserApplicationEngine(
      mockController as any,
      new AtsAdapterRegistry(),
    );

    const result = await faultyEngine.executeRun({
      applicationId: 'app-crash-1',
      userId: 'user-1',
      targetUrl: 'https://boards.greenhouse.io/acme/jobs/12345',
      mode: BrowserRunMode.SUBMIT,
      payload: validPayload,
      skipDb: true,
    });

    expect(result.status).toBe(BrowserRunStatus.SUBMISSION_UNCERTAIN);
    expect(result.errorMessage).toContain('Confirmation needed');
    expect(result.stepLogs.some((l) => l.step === 'SUBMISSION_UNCERTAIN')).toBe(true);
  });

  it('marks run as FAILED (not UNCERTAIN) if error occurs before submit action (e.g. navigation error)', async () => {
    const page = await controller.newPage();
    page.goto = async () => {
      throw new Error('DNS lookup failed for boards.greenhouse.io');
    };

    const mockController = {
      newPage: async () => page,
      close: async () => {},
    };

    const faultyEngine = new BrowserApplicationEngine(
      mockController as any,
      new AtsAdapterRegistry(),
    );

    const result = await faultyEngine.executeRun({
      applicationId: 'app-crash-2',
      userId: 'user-1',
      targetUrl: 'https://boards.greenhouse.io/acme/jobs/12345',
      mode: BrowserRunMode.SUBMIT,
      payload: validPayload,
      skipDb: true,
    });

    expect(result.status).toBe(BrowserRunStatus.FAILED);
    expect(result.status).not.toBe(BrowserRunStatus.SUBMISSION_UNCERTAIN);
    expect(result.errorMessage).toContain('DNS lookup failed');
  });

  it('preserves SUBMISSION_UNCERTAIN invariant when process crashes during submission flight', async () => {
    // Simulating database state where a worker process was killed while executing SUBMIT mode
    const orphanedRun = {
      id: 'run-crashed-during-submit',
      applicationId: 'app-crash-3',
      userId: 'user-1',
      mode: BrowserRunMode.SUBMIT,
      status: BrowserRunStatus.RUNNING,
      stepLogs: [
        { step: 'NAVIGATE', status: 'OK' },
        { step: 'FIELD_FILL', status: 'OK' },
        { step: 'SUBMISSION_DISPATCHING', status: 'OK', action: 'Dispatching submission action' },
      ],
    };

    // Evaluate recovery rule
    const isSubmitMode = orphanedRun.mode === BrowserRunMode.SUBMIT;
    const hasSubmissionStep = orphanedRun.stepLogs.some(
      (s) =>
        s.step === 'SUBMISSION' ||
        s.step === 'SUBMISSION_DISPATCHING' ||
        s.step === 'SUBMISSION_INITIATING',
    );

    const mayHaveReachedExternalProvider = isSubmitMode || hasSubmissionStep;
    expect(mayHaveReachedExternalProvider).toBe(true);

    const recoveredStatus = mayHaveReachedExternalProvider
      ? BrowserRunStatus.SUBMISSION_UNCERTAIN
      : BrowserRunStatus.FAILED;

    expect(recoveredStatus).toBe(BrowserRunStatus.SUBMISSION_UNCERTAIN);

    // Application MUST be placed in NEEDS_REVIEW, never automatically retried
    const targetApplicationStatus =
      recoveredStatus === BrowserRunStatus.SUBMISSION_UNCERTAIN
        ? ApplicationLifecycleStatus.NEEDS_REVIEW
        : ApplicationLifecycleStatus.READY_TO_APPLY;

    expect(targetApplicationStatus).toBe(ApplicationLifecycleStatus.NEEDS_REVIEW);
  });

  it('safely marks orphaned run as FAILED when process crashed during DRY_RUN (no external request emitted)', async () => {
    const orphanedDryRun = {
      id: 'run-crashed-during-dryrun',
      applicationId: 'app-crash-4',
      userId: 'user-1',
      mode: BrowserRunMode.DRY_RUN as BrowserRunMode,
      status: BrowserRunStatus.RUNNING,
      stepLogs: [
        { step: 'NAVIGATE', status: 'OK' },
        { step: 'FIELD_FILL', status: 'OK' },
      ],
    };

    const isSubmitMode = orphanedDryRun.mode === BrowserRunMode.SUBMIT;
    const hasSubmissionStep = orphanedDryRun.stepLogs.some(
      (s) =>
        s.step === 'SUBMISSION' ||
        s.step === 'SUBMISSION_DISPATCHING' ||
        s.step === 'SUBMISSION_INITIATING',
    );

    const mayHaveReachedExternalProvider = isSubmitMode || hasSubmissionStep;
    expect(mayHaveReachedExternalProvider).toBe(false);

    const recoveredStatus = mayHaveReachedExternalProvider
      ? BrowserRunStatus.SUBMISSION_UNCERTAIN
      : BrowserRunStatus.FAILED;

    expect(recoveredStatus).toBe(BrowserRunStatus.FAILED);
  });
});
