import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDb,
  users,
  jobs,
  jobRequirements,
  jobMatchAnalyses,
  jobRequirementEvaluations,
  jobPreferences,
  jobSearchSettings,
  eq,
  evaluateTestDatabaseSafety,
} from '@job-agent/database';
import { JobDiscoveryService } from './job-discovery-service.js';
import { JobService } from './job-service.js';
import { HttpRetrievalService } from './http-retrieval-service.js';
import { JobSearchSettingsService } from './job-search-settings-service.js';
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
  it('finds a compatible junior role after foreign and senior results without spending its result limit', async () => {
    await db
      .update(jobPreferences)
      .set({
        preferredLocations: ['Poland'],
        seniorityLevels: ['ENTRY'],
        willingToRelocate: false,
      })
      .where(eq(jobPreferences.userId, userId));
    const postings = [
      { title: 'Junior Project Manager', location: { name: 'Berlin, Germany' } },
      { title: 'Senior Project Manager', location: { name: 'Warsaw, Poland' } },
      { title: 'Junior Project Manager', location: { name: 'Warsaw, Poland' } },
    ].map((item, i) => ({ ...rows(3)[i], ...item }));
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify({ jobs: postings })),
    ) as typeof fetch;
    const service = new JobDiscoveryService(db, new JobService(db), { fetchFn });
    const result = await service.discoverForCandidate(userId, {
      sources: ['GREENHOUSE'],
      companies: ['fixture'],
      limit: 1,
    });
    expect(result.newJobsIngested).toBe(1);
    const saved = await db.select().from(jobs).where(eq(jobs.userId, userId));
    expect(saved).toHaveLength(1);
    expect(saved[0]!.title).toBe('Junior Project Manager');
    expect(saved[0]!.country).toBe('Poland');
    expect(saved[0]!.sourceExternalId).toBe('3');
  });
  it('refreshes checked provenance and changed text without replacing IDs or manual corrections', async () => {
    let description = 'Requirements:\n• Must have TypeScript experience.';
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            jobs: [
              {
                ...rows(1)[0],
                content: `<p>${description}</p>`,
              },
            ],
          }),
        ),
    ) as unknown as typeof fetch;
    const jobsService = new JobService(db);
    const service = new JobDiscoveryService(db, jobsService, { fetchFn });
    const options = { sources: ['GREENHOUSE' as const], companies: ['fixture'] };
    await service.discoverForCandidate(userId, options);
    const [original] = await db.select().from(jobs).where(eq(jobs.userId, userId));
    const unchanged = await service.discoverForCandidate(userId, options);
    expect(unchanged.duplicatesSkipped).toBe(1);
    const [checked] = await db.select().from(jobs).where(eq(jobs.userId, userId));
    expect(checked!.description).toBe(original!.description);
    const [oldRequirement] = await db
      .select()
      .from(jobRequirements)
      .where(eq(jobRequirements.jobId, original!.id));
    expect(oldRequirement!.rawText).toContain('TypeScript');
    const [oldAnalysis] = await db
      .insert(jobMatchAnalyses)
      .values({
        userId,
        jobId: original!.id,
        overallScore: 90,
        confidenceScore: 90,
        decision: 'MATCH',
        analysisMode: 'DETERMINISTIC_ONLY',
        algorithmVersion: 'fixture',
        inputFingerprint: 'fixture',
        summaryExplanation: 'Historical fixture',
      })
      .returning();
    await db.insert(jobRequirementEvaluations).values({
      analysisId: oldAnalysis!.id,
      jobRequirementId: oldRequirement!.id,
      jobId: original!.id,
      userId,
      status: 'MET',
      source: 'DETERMINISTIC',
      reason: 'Original requirement',
      confidence: 90,
    });
    description = 'Requirements:\n• Must have Python experience.';
    await service.discoverForCandidate(userId, options);
    const refreshed = await jobsService.getJobById(userId, original!.id);
    expect(refreshed.description).toContain(description);
    expect(refreshed.descriptionHtml).toContain('Must have Python experience.');
    expect(refreshed.requirements?.map((r) => r.rawText)).toEqual(['Must have Python experience.']);
    const history = await db
      .select()
      .from(jobRequirements)
      .where(eq(jobRequirements.jobId, original!.id));
    expect(history.find((r) => r.id === oldRequirement!.id)?.isCurrent).toBe(false);
    expect(
      await db
        .select()
        .from(jobRequirementEvaluations)
        .where(eq(jobRequirementEvaluations.analysisId, oldAnalysis!.id)),
    ).toHaveLength(1);
    expect(
      (await db.select().from(jobMatchAnalyses).where(eq(jobMatchAnalyses.id, oldAnalysis!.id)))[0]!
        .isStale,
    ).toBe(true);
    expect(refreshed.sources).toHaveLength(3);
    expect(refreshed.lastCheckedDate).toBeTruthy();
    await jobsService.updateJob(userId, original!.id, {
      description: 'Candidate corrected description remains authoritative.',
    });
    description = 'Different employer source content that remains in provenance.';
    await service.discoverForCandidate(userId, options);
    const manual = await jobsService.getJobById(userId, original!.id);
    expect(manual.description).toBe('Candidate corrected description remains authoritative.');
    expect(manual.sources).toHaveLength(4);
    expect(await db.select().from(jobs).where(eq(jobs.userId, userId))).toHaveLength(1);
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

