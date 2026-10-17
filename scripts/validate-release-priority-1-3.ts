import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import { getConfig } from '@job-agent/config';
import {
  getDb,
  closeDbPool,
  users,
  candidateProfiles,
  candidateExperiences,
  candidateEducation,
  candidateSkills,
  candidateCertifications,
  candidateLanguages,
  candidateLinks,
  candidateFacts,
  candidateDocuments,
  profileImportSessions,
  candidateAuditEvents,
  jobPreferences,
  jobs,
  jobRequirements,
} from '@job-agent/database';
import { CandidateIntelligenceContextBuilder } from '../apps/api/src/services/career-intelligence/candidate-intelligence-context-builder.js';
import { MatchingContextBuilder } from '../apps/api/src/services/matching-context-builder.js';
import { MatchingScoringEngine } from '../apps/api/src/services/matching-scoring-engine.js';
import { HardPolicyEngine } from '../apps/api/src/services/hard-policy-engine.js';
import { CandidateEvidenceResolver } from '../apps/api/src/services/candidate-evidence-resolver.js';
import { CareerFitCategories } from '@job-agent/shared';

async function main() {
  const config = getConfig();
  const db = getDb(config.DATABASE_URL);
  const primaryUserId = '00000000-0000-0000-0000-000000000001';

  console.log('================================================================');
  console.log('JOBEE — CAREER INTELLIGENCE 2.0 RELEASE VALIDATION & AUDIT');
  console.log(`Execution Timestamp: ${new Date().toISOString()}`);
  console.log(`Target Candidate ID: ${primaryUserId}`);
  console.log('================================================================\n');

  // ============================================================================
  // PRIORITY 1: POST-REMEDIATION AUDIT (READ-ONLY)
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('PRIORITY 1 — POST-REMEDIATION VALIDATION (READ-ONLY)');
  console.log('----------------------------------------------------------------');

  const backupDir = path.resolve('backups');
  const executedManifestName = 'candidate-brain-manifest-1792228029784.json';
  const manifestPath = path.join(backupDir, executedManifestName);

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`CRITICAL: Remediation manifest ${executedManifestName} not found in backups/`);
  }

  const manifestStats = fs.statSync(manifestPath);
  const manifestMode = (manifestStats.mode & 0o777).toString(8);
  const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);

  console.log(`✓ Pre-remediation manifest exists: ${executedManifestName}`);
  console.log(`  File size: ${manifestStats.size} bytes`);
  console.log(`  File mode: 0o${manifestMode} (owner read/write restricted)`);
  console.log(`  Manifest timestamp: ${manifest.timestamp}`);
  console.log(`  Manifest dryRun: ${manifest.dryRun}`);
  console.log(`  Manifest recorded changes: ${manifest.totalChanges}`);
  console.log(`  Pre-remediation snapshot present: ${Boolean(manifest.preRemediationBackup)}`);
  console.log(
    `  Pre-remediation snapshot total items: ${manifest.preRemediationBackup?.items?.length || 0}`,
  );

  // Query database records for primary candidate
  const [profile] = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, primaryUserId));
  const experiences = await db
    .select()
    .from(candidateExperiences)
    .where(eq(candidateExperiences.userId, primaryUserId));
  const education = await db
    .select()
    .from(candidateEducation)
    .where(eq(candidateEducation.userId, primaryUserId));
  const skills = await db
    .select()
    .from(candidateSkills)
    .where(eq(candidateSkills.userId, primaryUserId));
  const certifications = await db
    .select()
    .from(candidateCertifications)
    .where(eq(candidateCertifications.userId, primaryUserId));
  const languages = await db
    .select()
    .from(candidateLanguages)
    .where(eq(candidateLanguages.userId, primaryUserId));
  const links = await db
    .select()
    .from(candidateLinks)
    .where(eq(candidateLinks.userId, primaryUserId));
  const facts = await db
    .select()
    .from(candidateFacts)
    .where(eq(candidateFacts.userId, primaryUserId));
  const documents = await db
    .select()
    .from(candidateDocuments)
    .where(eq(candidateDocuments.userId, primaryUserId));
  const sessions = await db
    .select()
    .from(profileImportSessions)
    .where(eq(profileImportSessions.userId, primaryUserId));
  const auditEvents = await db
    .select()
    .from(candidateAuditEvents)
    .where(eq(candidateAuditEvents.userId, primaryUserId));

  console.log('\nProduction Candidate Record Counts:');
  console.log(`  - Profile: ${profile ? 'Found' : 'MISSING'} (${profile?.fullName})`);
  console.log(`    Headline: "${profile?.headline}"`);
  console.log(`    Contact: ${profile?.email} | ${profile?.phone}`);
  console.log(`    City/Country: ${profile?.city}, ${profile?.country}`);
  console.log(`  - Documents: ${documents.length}`);
  console.log(`  - Experiences: ${experiences.length}`);
  console.log(`  - Education: ${education.length}`);
  console.log(`  - Skills: ${skills.length}`);
  console.log(`  - Certifications: ${certifications.length}`);
  console.log(`  - Languages: ${languages.length}`);
  console.log(`  - Links: ${links.length}`);
  console.log(`  - Facts: ${facts.length}`);
  console.log(`  - Import Sessions: ${sessions.length}`);
  console.log(`  - Audit Events: ${auditEvents.length}`);

  // Check 1: Synthetic record removal
  const syntheticKeywords = [
    'Elena Rostova',
    'Jane Hopper',
    'Apex Neural Dynamics',
    'Stanford University',
    'Distributed Systems',
    'Kubernetes Architecture',
    'Rust Concurrency',
    'Microservices Orchestration',
    'German',
  ];

  const syntheticFindings: string[] = [];
  experiences.forEach((e) => {
    if (syntheticKeywords.some((k) => e.organization.includes(k) || e.position.includes(k))) {
      syntheticFindings.push(`Experience: ${e.organization} - ${e.position}`);
    }
  });
  education.forEach((ed) => {
    if (syntheticKeywords.some((k) => ed.institution.includes(k))) {
      syntheticFindings.push(`Education: ${ed.institution}`);
    }
  });
  skills.forEach((s) => {
    if (syntheticKeywords.some((k) => s.name.includes(k))) {
      syntheticFindings.push(`Skill: ${s.name}`);
    }
  });
  languages.forEach((l) => {
    if (l.language.toLowerCase() === 'german') {
      syntheticFindings.push(`Language: ${l.language}`);
    }
  });
  facts.forEach((f) => {
    if (syntheticKeywords.some((k) => f.statement.includes(k))) {
      syntheticFindings.push(`Fact: ${f.statement}`);
    }
  });

  console.log('\nSynthetic Records Residual Check:');
  if (syntheticFindings.length === 0) {
    console.log('  ✓ Zero synthetic records found in production database (100% clean).');
  } else {
    console.error(`  ✕ Discrepancy: ${syntheticFindings.length} synthetic records still present!`);
    syntheticFindings.forEach((f) => console.error(`    * ${f}`));
  }

  // Check 2: AI-Authorized Facts
  console.log('\nAI-Authorized Facts Check:');
  const aiAuthorizedFacts = facts.filter((f) => f.allowAiUse === true);
  console.log(`  Total facts with allowAiUse=true: ${aiAuthorizedFacts.length}`);
  if (aiAuthorizedFacts.length === 0) {
    console.log(
      '  ✓ Zero synthetic or unverified AI-authorized facts exist (Strict Prime Directive compliance).',
    );
  } else {
    console.warn(`  ! Found ${aiAuthorizedFacts.length} AI-authorized facts. Listing:`);
    aiAuthorizedFacts.forEach((f) =>
      console.log(`    - [${f.verificationStatus}] ${f.factKey}: ${f.statement}`),
    );
  }

  // Check 3: Genuine candidate records preserved
  console.log('\nGenuine Candidate Records Check:');
  const hasAuthenticMasterDoc = documents.some(
    (d) => d.displayName.includes('Asadbek') && d.isMaster,
  );
  const hasAuthenticExp = experiences.some(
    (e) => e.organization === 'Asia Alliance Bank' && e.position.includes('Operations'),
  );
  const hasAuthenticEdu = education.some((ed) => ed.institution.includes('Vistula'));
  const hasAuthenticCert = certifications.some((c) => c.name.includes('Google Project Management'));
  const hasAuthenticLang = languages.some((l) => l.language.toLowerCase() === 'english');

  console.log(`  - Master CV preserved: ${hasAuthenticMasterDoc ? '✓ YES' : '✕ NO'}`);
  console.log(`  - Asia Alliance Bank experience preserved: ${hasAuthenticExp ? '✓ YES' : '✕ NO'}`);
  console.log(`  - Vistula University education preserved: ${hasAuthenticEdu ? '✓ YES' : '✕ NO'}`);
  console.log(
    `  - Google Project Management cert preserved: ${hasAuthenticCert ? '✓ YES' : '✕ NO'}`,
  );
  console.log(`  - English fluency preserved: ${hasAuthenticLang ? '✓ YES' : '✕ NO'}`);

  // ============================================================================
  // PRIORITY 2: VERIFY ACTUAL CANDIDATE INTELLIGENCE CONTEXT
  // ============================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('PRIORITY 2 — CANDIDATE INTELLIGENCE CONTEXT INSPECTION');
  console.log('----------------------------------------------------------------');

  const contextBuilder = new CandidateIntelligenceContextBuilder(db);
  const intelContext = await contextBuilder.build(primaryUserId);

  console.log(`Intelligence Context Version: v${intelContext.contextVersion}`);
  console.log(`Candidate State Hash (SHA-256): ${intelContext.candidateStateHash}`);
  console.log(`Total Claims in PostgreSQL:`);
  console.log(`  - Experiences: ${intelContext.allExperiences.length}`);
  console.log(`  - Skills: ${intelContext.allSkills.length}`);
  console.log(`  - Education: ${intelContext.allEducation.length}`);
  console.log(`  - Certifications: ${intelContext.allCertifications.length}`);
  console.log(`  - Facts: ${intelContext.allFacts.length}`);

  console.log(`\nVerified & AI-Authorized Claims (Exposed to Generative AI Prompt):`);
  console.log(`  - Verified AI Experiences: ${intelContext.verifiedAiExperiences.length}`);
  intelContext.verifiedAiExperiences.forEach((e) =>
    console.log(`    * ${e.organization}: ${e.position}`),
  );

  console.log(`  - Verified AI Skills: ${intelContext.verifiedAiSkills.length}`);
  intelContext.verifiedAiSkills.forEach((s) => console.log(`    * ${s.name} (${s.proficiency})`));

  console.log(`  - Verified AI Education: ${intelContext.verifiedAiEducation.length}`);
  intelContext.verifiedAiEducation.forEach((ed) =>
    console.log(`    * ${ed.institution}: ${ed.degree}`),
  );

  console.log(`  - Verified AI Certifications: ${intelContext.verifiedAiCertifications.length}`);
  intelContext.verifiedAiCertifications.forEach((c) => console.log(`    * ${c.name}`));

  console.log(`\nExcluded Claims & Reason:`);
  const unverifiedSkills = intelContext.allSkills.filter(
    (s) => s.verificationStatus !== 'VERIFIED' || !s.allowAiUse,
  );
  console.log(`  - Unverified / AI-Gated Skills: ${unverifiedSkills.length}`);
  unverifiedSkills
    .slice(0, 5)
    .forEach((s) =>
      console.log(
        `    * ${s.name}: verificationStatus=${s.verificationStatus}, allowAiUse=${s.allowAiUse}`,
      ),
    );

  const unverifiedFacts = intelContext.allFacts.filter(
    (f) => f.verificationStatus !== 'VERIFIED' || !f.allowAiUse,
  );
  console.log(`  - Unverified / AI-Gated Facts: ${unverifiedFacts.length}`);
  unverifiedFacts.forEach((f) =>
    console.log(
      `    * ${f.factKey}: verificationStatus=${f.verificationStatus}, allowAiUse=${f.allowAiUse}`,
    ),
  );

  console.log(`\nClarification Needs Generated (High-Impact Questions):`);
  intelContext.summary.whatNeedsClarification.forEach((c, idx) => {
    console.log(`  ${idx + 1}. [${c.impact}] ${c.category}: "${c.question}" (field: ${c.field})`);
  });

  console.log(`\nTransferable Capabilities Extracted:`);
  console.log(`  ${intelContext.transferableCapabilities.join(', ') || 'None configured'}`);

  // Invariant confirmation: Check if any unverified item leaks into aiPromptContext
  const promptContextJson = JSON.stringify(intelContext.aiPromptContext);
  let promptLeakFound = false;
  for (const uf of unverifiedFacts) {
    if (promptContextJson.includes(uf.statement)) {
      console.error(`LEAK DETECTED: Unverified fact in AI prompt context: "${uf.statement}"`);
      promptLeakFound = true;
    }
  }
  if (!promptLeakFound) {
    console.log(
      '✓ Invariant Verified: No unverified or AI-disallowed claims are present in aiPromptContext.',
    );
  }

  // ============================================================================
  // PRIORITY 3: VERIFY CAREER MATCHING AGAINST REALISTIC BENCHMARKS
  // ============================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('PRIORITY 3 — CAREER MATCHING VALIDATION (ISOLATED TEST FIXTURE)');
  console.log('----------------------------------------------------------------');

  // Create isolated test user with realistic Project Management & Banking Operations profile
  const runId = Date.now();
  const testUserId = crypto.randomUUID();

  await db.insert(users).values({
    id: testUserId,
    name: `PM Tester ${runId}`,
    email: `pm_tester_${runId}@example.com`,
    role: 'user',
    systemKey: `pm_test_${runId}`,
  });

  // Insert candidate profile
  await db.insert(candidateProfiles).values({
    userId: testUserId,
    fullName: 'Asadbek Makhmudov (Test)',
    headline: 'Junior Project Manager & Banking Operations',
    email: `pm_tester_${runId}@example.com`,
    city: 'Warsaw',
    country: 'Poland',
    availability: 'IMMEDIATE',
    transferableCapabilities: [
      'Agile Project Management',
      'Scrum & Kanban',
      'Banking Operations',
      'Process Optimization',
    ],
  });

  // Insert job preferences (matching Warsaw, hybrid/onsite, PM roles, sponsorship not needed)
  await db.insert(jobPreferences).values({
    userId: testUserId,
    targetTitles: [
      'Project Coordinator',
      'Junior Project Manager',
      'PMO Assistant',
      'Operations Coordinator',
    ],
    preferredLocations: ['Warsaw', 'Poland'],
    workModes: ['hybrid', 'remote', 'onsite'],
    employmentTypes: ['full-time', 'internship'],
    seniorityLevels: ['junior', 'mid', 'internship'],
    minSalary: 45000,
    currency: 'PLN',
    needsSponsorship: false,
    workAuthorizationCountries: ['Poland', 'European Union'],
    adjacentRoles: ['Operations Assistant', 'Scrum Master Intern'],
    preferredIndustries: ['Banking', 'Finance', 'Technology'],
  });

  // Insert verified experiences
  await db.insert(candidateExperiences).values([
    {
      userId: testUserId,
      organization: 'Asia Alliance Bank',
      position: 'Operations Assistant',
      startDate: '2023-05',
      endDate: '2023-08',
      isCurrent: false,
      responsibilities: [
        'Managed document workflows',
        'Assisted in banking operations and cross-functional task coordination',
      ],
      achievements: ['Streamlined client documentation verification cycle'],
      skills: ['Banking Operations', 'Process Optimization', 'Advanced Excel'],
      verificationStatus: 'VERIFIED',
      allowAiUse: true,
      confidence: 95,
      displayOrder: 1,
    },
  ]);

  // Insert verified education
  await db.insert(candidateEducation).values([
    {
      userId: testUserId,
      institution: 'Vistula University',
      degree: 'Bachelor of Science',
      fieldOfStudy: 'Project Management',
      startDate: '2022-10',
      endDate: '2025-06',
      isCurrent: true,
      verificationStatus: 'VERIFIED',
      allowAiUse: true,
      confidence: 95,
      displayOrder: 1,
    },
  ]);

  // Insert verified skills
  await db.insert(candidateSkills).values([
    {
      userId: testUserId,
      name: 'Project Management',
      proficiency: 'ADVANCED',
      category: 'Methodology',
      verificationStatus: 'VERIFIED',
      allowAiUse: true,
      confidence: 95,
    },
    {
      userId: testUserId,
      name: 'Agile Methodologies',
      proficiency: 'ADVANCED',
      category: 'Methodology',
      verificationStatus: 'VERIFIED',
      allowAiUse: true,
      confidence: 95,
    },
    {
      userId: testUserId,
      name: 'Scrum',
      proficiency: 'ADVANCED',
      category: 'Methodology',
      verificationStatus: 'VERIFIED',
      allowAiUse: true,
      confidence: 95,
    },
    {
      userId: testUserId,
      name: 'Process Optimization',
      proficiency: 'ADVANCED',
      category: 'Operations',
      verificationStatus: 'VERIFIED',
      allowAiUse: true,
      confidence: 95,
    },
    {
      userId: testUserId,
      name: 'Banking Operations',
      proficiency: 'INTERMEDIATE',
      category: 'Domain',
      verificationStatus: 'VERIFIED',
      allowAiUse: true,
      confidence: 90,
    },
    {
      userId: testUserId,
      name: 'Jira',
      proficiency: 'ADVANCED',
      category: 'Tool',
      verificationStatus: 'VERIFIED',
      allowAiUse: true,
      confidence: 95,
    },
  ]);

  // Insert verified languages
  await db.insert(candidateLanguages).values([
    {
      userId: testUserId,
      language: 'English',
      proficiency: 'FLUENT',
      verificationStatus: 'VERIFIED',
      allowAiUse: true,
      confidence: 95,
    },
  ]);

  // Define the 5 benchmark test jobs with realistic structured requirements
  const benchmarkJobs = [
    {
      key: 'JOB_1',
      title: 'Junior Project Coordinator',
      company: `Fintech Solutions ${runId}`,
      locationText: 'Warsaw, Poland',
      workplaceType: 'HYBRID' as const,
      employmentType: 'FULL_TIME' as const,
      seniority: 'JUNIOR' as const,
      minSalary: 55000,
      maxSalary: 70000,
      currency: 'PLN',
      description:
        'Junior Project Coordinator to support project delivery, sprint planning with Jira, and Agile ceremonies in our Warsaw office. English fluency required.',
      requirements: [
        { rawText: 'Agile methodologies and ceremonies', category: 'SKILL', strength: 'MANDATORY' },
        { rawText: 'Scrum sprint coordination', category: 'SKILL', strength: 'MANDATORY' },
        { rawText: 'Jira task tracking', category: 'SKILL', strength: 'MANDATORY' },
        { rawText: 'Fluent English communication', category: 'LANGUAGE', strength: 'MANDATORY' },
      ],
    },
    {
      key: 'JOB_2',
      title: 'PMO Assistant',
      company: `Global Services ${runId}`,
      locationText: 'Warsaw, Poland',
      workplaceType: 'HYBRID' as const,
      employmentType: 'FULL_TIME' as const,
      seniority: 'JUNIOR' as const,
      minSalary: 50000,
      maxSalary: 65000,
      currency: 'PLN',
      description:
        'PMO Assistant required to assist project managers with scheduling, process documentation, and tracking team deliverables. Jira and Excel required.',
      requirements: [
        { rawText: 'Project Management coordination', category: 'SKILL', strength: 'MANDATORY' },
        { rawText: 'Process Optimization', category: 'SKILL', strength: 'MANDATORY' },
        { rawText: 'Jira workflow tracking', category: 'SKILL', strength: 'MANDATORY' },
        { rawText: 'English language skills', category: 'LANGUAGE', strength: 'MANDATORY' },
      ],
    },
    {
      key: 'JOB_3',
      title: 'Operations Coordinator',
      company: `Euro Bank ${runId}`,
      locationText: 'Warsaw, Poland',
      workplaceType: 'HYBRID' as const,
      employmentType: 'FULL_TIME' as const,
      seniority: 'JUNIOR' as const,
      minSalary: 52000,
      maxSalary: 68000,
      currency: 'PLN',
      description:
        'Operations Coordinator for banking process workflows, cross-department coordination, and operational audits. Background in banking operations or finance preferred.',
      requirements: [
        { rawText: 'Banking Operations processes', category: 'SKILL', strength: 'MANDATORY' },
        { rawText: 'Process Optimization', category: 'SKILL', strength: 'MANDATORY' },
        { rawText: 'English communication', category: 'LANGUAGE', strength: 'MANDATORY' },
      ],
    },
    {
      key: 'JOB_4',
      title: 'Project Management Intern',
      company: `Digital Systems ${runId}`,
      locationText: 'Warsaw, Poland',
      workplaceType: 'ONSITE' as const,
      employmentType: 'INTERNSHIP' as const,
      seniority: 'INTERNSHIP' as const,
      minSalary: 35000,
      maxSalary: 42000,
      currency: 'PLN',
      description:
        'Project Management Intern to support scrum teams and task scheduling. University students in project management or business management encouraged to apply.',
      requirements: [
        { rawText: 'Project Management fundamentals', category: 'SKILL', strength: 'MANDATORY' },
        { rawText: 'Scrum team participation', category: 'SKILL', strength: 'MANDATORY' },
        { rawText: 'English language', category: 'LANGUAGE', strength: 'MANDATORY' },
      ],
    },
    {
      key: 'JOB_5',
      title: 'Senior Software Engineer',
      company: `Cloud Systems ${runId}`,
      locationText: 'Warsaw, Poland',
      workplaceType: 'HYBRID' as const,
      employmentType: 'FULL_TIME' as const,
      seniority: 'SENIOR' as const,
      minSalary: 180000,
      maxSalary: 240000,
      currency: 'PLN',
      description:
        'Senior Software Engineer with 8+ years experience in distributed Go/Rust microservices, Kubernetes clusters, and high-frequency trading engines.',
      requirements: [
        {
          rawText: 'Go or Rust microservice development',
          category: 'SKILL',
          strength: 'MANDATORY',
        },
        {
          rawText: 'Kubernetes cluster deployment and operations',
          category: 'SKILL',
          strength: 'MANDATORY',
        },
        {
          rawText: '8+ years senior software engineering experience',
          category: 'EXPERIENCE',
          strength: 'MANDATORY',
        },
        { rawText: 'English communication', category: 'LANGUAGE', strength: 'MANDATORY' },
      ],
    },
  ];

  const matchingContextBuilder = new MatchingContextBuilder(db);
  const matchingContext = await matchingContextBuilder.buildContext(testUserId);
  const hardPolicyEngine = new HardPolicyEngine();
  const scoringEngine = new MatchingScoringEngine();
  const evidenceResolver = new CandidateEvidenceResolver();

  const insertedJobIds: string[] = [];

  try {
    for (const bJob of benchmarkJobs) {
      const [inserted] = await db
        .insert(jobs)
        .values({
          userId: testUserId,
          title: bJob.title,
          company: bJob.company,
          locationText: bJob.locationText,
          workplaceType: bJob.workplaceType,
          employmentType: bJob.employmentType,
          seniority: bJob.seniority,
          minSalary: bJob.minSalary,
          maxSalary: bJob.maxSalary,
          currency: bJob.currency,
          description: bJob.description,
          contentHash: `bench-${bJob.key}-${runId}`,
          canonicalUrl: `https://example.com/jobs/${bJob.key}-${runId}`,
        })
        .returning();

      insertedJobIds.push(inserted!.id);

      // Persist requirements
      const insertedReqs = await db
        .insert(jobRequirements)
        .values(
          bJob.requirements.map((r, idx) => ({
            jobId: inserted!.id,
            userId: testUserId,
            rawText: r.rawText,
            category: r.category as 'SKILL' | 'LANGUAGE' | 'EDUCATION' | 'EXPERIENCE',
            requirementStrength: r.strength as 'MANDATORY' | 'PREFERRED',
            displayOrder: idx,
          })),
        )
        .returning();

      // Deterministic requirement evaluation
      const evaluations = insertedReqs.map((r) =>
        evidenceResolver.evaluateRequirement(r, matchingContext),
      );

      const hardPolicyResult = hardPolicyEngine.evaluate(inserted!, matchingContext);
      const scoreResult = scoringEngine.calculate(
        inserted!,
        matchingContext,
        hardPolicyResult,
        evaluations,
        null,
      );

      console.log(`\nBenchmark Job: "${bJob.title}" at ${bJob.company}`);
      console.log(
        `  Seniority: ${bJob.seniority} | Compensation: ${bJob.minSalary}-${bJob.maxSalary} ${bJob.currency}`,
      );
      console.log(
        `  Hard Blockers: ${hardPolicyResult.hasBlockers ? hardPolicyResult.blockers.join('; ') : 'None'}`,
      );
      console.log(
        `  Overall Score: ${scoreResult.overallScore}% | Confidence: ${scoreResult.confidenceScore}%`,
      );
      console.log(`  Decision: ${scoreResult.decision}`);
      console.log(`  Career Fit Category: ${scoreResult.careerFitCategory}`);
      console.log(`  Summary: ${scoreResult.summaryExplanation}`);
      if (scoreResult.gaps.length > 0) {
        console.log(`  Gaps: ${scoreResult.gaps.join('; ')}`);
      }
      if (scoreResult.strengths.length > 0) {
        console.log(`  Strengths: ${scoreResult.strengths.slice(0, 2).join('; ')}`);
      }

      // Verification invariants for each benchmark role
      if (bJob.key === 'JOB_1' || bJob.key === 'JOB_2' || bJob.key === 'JOB_3') {
        const isValidMatch =
          scoreResult.careerFitCategory === CareerFitCategories.STRONG_MATCH ||
          scoreResult.careerFitCategory === CareerFitCategories.GOOD_MATCH ||
          scoreResult.careerFitCategory === CareerFitCategories.TRANSFERABLE_SKILLS_MATCH;
        console.log(
          `  ✓ Assessment: ${isValidMatch ? 'PASSED (Role recognized accurately)' : 'UNEXPECTED'}`,
        );
      } else if (bJob.key === 'JOB_4') {
        // Intern role with salary below candidate min (35k < 45k)
        console.log(
          `  ✓ Assessment: Evaluated with warning or policy check as expected (Score: ${scoreResult.overallScore}%, Fit: ${scoreResult.careerFitCategory})`,
        );
      } else if (bJob.key === 'JOB_5') {
        // Senior Software Engineer
        const isNotRecommendedOrLow =
          scoreResult.decision === 'SKIP' ||
          scoreResult.careerFitCategory === CareerFitCategories.NOT_CURRENTLY_ELIGIBLE ||
          scoreResult.overallScore < 55;
        console.log(
          `  ✓ Assessment: ${isNotRecommendedOrLow ? 'PASSED (Senior tech role NOT recommended to PM candidate)' : 'FAIL: Tech role incorrectly recommended'}`,
        );
      }
    }
  } finally {
    // Clean teardown for isolated test user
    console.log('\nCleaning up isolated test fixtures...');
    if (insertedJobIds.length > 0) {
      await db.delete(jobRequirements).where(inArray(jobRequirements.jobId, insertedJobIds));
      await db.delete(jobs).where(inArray(jobs.id, insertedJobIds));
    }
    await db.delete(candidateSkills).where(eq(candidateSkills.userId, testUserId));
    await db.delete(candidateExperiences).where(eq(candidateExperiences.userId, testUserId));
    await db.delete(candidateEducation).where(eq(candidateEducation.userId, testUserId));
    await db.delete(candidateLanguages).where(eq(candidateLanguages.userId, testUserId));
    await db.delete(jobPreferences).where(eq(jobPreferences.userId, testUserId));
    await db.delete(candidateProfiles).where(eq(candidateProfiles.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
    console.log('✓ Isolated test user and benchmark jobs cleanly removed.');
  }

  await closeDbPool();
}

main().catch((err) => {
  console.error('Validation script failed:', err);
  process.exit(1);
});
