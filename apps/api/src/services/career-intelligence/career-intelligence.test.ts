import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, users, candidateProfiles, candidateExperiences, candidateSkills, candidateEducation, candidateLanguages, jobPreferences, jobs, candidateJobFeedback, candidateIntelligenceSuggestions, candidateAuditEvents } from '@job-agent/database';
import { getConfig } from '@job-agent/config';
import { eq, inArray } from 'drizzle-orm';
import { CandidateIntelligenceContextBuilder } from './candidate-intelligence-context-builder.js';
import { CareerIntelligenceEnrichmentService } from './career-intelligence-enrichment-service.js';
import { CandidateJobFeedbackService } from './candidate-job-feedback-service.js';
import { MatchingContextBuilder } from '../matching-context-builder.js';
import { MatchingScoringEngine } from '../matching-scoring-engine.js';
import { HardPolicyEngine } from '../hard-policy-engine.js';
import { CareerFitCategories } from '@job-agent/shared';

describe('Career Intelligence 2.0 Test Suite (JOB-CAREER-INTEL-2.0)', () => {
  const config = getConfig();
  const db = getDb(config.DATABASE_URL);
  const runId = Date.now();

  let userAId: string;
  let userBId: string;
  let job1Id: string;
  let job2Id: string;

  beforeAll(async () => {
    // 1. Create disposable test users
    const [userA] = await db
      .insert(users)
      .values({
        name: `Career Intel Tester A ${runId}`,
        email: `career_intel_a_${runId}@example.com`,
        emailVerified: true,
        role: 'user',
        systemKey: `career_a_${runId}`,
      })
      .returning();
    userAId = userA!.id;

    const [userB] = await db
      .insert(users)
      .values({
        name: `Career Intel Tester B ${runId}`,
        email: `career_intel_b_${runId}@example.com`,
        emailVerified: true,
        role: 'user',
        systemKey: `career_b_${runId}`,
      })
      .returning();
    userBId = userB!.id;

    // 2. Setup candidate profile and preferences for User A
    await db.insert(candidateProfiles).values({
      userId: userAId,
      fullName: 'Alex Vance',
      headline: 'Full Stack Software Engineer',
      email: `alex_${runId}@example.com`,
      city: 'Berlin',
      country: 'Germany',
      availability: 'IMMEDIATE',
      transferableCapabilities: ['System Architecture', 'API Design'],
    });

    await db.insert(jobPreferences).values({
      userId: userAId,
      targetTitles: ['Senior Software Engineer', 'Full Stack Developer'],
      preferredLocations: ['Berlin', 'Remote'],
      workModes: ['remote', 'hybrid'],
      employmentTypes: ['full-time'],
      seniorityLevels: ['senior'],
      minSalary: 80000,
      currency: 'EUR',
      adjacentRoles: ['Engineering Lead', 'Backend Architect'],
      preferredIndustries: ['Technology', 'Fintech'],
      careerTransitions: ['Frontend to Full Stack'],
      developmentPriorities: ['Distributed Systems', 'Cloud Native'],
      workAuthorizationCountries: ['Germany', 'European Union'],
      needsSponsorship: false,
    });

    await db.insert(candidateEducation).values([
      {
        userId: userAId,
        institution: 'Technical University of Berlin',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        startDate: '2016-10',
        endDate: '2020-09',
        isCurrent: false,
        verificationStatus: 'VERIFIED',
        allowAiUse: true,
        confidence: 95,
        displayOrder: 1,
      },
    ]);

    await db.insert(candidateLanguages).values([
      {
        userId: userAId,
        language: 'English',
        proficiency: 'PROFICIENT',
        verificationStatus: 'VERIFIED',
        allowAiUse: true,
        confidence: 95,
      },
    ]);

    // 3. Insert experiences and skills with verification and AI permission flags
    await db.insert(candidateExperiences).values([
      {
        userId: userAId,
        organization: 'Acme Cloud',
        position: 'Software Engineer',
        startDate: '2021-01',
        endDate: '2024-01',
        isCurrent: false,
        achievements: ['Scaled messaging system to 50k QPS'],
        responsibilities: ['Architecting event-driven microservices'],
        skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
        transferableCapabilities: ['Distributed Messaging', 'Performance Optimization'],
        verificationStatus: 'VERIFIED',
        allowAiUse: true,
        confidence: 95,
        displayOrder: 1,
      },
      {
        userId: userAId,
        organization: 'Stealth Startup',
        position: 'Junior Dev',
        startDate: '2020-01',
        endDate: '2020-12',
        isCurrent: false,
        achievements: ['Internal tool development'],
        verificationStatus: 'UNVERIFIED',
        allowAiUse: false, // Strict Gating: Unverified cannot be used by AI
        confidence: 60,
        displayOrder: 2,
      },
    ]);

    await db.insert(candidateSkills).values([
      {
        userId: userAId,
        name: 'TypeScript',
        category: 'Language',
        proficiency: 'ADVANCED',
        yearsExperience: 4,
        isActive: true,
        verificationStatus: 'VERIFIED',
        allowAiUse: true,
        transferableCapabilities: ['Type-safe Development', 'Full Stack TypeScript'],
        confidence: 98,
      },
      {
        userId: userAId,
        name: 'Rust',
        category: 'Language',
        proficiency: 'BEGINNER',
        yearsExperience: 1,
        isActive: true,
        verificationStatus: 'UNVERIFIED',
        allowAiUse: false, // Cannot be used by AI
        confidence: 40,
      },
    ]);

    // 4. Create sample test jobs
    const [insertedJob1] = await db
      .insert(jobs)
      .values({
        userId: userAId,
        title: 'Senior TypeScript Engineer',
        company: `Cloud Systems ${runId}`,
        locationText: 'Berlin, Germany',
        workplaceType: 'HYBRID',
        employmentType: 'FULL_TIME',
        seniority: 'SENIOR',
        minSalary: 85000,
        maxSalary: 95000,
        currency: 'EUR',
        description: 'Building microservices in TypeScript, Node.js, and PostgreSQL in Berlin. Senior level role with competitive EUR salary.',
        contentHash: `hash-job1-${runId}`,
        canonicalUrl: `https://example.com/job1-${runId}`,
      })
      .returning();
    job1Id = insertedJob1!.id;

    const [insertedJob2] = await db
      .insert(jobs)
      .values({
        userId: userAId,
        title: 'Junior Marketing Assistant',
        company: `AdAgency ${runId}`,
        locationText: 'Paris, France',
        workplaceType: 'ONSITE',
        employmentType: 'INTERNSHIP',
        seniority: 'JUNIOR',
        description: 'Marketing intern needed for social media campaign management in Paris. French fluency required.',
        contentHash: `hash-job2-${runId}`,
        canonicalUrl: `https://example.com/job2-${runId}`,
      })
      .returning();
    job2Id = insertedJob2!.id;
  });

  afterAll(async () => {
    // Clean teardown for disposable test data
    if (job1Id || job2Id) {
      await db.delete(jobs).where(inArray(jobs.id, [job1Id, job2Id]));
    }
    await db.delete(candidateJobFeedback).where(inArray(candidateJobFeedback.userId, [userAId, userBId]));
    await db.delete(candidateIntelligenceSuggestions).where(inArray(candidateIntelligenceSuggestions.userId, [userAId, userBId]));
    await db.delete(candidateAuditEvents).where(inArray(candidateAuditEvents.userId, [userAId, userBId]));
    await db.delete(candidateLanguages).where(inArray(candidateLanguages.userId, [userAId, userBId]));
    await db.delete(candidateEducation).where(inArray(candidateEducation.userId, [userAId, userBId]));
    await db.delete(candidateSkills).where(inArray(candidateSkills.userId, [userAId, userBId]));
    await db.delete(candidateExperiences).where(inArray(candidateExperiences.userId, [userAId, userBId]));
    await db.delete(jobPreferences).where(inArray(jobPreferences.userId, [userAId, userBId]));
    await db.delete(candidateProfiles).where(inArray(candidateProfiles.userId, [userAId, userBId]));
    await db.delete(users).where(inArray(users.id, [userAId, userBId]));
  });

  describe('1. CandidateIntelligenceContextBuilder (Phase E)', () => {
    it('builds PostgreSQL-grounded intelligence context with deterministic state hash', async () => {
      const builder = new CandidateIntelligenceContextBuilder(db);
      const context = await builder.build(userAId);

      expect(context.userId).toBe(userAId);
      expect(context.profile?.fullName).toBe('Alex Vance');
      expect(context.allExperiences.length).toBe(2);
      expect(context.allSkills.length).toBe(2);
      expect(context.preferences?.targetTitles).toContain('Senior Software Engineer');
      expect(context.preferences?.adjacentRoles).toContain('Engineering Lead');

      // State hash must be non-empty SHA-256 string
      expect(context.candidateStateHash).toBeDefined();
      expect(context.candidateStateHash.length).toBe(64);

      // Verify privacy-minimized AI context: only verified & AI-authorized items are exposed
      expect(context.verifiedAiExperiences.length).toBe(1);
      expect(context.verifiedAiExperiences[0]?.organization).toBe('Acme Cloud');
      expect(context.verifiedAiSkills.length).toBe(1);
      expect(context.verifiedAiSkills[0]?.name).toBe('TypeScript');

      // Unverified items must be absent from aiPromptContext
      const aiSkillNames = context.aiPromptContext.skills.map((s) => s.name);
      expect(aiSkillNames).not.toContain('Rust');
      const aiExpOrgs = context.aiPromptContext.experiences.map((e) => e.organization);
      expect(aiExpOrgs).not.toContain('Stealth Startup');

      // Transferable capabilities must be surfaced
      expect(context.transferableCapabilities).toContain('System Architecture');
      expect(context.transferableCapabilities).toContain('Type-safe Development');
    });

    it('updates state hash when candidate records are mutated (context invalidation)', async () => {
      const builder = new CandidateIntelligenceContextBuilder(db);
      const initialContext = await builder.build(userAId);

      // Insert another skill
      const [newSkill] = await db
        .insert(candidateSkills)
        .values({
          userId: userAId,
          name: 'GraphQL',
          category: 'API',
          proficiency: 'INTERMEDIATE',
          isActive: true,
          verificationStatus: 'VERIFIED',
          allowAiUse: true,
        })
        .returning();

      const updatedContext = await builder.build(userAId);
      expect(updatedContext.candidateStateHash).not.toBe(initialContext.candidateStateHash);

      // Clean up added skill
      if (newSkill) {
        await db.delete(candidateSkills).where(eq(candidateSkills.id, newSkill.id));
      }
    });
  });

  describe('2. CareerIntelligenceEnrichmentService (Phase D)', () => {
    let enrichmentService: CareerIntelligenceEnrichmentService;

    beforeAll(() => {
      enrichmentService = new CareerIntelligenceEnrichmentService(db);
    });

    it('generates enrichment suggestions grounded in verified background and career goals', async () => {
      const result = await enrichmentService.runEnrichment(userAId);

      expect(result.userId).toBe(userAId);
      expect(result.suggestionsCount).toBeGreaterThanOrEqual(1);
      expect(result.suggestions.length).toBeGreaterThanOrEqual(1);

      const first = result.suggestions[0];
      expect(first).toBeDefined();
      expect(first!.status).toBe('PENDING');
      expect(first!.confidence).toBeGreaterThanOrEqual(50);
    });

    it('lists pending suggestions for user', async () => {
      const pendingList = await enrichmentService.listSuggestions(userAId, 'PENDING');
      expect(pendingList.length).toBeGreaterThanOrEqual(1);
    });

    it('approves a suggestion and applies it with audit tracking', async () => {
      const pendingList = await enrichmentService.listSuggestions(userAId, 'PENDING');
      expect(pendingList.length).toBeGreaterThan(0);

      const target = pendingList[0]!;
      const approved = await enrichmentService.applySuggestion(userAId, target.id);

      expect(approved.id).toBe(target.id);
      expect(approved.status).toBe('APPROVED');
      expect(approved.appliedAt).toBeDefined();

      // Verify audit event recorded
      const [audit] = await db
        .select()
        .from(candidateAuditEvents)
        .where(eq(candidateAuditEvents.entityId, target.id));
      expect(audit).toBeDefined();
      expect(audit?.action).toBe('CAREER_SUGGESTION_APPROVED');
    });

    it('dismisses a suggestion without applying any state changes', async () => {
      // Create a specific disposable suggestion
      const [dismissable] = await db
        .insert(candidateIntelligenceSuggestions)
        .values({
          userId: userAId,
          suggestionType: 'MISSING_DETAIL',
          title: 'Add target salary currency',
          description: 'Specifying currency avoids mismatch',
          payload: { field: 'targetSalaryCurrency', value: 'EUR' },
          status: 'PENDING',
          confidence: 80,
        })
        .returning();

      const dismissed = await enrichmentService.dismissSuggestion(userAId, dismissable!.id);
      expect(dismissed.status).toBe('DISMISSED');
    });
  });

  describe('3. CandidateJobFeedbackService & Learned Preferences (Phase G)', () => {
    let feedbackService: CandidateJobFeedbackService;

    beforeAll(() => {
      feedbackService = new CandidateJobFeedbackService(db);
    });

    it('records user feedback and dynamically learns downweighted preferences', async () => {
      const feedback = await feedbackService.recordFeedback(
        userAId,
        job2Id,
        'WRONG_INDUSTRY',
        'Not interested in marketing roles',
      );

      expect(feedback.userId).toBe(userAId);
      expect(feedback.jobId).toBe(job2Id);
      expect(feedback.feedbackType).toBe('WRONG_INDUSTRY');
      expect(feedback.notes).toBe('Not interested in marketing roles');

      // Inferred learned preferences check
      const learned = await feedbackService.getLearnedPreferences(userAId);
      expect(learned).toBeDefined();
      expect(learned.feedbackCounts['WRONG_INDUSTRY']).toBeGreaterThanOrEqual(1);
      expect(learned.downvotedIndustries.length).toBeGreaterThanOrEqual(1);

      // Verify human inspection and correction invariant: learned preferences are NOT permanent facts
      expect(learned.downvotedIndustries[0]?.toLowerCase()).toContain('marketing');
    });

    it('resets learned preferences when requested by the candidate', async () => {
      const resetResult = await feedbackService.resetLearnedPreferences(userAId);
      expect(resetResult.downvotedIndustries.length).toBe(0);
      expect(resetResult.downvotedCompanies.length).toBe(0);
      expect(Object.keys(resetResult.feedbackCounts).length).toBe(0);

      const learned = await feedbackService.getLearnedPreferences(userAId);
      expect(learned.downvotedIndustries.length).toBe(0);
    });
  });

  describe('4. Intelligent Matching & Career Fit Categories (Phase F)', () => {
    it('classifies eligible high-match jobs as STRONG_MATCH or GOOD_MATCH', async () => {
      const matchingContextBuilder = new MatchingContextBuilder(db);
      const candidateContext = await matchingContextBuilder.buildContext(userAId);

      const [jobRecord] = await db.select().from(jobs).where(eq(jobs.id, job1Id));
      expect(jobRecord).toBeDefined();

      const hardPolicyEngine = new HardPolicyEngine();
      const hardPolicyResult = hardPolicyEngine.evaluate(jobRecord!, candidateContext);
      expect(hardPolicyResult.hasBlockers).toBe(false);

      const scoringEngine = new MatchingScoringEngine();
      const scoringResult = scoringEngine.calculate(
        jobRecord!,
        candidateContext,
        hardPolicyResult,
        [],
        null,
      );

      expect(scoringResult.decision).toBeDefined();
      expect([CareerFitCategories.STRONG_MATCH, CareerFitCategories.GOOD_MATCH]).toContain(
        scoringResult.careerFitCategory,
      );
      expect(scoringResult.careerFitCategory).toBeDefined();
    });

    it('strictly classifies hard blocker jobs as NOT_CURRENTLY_ELIGIBLE without AI bypass', async () => {
      const matchingContextBuilder = new MatchingContextBuilder(db);
      const candidateContext = await matchingContextBuilder.buildContext(userAId);

      // Override workModes to only allow remote
      candidateContext.preferences = {
        ...candidateContext.preferences!,
        workModes: ['REMOTE'],
        willingToRelocate: false,
      };

      const [jobRecord] = await db.select().from(jobs).where(eq(jobs.id, job2Id));
      expect(jobRecord).toBeDefined();

      const hardPolicyEngine = new HardPolicyEngine();
      const hardPolicyResult = hardPolicyEngine.evaluate(jobRecord!, candidateContext);
      expect(hardPolicyResult.hasBlockers).toBe(true); // Blocked because workplaceType is ONSITE vs preferred REMOTE

      const scoringEngine = new MatchingScoringEngine();
      const scoringResult = scoringEngine.calculate(
        jobRecord!,
        candidateContext,
        hardPolicyResult,
        [],
        null,
      );

      // Invariant: Hard blockers force NOT_CURRENTLY_ELIGIBLE regardless of any potential AI score
      expect(scoringResult.decision).toBe('SKIP');
      expect(scoringResult.careerFitCategory).toBe(CareerFitCategories.NOT_CURRENTLY_ELIGIBLE);
    });
  });

  describe('5. Cross-User Multi-Tenant Isolation (Phase I)', () => {
    it('prevents User B from accessing or approving User A suggestions', async () => {
      const enrichmentService = new CareerIntelligenceEnrichmentService(db);

      // Suggestions for User A must not be visible to User B
      const userBSuggestions = await enrichmentService.listSuggestions(userBId);
      expect(userBSuggestions.length).toBe(0);

      // Attempting to approve User A suggestion with User B credentials must throw
      const userASuggestions = await enrichmentService.listSuggestions(userAId);
      if (userASuggestions.length > 0) {
        const userASuggestionId = userASuggestions[0]!.id;
        await expect(
          enrichmentService.applySuggestion(userBId, userASuggestionId),
        ).rejects.toThrow();
      }
    });

    it('prevents User B from accessing User A feedback and learned preferences', async () => {
      const feedbackService = new CandidateJobFeedbackService(db);

      const userBFeedback = await feedbackService.listUserFeedback(userBId);
      expect(userBFeedback.length).toBe(0);

      const userBLearned = await feedbackService.getLearnedPreferences(userBId);
      expect(userBLearned.downvotedIndustries.length).toBe(0);
      expect(userBLearned.downvotedCompanies.length).toBe(0);
    });
  });
});
