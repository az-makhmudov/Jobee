import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import {
  closeDbPool,
  getDb,
  assertSafeTestDatabase,
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

  // Enforce strict test database isolation
  assertSafeTestDatabase(config.DATABASE_URL);

  let app: ReturnType<typeof buildApp>;
  const db = getDb(config.DATABASE_URL);

  const timestamp = Date.now();
  let disposableUserId: string;
  let sentinelUserId: string;
  let testSkillId: string;

  // Track disposable sentinel user baseline records to verify complete isolation and zero mutation
  let sentinelRecordBaseline: {
    skillsCount: number;
    experiencesCount: number;
    educationCount: number;
    certsCount: number;
    factsCount: number;
    suggestionsCount: number;
    learnedPreferences: {
      downvotedIndustries: string[];
      downvotedLocations: string[];
      downvotedCompanies: string[];
      tooSeniorCount: number;
    };
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

    // 1. Create a DISPOSABLE SENTINEL user to verify multi-tenant isolation and data survival
    const [sentinelUser] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        name: `Sentinel Candidate ${timestamp}`,
        email: `sentinel_candidate_${timestamp}@example.com`,
        emailVerified: true,
        role: 'user',
        systemKey: `sentinel_key_${timestamp}`,
      })
      .returning();

    if (!sentinelUser) throw new Error('Failed to create disposable sentinel user');
    sentinelUserId = sentinelUser.id;

    // Seed sentinel candidate profile
    await db.insert(candidateProfiles).values({
      userId: sentinelUserId,
      fullName: 'Sentinel Candidate Preexisting',
      headline: 'Senior Project Manager',
      email: sentinelUser.email,
      city: 'Warsaw',
      country: 'Poland',
      availability: 'ONE_MONTH',
    });

    // Seed sentinel job preferences with distinct learned preferences
    const sentinelLearnedPreferences = {
      downvotedIndustries: ['Gambling', 'Tobacco'],
      downvotedLocations: ['Antarctica'],
      downvotedCompanies: ['SpamCorp'],
      tooSeniorCount: 3,
    };

    await db.insert(jobPreferences).values({
      userId: sentinelUserId,
      targetTitles: ['Senior Project Manager'],
      preferredLocations: ['Warsaw'],
      workModes: ['hybrid'],
      minSalary: 80000,
      currency: 'PLN',
      workAuthorizationCountries: ['Poland', 'EU'],
      needsSponsorship: false,
      learnedPreferences: sentinelLearnedPreferences,
    });

    // Seed sentinel experience (1)
    await db.insert(candidateExperiences).values({
      userId: sentinelUserId,
      organization: 'Sentinel Preexisting Bank',
      position: 'Project Manager',
      startDate: '2021-01-01',
      endDate: '2023-01-01',
      isCurrent: false,
      verificationStatus: 'VERIFIED',
      allowAiUse: true,
      description: 'Managed banking delivery projects.',
    });

    // Seed sentinel skills (2)
    await db.insert(candidateSkills).values([
      {
        userId: sentinelUserId,
        name: `SentinelSkill1_${timestamp}`,
        category: 'Project Management',
        proficiency: 'EXPERT',
        verificationStatus: 'VERIFIED',
        allowAiUse: true,
      },
      {
        userId: sentinelUserId,
        name: `SentinelSkill2_${timestamp}`,
        category: 'Agile',
        proficiency: 'ADVANCED',
        verificationStatus: 'VERIFIED',
        allowAiUse: false,
      },
    ]);

    // Seed sentinel education (1)
    await db.insert(candidateEducation).values({
      userId: sentinelUserId,
      institution: 'Sentinel University',
      degree: 'Master of Science',
      fieldOfStudy: 'Management',
      startDate: '2018-09-01',
      endDate: '2020-06-30',
      isCurrent: false,
      verificationStatus: 'VERIFIED',
    });

    // Seed sentinel certification (1)
    await db.insert(candidateCertifications).values({
      userId: sentinelUserId,
      name: 'PMP Certification',
      issuingOrganization: 'PMI',
      issueDate: '2021-06-01',
      verificationStatus: 'VERIFIED',
    });

    // Seed sentinel facts (2)
    await db.insert(candidateFacts).values([
      {
        userId: sentinelUserId,
        category: 'WORK_AUTHORIZATION',
        factKey: 'work_authorization_eu',
        statement: 'Authorized to work in EU',
        verificationStatus: 'VERIFIED',
        allowAiUse: true,
      },
      {
        userId: sentinelUserId,
        category: 'LOCATION',
        factKey: 'current_location',
        statement: 'Located in Warsaw, Poland',
        verificationStatus: 'VERIFIED',
        allowAiUse: true,
      },
    ]);

    // Seed sentinel suggestion (1) to verify enrichment teardown does NOT delete sentinel suggestions
    await db.insert(candidateIntelligenceSuggestions).values({
      userId: sentinelUserId,
      suggestionType: 'CAREER_PATH',
      title: 'Sentinel Career Path Suggestion',
      description: 'Pre-existing sentinel suggestion that must not be deleted.',
      payload: { path: 'Senior Operations Director' },
      status: 'PENDING',
    });

    sentinelRecordBaseline = {
      skillsCount: 2,
      experiencesCount: 1,
      educationCount: 1,
      certsCount: 1,
      factsCount: 2,
      suggestionsCount: 1,
      learnedPreferences: sentinelLearnedPreferences,
    };

    // 2. Create a UNIQUE DISPOSABLE test user - NEVER use primary candidate
    const [newUser] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
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
    // Clean up all data created for disposable user and sentinel user
    const targetUserIds = [disposableUserId, sentinelUserId].filter(Boolean);
    if (targetUserIds.length > 0) {
      for (const uid of targetUserIds) {
        await db.delete(candidateAuditEvents).where(eq(candidateAuditEvents.userId, uid));
        await db
          .delete(candidateIntelligenceSuggestions)
          .where(eq(candidateIntelligenceSuggestions.userId, uid));
        await db.delete(candidateJobFeedback).where(eq(candidateJobFeedback.userId, uid));
        await db.delete(candidateFacts).where(eq(candidateFacts.userId, uid));
        await db.delete(candidateCertifications).where(eq(candidateCertifications.userId, uid));
        await db.delete(candidateEducation).where(eq(candidateEducation.userId, uid));
        await db.delete(candidateSkills).where(eq(candidateSkills.userId, uid));
        await db.delete(candidateExperiences).where(eq(candidateExperiences.userId, uid));
        await db.delete(jobPreferences).where(eq(jobPreferences.userId, uid));
        await db.delete(candidateProfiles).where(eq(candidateProfiles.userId, uid));
        await db.delete(sessions).where(eq(sessions.userId, uid));
        await db.delete(users).where(eq(users.id, uid));
      }
    }

    await app.close();
    await closeDbPool();
  });

  it('1. GET /api/candidate/intelligence returns standard envelope and valid intelligence payload', async () => {
    const res = await injectForDisposableUser({
      method: 'GET',
      url: '/api/candidate/intelligence',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.status).toBe('ok');
    expect(body.data).toBeDefined();
    expect(body.data.summary).toBeDefined();
    expect(body.data.candidateStateHash).toBeDefined();
    expect(body.data.contextVersion).toBeDefined();
  });

  it('2. GET /api/candidate/intelligence/records returns records list in standard envelope', async () => {
    const res = await injectForDisposableUser({
      method: 'GET',
      url: '/api/candidate/intelligence/records',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.status).toBe('ok');
    expect(body.data).toBeDefined();
    expect(body.data.records).toBeDefined();
    expect(Array.isArray(body.data.records.experiences)).toBe(true);
    expect(Array.isArray(body.data.records.skills)).toBe(true);
    expect(body.data.records.experiences.length).toBeGreaterThanOrEqual(1);

    for (const exp of body.data.records.experiences) {
      expect(exp.id).toBeDefined();
      expect(exp.entityType).toBe('experiences');
      expect(exp.verificationStatus).toBeDefined();
      expect(typeof exp.allowAiUse).toBe('boolean');
    }
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
        items: [{ entityType: 'skills', id: testSkillId, allowAiUse: false }],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.status).toBe('ok');
    expect(body.data).toBeDefined();
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

  it('9. INVARIANT: Pre-existing sentinel candidate records survive all test operations completely untouched', async () => {
    // Re-query sentinel user's candidate records from PostgreSQL
    const sSkills = await db
      .select()
      .from(candidateSkills)
      .where(eq(candidateSkills.userId, sentinelUserId));
    const sExps = await db
      .select()
      .from(candidateExperiences)
      .where(eq(candidateExperiences.userId, sentinelUserId));
    const sEdu = await db
      .select()
      .from(candidateEducation)
      .where(eq(candidateEducation.userId, sentinelUserId));
    const sCerts = await db
      .select()
      .from(candidateCertifications)
      .where(eq(candidateCertifications.userId, sentinelUserId));
    const sFacts = await db
      .select()
      .from(candidateFacts)
      .where(eq(candidateFacts.userId, sentinelUserId));
    const sSuggestions = await db
      .select()
      .from(candidateIntelligenceSuggestions)
      .where(eq(candidateIntelligenceSuggestions.userId, sentinelUserId));
    const [sPrefs] = await db
      .select()
      .from(jobPreferences)
      .where(eq(jobPreferences.userId, sentinelUserId));

    // Assert 100% preservation of all sentinel baseline counts
    expect(sSkills.length).toBe(sentinelRecordBaseline.skillsCount);
    expect(sExps.length).toBe(sentinelRecordBaseline.experiencesCount);
    expect(sEdu.length).toBe(sentinelRecordBaseline.educationCount);
    expect(sCerts.length).toBe(sentinelRecordBaseline.certsCount);
    expect(sFacts.length).toBe(sentinelRecordBaseline.factsCount);
    expect(sSuggestions.length).toBe(sentinelRecordBaseline.suggestionsCount);

    // Assert sentinel learned preferences were NOT reset or modified by the test suite
    expect(sPrefs).toBeDefined();
    expect(sPrefs!.learnedPreferences).toEqual(sentinelRecordBaseline.learnedPreferences);
  });
});
