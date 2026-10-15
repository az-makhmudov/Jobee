import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import { closeDbPool, getDb, getOrCreatePrimaryUser } from '@job-agent/database';

describe('Candidate Smart Profile Import Routes (JOB-SMART-PROFILE-IMPORT)', () => {
  const config = getConfig();
  let app: ReturnType<typeof buildApp>;
  let createdSessionId: string | null = null;
  let testItemId: string | null = null;

  beforeAll(async () => {
    app = buildApp({ config });
    await app.ready();

    const db = getDb(config.DATABASE_URL);
    await getOrCreatePrimaryUser(db);
  });

  afterAll(async () => {
    await app.close();
    await closeDbPool();
  });

  it('GET /api/candidate/linkedin/status returns official integration status and instructions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/candidate/linkedin/status',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.data.recommendedMethod).toBe('PDF_EXPORT');
    expect(body.data.howToExport).toBeDefined();
    expect(body.data.howToExport.length).toBeGreaterThan(0);
  });

  it('POST /api/candidate/import/upload uploads a CV document and initializes session', async () => {
    const resumeText = `Asadbek Makhmudov
Lead Systems Architect
Email: asadbek.dev@example.com | Phone: +49 151 9876543
Berlin, Germany
https://linkedin.com/in/asadbek-dev

Professional Summary
Senior architect with extensive experience in cloud distributed systems and AI applications.

Work Experience
Global Fintech Corp (2022-01 - Present)
• Led development of core ledger microservices.
• Optimized query throughput by 50%.

Education
Technical University Berlin
Master of Science in Software Engineering (2018 - 2020)

Technical Skills
TypeScript, Node.js, Fastify, Docker, Cloudflare R2, PostgreSQL

Languages
English (Fluent), German (Professional)
`;

    const boundary = '----WebKitFormBoundaryTestImport1234';
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="sourceType"',
      '',
      'CV',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="sample_cv.txt"',
      'Content-Type: text/plain',
      '',
      resumeText,
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const res = await app.inject({
      method: 'POST',
      url: '/api/candidate/import/upload',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.data.id).toBeDefined();
    expect(body.data.status).toBe('PENDING');
    expect(body.data.sourceType).toBe('CV');
    expect(body.data.originalFilename).toBe('sample_cv.txt');

    createdSessionId = body.data.id;
  });

  it('POST /api/candidate/import/:sessionId/extract extracts information and compares with Candidate Brain', async () => {
    expect(createdSessionId).toBeDefined();

    const res = await app.inject({
      method: 'POST',
      url: `/api/candidate/import/${createdSessionId}/extract`,
      payload: {
        aiConsent: false, // Tests local deterministic parser and comparison
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.data.status).toBe('REVIEW_READY');
    expect(body.data.extractorUsed).toBe('HEURISTIC_PARSER');
    expect(body.data.items).toBeDefined();
    expect(body.data.items.length).toBeGreaterThan(0);

    // Save one item ID for item action tests
    testItemId = body.data.items[0].id;
  });

  it('GET /api/candidate/import/:sessionId returns the session and all review items', async () => {
    expect(createdSessionId).toBeDefined();

    const res = await app.inject({
      method: 'GET',
      url: `/api/candidate/import/${createdSessionId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.data.id).toBe(createdSessionId);
    expect(body.data.itemCounts).toBeDefined();
    expect(body.data.itemCounts.total).toBeGreaterThan(0);
    expect(body.data.items.length).toBeGreaterThan(0);

    // Verify every item has a classification
    for (const item of body.data.items) {
      expect(['NEW', 'DUPLICATE', 'MATCHED', 'CONFLICT', 'INCOMPLETE', 'LOW_CONFIDENCE']).toContain(
        item.classification,
      );
      expect(item.reviewStatus).toBe('PENDING');
    }
  });

  it('PATCH /api/candidate/import/:sessionId/items/:itemId approves a review item', async () => {
    expect(createdSessionId).toBeDefined();
    expect(testItemId).toBeDefined();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/candidate/import/${createdSessionId}/items/${testItemId}`,
      payload: {
        action: 'APPROVED',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.data.id).toBe(testItemId);
    expect(body.data.reviewStatus).toBe('APPROVED');
  });

  it('POST /api/candidate/import/:sessionId/items/bulk approves all new items in bulk', async () => {
    expect(createdSessionId).toBeDefined();

    const res = await app.inject({
      method: 'POST',
      url: `/api/candidate/import/${createdSessionId}/items/bulk`,
      payload: {
        action: 'APPROVE_ALL_NEW',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.data.updatedCount).toBeGreaterThanOrEqual(0);
  });

  it('POST /api/candidate/import/:sessionId/commit commits approved items to Candidate Brain', async () => {
    expect(createdSessionId).toBeDefined();

    const res = await app.inject({
      method: 'POST',
      url: `/api/candidate/import/${createdSessionId}/commit`,
      payload: {
        verifyOnCommit: false, // Preserves invariant: defaults to UNVERIFIED
        allowAiOnCommit: false, // Preserves invariant: defaults to allowAiUse: false
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.data.sessionId).toBe(createdSessionId);
    expect(body.data.committedCounts).toBeDefined();
    expect(body.data.newProfileCompleteness).toBeDefined();
    expect(body.data.newProfileCompleteness.score).toBeGreaterThanOrEqual(0);
  });

  it('POST /api/candidate/import/:sessionId/commit rejects duplicate commit on already committed session', async () => {
    expect(createdSessionId).toBeDefined();

    const res = await app.inject({
      method: 'POST',
      url: `/api/candidate/import/${createdSessionId}/commit`,
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error?.message || body.message).toContain('already been committed');
  });

  it('GET /api/candidate/import lists recent import sessions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/candidate/import',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.some((s: any) => s.id === createdSessionId)).toBe(true);
  });
});
