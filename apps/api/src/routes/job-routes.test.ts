import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import { closeDbPool } from '@job-agent/database';

describe('Job Routes Integration Tests', () => {
  const config = getConfig();
  let app: ReturnType<typeof buildApp>;
  let createdJobId: string;
  const runId = `job-routes-${crypto.randomUUID()}`;
  const testCompany = `CloudScale Enterprise ${runId}`;

  beforeAll(async () => {
    app = buildApp({ config });
    await app.ready();
  });

  afterAll(async () => {
    if (createdJobId) {
      const { getDb, jobs } = await import('@job-agent/database');
      const { eq } = await import('drizzle-orm');
      const db = getDb(config.DATABASE_URL);
      await db.delete(jobs).where(eq(jobs.id, createdJobId));
    }
    await app.close();
    await closeDbPool();
  });

  describe('POST /api/jobs/text', () => {
    it('successfully ingests a pasted text job with structured requirements and sections', async () => {
      const payload = {
        text: `
Job Title: Principal Backend Engineer
Company: ${testCompany}
Location: Berlin, Germany
Salary: €100,000 - €130,000

About the role:
We are expanding our core backend engineering team.

Responsibilities:
• Architect distributed message processing systems
• Scale PostgreSQL clusters and streaming infrastructure
• Mentor senior engineers

Requirements:
• 8+ years of backend engineering experience
• Deep experience with Node.js, Go, or Rust
• Strong database design skills with PostgreSQL
        `,
        sourceNotes: 'Found on engineering careers portal',
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/text',
        payload,
      });

      const body = JSON.parse(res.body);
      if (body.data?.job?.id) {
        createdJobId = body.data.job.id;
      }

      expect(res.statusCode).toBe(201);
      expect(body.status).toBe('ok');
      expect(body.data.job).toBeDefined();
      expect(body.data.isDuplicate).toBe(false);

      const job = body.data.job;
      expect(job.title).toBe('Principal Backend Engineer');
      expect(job.company).toBe(testCompany);
      expect(job.locationText).toBe('Berlin, Germany');
      expect(job.city).toBe('Berlin');
      expect(job.country).toBe('Germany');
      expect(job.state).toBe('INGESTED');
      expect(job.requirements.length).toBeGreaterThanOrEqual(3);
      expect(job.sources.length).toBe(1);
      expect(job.sources[0].provider).toBe('MANUAL');
      expect(job.events.length).toBeGreaterThanOrEqual(1);
      expect(job.events[0].eventType).toBe('JOB_INGESTED');
    });

    it('detects duplicate ingestion idempotently and creates duplicate source record', async () => {
      const payload = {
        text: `
Job Title: Principal Backend Engineer
Company: ${testCompany}
Location: Berlin, Germany
Salary: €100,000 - €130,000

About the role:
We are expanding our core backend engineering team.

Responsibilities:
• Architect distributed message processing systems
• Scale PostgreSQL clusters and streaming infrastructure
• Mentor senior engineers

Requirements:
• 8+ years of backend engineering experience
• Deep experience with Node.js, Go, or Rust
• Strong database design skills with PostgreSQL
        `,
        sourceNotes: 'Pasted second time by mistake',
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/text',
        payload,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(body.data.isDuplicate).toBe(true);
      expect(body.data.job.id).toBe(createdJobId);

      // Verify a duplicate source was appended
      expect(body.data.job.sources.length).toBe(2);
      expect(
        body.data.job.sources.some(
          (s: { ingestionStatus: string }) => s.ingestionStatus === 'DUPLICATE',
        ),
      ).toBe(true);

      // Verify duplicate event was recorded
      const hasDuplicateEvent = body.data.job.events.some(
        (e: { eventType: string }) => e.eventType === 'JOB_DUPLICATE_DETECTED',
      );
      expect(hasDuplicateEvent).toBe(true);
    });

    it('rejects text ingestion with empty or short text (< 20 chars)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/text',
        payload: { text: 'too short' },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('error');
    });
  });

  describe('POST /api/jobs/url', () => {
    it('validates URL format and rejects invalid URLs', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/url',
        payload: { url: 'not-a-valid-url' },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('error');
    });

    it('blocks SSRF attempts targeting localhost or private IPs', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/url',
        payload: { url: 'http://127.0.0.1:8080/internal-job' },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('error');
      expect(body.error.message).toMatch(/prohibited/);
    });
  });

  describe('GET /api/jobs (Inbox & List)', () => {
    it('lists jobs with pagination and default sort by ingestedAt desc', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/jobs?limit=10&page=1',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(Array.isArray(body.data.items)).toBe(true);
      expect(body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(body.data.page).toBe(1);
      expect(body.data.total).toBeGreaterThanOrEqual(1);

      const found = body.data.items.find((j: { id: string }) => j.id === createdJobId);
      expect(found).toBeDefined();
      expect(found.title).toBe('Principal Backend Engineer');
    });

    it('filters jobs by state', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/jobs?state=INGESTED',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.items.every((j: { state: string }) => j.state === 'INGESTED')).toBe(true);
    });

    it('searches jobs by keyword', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/jobs?search=${runId}`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(body.data.items[0].company).toContain(String(runId));
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('retrieves full job details including requirements, sections, sources, and events', async () => {
      expect(createdJobId).toBeDefined();
      const res = await app.inject({
        method: 'GET',
        url: `/api/jobs/${createdJobId}`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(body.data.id).toBe(createdJobId);
      expect(body.data.requirements).toBeDefined();
      expect(body.data.sections).toBeDefined();
      expect(body.data.sources).toBeDefined();
      expect(body.data.events).toBeDefined();
    });

    it('returns 404 for nonexistent job ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/jobs/00000000-0000-0000-0000-000000000000',
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/jobs/:id (Manual Correction)', () => {
    it('allows correcting normalized fields while preserving raw source provenance', async () => {
      expect(createdJobId).toBeDefined();
      const updates = {
        title: 'Lead Distributed Systems Engineer',
        company: `${testCompany} Global`,
        city: 'Munich',
        country: 'Germany',
        department: 'Core Platform',
      };

      const res = await app.inject({
        method: 'PUT',
        url: `/api/jobs/${createdJobId}`,
        payload: updates,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(body.data.title).toBe('Lead Distributed Systems Engineer');
      expect(body.data.company).toBe(`${testCompany} Global`);
      expect(body.data.city).toBe('Munich');
      expect(body.data.department).toBe('Core Platform');

      // Verify raw source still retains original raw text
      expect(
        body.data.sources.some((s: { rawDescription: string }) =>
          s.rawDescription.includes('Principal Backend Engineer'),
        ),
      ).toBe(true);

      // Verify audit event was logged
      const updateEvent = body.data.events.find(
        (e: { eventType: string }) => e.eventType === 'JOB_UPDATED',
      );
      expect(updateEvent).toBeDefined();
    });
  });

  describe('POST /api/jobs/:id/archive', () => {
    it('archives job and logs event', async () => {
      expect(createdJobId).toBeDefined();
      const res = await app.inject({
        method: 'POST',
        url: `/api/jobs/${createdJobId}/archive`,
        payload: { reason: 'Position no longer accepting applications' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(body.data.state).toBe('ARCHIVED');

      const archiveEvent = body.data.events.find(
        (e: { eventType: string }) => e.eventType === 'JOB_ARCHIVED',
      );
      expect(archiveEvent).toBeDefined();
      expect(archiveEvent.metadata.reason).toBe('Position no longer accepting applications');
    });
  });

  describe('GET /api/jobs/metrics', () => {
    it('returns dashboard counts accurately', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/jobs/metrics',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(body.data.totalJobs).toBeGreaterThanOrEqual(1);
      expect(body.data.archivedJobs).toBeGreaterThanOrEqual(1);
      expect(body.data.providerCounts).toBeDefined();
    });
  });
});