describe('Poland discovery and recovery regressions', () => {
  it('reads full SmartRecruiters descriptions only for compatible Warsaw entry roles', async () => {
    await db
      .update(jobPreferences)
      .set({
        targetTitles: ['Junior Project Manager'],
        preferredLocations: ['Warsaw'],
        seniorityLevels: ['ENTRY', 'INTERNSHIP'],
        willingToRelocate: true,
      })
      .where(eq(jobPreferences.userId, userId));
    await db.insert(jobSearchSettings).values({
      userId,
      settings: {
        ...DEFAULT_SEARCH_SETTINGS,
        sources: ['SMARTRECRUITERS'],
        boards: [{ source: 'SMARTRECRUITERS', slug: 'fixture' }],
      },
    });
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.includes('/postings?'))
        return new Response(
          JSON.stringify({
            totalFound: 4,
            content: [
              {
                id: '1',
                name: 'Senior Project Manager',
                location: { city: 'Warsaw', country: 'pl' },
              },
              {
                id: '2',
                name: 'Project Management Intern',
                location: { city: 'Berlin', country: 'de' },
              },
              {
                id: '3',
                name: 'Płatny staż - Project Management',
                location: { city: 'Warszawa', country: 'pl' },
              },
              {
                id: '4',
                name: 'Project Coordinator',
                experienceLevel: { id: 'mid_senior_level' },
                location: { city: 'Warsaw', country: 'pl' },
              },
            ],
          }),
        );
      expect(value).toBe('https://api.smartrecruiters.com/v1/companies/fixture/postings/3');
      return new Response(
        JSON.stringify({
          id: '3',
          name: 'Płatny staż - Project Management',
          company: { name: 'Synthetic employer' },
          location: { fullLocation: 'Warszawa, Poland', hybrid: true },
          postingUrl: 'https://jobs.smartrecruiters.com/fixture/3-project-management',
          jobAd: {
            sections: {
              jobDescription: {
                title: 'Responsibilities',
                text: '<p>Assist with project delivery, scheduling and stakeholder reporting in the Warsaw team. This is an explicitly synthetic internship fixture.</p>',
              },
              qualifications: {
                title: 'Requirements',
                text: '<p>Must have project coordination skills.</p>',
              },
            },
          },
        }),
      );
    }) as typeof fetch;
    const result = await new JobDiscoveryService(db, new JobService(db), {
      fetchFn,
    }).discoverForCandidate(userId);
    expect(result.newJobsIngested).toBe(1);
    expect(result.postingsExamined).toBe(4);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(fetchFn).mock.calls[0]?.[0])).toContain('country=pl');
    const saved = (await db.select().from(jobs).where(eq(jobs.userId, userId)))[0]!;
    expect(saved.provider).toBe('SMARTRECRUITERS');
    expect(saved.city).toBe('Warszawa');
    expect(saved.seniority).toBe('INTERNSHIP');
    expect(saved.workplaceType).toBe('HYBRID');
    expect(saved.description).toContain('Must have project coordination skills.');
    expect(saved.applicationUrl).toBe(
      'https://jobs.smartrecruiters.com/fixture/3-project-management',
    );
  });
  it('resumes within a partially checked page rather than repeating the same first 1000 rows', async () => {
    const data = Array.from({ length: 1500 }, (_, i) => ({
      title: i === 1250 ? 'Project Manager' : 'Surgeon',
      company_name: 'Synthetic employer',
      url: `https://example.test/${i}`,
      description: 'Synthetic vacancy description for deterministic traversal verification.',
      location: 'Warsaw',
    }));
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data,
            links: { next: 'https://www.arbeitnow.com/api/job-board-api?page=2' },
          }),
        ),
    ) as typeof fetch;
    const service = new JobDiscoveryService(db, new JobService(db), { fetchFn });
    const first = await service.discoverForCandidate(userId, { sources: ['ARBEITNOW'], limit: 1 });
    expect(first.postingsExamined).toBe(1000);
    expect(first.totalDiscovered).toBe(1500);
    expect(first.newJobsIngested).toBe(0);
    const second = await service.discoverForCandidate(userId, { sources: ['ARBEITNOW'], limit: 1 });
    expect(second.newJobsIngested).toBe(1);
    expect(second.postingsExamined).toBe(251);
    const [state] = await db
      .select()
      .from(jobSearchSettings)
      .where(eq(jobSearchSettings.userId, userId));
    expect(state!.cursors['ARBEITNOW:feed:row']).toBe(1251);
  });
  it('upgrades the exact retired built-in catalog and preserves custom boards and workflow opt-ins', async () => {
    const legacy = {
      ...DEFAULT_SEARCH_SETTINGS,
      sources: [
        'ARBEITNOW',
        'GREENHOUSE',
        'LEVER',
        'ASHBY',
      ] as typeof DEFAULT_SEARCH_SETTINGS.sources,
      boards: [
        { source: 'GREENHOUSE' as const, slug: 'revolut' },
        { source: 'GREENHOUSE' as const, slug: 'canonical' },
        { source: 'GREENHOUSE' as const, slug: 'gitlab' },
        { source: 'GREENHOUSE' as const, slug: 'stripe' },
        { source: 'LEVER' as const, slug: 'spotify' },
      ],
      dailyDiscovery: false,
      dailyPreparation: false,
      dailyDigest: false,
    };
    await db.insert(jobSearchSettings).values({ userId, settings: legacy });
    const service = new JobSearchSettingsService(db);
    const upgraded = await service.get(userId);
    expect(upgraded.sources).toContain('SMARTRECRUITERS');
    expect(upgraded.boards).toContainEqual({ source: 'SMARTRECRUITERS', slug: 'BoschGroup' });
    expect(upgraded.dailyDigest).toBe(false);
    expect(upgraded.dailyDiscovery).toBe(false);
    await db
      .update(jobSearchSettings)
      .set({ settings: { ...legacy, boards: [{ source: 'GREENHOUSE', slug: 'custom' }] } })
      .where(eq(jobSearchSettings.userId, userId));
    const custom = await service.get(userId);
    expect(custom.sources).not.toContain('SMARTRECRUITERS');
    expect(custom.boards).toEqual([{ source: 'GREENHOUSE', slug: 'custom' }]);
  });
  it('completes an owned page-shell import without replacing its record, URL or history', async () => {
    const service = new JobService(db);
    const { job } = await service.ingestText(userId, {
      title: 'Sonnedix Careers',
      company: 'Unknown Company',
      url: 'https://example.test/vacancy?id=fixture',
      text: 'Please enable JavaScript to view this page.',
    });
    const completed = await service.updateJob(userId, job.id, {
      description:
        'Title: Project Management Intern\nCompany: Synthetic employer\nLocation: Warsaw, Poland\nResponsibilities:\nAssist with project scheduling and stakeholder reports. This deterministic fixture contains no candidate facts.\nRequirements:\n• Must have project coordination skills.',
    });
    expect(completed.id).toBe(job.id);
    expect(completed.originalUrl).toBe(job.originalUrl);
    expect(completed.title).toBe('Project Management Intern');
    expect(completed.city).toBe('Warsaw');
    expect(completed.seniority).toBe('INTERNSHIP');
    expect(completed.requirements?.length).toBeGreaterThan(0);
    expect(await db.select().from(jobs).where(eq(jobs.userId, userId))).toHaveLength(1);
    await expect(
      service.updateJob(crypto.randomUUID(), job.id, { description: 'Not owned' }),
    ).rejects.toThrow();
  });
});

