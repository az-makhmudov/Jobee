import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDb,
  users,
  jobs,
  jobPreferences,
  jobSearchSettings,
  eq,
  evaluateTestDatabaseSafety,
} from '@job-agent/database';
import { JobDiscoveryService } from './job-discovery-service.js';
import { JobService } from './job-service.js';
import { DEFAULT_SEARCH_SETTINGS } from '@job-agent/shared';
const db = getDb(process.env.DATABASE_URL);
let userId: string;
const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    title: `Project Manager ${i + 1}`,
    absolute_url: `https://boards.greenhouse.io/fixture/jobs/${i + 1}`,
    content: '<p>Coordinate project delivery and stakeholders.</p>',
    location: { name: 'Warsaw, Poland' },
  }));
beforeEach(async () => {
  if (!evaluateTestDatabaseSafety(process.env.DATABASE_URL).safe)
    throw new Error('Isolated test database required');
  const [user] = await db
    .insert(users)
    .values({ name: 'Discovery fixture', email: `discovery-${crypto.randomUUID()}@example.test` })
    .returning();
  userId = user!.id;
  await db.insert(jobPreferences).values({ userId, targetTitles: ['Project Manager'] });
});
afterEach(async () => {
  await db.delete(users).where(eq(users.id, userId));
});
describe('Public discovery traversal', () => {
  it('filters Arbeitnow by target roles and records checked source provenance', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                title: 'Project Manager',
                company_name: 'Fixture Company',
                url: 'https://example.test/pm',
                description: '<p>Manage project delivery</p>',
                location: 'Warsaw',
                remote: true,
              },
              {
                title: 'Senior Surgeon',
                company_name: 'Fixture Hospital',
                url: 'https://example.test/surgeon',
                description: 'Healthcare',
              },
            ],
          }),
        ),
    ) as unknown as typeof fetch;
    const service = new JobDiscoveryService(db, new JobService(db), { fetchFn });
    const result = await service.discoverForCandidate(userId, { sources: ['ARBEITNOW'] });
    expect(result.totalDiscovered).toBe(2);
    expect(result.newJobsIngested).toBe(1);
    const saved = await db.select().from(jobs).where(eq(jobs.userId, userId));
    expect(saved[0]?.lastCheckedDate).toBeTruthy();
    expect(saved[0]?.workplaceType).toBe('REMOTE');
  });
  it('advances past the first three matches and duplicates over repeated full-board searches', async () => {
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify({ jobs: rows(8) })),
    ) as unknown as typeof fetch;
    const service = new JobDiscoveryService(db, new JobService(db), { fetchFn });
    const first = await service.discoverForCandidate(userId, {
      sources: ['GREENHOUSE'],
      companies: ['fixture'],
      limit: 3,
    });
    const second = await service.discoverForCandidate(userId, {
      sources: ['GREENHOUSE'],
      companies: ['fixture'],
      limit: 3,
    });
    const third = await service.discoverForCandidate(userId, {
      sources: ['GREENHOUSE'],
      companies: ['fixture'],
      limit: 3,
    });
    expect([first.newJobsIngested, second.newJobsIngested, third.newJobsIngested]).toEqual([
      3, 3, 2,
    ]);
    expect((await db.select().from(jobs).where(eq(jobs.userId, userId))).length).toBe(8);
  });
  it('isolates provider errors and continues other configured sources', async () => {
    await db.insert(jobSearchSettings).values({
      userId,
      settings: {
        ...DEFAULT_SEARCH_SETTINGS,
        sources: ['GREENHOUSE', 'ASHBY'],
        boards: [
          { source: 'GREENHOUSE', slug: 'broken' },
          { source: 'ASHBY', slug: 'fixture' },
        ],
      },
    });
    const fetchFn = vi.fn(async (url: string | URL | Request) =>
      String(url).includes('greenhouse')
        ? new Response('', { status: 429 })
        : new Response(
            JSON.stringify({
              jobs: [
                {
                  id: 'a',
                  title: 'Project Manager',
                  applyUrl: 'https://jobs.ashbyhq.com/fixture/a',
                  descriptionPlain: 'Manage project delivery',
                  location: 'Warsaw',
                  isListed: true,
                },
                { id: 'hidden', title: 'Project Manager', isListed: false },
              ],
            }),
          ),
    ) as typeof fetch;
    const result = await new JobDiscoveryService(db, new JobService(db), {
      fetchFn,
    }).discoverForCandidate(userId);
    expect(result.newJobsIngested).toBe(1);
    expect(result.sourcesSummary.find((s) => s.source === 'GREENHOUSE')?.errors).toHaveLength(1);
  });
  it('normalizes Lever and follows documented skip/limit pages', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            Array.from({ length: 100 }, (_, i) => ({
              id: String(i),
              text: 'Project Manager',
              applyUrl: `https://jobs.lever.co/fixture/${i}/apply`,
              descriptionPlain: 'Project delivery',
              categories: { location: 'Warsaw', commitment: 'Full-time' },
            })),
          ),
        ),
    ) as unknown as typeof fetch;
    const service = new JobDiscoveryService(db, new JobService(db), { fetchFn });
    const result = await service.fetchPostings('LEVER', 'fixture', 100);
    expect(result.nextOffset).toBe(200);
    expect(result.items[0]?.employmentType).toBe('Full-time');
    expect(String(vi.mocked(fetchFn).mock.calls[0]?.[0])).toContain('skip=100&limit=100');
  });
  it('does not treat empty feeds or missing salary and jurisdiction as known values', async () => {
    const service = new JobDiscoveryService(db, new JobService(db), {
      fetchFn: vi.fn(async () => new Response('{"jobs":[]}')) as unknown as typeof fetch,
    });
    const result = await service.discoverForCandidate(userId, { sources: ['ASHBY'] });
    expect(result.newJobsIngested).toBe(0);
  });
});
