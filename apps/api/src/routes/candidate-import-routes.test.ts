import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import { eq } from 'drizzle-orm';
import {
  closeDbPool,
  getDb,
  users,
  candidateProfiles,
  candidateExperiences,
  candidateEducation,
  candidateSkills,
  candidateCertifications,
  candidateLanguages,
  candidateProjects,
  candidateLinks,
  candidateFacts,
  candidateDocuments,
  profileImportSessions,
  profileImportItems,
  candidateAuditEvents,
} from '@job-agent/database';

describe('Candidate Smart Profile Import Routes (JOB-SMART-PROFILE-IMPORT)', () => {
  const config = getConfig();
  let app: ReturnType<typeof buildApp>;
  let createdSessionId: string | null = null;
  let testItemId: string | null = null;

  // Isolation Guard: Dedicated disposable test user
  const testUserId = crypto.randomUUID();
  const authHeaders = {
    'x-test-user-id': testUserId,
    'x-test-user-role': 'admin',
  };

  beforeAll(async () => {
    app = buildApp({ config });
    await app.ready();

    const db = getDb(config.DATABASE_URL);
    await db.insert(users).values({
      id: testUserId,
      systemKey: `test_routes_${Date.now()}`,
      name: 'Test Routes Candidate',
      email: `test-routes-${Date.now()}@example.com`,
      emailVerified: true,
      role: 'admin',
    });
    await db.insert(candidateProfiles).values({
      userId: testUserId,
      fullName: 'Test Routes Candidate',
      email: `test-routes-${Date.now()}@example.com`,
    });
  });

  afterAll(async () => {
    const db = getDb(config.DATABASE_URL);
    try {
      await db.delete(candidateAuditEvents).where(eq(candidateAuditEvents.userId, testUserId));
      await db.delete(candidateFacts).where(eq(candidateFacts.userId, testUserId));
      await db.delete(candidateExperiences).where(eq(candidateExperiences.userId, testUserId));
      await db.delete(candidateEducation).where(eq(candidateEducation.userId, testUserId));
      await db.delete(candidateSkills).where(eq(candidateSkills.userId, testUserId));
      await db
        .delete(candidateCertifications)
        .where(eq(candidateCertifications.userId, testUserId));
      await db.delete(candidateLanguages).where(eq(candidateLanguages.userId, testUserId));
      await db.delete(candidateProjects).where(eq(candidateProjects.userId, testUserId));
      await db.delete(candidateLinks).where(eq(candidateLinks.userId, testUserId));
      await db.delete(candidateDocuments).where(eq(candidateDocuments.userId, testUserId));
      await db.delete(profileImportItems).where(eq(profileImportItems.userId, testUserId));
      await db.delete(profileImportSessions).where(eq(profileImportSessions.userId, testUserId));
      await db.delete(candidateProfiles).where(eq(candidateProfiles.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    } catch {
      // Non-blocking cleanup
    }
    await app.close();
    await closeDbPool();
  });

  it('GET /api/candidate/linkedin/status returns official integration status and instructions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/candidate/linkedin/status',
      headers: authHeaders,
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
        ...authHeaders,
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
      headers: authHeaders,
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

    // Save one item ID for item action tests (prefer NEW item)
    const targetItem =
      body.data.items.find((i: any) => i.classification === 'NEW') || body.data.items[0];
    testItemId = targetItem.id;
  });

  it('GET /api/candidate/import/:sessionId returns the session and all review items', async () => {
    expect(createdSessionId).toBeDefined();

    const res = await app.inject({
      method: 'GET',
      url: `/api/candidate/import/${createdSessionId}`,
      headers: authHeaders,
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

    const sessionRes = await app.inject({
      method: 'GET',
      url: `/api/candidate/import/${createdSessionId}`,
      headers: authHeaders,
    });
    const currentItem = JSON.parse(sessionRes.body).data.items.find(
      (i: any) => i.id === testItemId,
    );
    const isConflict = currentItem?.classification === 'CONFLICT';

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/candidate/import/${createdSessionId}/items/${testItemId}`,
      headers: authHeaders,
      payload: {
        action: 'APPROVED',
        ...(isConflict ? { conflictResolution: 'REPLACE_EXISTING' } : {}),
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
      headers: authHeaders,
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
      headers: authHeaders,
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
      headers: authHeaders,
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
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.some((s: any) => s.id === createdSessionId)).toBe(true);
  });

  it('POST /api/candidate/import/:sessionId/commit rejects allowAiOnCommit: true if verifyOnCommit: false (Invariant Enforced)', async () => {
    // Create new session to test commit validation
    const boundary = '----WebKitFormBoundaryTestValidation123';
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="sourceType"',
      '',
      'CV',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="validation_cv.txt"',
      'Content-Type: text/plain',
      '',
      'Alice Dev\nSenior Engineer\nSkills: TypeScript\n',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const uploadRes = await app.inject({
      method: 'POST',
      url: '/api/candidate/import/upload',
      headers: {
        ...authHeaders,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });
    const session = JSON.parse(uploadRes.body).data;

    // Try committing with allowAiOnCommit=true and verifyOnCommit=false
    const commitRes = await app.inject({
      method: 'POST',
      url: `/api/candidate/import/${session.id}/commit`,
      headers: authHeaders,
      payload: {
        verifyOnCommit: false,
        allowAiOnCommit: true,
      },
    });

    expect(commitRes.statusCode).toBe(400);
    const commitBody = JSON.parse(commitRes.body);
    expect(commitBody.error?.message || commitBody.message).toContain(
      'allowAiUse=true requires verificationStatus=VERIFIED',
    );
  });

  it('POST /api/candidate/import/upload preserves active Master CV by default when replaceMasterCv is false', async () => {
    const boundary = '----WebKitFormBoundaryTestPreserveMaster';
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="sourceType"',
      '',
      'CV',
      `--${boundary}`,
      'Content-Disposition: form-data; name="replaceMasterCv"',
      '',
      'false',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="supporting_cv.txt"',
      'Content-Type: text/plain',
      '',
      'Bob Dev\nStaff Engineer\n',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const res = await app.inject({
      method: 'POST',
      url: '/api/candidate/import/upload',
      headers: {
        ...authHeaders,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(201);
  });
});