it('stores short generic fallback text as escaped content, not executable markup', async () => {
  const retrieval = new HttpRetrievalService();
  const url = 'https://example.test/synthetic-vacancy';
  vi.spyOn(retrieval, 'fetchPublicPage').mockResolvedValue({
    url,
    finalUrl: url,
    contentType: 'text/html',
    statusCode: 200,
    content:
      '<html><head><title>Careers</title></head><body>&lt;img src=x onerror=alert(1)&gt;</body></html>',
  });
  const result = await new JobService(db, { retrievalService: retrieval }).ingestUrl(userId, {
    url,
  });
  expect(result.job.state).toBe('NEEDS_REVIEW');
  expect(result.job.description).toContain('<img');
  expect(result.job.descriptionHtml).not.toContain('<img');
  expect(result.job.descriptionHtml).toContain('&lt;img');
});

it('uses optional indexed search only when enabled and preserves the originating publisher', async () => {
  const fetchFn = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          jobs_results: [
            {
              title: 'Junior Project Coordinator',
              company_name: 'Indexed fixture',
              location: 'Warsaw, Poland',
              description:
                'Coordinate project scheduling and stakeholder reports for this deterministic fixture. No candidate facts are included in this public-source test.',
              job_id: 'indexed-fixture',
              via: 'LinkedIn',
              apply_options: [
                { title: 'LinkedIn', link: 'https://www.linkedin.com/jobs/view/12345' },
              ],
            },
          ],
        }),
      ),
  ) as typeof fetch;
  const service = new JobDiscoveryService(db, new JobService(db), {
    fetchFn,
    search: { enabled: true, apiKey: 'fixture-key', maxRequests: 1 },
  });
  const result = await service.discoverForCandidate(userId, { sources: ['GOOGLE_JOBS'] });
  // Role/location search must be explicit; a missing location is never broadened silently.
  expect(fetchFn).not.toHaveBeenCalled();
  expect(result.newJobsIngested).toBe(0);
  await db
    .update(jobPreferences)
    .set({ preferredLocations: ['Warsaw'] })
    .where(eq(jobPreferences.userId, userId));
  const found = await service.discoverForCandidate(userId, { sources: ['GOOGLE_JOBS'] });
  expect(found.newJobsIngested).toBe(1);
  expect(fetchFn).toHaveBeenCalledOnce();
  const list = await new JobService(db).getJobs(userId);
  const detail = await new JobService(db).getJobById(userId, list.items[0]!.id);
  expect(detail.provider).toBe('GOOGLE_JOBS');
  expect(detail.sources?.[0]?.rawMetadata?.via).toBe('LinkedIn');
});
it('preserves first-party provider identifiers when indexed search finds the same destination', async () => {
  await db
    .update(jobPreferences)
    .set({ preferredLocations: ['Warsaw'] })
    .where(eq(jobPreferences.userId, userId));
  const jobService = new JobService(db);
  const url = 'https://jobs.lever.co/fixture/original-id';
  const original = await jobService.ingestText(userId, {
    title: 'Project Manager',
    company: 'Fixture employer',
    url,
    text: 'Title: Project Manager\nCompany: Fixture employer\nLocation: Warsaw, Poland\nA deterministic first-party vacancy for project coordination, stakeholder reporting and delivery planning.',
    provider: 'LEVER',
  });
  await db
    .update(jobs)
    .set({ sourceExternalId: 'original-id', sourceCompanyId: 'fixture' })
    .where(eq(jobs.id, original.job.id));
  const fetchFn = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          jobs_results: [
            {
              title: 'Project Manager',
              company_name: 'Fixture employer',
              location: 'Warsaw, Poland',
              description:
                'A deterministic indexed description of the same vacancy for project coordination, stakeholder reporting and delivery planning.',
              job_id: 'different-index-id',
              via: 'Lever',
              apply_options: [{ title: 'Lever', link: url }],
            },
          ],
        }),
      ),
  ) as typeof fetch;
  const result = await new JobDiscoveryService(db, jobService, {
    fetchFn,
    search: { enabled: true, apiKey: 'fixture-key', maxRequests: 1 },
  }).discoverForCandidate(userId, { sources: ['GOOGLE_JOBS'] });
  expect(result.duplicatesSkipped).toBe(1);
  const [saved] = await db.select().from(jobs).where(eq(jobs.id, original.job.id));
  expect(saved!.provider).toBe('LEVER');
  expect(saved!.sourceExternalId).toBe('original-id');
  expect(saved!.sourceCompanyId).toBe('fixture');
});
it('does not advertise or call an unconfigured search provider', async () => {
  const settings = new JobSearchSettingsService(db, false);
  const visible = await settings.get(userId);
  expect(visible.availableSources).not.toContain('GOOGLE_JOBS');
  await expect(
    settings.save(userId, { ...DEFAULT_SEARCH_SETTINGS, sources: ['GOOGLE_JOBS'] }),
  ).rejects.toThrow('not available');
});
