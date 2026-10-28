import { it, expect, vi } from 'vitest';
import { GoogleJobsReader } from './google-jobs-reader.js';
const result = (publisher: string, link: string) => ({
  title: 'Junior Project Coordinator',
  company_name: 'Synthetic employer',
  location: 'Warsaw, Poland',
  description:
    'Coordinate scheduling, reporting and stakeholder communications for projects. This is a deterministic synthetic job posting fixture.',
  job_id: publisher,
  via: publisher,
  apply_options: [{ title: publisher, link }],
});
it('requires explicit enablement even when a provider key exists', async () => {
  const fetchFn = vi.fn();
  await expect(
    new GoogleJobsReader(fetchFn, { enabled: false, apiKey: 'fixture-key' }).read(
      'Project Manager',
      'Warsaw',
      'pl',
    ),
  ).rejects.toThrow('not configured');
  expect(fetchFn).not.toHaveBeenCalled();
});
it('preserves returned LinkedIn/Indeed/Glassdoor publisher links without accessing their accounts or sending candidate records', async () => {
  const fetchFn = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          jobs_results: [
            result('LinkedIn', 'https://www.linkedin.com/jobs/view/12345'),
            result('Indeed', 'https://pl.indeed.com/viewjob?jk=fixture'),
            result('Glassdoor', 'https://www.glassdoor.com/job-listing/fixture'),
          ],
        }),
      ),
  ) as typeof fetch;
  const jobs = await new GoogleJobsReader(fetchFn, { enabled: true, apiKey: 'fixture-key' }).read(
    'Junior Project Manager',
    'Warsaw',
    'pl',
  );
  expect(jobs).toHaveLength(3);
  expect(jobs.map((x) => x.sourceMetadata?.via)).toEqual(['LinkedIn', 'Indeed', 'Glassdoor']);
  const [raw, init] = vi.mocked(fetchFn).mock.calls[0]!;
  const url = new URL(String(raw));
  expect(url.origin).toBe('https://serpapi.com');
  expect(url.searchParams.get('api_key')).toBe('fixture-key');
  expect(url.searchParams.get('q')).toBe('Junior Project Manager');
  expect(init?.method ?? 'GET').toBe('GET');
  expect(init?.body).toBeUndefined();
  expect(fetchFn).toHaveBeenCalledOnce();
});
it('discards unsafe destinations and incomplete snippets and does not expose credential URLs on failure', async () => {
  const fetchFn = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          jobs_results: [
            result('Unsafe', 'https://127.0.0.1/secret'),
            result('Unsafe', 'javascript:alert(1)'),
            { ...result('Incomplete', 'https://example.test/job'), description: 'Snippet' },
          ],
        }),
      ),
  ) as typeof fetch;
  expect(
    await new GoogleJobsReader(fetchFn, { enabled: true, apiKey: 'fixture-key' }).read(
      'Project Manager',
      'Warsaw',
    ),
  ).toEqual([]);
  const failed = vi.fn(async () => {
    throw Error('https://serpapi.com/search.json?api_key=fixture-key');
  }) as typeof fetch;
  await expect(
    new GoogleJobsReader(failed, { enabled: true, apiKey: 'fixture-key' }).read(
      'Project Manager',
      'Warsaw',
    ),
  ).rejects.toThrow('Additional job search is temporarily unavailable');
});
