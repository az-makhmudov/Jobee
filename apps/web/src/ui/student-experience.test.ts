// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { submissionSummary, initialApplicationView } from './student-experience.js';
import { ApplicationLifecycleStatus } from '@job-agent/shared';
const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());
describe('Truthful application presentation', () => {
  it.each(['DISCOVERED', 'ANALYZED', 'MATCHED', 'NEEDS_REVIEW', 'SKIPPED'] as const)(
    'does not imply a %s draft was submitted',
    (status) => {
      expect(submissionSummary(status)).toBe(
        'No submission has been recorded for this application.',
      );
    },
  );
  it('keeps preparation, running and uncertain submissions separate', () => {
    expect(submissionSummary('READY_TO_APPLY')).toContain('does not submit');
    expect(submissionSummary('APPLYING')).toContain('in progress');
    expect(submissionSummary('APPLIED', '2026-10-18', 'SUBMISSION_UNCERTAIN')).toContain(
      'needs confirmation',
    );
  });
  it('uses recorded submission evidence rather than guessing from an outcome', () => {
    expect(submissionSummary('INTERVIEW')).toContain('Check the application history');
    expect(submissionSummary('INTERVIEW', '2026-10-18')).toContain('A submission is recorded');
    for (const status of Object.values(ApplicationLifecycleStatus))
      expect(submissionSummary(status)).not.toContain('Submitted externally');
  });
  it('defaults to list, preserves a deliberate board choice and rejects invalid preferences', () => {
    expect(initialApplicationView()).toBe('list');
    localStorage.setItem('jobee.applications.view', 'board');
    expect(initialApplicationView()).toBe('board');
    localStorage.setItem('jobee.applications.view', 'broken');
    expect(initialApplicationView()).toBe('list');
  });
});
