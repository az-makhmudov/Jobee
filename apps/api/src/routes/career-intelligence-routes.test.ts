import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import {
  closeDbPool,
  getDb,
  getOrCreatePrimaryUser,
  candidateSkills,
  candidateIntelligenceSuggestions,
} from '@job-agent/database';
import { eq, inArray } from 'drizzle-orm';

describe('Career Intelligence Routes Integration & Contract Tests (JOB-CAREER-INTEL-2.0)', () => {
  const config = getConfig();
  let app: ReturnType<typeof buildApp>;
  const db = getDb(config.DATABASE_URL);
  let primaryUserId: string;
  let testSkillId: string | null = null;
  const createdSuggestionIds: string[] = [];
  const runId = Date.now();

  beforeAll(async () => {
    app = buildApp({ config });
    await app.ready();

    const user = await getOrCreatePrimaryUser(db);
    primaryUserId = user.id;

    // Seed a test skill for record authorization tests
    const [skill] = await db
      .insert(candidateSkills)
      .values({
        userId: primaryUserId,
        name: `CareerIntelRouteSkill_${runId}`,
        category: 'Testing',
        proficiency: 'INTERMEDIATE',
        verificationStatus: 'UNVERIFIED',
        allowAiUse: false,
      })
      .returning();
    testSkillId = skill!.id;
  });

  afterAll(async () => {
    if (testSkillId) {
      await db.delete(candidateSkills).where(eq(candidateSkills.id, testSkillId));
    }
    if (createdSuggestionIds.length > 0) {
      await db
        .delete(candidateIntelligenceSuggestions)
        .where(inArray(candidateIntelligenceSuggestions.id, createdSuggestionIds));
    }
    await app.close();
    await closeDbPool();
  });

  it('1. GET /api/candidate/intelligence returns standard { status: "ok", data, timestamp } envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/candidate/intelligence',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    // Verify standard envelope structure
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
    expect(body.data).toBeDefined();

    // Verify overview payload structure
    expect(body.data.summary).toBeDefined();
    expect(typeof body.data.summary.verifiedCount).toBe('number');
    expect(body.data.contextVersion).toBeDefined();
    expect(typeof body.data.candidateStateHash).toBe('string');
    expect(body.data.candidateStateHash.length).toBeGreaterThan(0);
  });

  it('2. GET /api/candidate/intelligence/records returns records and counts in standard envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/candidate/intelligence/records',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.status).toBe('ok');
    expect(body.data).toBeDefined();
    expect(body.data.records).toBeDefined();
    expect(Array.isArray(body.data.records.skills)).toBe(true);
    expect(body.data.counts).toBeDefined();
    expect(typeof body.data.counts.total).toBe('number');
    expect(typeof body.data.counts.verified).toBe('number');
    expect(typeof body.data.counts.aiAuthorized).toBe('number');
  });

  it('3. POST /api/candidate/intelligence/enrich returns suggestions and deduplicates consecutive calls', async () => {
    // First enrichment run
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/candidate/intelligence/enrich',
      payload: {},
    });

    expect(res1.statusCode).toBe(200);
    const body1 = JSON.parse(res1.body);

    expect(body1.status).toBe('ok');
    expect(body1.data).toBeDefined();
    expect(body1.data.userId).toBe(primaryUserId);
    expect(typeof body1.data.suggestionsCount).toBe('number');
    expect(typeof body1.data.suggestionsCreated).toBe('number');
    expect(Array.isArray(body1.data.suggestions)).toBe(true);

    // Track created suggestions for cleanup
    for (const s of body1.data.suggestions) {
      createdSuggestionIds.push(s.id);
    }

    // Second consecutive enrichment run: should deduplicate pending suggestions
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/candidate/intelligence/enrich',
      payload: {},
    });

    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.body);

    expect(body2.status).toBe('ok');
    expect(body2.data).toBeDefined();
    // suggestionsCreated must be 0 because all pending suggestions were already created
    expect(body2.data.suggestionsCreated).toBe(0);
    // suggestionsCount should remain equal to existing pending suggestions
    expect(body2.data.suggestionsCount).toBe(body1.data.suggestionsCount);
  });

  it('4. GET /api/candidate/intelligence/suggestions returns suggestions list in standard envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/candidate/intelligence/suggestions?status=PENDING',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.status).toBe('ok');
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.suggestions)).toBe(true);
  });

  it('5. PATCH /api/candidate/intelligence/records/:entityType/:id verifies record and enforces AI invariant', async () => {
    if (!testSkillId) return;

    // Invariant check: Cannot set allowAiUse=true when verificationStatus is UNVERIFIED
    const invalidRes = await app.inject({
      method: 'PATCH',
      url: `/api/candidate/intelligence/records/skills/${testSkillId}`,
      payload: { allowAiUse: true },
    });
    expect(invalidRes.statusCode).toBe(400);

    // Step 1: Explicitly verify record
    const verifyRes = await app.inject({
      method: 'PATCH',
      url: `/api/candidate/intelligence/records/skills/${testSkillId}`,
      payload: { verificationStatus: 'VERIFIED' },
    });
    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = JSON.parse(verifyRes.body);
    expect(verifyBody.status).toBe('ok');
    expect(verifyBody.data.success).toBe(true);
    expect(verifyBody.data.record.verificationStatus).toBe('VERIFIED');
    expect(verifyBody.data.record.allowAiUse).toBe(false); // Does not silently grant AI use

    // Step 2: Explicitly authorize AI use
    const aiRes = await app.inject({
      method: 'PATCH',
      url: `/api/candidate/intelligence/records/skills/${testSkillId}`,
      payload: { allowAiUse: true },
    });
    expect(aiRes.statusCode).toBe(200);
    const aiBody = JSON.parse(aiRes.body);
    expect(aiBody.status).toBe('ok');
    expect(aiBody.data.record.allowAiUse).toBe(true);
  });

  it('6. POST /api/candidate/intelligence/records/batch-authorize updates multiple records in standard envelope', async () => {
    if (!testSkillId) return;

    const res = await app.inject({
      method: 'POST',
      url: '/api/candidate/intelligence/records/batch-authorize',
      payload: {
        items: [
          {
            entityType: 'skills',
            id: testSkillId,
            verificationStatus: 'VERIFIED',
            allowAiUse: false,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.data.success).toBe(true);
    expect(body.data.updatedCount).toBe(1);
  });

  it('7. GET /api/candidate/learned-preferences and reset return standard envelopes', async () => {
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/candidate/learned-preferences',
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    expect(getBody.status).toBe('ok');
    expect(getBody.data.learnedPreferences).toBeDefined();

    const resetRes = await app.inject({
      method: 'POST',
      url: '/api/candidate/learned-preferences/reset',
    });

    expect(resetRes.statusCode).toBe(200);
    const resetBody = JSON.parse(resetRes.body);
    expect(resetBody.status).toBe('ok');
    expect(resetBody.data.success).toBe(true);
    expect(resetBody.data.learnedPreferences).toBeDefined();
  });

  it('8. Frontend client request helper safely extracts data and never returns undefined', async () => {
    // Simulate what career-intelligence-client.ts request() does
    const res = await app.inject({
      method: 'GET',
      url: '/api/candidate/intelligence',
    });

    const json = JSON.parse(res.body);
    const data = json && typeof json === 'object' && 'data' in json ? json.data : json;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();
    expect(data.summary).toBeDefined();
    expect(data.candidateStateHash).toBeDefined();
  });
});
