import { expect, it } from 'vitest';
import { assessApplicationCapability } from './browser-worker.js';
it('uses the application destination independently of the discovery source', () => {
  expect(assessApplicationCapability('https://boards.greenhouse.io/example/jobs/123').method).toBe(
    'JOBEE',
  );
  expect(assessApplicationCapability('https://jobs.lever.co/example/123').method).toBe('JOBEE');
  expect(assessApplicationCapability('https://jobs.ashbyhq.com/example/123').method).toBe('JOBEE');
  expect(assessApplicationCapability('https://jobs.smartrecruiters.com/example/123').method).toBe(
    'EMPLOYER_SITE',
  );
});
it('does not advertise support for spoofed hosts or non-HTTPS targets', () => {
  for (const url of [
    'http://boards.greenhouse.io/example',
    'javascript://boards.greenhouse.io/example',
    'https://boards.greenhouse.io.evil.test/example',
    'https://user:password@boards.greenhouse.io/example',
  ]) {
    expect(assessApplicationCapability(url).method).toBe('EMPLOYER_SITE');
  }
});
