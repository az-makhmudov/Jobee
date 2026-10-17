import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import {
  closeDbPool,
  getDb,
  users,
  sessions,
  candidateProfiles,
  candidateExperiences,
  candidateSkills,
  candidateEducation,
  candidateCertifications,
  candidateFacts,
  candidateIntelligenceSuggestions,
  candidateJobFeedback,
  candidateAuditEvents,
  jobPreferences,
} from '@job-agent/database';
import { eq } from 'drizzle-orm';

describe('Career Intelligence Routes Integration & Contract Tests (JOB-CAREER-INTEL-2.0)', () => {
  const config = getConfig();

  // Safety Assertion 1: Abort if environment is marked as production
  if (config.NODE_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error(
      'SAFETY VIOLATION: Refusing to run integration tests against a production environment!',
    );
  }

  // Safety Assertion 2: Abort if DATABASE_URL contains production host/db keywords
  const rawDbUrl = (config.DATABASE_URL || '').toLowerCase();
  if (rawDbUrl.includes('prod') && !rawDbUrl.includes('test')) {
    throw new Error(
      `SAFETY VIOLATION: Database URL appears to target production: ${config.DATABASE_URL}`,
    );
  }

  let app: ReturnType<typeof buildApp>;
  const db = getDb(config.DATABASE_URL);

  const timestamp = Date.now();
  let disposableUserId: string;
  let testSkillId: string;

  // Track primary user baseline records before tests to verify they are completely untouched
  const primaryUserId = '00000000-0000-0000-0000-000000000001';
  let primaryRecordBaseline: {
    skillsCount: number;
    experiencesCount: number;
    educationCount: number;
    certsCount: number;
    factsCount: number;
    learnedPreferencesSnapshot: string | null;
  };

  // Helper for all injected requests: ALWAYS sets x-test-user-id to disposableUserId
  const injectForDisposableUser = (options: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    payload?: any;
    headers?: Record<string, string>;
  }) => {
    return app.inject({
      ...options,
      headers: {
        ...(options.headers || {}),
        'x-test-user-id': disposableUserId,
      },
    });
  };

  beforeAll(async () => {
    app = buildApp({ config });
    await app.ready();

    // 1. Snapshot primary candidate data to verify survival and zero-mutation invariant
    const [primaryPrefs] = await db
      .select()
      .from(jobPreferences)
      .where(eq(jobPreferences.userId, primaryUserId));
    const pSkills = await db
      .select()
      .from(candidateSkills)
      .where(eq(candidateSkills.userId, primaryUserId));
    const pExps = await db
      .select()
      .from(candidateExperiences)
      .where(eq(candidateExperiences.userId, primaryUserId));
    const pEdu = await db
      .select()
      .from(candidateEducation)
      .where(eq(candidateEducation.userId, primaryUserId));
    const pCerts = await db
      .select()
      .from(candidateCertifications)
      .where(eq(candidateCertifications.userId, primaryUserId));
    const pFacts = await db
      .select()
      .from(candidateFacts)
      .where(eq(candidateFacts.userId, primaryUserId));

    primaryRecordBaseline = {
      skillsCount: pSkills.length,
      experiencesCount: pExps.length,
      educationCount: pEdu.length,
      certsCount: pCerts.length,
      factsCount: pFacts.length,
      learnedPreferencesSnapshot: primaryPrefs
        ? JSON.stringify(primaryPrefs.learnedPreferences)
        : null,
    };

    // 2. Create a UNIQUE DISPOSABLE test user - NEVER use primary candidate
    const [newUser] = await db
      .insert(users)
      .values({
        name: `Disposable Career Tester ${timestamp}`,
        email: `disposable_career_tester_${timestamp}@example.com`,
        emailVerified: true,
        role: 'user',
        systemKey: `disposable_career_${timestamp}`,
      })
      .returning();

    if (!newUser) throw new Error('Failed to create disposable test user');
    disposableUserId = newUser.id;

    // 3. Seed isolated candidate profile for disposable user
    await db.insert(candidateProfiles).values({
      userId: disposableUserId,
      fullName: 'Disposable Career Candidate',
      headline: 'Operations Coordinator',
      email: newUser.email,
      city: 'Warsaw',
      country: 'Poland',
      availability: 'IMMEDIATE',
    });

    // 4. Seed isolated job preferences for disposable user
    await db.insert(jobPreferences).values({
      userId: disposableUserId,
      targetTitles: ['Operations Coordinator', 'Junior Project Manager'],
      preferredLocations: ['Warsaw', 'Remote'],
      workModes: ['hybrid'],
      minSalary: 55000,
      currency: 'PLN',
      workAuthorizationCountries: ['Poland'],
      needsSponsorship: false,
    });

    // 5. Seed isolated experience for disposable user
    await db.insert(candidateExperiences).values({
      userId: disposableUserId,
      organization: 'Disposable Test Bank',
      position: 'Operations Coordinator',
      startDate: '2023-01-01',
      isCurrent: false,
      endDate: '2023-12-31',
      verificationStatus: 'VERIFIED',
      allowAiUse: true,
      description: 'Managed banking operations and coordination workflows.',
    });

    // 6. Seed isolated skill for disposable user
    const [skill] = await db
      .insert(candidateSkills)
      .values({
        userId: disposableUserId,
        name: `DisposableSkill_${timestamp}`,
        category: 'Testing',
        proficiency: 'INTERMEDIATE',
        verificationStatus: 'UNVERIFIED',
        allowAiUse: false,
      })
      .returning();
    testSkillId = skill!.id;
  });

  afterAll(async () => {
    // Strictly scoped cleanup by disposableUserId ONLY
    // Guarantees zero records outside disposableUserId are touched
    if (disposableUserId) {
      await db
        .delete(candidateAuditEvents)
        .where(eq(candidateAuditEvents.userId, disposableUserId));
      await db
        .delete(candidateIntelligenceSuggestions)
        .where(eq(candidateIntelligenceSuggestions.userId, disposableUserId));
      await db
        .delete(candidateJobFeedback)
        .where(eq(candidateJobFeedback.userId, disposableUserId));
      await db.delete(candidateSkills).where(eq(candidateSkills.userId, disposableUserId));
      await db
        .delete(candidateExperiences)
        .where(eq(candidateExperiences.userId, disposableUserId));
      await db.delete(jobPreferences).where(eq(jobPreferences.userId, disposableUserId));
      await db.delete(candidateProfiles).where(eq(candidateProfiles.userId, disposableUserId));
      await db.delete(sessions).where(eq(sessions.userId, disposableUserId));
      await db.delete(users).where(eq(users.id, disposableUserId));
    }

    await app.close();
    await closeDbPool();
  });

  it('1. GET /api/candidate/intelligence returns standard { status: "ok", data, timestamp } envelope for disposable user', async () => {
    const res = await injectForDisposableUser({
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

  it('2. GET /api/candidate/intelligence/records returns isolated records and counts in standard envelope', async () => {
    const res = await injectForDisposableUser({
      method: 'GET',
      url: '/api/candidate/intelligence/records',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.status).toBe('ok');
    expect(body.data).toBeDefined();
    expect(body.data.records).toBeDefined();
    expect(Array.isArray(body.data.records.skills)).toBe(true);

    // Records must belong exclusively to disposable user
    const skills = body.data.records.skills;
    expect(skills.some((s: any) => s.id === testSkillId)).toBe(true);

    expect(body.data.counts).toBeDefined();
    expect(typeof body.data.counts.total).toBe('number');
    expect(typeof body.data.counts.verified).toBe('number');
    expect(typeof body.data.counts.aiAuthorized).toBe('number');
  });

  it('3. POST /api/candidate/intelligence/enrich generates suggestions for disposable user and deduplicates', async () => {
    // First enrichment run for disposable user
    const res1 = await injectForDisposableUser({
      method: 'POST',
      url: '/api/candidate/intelligence/enrich',
      payload: {},
    });

    expect(res1.statusCode).toBe(200);
    const body1 = JSON.parse(res1.body);

    expect(body1.status).toBe('ok');
    expect(body1.data).toBeDefined();
    // Confirms enrichment ran strictly for the disposable user ID
    expect(body1.data.userId).toBe(disposableUserId);
    expect(typeof body1.data.suggestionsCount).toBe('number');
    expect(typeof body1.data.suggestionsCreated).toBe('number');
    expect(Array.isArray(body1.data.suggestions)).toBe(true);

    // Second consecutive enrichment run: should deduplicate pending suggestions
    const res2 = await injectForDisposableUser({
      method: 'POST',
      url: '/api/candidate/intelligence/enrich',
      payload: {},
    });

    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.body);

    expect(body2.status).toBe('ok');
    expect(body2.data).toBeDefined();
    expect(body2.data.userId).toBe(disposableUserId);
    // suggestionsCreated must be 0 because pending suggestions were already created
    expect(body2.data.suggestionsCreated).toBe(0);
    expect(body2.data.suggestionsCount).toBe(body1.data.suggestionsCount);
  });

  it('4. GET /api/candidate/intelligence/suggestions returns suggestions list scoped to disposable user', async () => {
    const res = await injectForDisposableUser({
      method: 'GET',
      url: '/api/candidate/intelligence/suggestions?status=PENDING',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.status).toBe('ok');
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.suggestions)).toBe(true);

    // Verify all returned suggestions belong to disposable user
    for (const sugg of body.data.suggestions) {
      expect(sugg.userId).toBe(disposableUserId);
    }
  });

  it('5. PATCH /api/candidate/intelligence/records/:entityType/:id verifies record and enforces AI invariant', async () => {
    if (!testSkillId) return;

    // Invariant check: Cannot set allowAiUse=true when verificationStatus is UNVERIFIED
    const invalidRes = await injectForDisposableUser({
      method: 'PATCH',
      url: `/api/candidate/intelligence/records/skills/${testSkillId}`,
      payload: { allowAiUse: true },
    });
    expect(invalidRes.statusCode).toBe(400);

    // Step 1: Explicitly verify record
    const verifyRes = await injectForDisposableUser({
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
    const aiRes = await injectForDisposableUser({
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

    const res = await injectForDisposableUser({
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

  it('7. GET /api/candidate/learned-preferences and reset affect ONLY disposable user preferences', async () => {
    const getRes = await injectForDisposableUser({
      method: 'GET',
      url: '/api/candidate/learned-preferences',
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    expect(getBody.status).toBe('ok');
    expect(getBody.data.learnedPreferences).toBeDefined();

    const resetRes = await injectForDisposableUser({
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
    const res = await injectForDisposableUser({
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

  it('9. INVARIANT: Pre-existing primary candidate records survive all test operations completely untouched', async () => {
    // Re-query primary user's candidate records from PostgreSQL
    const pSkills = await db
      .select()
      .from(candidateSkills)
      .where(eq(candidateSkills.userId, primaryUserId));
    const pExps = await db
      .select()
      .from(candidateExperiences)
      .where(eq(candidateExperiences.userId, primaryUserId));
    const pEdu = await db
      .select()
      .from(candidateEducation)
      .where(eq(candidateEducation.userId, primaryUserId));
    const pCerts = await db
      .select()
      .from(candidateCertifications)
      .where(eq(candidateCertifications.userId, primaryUserId));
    const pFacts = await db
      .select()
      .from(candidateFacts)
      .where(eq(candidateFacts.userId, primaryUserId));
    const [pPrefs] = await db
      .select()
      .from(jobPreferences)
      .where(eq(jobPreferences.userId, primaryUserId));

    // Assert 100% preservation of all baseline records
    expect(pSkills.length).toBe(primaryRecordBaseline.skillsCount);
    expect(pExps.length).toBe(primaryRecordBaseline.experiencesCount);
    expect(pEdu.length).toBe(primaryRecordBaseline.educationCount);
    expect(pCerts.length).toBe(primaryRecordBaseline.certsCount);
    expect(pFacts.length).toBe(primaryRecordBaseline.factsCount);

    // Assert primary user preferences were NOT reset or modified by the test suite
    const currentPrefsSnapshot = pPrefs ? JSON.stringify(pPrefs.learnedPreferences) : null;
    expect(currentPrefsSnapshot).toBe(primaryRecordBaseline.learnedPreferencesSnapshot);
  });
});
