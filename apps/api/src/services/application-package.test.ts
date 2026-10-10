import { describe, it, expect } from 'vitest';
import { CvBaseSelector } from './cv-base-selector.js';
import { TailoringEngine, type CandidateContext } from './tailoring-engine.js';
import { CoverLetterEngine } from './cover-letter-engine.js';
import { ApplicationQuestionEngine } from './application-question-engine.js';
import { PackageReadinessEngine } from './package-readiness-engine.js';
import { DocxGeneratorService } from './docx-generator-service.js';
import type {
  CandidateProfile,
  CandidateExperience,
  CandidateEducation,
  CandidateSkill,
  CandidateLanguage,
  CandidateCertification,
  CandidateProject,
  CandidateLink,
  CandidateDocument,
  Job,
  AnswerLibrary,
  JobPreferences,
  ApplicationPackage,
  ApplicationPackageVersion,
  ApplicationArtifact,
  ApplicationQuestion,
  ApprovalRequest,
} from '@job-agent/database';

describe('Application Studio Unit Tests (JOB-P3-T01)', () => {
  const dummyProfile: CandidateProfile = {
    id: '00000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000001',
    preferredName: 'Alex',
    fullName: 'Alex Developer',
    headline: 'Senior Full Stack Engineer',
    email: 'alex@example.com',
    phone: '+49 123 456789',
    city: 'Berlin',
    region: 'Berlin',
    country: 'Germany',
    summary: 'Experienced software engineer specializing in distributed systems.',
    availability: 'IMMEDIATE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const dummyExperiences: CandidateExperience[] = [
    {
      id: 'exp-1',
      userId: dummyProfile.userId,
      organization: 'Tech Corp',
      position: 'Senior Software Engineer',
      location: 'Berlin',
      employmentType: 'FULL_TIME',
      startDate: '2021-01',
      endDate: '2024-01',
      isCurrent: false,
      description: 'Built distributed backend services',
      achievements: [
        'Architected high-throughput microservices using TypeScript and Node.js serving 10000 requests per second',
        'Led a squad of 5 engineers to deliver cloud infrastructure migration',
      ],
      displayOrder: 0,
      verificationStatus: 'VERIFIED',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const dummyEducation: CandidateEducation[] = [
    {
      id: 'edu-1',
      userId: dummyProfile.userId,
      institution: 'Technical University',
      degree: 'Bachelor of Science',
      fieldOfStudy: 'Computer Science',
      startDate: '2016-09',
      endDate: '2020-07',
      isCurrent: false,
      location: null,
      description: null,
      activities: null,
      displayOrder: 0,
      verificationStatus: 'VERIFIED',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const dummySkills: CandidateSkill[] = [
    {
      id: 'skill-1',
      userId: dummyProfile.userId,
      name: 'TypeScript',
      category: 'Languages',
      proficiency: 'ADVANCED',
      yearsExperience: 5,
      isActive: true,
      verificationStatus: 'VERIFIED',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'skill-2',
      userId: dummyProfile.userId,
      name: 'PostgreSQL',
      category: 'Databases',
      proficiency: 'INTERMEDIATE',
      yearsExperience: 4,
      isActive: true,
      verificationStatus: 'VERIFIED',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const dummyLanguages: CandidateLanguage[] = [
    {
      id: 'lang-1',
      userId: dummyProfile.userId,
      language: 'English',
      proficiency: 'NATIVE_OR_BILINGUAL',
      cefrLevel: 'C2',
      notes: null,
      verificationStatus: 'VERIFIED',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const dummyCertifications: CandidateCertification[] = [
    {
      id: 'cert-1',
      userId: dummyProfile.userId,
      name: 'AWS Solutions Architect',
      issuingOrganization: 'Amazon Web Services',
      issueDate: '2022-05',
      expirationDate: null,
      credentialId: 'AWS-123',
      credentialUrl: null,
      verificationStatus: 'VERIFIED',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const dummyProjects: CandidateProject[] = [
    {
      id: 'proj-1',
      userId: dummyProfile.userId,
      name: 'Cloud Observability Tool',
      role: 'Lead Developer',
      description: 'Open source monitoring agent',
      projectUrl: 'https://github.com/alex/cloud-agent',
      startDate: '2022-01',
      endDate: null,
      skills: ['TypeScript', 'Go'],
      achievements: ['Achieved 500 GitHub stars'],
      isActive: true,
      displayOrder: 0,
      verificationStatus: 'VERIFIED',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const dummyLinks: CandidateLink[] = [
    {
      id: 'link-1',
      userId: dummyProfile.userId,
      label: 'LinkedIn',
      url: 'https://linkedin.com/in/alex-dev',
      displayOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const candidateContext: CandidateContext = {
    profile: dummyProfile,
    experiences: dummyExperiences,
    education: dummyEducation,
    skills: dummySkills,
    languages: dummyLanguages,
    certifications: dummyCertifications,
    projects: dummyProjects,
    links: dummyLinks,
  };

  const dummyJob: Job = {
    id: 'job-1',
    userId: dummyProfile.userId,
    state: 'INGESTED',
    title: 'Staff Software Engineer',
    company: 'Acme Cloud Systems',
    companyUrl: 'https://acme.example.com',
    locationText: 'Berlin, Germany',
    city: 'Berlin',
    region: null,
    country: 'Germany',
    workplaceType: 'REMOTE',
    employmentType: 'FULL_TIME',
    seniority: 'SENIOR',
    department: 'Engineering',
    minSalary: 95000,
    maxSalary: 120000,
    currency: 'EUR',
    payPeriod: 'YEAR',
    applicationUrl: 'https://acme.example.com/apply',
    description: 'We are seeking a Staff Software Engineer with TypeScript expertise.',
    descriptionHtml: '<p>We are seeking a Staff Software Engineer with TypeScript expertise.</p>',
    contentHash: 'hash-1',
    canonicalUrl: 'https://acme.example.com/jobs/1',
    originalUrl: 'https://acme.example.com/apply',
    postedDate: null,
    expirationDate: null,
    discoveredDate: new Date(),
    lastCheckedDate: null,
    compensationRaw: null,
    provider: 'GENERIC',
    sourceExternalId: null,
    sourceCompanyId: null,
    isDuplicate: false,
    duplicateOfId: null,
    hasManualEdits: false,
    manualEditFields: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // ========================================================================
  // 1. CV Base Selector Tests
  // ========================================================================
  describe('CvBaseSelector', () => {
    const dummyDocs: CandidateDocument[] = [
      {
        id: 'doc-master',
        userId: dummyProfile.userId,
        documentType: 'MASTER_CV',
        displayName: 'Alex Developer Master Resume',
        originalFilename: 'master.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 15000,
        storageKey: 'master.docx',
        sha256Checksum: 'chk-master',
        roleFocus: 'General Full Stack',
        version: '1.0',
        isActive: true,
        isMaster: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'doc-role',
        userId: dummyProfile.userId,
        documentType: 'ROLE_CV',
        displayName: 'Alex Staff Engineer Resume',
        originalFilename: 'staff.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 16000,
        storageKey: 'staff.docx',
        sha256Checksum: 'chk-staff',
        roleFocus: 'Staff Software Engineer',
        version: '1.0',
        isActive: true,
        isMaster: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('prioritizes manual document override when provided', () => {
      const result = CvBaseSelector.selectBase(dummyDocs, dummyJob, 'doc-master');
      expect(result.selectedDocumentId).toBe('doc-master');
      expect(result.reason).toContain('Manually chosen base CV');
    });

    it('selects active role-oriented CV matching job title', () => {
      const result = CvBaseSelector.selectBase(dummyDocs, dummyJob);
      expect(result.selectedDocumentId).toBe('doc-role');
      expect(result.reason).toContain('Matched active role-oriented CV');
      expect(result.roleFocus).toBe('Staff Software Engineer');
    });

    it('falls back to active Master CV when no role CV matches', () => {
      const otherJob = { ...dummyJob, title: 'Product Manager' };
      const result = CvBaseSelector.selectBase(dummyDocs, otherJob);
      expect(result.selectedDocumentId).toBe('doc-master');
      expect(result.reason).toContain('Selected active Master CV');
    });

    it('falls back to pure Candidate Brain structured compilation when no documents exist', () => {
      const result = CvBaseSelector.selectBase([], dummyJob);
      expect(result.selectedDocumentId).toBeNull();
      expect(result.reason).toContain('No base CV document selected');
    });
  });

  // ========================================================================
  // 2. TailoringEngine & Truthfulness Tests
  // ========================================================================
  describe('TailoringEngine & Truthfulness Invariants', () => {
    it('preserves immutable candidate factual fields (employers, titles, dates, institutions, degrees)', () => {
      const tailored = TailoringEngine.buildTailoredCv(candidateContext, dummyJob, null, []);

      expect(tailored.header.fullName).toBe('Alex Developer');
      expect(tailored.experiences[0]?.organization).toBe('Tech Corp');
      expect(tailored.experiences[0]?.title).toBe('Senior Software Engineer');
      expect(tailored.experiences[0]?.startDate).toBe('2021-01');
      expect(tailored.experiences[0]?.endDate).toBe('2024-01');

      expect(tailored.education[0]?.institution).toBe('Technical University');
      expect(tailored.education[0]?.degree).toBe('Bachelor of Science');
      expect(tailored.certifications[0]?.issuer).toBe('Amazon Web Services');
      expect(tailored.languages[0]?.language).toBe('English');
      expect(tailored.languages[0]?.proficiencyLevel).toBe('NATIVE_OR_BILINGUAL');
    });

    it('attaches evidence IDs to all tailored bullet points', () => {
      const tailored = TailoringEngine.buildTailoredCv(candidateContext, dummyJob, null, []);
      const bullet = tailored.experiences[0]?.bullets[0];

      expect(bullet).toBeDefined();
      expect(bullet?.evidenceIds).toContain('candidate_experience:exp-1');
      expect(bullet?.sourceEntityType).toBe('candidate_experiences');
      expect(bullet?.sourceEntityId).toBe('exp-1');
    });

    it('never adds unsupported skills into tailored skills list', () => {
      const tailored = TailoringEngine.buildTailoredCv(candidateContext, dummyJob, null, []);
      const skillNames = tailored.skills.map((s) => s.name);

      expect(skillNames).toContain('TypeScript');
      expect(skillNames).toContain('PostgreSQL');
      expect(skillNames).not.toContain('Rust');
      expect(skillNames).not.toContain('React');
    });

    it('rejects synthetic metrics via metric safeguard and falls back to verified source text', () => {
      const verifiedSource = 'Managed engineering deliverables and backend microservices.';
      const hallucinatedBullet =
        'Managed engineering deliverables and boosted team productivity by 40% across 12 squads.';

      const safeguarded = TailoringEngine.applyMetricSafeguard(hallucinatedBullet, verifiedSource);
      expect(safeguarded).toBe(verifiedSource);
    });

    it('allows verified metrics when they exist in source text', () => {
      const verifiedSource =
        'Architected microservices serving 10000 requests per second with 99.9% uptime.';
      const tailored =
        'Architected distributed microservices serving 10000 requests per second with 99.9% uptime.';

      const safeguarded = TailoringEngine.applyMetricSafeguard(tailored, verifiedSource);
      expect(safeguarded).toBe(tailored);
    });
  });

  // ========================================================================
  // 3. CoverLetterEngine Tests
  // ========================================================================
  describe('CoverLetterEngine', () => {
    it('generates grounded cover letter referencing candidate verified experience and skills', () => {
      const cl = CoverLetterEngine.generateCoverLetter(candidateContext, dummyJob);

      expect(cl.text).toContain('Acme Cloud Systems');
      expect(cl.text).toContain('Staff Software Engineer');
      expect(cl.text).toContain('Tech Corp');
      expect(cl.text).toContain('Senior Software Engineer');
      expect(cl.text).toContain('TypeScript');
      expect(cl.evidenceIds).toContain('candidate_experience:exp-1');
      expect(cl.evidenceIds).toContain('candidate_skill:skill-1');
      expect(cl.changeSummary.length).toBeGreaterThan(0);
    });

    it('generates truthful domain-appropriate cover letter for Project Manager without software engineering bias', () => {
      const pmContext: CandidateContext = {
        ...candidateContext,
        profile: {
          ...dummyProfile,
          fullName: 'Asadbek Makhmudov',
          headline: 'Project Manager',
        },
        experiences: [
          {
            id: 'exp-pm',
            userId: dummyProfile.userId,
            organization: 'Asia Alliance Bank',
            position: 'Operations Assistant',
            location: 'Samarkand',
            employmentType: 'INTERNSHIP',
            startDate: '2023-05',
            endDate: '2023-08',
            isCurrent: false,
            description: 'Assisted operations management and optimized banking workflows.',
            achievements: [
              'Assisted in digitizing operational files and optimizing workflows, achieving a 30% reduction in document retrieval time',
            ],
            displayOrder: 0,
            verificationStatus: 'VERIFIED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        skills: [
          {
            id: 'skill-pm1',
            userId: dummyProfile.userId,
            name: 'Project Management',
            category: 'Management',
            proficiency: 'ADVANCED',
            yearsExperience: 2,
            isActive: true,
            verificationStatus: 'VERIFIED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'skill-pm2',
            userId: dummyProfile.userId,
            name: 'Agile Methodologies',
            category: 'Methodology',
            proficiency: 'ADVANCED',
            yearsExperience: 2,
            isActive: true,
            verificationStatus: 'VERIFIED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const pmJob: Job = {
        ...dummyJob,
        title: 'Associate Project Manager',
        company: 'Fintech Solutions Ltd',
      };

      const cl = CoverLetterEngine.generateCoverLetter(pmContext, pmJob);

      expect(cl.text).toContain('Fintech Solutions Ltd');
      expect(cl.text).toContain('Associate Project Manager');
      expect(cl.text).toContain('Asia Alliance Bank');
      expect(cl.text).toContain('Operations Assistant');
      expect(cl.text).toContain('Project Management');
      expect(cl.text).toContain('Agile Methodologies');
      expect(cl.text).toContain('30% reduction in document retrieval time');
      // Crucial: must never hallucinate software engineering claims
      expect(cl.text).not.toContain('production software systems');
      expect(cl.text).not.toContain('engineering experience');
      expect(cl.text).not.toContain('engineering initiatives');
      expect(cl.evidenceIds).toContain('candidate_experience:exp-pm');
      expect(cl.evidenceIds).toContain('candidate_skill:skill-pm1');
    });
  });

  // ========================================================================
  // 4. ApplicationQuestionEngine Tests
  // ========================================================================
  describe('ApplicationQuestionEngine Resolution Hierarchy', () => {
    const verifiedAnswers: AnswerLibrary[] = [
      {
        id: 'ans-1',
        userId: dummyProfile.userId,
        question: 'Are you open to remote work?',
        category: 'WORK_AUTHORIZATION',
        answer: 'Yes, I am fully equipped for remote work.',
        notes: null,
        automationLevel: 'AUTO',
        verificationStatus: 'VERIFIED',
        isSensitive: false,
        conditions: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'ans-2',
        userId: dummyProfile.userId,
        question: 'What is your management philosophy?',
        category: 'GENERAL',
        answer: 'Empower autonomous cross-functional teams.',
        notes: null,
        automationLevel: 'REVIEW',
        verificationStatus: 'VERIFIED',
        isSensitive: false,
        conditions: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const preferences: JobPreferences = {
      id: 'pref-1',
      userId: dummyProfile.userId,
      targetTitles: ['Staff Software Engineer'],
      targetCategories: ['Engineering'],
      preferredLocations: ['Berlin'],
      workModes: ['REMOTE'],
      employmentTypes: ['FULL_TIME'],
      seniorityLevels: ['SENIOR'],
      minSalary: 90000,
      maxSalary: 120000,
      currency: 'EUR',
      preferredLanguages: ['English'],
      excludedCompanies: [],
      excludedKeywords: [],
      acceptUnpaid: false,
      willingToRelocate: false,
      needsSponsorship: false,
      customPreferences: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('Level 1: resolves non-sensitive verified AUTO answer without approval needed', () => {
      const res = ApplicationQuestionEngine.resolveQuestion(
        {
          questionText: 'Are you open to remote work?',
          category: 'GENERAL',
          questionType: 'TEXT',
          options: [],
          sensitivity: 'STANDARD',
          isRequired: true,
        },
        {
          candidate: candidateContext,
          answerLibrary: verifiedAnswers,
          candidateFacts: [],
          preferences,
          policy: null,
        },
      );

      expect(res.proposedAnswer).toBe('Yes, I am fully equipped for remote work.');
      expect(res.answerSource).toBe('ANSWER_LIBRARY');
      expect(res.approvalState).toBe('APPROVED');
      expect(res.needsApproval).toBe(false);
    });

    it('Level 1: resolves REVIEW answer with pending approval required', () => {
      const res = ApplicationQuestionEngine.resolveQuestion(
        {
          questionText: 'What is your management philosophy?',
          category: 'GENERAL',
          questionType: 'TEXT',
          options: [],
          sensitivity: 'STANDARD',
          isRequired: true,
        },
        {
          candidate: candidateContext,
          answerLibrary: verifiedAnswers,
          candidateFacts: [],
          preferences,
          policy: null,
        },
      );

      expect(res.proposedAnswer).toBe('Empower autonomous cross-functional teams.');
      expect(res.answerSource).toBe('ANSWER_LIBRARY');
      expect(res.approvalState).toBe('PENDING');
      expect(res.needsApproval).toBe(true);
      expect(res.approvalDetails?.riskLevel).toBe('LOW');
    });

    it('Level 2: resolves sensitive visa sponsorship from candidate preferences with mandatory human approval', () => {
      const res = ApplicationQuestionEngine.resolveQuestion(
        {
          questionText: 'Will you now or in the future require visa sponsorship?',
          category: 'SPONSORSHIP',
          questionType: 'SINGLE_SELECT',
          options: ['Yes', 'No'],
          sensitivity: 'SENSITIVE',
          isRequired: true,
        },
        {
          candidate: candidateContext,
          answerLibrary: [],
          candidateFacts: [],
          preferences,
          policy: null,
        },
      );

      expect(res.proposedAnswer).toBe('No');
      expect(res.answerSource).toBe('CANDIDATE_FACT');
      expect(res.approvalState).toBe('PENDING');
      expect(res.needsApproval).toBe(true);
      expect(res.approvalDetails?.approvalType).toBe('SENSITIVE_ANSWER');
      expect(res.approvalDetails?.riskLevel).toBe('CRITICAL');
    });

    it('Level 2: resolves verified candidate email and phone automatically', () => {
      const res = ApplicationQuestionEngine.resolveQuestion(
        {
          questionText: 'Email address',
          category: 'GENERAL',
          questionType: 'TEXT',
          options: [],
          sensitivity: 'STANDARD',
          isRequired: true,
        },
        {
          candidate: candidateContext,
          answerLibrary: [],
          candidateFacts: [],
          preferences,
          policy: null,
        },
      );

      expect(res.proposedAnswer).toBe('alex@example.com');
      expect(res.approvalState).toBe('APPROVED');
      expect(res.needsApproval).toBe(false);
    });

    it('Level 4: unknown question creates pending approval and never guesses an answer', () => {
      const res = ApplicationQuestionEngine.resolveQuestion(
        {
          questionText: 'How many years have you worked with Quantum Computing?',
          category: 'EXPERIENCE_YEARS',
          questionType: 'NUMBER',
          options: [],
          sensitivity: 'STANDARD',
          isRequired: true,
        },
        {
          candidate: candidateContext,
          answerLibrary: [],
          candidateFacts: [],
          preferences,
          policy: null,
        },
      );

      expect(res.proposedAnswer).toBeNull();
      expect(res.answerSource).toBe('UNRESOLVED');
      expect(res.approvalState).toBe('PENDING');
      expect(res.needsApproval).toBe(true);
      expect(res.approvalDetails?.reason).toContain('No authoritative Candidate Brain evidence');
    });
  });

  // ========================================================================
  // 5. PackageReadinessEngine Tests
  // ========================================================================
  describe('PackageReadinessEngine Determinism', () => {
    const dummyPkg: ApplicationPackage = {
      id: 'pkg-1',
      jobId: dummyJob.id,
      userId: dummyProfile.userId,
      matchAnalysisId: 'analysis-1',
      status: 'NEEDS_REVIEW',
      currentVersionNumber: 1,
      hasPolicyBlocker: false,
      blockerOverridden: false,
      blockerOverrideReason: null,
      blockerOverriddenAt: null,
      isStale: false,
      readinessReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const dummyVer: ApplicationPackageVersion = {
      id: 'ver-1',
      packageId: 'pkg-1',
      versionNumber: 1,
      status: 'NEEDS_REVIEW',
      inputFingerprint: 'fp-1',
      baseDocumentId: 'doc-master',
      baseSelectionReason: 'Selected Master CV',
      tailoredCvContent: null,
      coverLetterContent: 'Letter text',
      coverLetterEnabled: true,
      coverLetterApproved: true,
      changeSummary: [],
      generationMode: 'DETERMINISTIC_ONLY',
      aiModel: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const validArtifact: ApplicationArtifact = {
      id: 'art-1',
      packageId: 'pkg-1',
      versionId: 'ver-1',
      artifactType: 'TAILORED_CV',
      storageKey: 'cv.docx',
      filename: 'cv.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 12000,
      sha256Checksum: 'hash-cv',
      metadata: {},
      createdAt: new Date(),
    };

    it('blocks READY if tailored CV artifact is missing', () => {
      const readiness = PackageReadinessEngine.evaluateReadiness({
        pkg: dummyPkg,
        version: dummyVer,
        artifacts: [],
        questions: [],
        approvals: [],
      });

      expect(readiness.isReady).toBe(false);
      expect(readiness.status).toBe('NEEDS_REVIEW');
      expect(readiness.blockingIssues).toContain(
        'Tailored CV document artifact has not been generated',
      );
    });

    it('blocks READY if required application questions are unresolved', () => {
      const unresolvedQ: ApplicationQuestion = {
        id: 'q-1',
        packageId: 'pkg-1',
        versionId: 'ver-1',
        questionText: 'Are you authorized to work?',
        category: 'WORK_AUTHORIZATION',
        questionType: 'SINGLE_SELECT',
        isRequired: true,
        options: ['Yes', 'No'],
        sensitivity: 'SENSITIVE',
        answerSource: 'UNRESOLVED',
        sourceEntityId: null,
        proposedAnswer: null,
        humanEditedAnswer: null,
        finalAnswer: null,
        approvalState: 'PENDING',
        displayOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const readiness = PackageReadinessEngine.evaluateReadiness({
        pkg: dummyPkg,
        version: dummyVer,
        artifacts: [validArtifact],
        questions: [unresolvedQ],
        approvals: [],
      });

      expect(readiness.isReady).toBe(false);
      expect(
        readiness.blockingIssues.some((i) =>
          i.includes('required application question(s) are unresolved'),
        ),
      ).toBe(true);
    });

    it('blocks READY if pending approval requests exist', () => {
      const pendingApproval: ApprovalRequest = {
        id: 'appr-1',
        packageId: 'pkg-1',
        versionId: 'ver-1',
        userId: dummyProfile.userId,
        questionId: 'q-1',
        approvalType: 'SENSITIVE_ANSWER',
        status: 'PENDING',
        subject: 'Visa Sponsorship Approval',
        proposedValue: 'No',
        userEditedValue: null,
        reason: 'Requires legal verification',
        riskLevel: 'CRITICAL',
        evidenceReferences: [],
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const readiness = PackageReadinessEngine.evaluateReadiness({
        pkg: dummyPkg,
        version: dummyVer,
        artifacts: [validArtifact],
        questions: [],
        approvals: [pendingApproval],
      });

      expect(readiness.isReady).toBe(false);
      expect(
        readiness.blockingIssues.some((i) =>
          i.includes('pending approval request(s) require human review'),
        ),
      ).toBe(true);
    });

    it('blocks READY if package is marked stale', () => {
      const readiness = PackageReadinessEngine.evaluateReadiness({
        pkg: { ...dummyPkg, isStale: true },
        version: dummyVer,
        artifacts: [validArtifact],
        questions: [],
        approvals: [],
      });

      expect(readiness.isReady).toBe(false);
      expect(readiness.blockingIssues.some((i) => i.includes('package is stale'))).toBe(true);
    });

    it('blocks READY if hard policy blocker exists without override, but allows READY when override exists', () => {
      // 1. Without override
      const blocked = PackageReadinessEngine.evaluateReadiness({
        pkg: { ...dummyPkg, hasPolicyBlocker: true, blockerOverridden: false },
        version: dummyVer,
        artifacts: [validArtifact],
        questions: [],
        approvals: [],
      });
      expect(blocked.isReady).toBe(false);
      expect(blocked.blockingIssues.some((i) => i.includes('hard policy blockers'))).toBe(true);

      // 2. With override
      const unblocked = PackageReadinessEngine.evaluateReadiness({
        pkg: {
          ...dummyPkg,
          hasPolicyBlocker: true,
          blockerOverridden: true,
          blockerOverrideReason: 'Candidate willing to commute despite location policy',
        },
        version: dummyVer,
        artifacts: [validArtifact],
        questions: [],
        approvals: [],
      });
      expect(unblocked.isReady).toBe(true);
      expect(unblocked.status).toBe('READY');
    });

    it('returns READY when all artifacts, questions, and approvals are valid and resolved', () => {
      const approvedQ: ApplicationQuestion = {
        id: 'q-1',
        packageId: 'pkg-1',
        versionId: 'ver-1',
        questionText: 'Email',
        category: 'GENERAL',
        questionType: 'TEXT',
        isRequired: true,
        options: [],
        sensitivity: 'STANDARD',
        answerSource: 'CANDIDATE_FACT',
        sourceEntityId: null,
        proposedAnswer: 'alex@example.com',
        humanEditedAnswer: null,
        finalAnswer: 'alex@example.com',
        approvalState: 'APPROVED',
        displayOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const readiness = PackageReadinessEngine.evaluateReadiness({
        pkg: dummyPkg,
        version: dummyVer,
        artifacts: [validArtifact],
        questions: [approvedQ],
        approvals: [],
      });

      expect(readiness.isReady).toBe(true);
      expect(readiness.status).toBe('READY');
      expect(readiness.blockingIssues.length).toBe(0);
    });
  });

  // ========================================================================
  // 6. DocxGeneratorService Tests
  // ========================================================================
  describe('DocxGeneratorService Document Creation', () => {
    it('generates non-empty ATS-compliant DOCX file with expected MIME and filename', async () => {
      const mockStorage = {
        saveFile: async (buf: Buffer, opt: { originalFilename: string; mimeType: string }) => ({
          storageKey: 'mock-key.docx',
          originalFilename: opt.originalFilename,
          mimeType: opt.mimeType,
          sizeBytes: buf.length,
          sha256Checksum: 'mock-chk',
        }),
        getFile: async (key: string) => ({ buffer: Buffer.from('mock'), storageKey: key }),
        deleteFile: async () => {},
        exists: async () => true,
      };

      const docxService = new DocxGeneratorService(mockStorage as any);
      const tailoredCv = TailoringEngine.buildTailoredCv(candidateContext, dummyJob, null, []);

      const result = await docxService.generateTailoredCvDocx(tailoredCv, {
        packageId: 'pkg-1',
        versionNumber: 1,
        candidateName: 'Alex Developer',
        jobTitle: 'Staff Software Engineer',
      });

      expect(result.buffer).toBeDefined();
      expect(result.buffer.length).toBeGreaterThan(100); // Valid zip/docx file size
      expect(result.metadata.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      expect(result.metadata.originalFilename).toContain('Alex_Developer_CV');
    });
  });
});
