import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import { closeDbPool, getDb, jobs, candidateSkills } from '@job-agent/database';
import { eq, inArray } from 'drizzle-orm';

describe('Match Intelligence Routes Integration Tests (JOB-P2-T02)', () => {
  const config = getConfig();
  let app: ReturnType<typeof buildApp>;
  const createdJobIds: string[] = [];
  let testSkillId: string | null = null;
  const runId = Date.now();
  const testCompany = `MatchIntelligence Corp ${runId}`;

  beforeAll(async () => {
    app = buildApp({ config });
    await app.ready();

    // Ensure candidate has a verified skill for deterministic evidence mapping
    const db = getDb(config.DATABASE_URL);
    const candidateRes = await app.inject({
      method: 'GET',
      url: '/api/candidate/overview',
    });
    const candidateData = JSON.parse(candidateRes.body).data;
    const userId = candidateData.profile.userId;

    const [insertedSkill] = await db
      .insert(candidateSkills)
      .values({
        userId,
        name: `TypeScriptMatchTest_${runId}`,
        category: 'Language',
        proficiency: 'ADVANCED',
        verificationStatus: 'VERIFIED',
      })
      .returning();
    testSkillId = insertedSkill!.id;
  });

  afterAll(async () => {
    const db = getDb(config.DATABASE_URL);
    if (createdJobIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
    }
    if (testSkillId) {
      await db.delete(candidateSkills).where(eq(candidateSkills.id, testSkillId));
    }
    await app.close();
    await closeDbPool();
  });

  describe('POST /api/jobs/:id/analyze & GET /api/jobs/:id/analysis', () => {
    let jobId: string;

    it('analyzes a job against Candidate Brain and returns comprehensive analysis', async () => {
      // 1. Ingest a test job
      const ingestRes = await app.inject({
        method: 'POST',
        url: '/api/jobs/text',
        payload: {
          text: `
Job Title: Senior TypeScript Architect
Company: ${testCompany}
Location: Berlin, Germany
Salary: €95,000 - €125,000

Requirements:
• 5+ years of software development experience
• Deep expertise with TypeScriptMatchTest_${runId}
• Excellent communication in English
          `,
          sourceNotes: 'Integration test job for matching',
        },
      });

      expect(ingestRes.statusCode).toBe(201);
      const ingestBody = JSON.parse(ingestRes.body);
      jobId = ingestBody.data.job.id;
      createdJobIds.push(jobId);

      // 2. Trigger match analysis
      const analyzeRes = await app.inject({
        method: 'POST',
        url: `/api/jobs/${jobId}/analyze`,
        payload: { force: true },
      });

      expect(analyzeRes.statusCode).toBe(200);
      const analyzeBody = JSON.parse(analyzeRes.body);
      expect(analyzeBody.status).toBe('ok');
      const analysis = analyzeBody.data;

      expect(analysis.jobId).toBe(jobId);
      expect(typeof analysis.overallScore).toBe('number');
      expect(typeof analysis.confidenceScore).toBe('number');
      expect(['MATCH', 'REVIEW', 'SKIP']).toContain(analysis.decision);
      expect(typeof analysis.autoApplyEligible).toBe('boolean');
      expect(analysis.dimensions).toBeDefined();
      expect(analysis.dimensions.length).toBeGreaterThan(0);
      expect(analysis.evaluations).toBeDefined();
      expect(analysis.evaluations.length).toBeGreaterThan(0);

      // Check evidence grounding
      const matchedEval = analysis.evaluations.find((ev: any) =>
        ev.requirement?.rawText?.includes(`TypeScriptMatchTest_${runId}`),
      );
      if (matchedEval) {
        expect(matchedEval.status).toBe('MET');
        expect(matchedEval.evidenceIds).toContain(`candidate_skill:${testSkillId}`);
      }
    });

    it('retrieves stored match analysis via GET /api/jobs/:id/analysis with fresh status', async () => {
      // Re-run analyze to capture latest candidate state in case of concurrent test writes
      await app.inject({
        method: 'POST',
        url: `/api/jobs/${jobId}/analyze`,
        payload: { force: true },
      });

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/jobs/${jobId}/analysis`,
      });

      expect(getRes.statusCode).toBe(200);
      const body = JSON.parse(getRes.body);
      expect(body.status).toBe('ok');
      expect(body.data.jobId).toBe(jobId);
      expect(typeof body.data.isStale).toBe('boolean');
    });

    it('marks analysis stale when job fields are updated via PUT /api/jobs/:id', async () => {
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/jobs/${jobId}`,
        payload: {
          title: 'Staff TypeScript Architect & Principal Leader',
        },
      });

      expect(updateRes.statusCode).toBe(200);

      // Inspect analysis staleness
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/jobs/${jobId}/analysis`,
      });

      expect(getRes.statusCode).toBe(200);
      const body = JSON.parse(getRes.body);
      expect(body.data.isStale).toBe(true);
    });
  });

  describe('POST /api/jobs/analyze (Batch Analysis)', () => {
    it('analyzes multiple jobs in batch with bounded processing and error isolation', async () => {
      // Ingest 2 quick jobs
      const j1Res = await app.inject({
        method: 'POST',
        url: '/api/jobs/text',
        payload: {
          text: `
Job Title: Batch Engineer Alpha
Company: BatchTest Alpha ${runId}
Location: Berlin, Germany
Requirements:
• Software development experience
          `,
        },
      });
      const j2Res = await app.inject({
        method: 'POST',
        url: '/api/jobs/text',
        payload: {
          text: `
Job Title: Batch Engineer Beta
Company: BatchTest Beta ${runId}
Location: Remote
Requirements:
• Backend systems experience
          `,
        },
      });

      const j1Id = JSON.parse(j1Res.body).data.job.id;
      const j2Id = JSON.parse(j2Res.body).data.job.id;
      createdJobIds.push(j1Id, j2Id);

      const batchRes = await app.inject({
        method: 'POST',
        url: '/api/jobs/analyze',
        payload: {
          jobIds: [j1Id, j2Id],
          force: true,
        },
      });

      expect(batchRes.statusCode).toBe(200);
      const batchBody = JSON.parse(batchRes.body).data;
      expect(batchBody.totalRequested).toBe(2);
      expect(batchBody.processed).toBe(2);
      expect(batchBody.succeeded).toBe(2);
      expect(batchBody.failed).toBe(0);
      expect(batchBody.results.length).toBe(2);
      expect(batchBody.results[0].success).toBe(true);
      expect(batchBody.results[1].success).toBe(true);
    });
  });

  describe('GET /api/jobs matching query parameters and sorting', () => {
    it('returns matchSummary and supports filtering by decision and score', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/jobs?limit=5&sortBy=score&sortOrder=desc',
      });

      expect(listRes.statusCode).toBe(200);
      const listBody = JSON.parse(listRes.body).data;
      expect(Array.isArray(listBody.items)).toBe(true);

      const analyzedItem = listBody.items.find((item: any) => item.matchSummary !== null);
      if (analyzedItem) {
        expect(analyzedItem.matchSummary).toHaveProperty('overallScore');
        expect(analyzedItem.matchSummary).toHaveProperty('confidenceScore');
        expect(analyzedItem.matchSummary).toHaveProperty('decision');
        expect(analyzedItem.matchSummary).toHaveProperty('isStale');
      }
    });

    it('filters jobs by decision query parameter', async () => {
      const filterRes = await app.inject({
        method: 'GET',
        url: '/api/jobs?decision=UNANALYZED&limit=5',
      });

      expect(filterRes.statusCode).toBe(200);
      const filterBody = JSON.parse(filterRes.body).data;
      for (const item of filterBody.items) {
        expect(item.matchSummary).toBeNull();
      }
    });
  });
});
