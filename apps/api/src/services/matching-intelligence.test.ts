import { describe, it, expect } from 'vitest';
import {
  CandidateEvidenceResolver,
  DeterministicEvaluationResult,
} from './candidate-evidence-resolver.js';
import { HardPolicyEngine } from './hard-policy-engine.js';
import { MatchingScoringEngine } from './matching-scoring-engine.js';
import { MockAiProvider } from '../ai/mock-ai-provider.js';
import { DisabledAiProvider } from '../ai/disabled-ai-provider.js';
import { validateAndSanitizeAiOutput } from '../ai/validator.js';
import type { CandidateMatchingContext } from './matching-context-builder.js';
import type { Job, JobRequirement } from '@job-agent/database';
import type { CandidateEvidenceItemDto } from '@job-agent/shared';
import type { AiMatchContext } from '../ai/types.js';

describe('Matching Intelligence Unit Tests (JOB-P2-T02)', () => {
  const mockEvidenceMap: Record<string, CandidateEvidenceItemDto> = {
    'candidate_skill:ts': {
      id: 'candidate_skill:ts',
      type: 'skill',
      label: 'TypeScript (Advanced)',
    },
    'candidate_skill:py': {
      id: 'candidate_skill:py',
      type: 'skill',
      label: 'Python (Intermediate)',
    },
    'candidate_language:en': {
      id: 'candidate_language:en',
      type: 'language',
      label: 'English (C2)',
    },
    'candidate_language:de': {
      id: 'candidate_language:de',
      type: 'language',
      label: 'German (B1)',
    },
    'candidate_education:bs': {
      id: 'candidate_education:bs',
      type: 'education',
      label: 'BS in Computer Science',
    },
    'candidate_experience:eng': {
      id: 'candidate_experience:eng',
      type: 'experience',
      label: 'Senior Engineer at Tech Corp (4.0 years)',
    },
  };

  const evidenceMapInstance = new Map<string, CandidateEvidenceItemDto>(
    Object.entries(mockEvidenceMap),
  );

  const createMockCandidateContext = (
    overrides?: Partial<CandidateMatchingContext>,
  ): CandidateMatchingContext => ({
    userId: 'user-test-1',
    candidateProfile: {
      id: 'prof-1',
      userId: 'user-test-1',
      headline: 'Senior Full Stack Engineer',
      summary: 'Passionate developer with 6 years experience',
      location: 'Berlin, Germany',
      citizenship: 'German',
      requiresSponsorship: false,
      activelyLooking: true,
      phone: null,
      website: null,
      githubUrl: null,
      linkedinUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any,
    preferences: {
      id: 'pref-1',
      userId: 'user-test-1',
      targetTitles: ['Senior Full Stack Engineer', 'Backend Engineer'],
      targetCategories: ['Software Development'],
      preferredLocations: ['Berlin, Germany', 'Remote'],
      workModes: ['remote', 'hybrid', 'onsite'],
      employmentTypes: ['full-time'],
      seniorityLevels: ['senior', 'lead'],
      minSalary: 80000,
      maxSalary: 120000,
      currency: 'EUR',
      preferredLanguages: ['English', 'German'],
      excludedCompanies: ['Toxic Corp', 'Crypto Casino'],
      excludedKeywords: ['crypto', 'gambling'],
      acceptUnpaid: false,
      willingToRelocate: false,
      needsSponsorship: false,
      adjacentRoles: [],
      preferredIndustries: [],
      careerTransitions: [],
      developmentPriorities: [],
      availability: null,
      targetSalary: null,
      targetSalaryCurrency: 'EUR',
      workAuthorizationCountries: [],
      learnedPreferences: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any,
    policy: {
      id: 'pol-1',
      userId: 'user-test-1',
      minScoreForReview: 60,
      autoApplyMinScore: 75,
      autoApplyEnabled: true,
      blockOnUnknownSensitive: true,
      requireSalaryTransparency: false,
      disallowThirdPartyRecruiters: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any,
    experiences: [
      {
        id: 'candidate_experience:eng',
        userId: 'user-test-1',
        title: 'Senior Engineer',
        position: 'Senior Engineer',
        organization: 'Tech Corp',
        company: 'Tech Corp',
        startDate: '2020-01',
        endDate: '2024-01',
        durationMonths: 48,
        description: 'Built scalable microservices in Node and TypeScript',
        isCurrent: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ],
    education: [
      {
        id: 'candidate_education:bs',
        userId: 'user-test-1',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        institution: 'TU Berlin',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ],
    skills: [
      {
        id: 'candidate_skill:ts',
        userId: 'user-test-1',
        name: 'TypeScript',
        category: 'Language',
        proficiency: 'ADVANCED',
        isActive: true,
        verificationStatus: 'VERIFIED',
        yearsExperience: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
      {
        id: 'candidate_skill:py',
        userId: 'user-test-1',
        name: 'Python',
        category: 'Language',
        proficiency: 'INTERMEDIATE',
        isActive: true,
        verificationStatus: 'VERIFIED',
        yearsExperience: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ],
    languages: [
      {
        id: 'candidate_language:en',
        userId: 'user-test-1',
        language: 'English',
        proficiency: 'NATIVE_OR_BILINGUAL',
        cefrLevel: 'C2',
        verificationStatus: 'VERIFIED',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
      {
        id: 'candidate_language:de',
        userId: 'user-test-1',
        language: 'German',
        proficiency: 'INTERMEDIATE',
        cefrLevel: 'B1',
        verificationStatus: 'VERIFIED',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ],
    certifications: [],
    projects: [],
    verifiedFacts: [
      {
        id: 'candidate_fact:sec',
        userId: 'user-test-1',
        key: 'security_clearance',
        value: 'None',
        category: 'GENERAL',
        isSensitive: false,
        verificationStatus: 'VERIFIED',
        allowAiUse: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ],
    allCandidateFacts: [],
    evidenceMap: evidenceMapInstance,
    candidateStateHash: 'sha256-test-fingerprint',
    transferableCapabilities: [],
    learnedPreferences: null,
    aiContext: {
      targetRoles: ['Senior Full Stack Engineer'],
      experiences: [],
      skills: [{ id: 'candidate_skill:ts', name: 'TypeScript', proficiency: 'ADVANCED' }],
      education: [],
      languages: [],
      certifications: [],
      verifiedFacts: [],
    },
    ...overrides,
  });

  const createMockRequirement = (overrides?: Partial<JobRequirement>): JobRequirement => ({
    id: 'req-1',
    jobId: 'job-test-1',
    sourceId: null,
    sourceSection: null,
    category: 'SKILL',
    requirementStrength: 'MANDATORY',
    rawText: 'Test requirement',
    normalizedText: null,
    displayOrder: 0,
    userId: 'user-test-1',
    createdAt: new Date(),
    ...overrides,
  });

  const createMockJob = (overrides?: Partial<Job>): Job =>
    ({
      id: 'job-test-1',
      userId: 'user-test-1',
      title: 'Senior Software Engineer',
      company: 'Acme Corp',
      locationText: 'Berlin, Germany',
      workplaceType: 'HYBRID',
      employmentType: 'FULL_TIME',
      seniority: 'SENIOR',
      minSalary: 85000,
      maxSalary: 105000,
      currency: 'EUR',
      payPeriod: 'YEARLY',
      description: 'Building microservices in TypeScript',
      descriptionHtml: null,
      canonicalUrl: 'https://example.com/job/1',
      originalUrl: 'https://example.com/job/1',
      applicationUrl: null,
      companyUrl: null,
      city: 'Berlin',
      region: null,
      country: 'Germany',
      department: 'Engineering',
      compensationRaw: null,
      postedDate: null,
      expirationDate: null,
      discoveredDate: new Date(),
      lastCheckedDate: null,
      provider: 'GENERIC',
      sourceExternalId: null,
      sourceCompanyId: null,
      contentHash: 'hash-1',
      isDuplicate: false,
      duplicateOfId: null,
      hasManualEdits: false,
      manualEditFields: [],
      state: 'INGESTED',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as Job;

  describe('CandidateEvidenceResolver', () => {
    const resolver = new CandidateEvidenceResolver();

    it('resolves skill requirements with exact, alias, and substring matches', () => {
      const candidate = createMockCandidateContext();
      const req = createMockRequirement({
        rawText: 'Strong knowledge of TypeScript or JS required',
        normalizedText: 'TypeScript experience',
        category: 'SKILL',
        requirementStrength: 'MANDATORY',
      });

      const result = resolver.evaluateRequirement(req, candidate);
      expect(result.status).toBe('MET');
      expect(result.evidenceIds).toContain('candidate_skill:ts');
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    it('resolves language requirements based on CEFR ranking (candidate exceeds or meets)', () => {
      const candidate = createMockCandidateContext();
      const reqEnglish = createMockRequirement({
        rawText: 'Fluent English (B2 or higher) required',
        normalizedText: 'Fluent English',
        category: 'LANGUAGE',
        requirementStrength: 'MANDATORY',
      });

      const resultEn = resolver.evaluateRequirement(reqEnglish, candidate);
      expect(resultEn.status).toBe('MET');
      expect(resultEn.evidenceIds).toContain('candidate_language:en');

      // German requirement (candidate has B1, job requires C1)
      const reqGermanC1 = createMockRequirement({
        rawText: 'Fluent German (C1) required for client meetings',
        normalizedText: 'German C1 required',
        category: 'LANGUAGE',
        requirementStrength: 'MANDATORY',
      });

      const resultDe = resolver.evaluateRequirement(reqGermanC1, candidate);
      expect(resultDe.status).toBe('NOT_MET');
      expect(resultDe.reason).toContain('is below required level (C1)');
    });

    it('evaluates experience duration requirements accurately', () => {
      const candidate = createMockCandidateContext(); // 4 years (48 months)
      const req3Years = createMockRequirement({
        rawText: 'At least 3 years of software engineering experience',
        normalizedText: '3 years experience',
        category: 'EXPERIENCE',
        requirementStrength: 'MANDATORY',
      });

      const result3y = resolver.evaluateRequirement(req3Years, candidate);
      expect(result3y.status).toBe('MET');
      expect(result3y.evidenceIds).toContain('candidate_experience:eng');

      const req8Years = createMockRequirement({
        rawText: '8+ years of engineering leadership experience',
        normalizedText: '8 years experience',
        category: 'EXPERIENCE',
        requirementStrength: 'MANDATORY',
      });

      const result8y = resolver.evaluateRequirement(req8Years, candidate);
      expect(result8y.status).toBe('PARTIAL');
      expect(result8y.reason).toContain('Candidate has ~4 years of experience');
    });

    it('does not double-count overlapping employment periods (interval-union)', () => {
      // Two concurrent roles in the exact same 12-month period (Jan 2024 - Dec 2024)
      const candidate = createMockCandidateContext({
        experiences: [
          {
            id: 'candidate_experience:roleA',
            userId: 'user-test-1',
            title: 'Full Stack Engineer (Consulting)',
            organization: 'Agency A',
            startDate: '2024-01',
            endDate: '2024-12',
            isCurrent: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any,
          {
            id: 'candidate_experience:roleB',
            userId: 'user-test-1',
            title: 'Technical Writer (Concurrent)',
            organization: 'Company B',
            startDate: '2024-01',
            endDate: '2024-12',
            isCurrent: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any,
        ],
      });

      // Directly verify calculateExperienceMonths interval-union
      const months = resolver.calculateExperienceMonths(candidate.experiences);
      expect(months).toBe(12); // Exactly 12 months, NOT 24 months

      // Requirement asks for 2 years experience (24 months)
      const req2Years = createMockRequirement({
        rawText: 'Requires at least 2 years of professional software engineering experience',
        normalizedText: '2 years experience',
        category: 'EXPERIENCE',
        requirementStrength: 'MANDATORY',
      });

      const result = resolver.evaluateRequirement(req2Years, candidate);
      // Because candidate only has 1 non-overlapping year, 2 years requirement is PARTIAL
      expect(result.status).toBe('PARTIAL');
      expect(result.reason).toContain('Candidate has ~1 years of experience');
    });

    it('handles partial or invalid dates safely without inventing duration', () => {
      const candidate = createMockCandidateContext({
        experiences: [
          {
            id: 'candidate_experience:bad1',
            userId: 'user-test-1',
            title: 'Engineer',
            organization: 'Co',
            startDate: 'invalid-date',
            endDate: null,
            isCurrent: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any,
        ],
      });

      const months = resolver.calculateExperienceMonths(candidate.experiences);
      expect(months).toBe(0); // Safely returns 0 without crashing or inventing years
    });

    it('marks unstated or unmatched requirements as UNKNOWN or NOT_MET without guessing', () => {
      const candidate = createMockCandidateContext();
      const reqKubernetes = createMockRequirement({
        rawText: '5 years of Kubernetes cluster administration in production',
        normalizedText: 'Kubernetes production experience',
        category: 'SKILL',
        requirementStrength: 'MANDATORY',
      });

      const result = resolver.evaluateRequirement(reqKubernetes, candidate);
      expect(['NOT_MET', 'UNKNOWN']).toContain(result.status);
      expect(result.evidenceIds).toHaveLength(0);
    });
  });

  describe('HardPolicyEngine', () => {
    const engine = new HardPolicyEngine();

    it('blocks roles at excluded companies (deterministic SKIP)', () => {
      const candidate = createMockCandidateContext();
      const job = createMockJob({
        company: 'Toxic Corp',
      });

      const result = engine.evaluate(job, candidate);
      expect(result.hasBlockers).toBe(true);
      expect(result.blockers.some((b) => b.includes('Toxic Corp'))).toBe(true);
      expect(result.reasonCodes).toContain('EXCLUDED_COMPANY');
    });

    it('blocks roles with excluded keywords (deterministic SKIP)', () => {
      const candidate = createMockCandidateContext();
      const job = createMockJob({
        title: 'Lead Crypto Engineer',
        description: 'Building Web3 and crypto platforms',
      });

      const result = engine.evaluate(job, candidate);
      expect(result.hasBlockers).toBe(true);
      expect(result.reasonCodes).toContain('EXCLUDED_KEYWORD');
    });

    it('blocks roles that violate workplace type policy (e.g. Remote-only candidate vs ONSITE job)', () => {
      const candidate = createMockCandidateContext({
        preferences: {
          ...createMockCandidateContext().preferences!,
          workModes: ['remote'],
        },
      });

      const job = createMockJob({
        workplaceType: 'ONSITE',
      });

      const result = engine.evaluate(job, candidate);
      expect(result.hasBlockers).toBe(true);
      expect(result.reasonCodes).toContain('WORK_MODE_NOT_ALLOWED');
    });

    it('blocks unpaid roles unconditionally when acceptUnpaid is false', () => {
      const candidate = createMockCandidateContext();
      const job = createMockJob({
        title: 'Unpaid Volunteer Developer',
        description: 'This is an unpaid internship for university credit',
      });

      const result = engine.evaluate(job, candidate);
      expect(result.hasBlockers).toBe(true);
      expect(result.reasonCodes).toContain('UNPAID_ROLE_REJECTED');
    });

    it('blocks roles where stated maximum salary is below candidate minimum', () => {
      const candidate = createMockCandidateContext({
        preferences: {
          ...createMockCandidateContext().preferences!,
          minSalary: 90000,
        },
      });

      const job = createMockJob({
        maxSalary: 65000,
      });

      const result = engine.evaluate(job, candidate);
      expect(result.hasBlockers).toBe(true);
      expect(result.reasonCodes).toContain('SALARY_BELOW_MINIMUM');
    });

    it('flags missing sensitive policy info for review rather than inventing facts', () => {
      const candidate = createMockCandidateContext({
        preferences: {
          ...createMockCandidateContext().preferences!,
          willingToRelocate: null, // unknown relocation preference
        },
      });

      const job = createMockJob({
        locationText: 'Tokyo, Japan',
        city: 'Tokyo',
        country: 'Japan',
        workplaceType: 'ONSITE',
      });

      const result = engine.evaluate(job, candidate);
      expect(result.missingSensitiveInfo || result.hasBlockers).toBe(true);
    });
  });

  describe('MatchingScoringEngine', () => {
    const scoringEngine = new MatchingScoringEngine();

    it('scores a strong candidate as MATCH with auto-apply preliminary eligibility', () => {
      const candidate = createMockCandidateContext();
      const job = createMockJob({
        title: 'Senior TypeScript Engineer',
        minSalary: 85000,
        maxSalary: 110000,
      });

      const hardPolicyResult = {
        hasBlockers: false,
        blockers: [],
        warnings: [],
        missingInformation: [],
        reasonCodes: [],
        missingSensitiveInfo: false,
      };

      const evaluations: DeterministicEvaluationResult[] = [
        {
          requirementId: 'req-1',
          status: 'MET',
          evidenceIds: ['candidate_skill:ts'],
          evidenceItems: [{ id: 'candidate_skill:ts', type: 'skill', label: 'TypeScript' }],
          reason: 'Direct match for TypeScript skill',
          confidence: 95,
          contributesToBlocker: false,
        },
      ];

      const result = scoringEngine.calculate(job, candidate, hardPolicyResult, evaluations, null);

      expect(result.decision).toBe('MATCH');
      expect(result.overallScore).toBeGreaterThanOrEqual(70);
      expect(result.autoApplyEligible).toBe(true);
      expect(result.strengths.length).toBeGreaterThan(0);
    });

    it('scores a hard policy blocked job as SKIP with overall score capped or 0', () => {
      const candidate = createMockCandidateContext();
      const job = createMockJob({
        company: 'Toxic Corp',
      });

      const hardPolicyResult = {
        hasBlockers: true,
        blockers: ['Role is with excluded company: Toxic Corp'],
        warnings: [],
        missingInformation: [],
        reasonCodes: ['EXCLUDED_COMPANY' as const],
        missingSensitiveInfo: false,
      };

      const result = scoringEngine.calculate(job, candidate, hardPolicyResult, [], null);

      expect(result.decision).toBe('SKIP');
      expect(result.autoApplyEligible).toBe(false);
      expect(result.hardBlockers).toContain('Role is with excluded company: Toxic Corp');
      expect(result.reasonCodes).toContain('EXCLUDED_COMPANY');
    });

    it('forces REVIEW decision when unknown sensitive facts exist even if score is high', () => {
      const candidate = createMockCandidateContext();
      const job = createMockJob();

      const hardPolicyResult = {
        hasBlockers: false,
        blockers: [],
        warnings: ['Sponsorship/clearance requirements cannot be verified.'],
        missingInformation: ['Visa / sponsorship status not confirmed'],
        reasonCodes: ['POLICY_INFORMATION_MISSING' as const],
        missingSensitiveInfo: true,
      };

      const result = scoringEngine.calculate(job, candidate, hardPolicyResult, [], null);

      expect(result.decision).toBe('REVIEW');
      expect(result.autoApplyEligible).toBe(false);
      expect(result.reasonCodes).toContain('POLICY_INFORMATION_MISSING');
    });

    it('re-weights dimensions when dimension status is UNKNOWN rather than scoring as 0', () => {
      const candidate = createMockCandidateContext();
      const jobNoSalary = createMockJob({
        minSalary: null,
        maxSalary: null,
      });

      const hardPolicyResult = {
        hasBlockers: false,
        blockers: [],
        warnings: [],
        missingInformation: [],
        reasonCodes: [],
        missingSensitiveInfo: false,
      };

      const result = scoringEngine.calculate(jobNoSalary, candidate, hardPolicyResult, [], null);

      const compDimension = result.dimensions.find((d) => d.dimension === 'COMPENSATION_FIT');
      expect(compDimension?.status).toBe('UNKNOWN');
      // Total score should not be penalized to 0 simply because salary was unlisted
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it('maintains high suitability score while setting decision to SKIP when hard blocker is present', () => {
      const candidate = createMockCandidateContext();
      const job = createMockJob({
        title: 'Senior Full Stack Engineer',
        company: 'Toxic Corp', // EXCLUDED COMPANY
        minSalary: 85000,
        maxSalary: 110000,
      });

      const hardPolicyResult = {
        hasBlockers: true,
        blockers: ['Role is with excluded company: Toxic Corp'],
        warnings: [],
        missingInformation: [],
        reasonCodes: ['EXCLUDED_COMPANY' as const],
        missingSensitiveInfo: false,
      };

      const evaluations: DeterministicEvaluationResult[] = [
        {
          requirementId: 'req-1',
          status: 'MET',
          evidenceIds: ['candidate_skill:ts'],
          evidenceItems: [{ id: 'candidate_skill:ts', type: 'skill', label: 'TypeScript' }],
          reason: 'Matches skill',
          confidence: 90,
          contributesToBlocker: false,
        },
      ];

      const result = scoringEngine.calculate(job, candidate, hardPolicyResult, evaluations, null);

      // Score remains high based on skills and qualifications (not zeroed out)
      expect(result.overallScore).toBeGreaterThanOrEqual(70);
      // But deterministic policy strictly dictates SKIP decision
      expect(result.decision).toBe('SKIP');
      expect(result.hardBlockers).toContain('Role is with excluded company: Toxic Corp');
      expect(result.reasonCodes).toContain('EXCLUDED_COMPANY');
    });

    it('drops confidence when job posting is sparse and lacks details', () => {
      const candidate = createMockCandidateContext();
      const sparseJob = createMockJob({
        description: 'Short text', // < 300 chars
        workplaceType: 'UNKNOWN',
      });

      const hardPolicyResult = {
        hasBlockers: false,
        blockers: [],
        warnings: [],
        missingInformation: [],
        reasonCodes: [],
        missingSensitiveInfo: false,
      };

      const result = scoringEngine.calculate(sparseJob, candidate, hardPolicyResult, [], null);

      // Sparse job has lower confidence score
      expect(result.confidenceScore).toBeLessThan(75);
    });
  });

  describe('AI Provider Abstraction and Grounded Validation', () => {
    it('DisabledAiProvider safely reports unavailable', () => {
      const provider = new DisabledAiProvider();
      expect(provider.isAvailable()).toBe(false);
    });

    it('MockAiProvider produces controlled match evaluation', async () => {
      const provider = new MockAiProvider();
      expect(provider.isAvailable()).toBe(true);

      const context: AiMatchContext = {
        jobId: 'j1',
        jobTitle: 'Lead Eng',
        jobCompany: 'Acme',
        workplaceType: 'REMOTE',
        descriptionSnippet: 'Node lead engineer position',
        requirements: [
          {
            id: 'req-1',
            rawText: 'Strong TypeScript and Node.js',
            category: 'SKILL',
            strength: 'MANDATORY',
          },
        ],
        candidateContext: {
          targetRoles: ['Lead Engineer'],
          experiences: [],
          skills: [{ id: 'candidate_skill:ts', name: 'TypeScript', proficiency: 'ADVANCED' }],
          education: [],
          languages: [],
          certifications: [],
          verifiedFacts: [],
        },
      };

      const res = await provider.analyzeMatch(context);
      expect(res).not.toBeNull();
      expect(res.strengths.length).toBeGreaterThan(0);
      expect(res.provider).toBe('mock');
    });

    it('validator.ts strips hallucinated candidate evidence IDs not in context', () => {
      const context: AiMatchContext = {
        jobId: 'j1',
        jobTitle: 'Lead Eng',
        jobCompany: 'Acme',
        workplaceType: 'REMOTE',
        descriptionSnippet: 'Node lead',
        requirements: [
          {
            id: 'req-1',
            rawText: 'Strong TypeScript',
            category: 'SKILL',
            strength: 'MANDATORY',
          },
        ],
        candidateContext: {
          targetRoles: [],
          experiences: [],
          skills: [{ id: 'candidate_skill:ts', name: 'TypeScript' }],
          education: [],
          languages: [],
          certifications: [],
          verifiedFacts: [],
        },
      };

      const payloadFromAi = {
        evaluations: [
          {
            requirementId: 'req-1',
            status: 'MET',
            evidenceIds: ['candidate_skill:ts', 'hallucinated_skill_not_in_db:xyz'],
            confidence: 90,
            reason: 'Claimed invented qualification',
          },
        ],
        strengths: ['Great match'],
        gaps: [],
        semanticSummary: 'Good fit',
      };

      const validated = validateAndSanitizeAiOutput(payloadFromAi, context, 'mock', 'mock-model');
      expect(validated).not.toBeNull();
      const eval1 = validated.evaluations[0];
      // Only candidate_skill:ts is in context
      expect(eval1?.evidenceIds).toEqual(['candidate_skill:ts']);
      expect(eval1?.evidenceIds).not.toContain('hallucinated_skill_not_in_db:xyz');
    });

    it('validator.ts converts status to UNKNOWN if AI claims MET with entirely invented evidence IDs', () => {
      const context: AiMatchContext = {
        jobId: 'j1',
        jobTitle: 'Lead Eng',
        jobCompany: 'Acme',
        workplaceType: 'REMOTE',
        descriptionSnippet: 'Node lead',
        requirements: [
          {
            id: 'req-2',
            rawText: 'Kubernetes cluster administration',
            category: 'SKILL',
            strength: 'MANDATORY',
          },
        ],
        candidateContext: {
          targetRoles: [],
          experiences: [],
          skills: [],
          education: [],
          languages: [],
          certifications: [],
          verifiedFacts: [],
        },
      };

      const payloadFromAi = {
        evaluations: [
          {
            requirementId: 'req-2',
            status: 'MET',
            evidenceIds: ['fake_experience_id_999'],
            confidence: 80,
            reason: 'Invented experience claim',
          },
        ],
        strengths: [],
        gaps: [],
        semanticSummary: '',
      };

      const validated = validateAndSanitizeAiOutput(payloadFromAi, context, 'mock', 'mock-model');
      expect(validated).not.toBeNull();
      const eval2 = validated.evaluations[0];
      expect(eval2?.evidenceIds).toEqual([]);
      // Demoted to UNKNOWN to uphold Prime Invariant
      expect(eval2?.status).toBe('UNKNOWN');
      expect(eval2?.reason).toContain('Unverifiable evidence claims were excluded');
    });

    it('validator.ts strips candidate_experience:DOES-NOT-EXIST and deduplicates valid evidence IDs', () => {
      const context: AiMatchContext = {
        jobId: 'j1',
        jobTitle: 'Lead Eng',
        jobCompany: 'Acme',
        workplaceType: 'REMOTE',
        descriptionSnippet: 'Node lead',
        requirements: [
          {
            id: 'req-1',
            rawText: 'TypeScript requirement',
            category: 'SKILL',
            strength: 'MANDATORY',
          },
        ],
        candidateContext: {
          targetRoles: [],
          experiences: [],
          skills: [{ id: 'candidate_skill:ts', name: 'TypeScript' }],
          education: [],
          languages: [],
          certifications: [],
          verifiedFacts: [],
        },
      };

      const payloadWithMalformedEvidence = {
        evaluations: [
          {
            requirementId: 'req-1',
            status: 'MET',
            evidenceIds: [
              'candidate_experience:DOES-NOT-EXIST',
              'candidate_skill:ts',
              'candidate_skill:ts', // duplicate to verify deduplication
            ],
            confidence: 90,
            reason: 'TypeScript proficiency with bogus experience',
          },
        ],
        strengths: [],
        gaps: [],
        semanticSummary: '',
      };

      const validated = validateAndSanitizeAiOutput(
        payloadWithMalformedEvidence,
        context,
        'mock',
        'mock-model',
      );
      const ev = validated.evaluations[0];
      // Invented ID is stripped
      expect(ev?.evidenceIds).not.toContain('candidate_experience:DOES-NOT-EXIST');
      // Duplicate is deduplicated
      expect(ev?.evidenceIds).toEqual(['candidate_skill:ts']);
      // Status remains MET because candidate_skill:ts is valid in candidate context
      expect(ev?.status).toBe('MET');
    });
  });
});
