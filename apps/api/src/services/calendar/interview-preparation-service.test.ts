import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getConfig } from '@job-agent/config';
import {
  getDb,
  users,
  closeDbPool,
  jobs,
  jobRequirements,
  applications,
  applicationInterviews,
  candidateProfiles,
  candidateExperiences,
  candidateSkills,
  interviewPreparationBriefs,
  type Database,
} from '@job-agent/database';
import { InterviewPreparationService } from './interview-preparation-service.js';

describe('InterviewPreparationService Unit & Integration Tests (JOB-P4-T02)', () => {
  const config = getConfig();
  let db: Database;
  let userId: string;
  let prepService: InterviewPreparationService;

  let testJobId: string;
  let testAppId: string;
  let testInterviewId: string;
  let testExpId: string;
  let testSkillId: string;

  beforeAll(async () => {
    db = getDb(config.DATABASE_URL);
    const [testUser] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: `disposable_prep_tester_${Date.now()}@example.com`,
        name: 'Disposable Prep Tester',
        emailVerified: true,
        role: 'user',
      })
      .returning();
    userId = testUser!.id;

    prepService = new InterviewPreparationService({ db });

    // Ensure Candidate Profile exists for disposable user
    await db.insert(candidateProfiles).values({
      userId,
      fullName: 'Bek Test Candidate',
      headline: 'Lead Systems & Operations Engineer',
    });

    // Create Verified Candidate Skill
    const [skill] = await db
      .insert(candidateSkills)
      .values({
        userId,
        name: 'TypeScriptArchitecture',
        proficiency: 'EXPERT',
        verificationStatus: 'VERIFIED',
        allowAiUse: true,
      })
      .returning();
    testSkillId = skill!.id;

    // Create Unverified Candidate Skill to test truthfulness boundary
    await db.insert(candidateSkills).values({
      userId,
      name: 'DockerSwarmCluster',
      proficiency: 'INTERMEDIATE',
      verificationStatus: 'UNVERIFIED',
      allowAiUse: false,
    });

    // Create Verified Candidate Experience
    const [exp] = await db
      .insert(candidateExperiences)
      .values({
        userId,
        organization: 'Acme Technologies',
        position: 'Senior Software Engineer',
        startDate: '2023-01',
        description: 'Led core backend distributed systems and TypeScript APIs',
        verificationStatus: 'VERIFIED',
        allowAiUse: true,
        achievements: [
          'Architected high-throughput message processing pipeline',
          'Reduced latency by 45% across platform microservices',
        ],
      })
      .returning();
    testExpId = exp!.id;

    // Create Job mentioning both verified and unverified skills
    const [job] = await db
      .insert(jobs)
      .values({
        userId,
        title: 'Senior TypeScriptArchitecture Platform Engineer',
        company: 'CloudCorp Global',
        description:
          'We are seeking a Senior TypeScriptArchitecture Platform Engineer proficient in TypeScriptArchitecture, DockerSwarmCluster, distributed architectures, and API services.',
        locationText: 'Remote',
        contentHash: 'hash-test-job-prep-123',
      })
      .returning();
    testJobId = job!.id;

    // Add Job Requirements
    await db.insert(jobRequirements).values([
      {
        jobId: testJobId,
        userId,
        rawText: 'Strong experience with TypeScriptArchitecture and modern Node.js',
        normalizedText: 'TypeScriptArchitecture experience',
        requirementStrength: 'MANDATORY',
      },
      {
        jobId: testJobId,
        userId,
        rawText: 'Experience in distributed systems and API design',
        normalizedText: 'Distributed systems',
        requirementStrength: 'PREFERRED',
      },
    ]);

    // Create Application
    const [app] = await db
      .insert(applications)
      .values({
        userId,
        jobId: testJobId,
        status: 'INTERVIEW',
        source: 'MANUAL',
      })
      .returning();
    testAppId = app!.id;

    // Create Interview Record
    const [interview] = await db
      .insert(applicationInterviews)
      .values({
        applicationId: testAppId,
        userId,
        roundTitle: 'Technical Deep Dive',
        interviewType: 'TECHNICAL',
        scheduledAt: new Date('2026-10-15T14:00:00.000Z'),
        durationMinutes: 60,
        interviewerName: 'Sarah Jenkins (VP Eng)',
        notes: 'Focus on distributed systems and TypeScript architecture',
      })
      .returning();
    testInterviewId = interview!.id;
  });

  afterAll(async () => {
    // Clean up created entities
    if (testInterviewId) {
      await db
        .delete(interviewPreparationBriefs)
        .where(eq(interviewPreparationBriefs.interviewId, testInterviewId));
      await db.delete(applicationInterviews).where(eq(applicationInterviews.id, testInterviewId));
    }
    if (testAppId) {
      await db.delete(applications).where(eq(applications.id, testAppId));
    }
    if (testJobId) {
      await db.delete(jobRequirements).where(eq(jobRequirements.jobId, testJobId));
      await db.delete(jobs).where(eq(jobs.id, testJobId));
    }
    if (testExpId) {
      await db.delete(candidateExperiences).where(eq(candidateExperiences.id, testExpId));
    }
    if (userId) {
      await db.delete(candidateSkills).where(eq(candidateSkills.userId, userId));
      await db.delete(candidateProfiles).where(eq(candidateProfiles.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
    }

    await closeDbPool();
  });

  it('1. generates a structured, evidence-grounded interview preparation brief', async () => {
    const brief = await prepService.generatePreparationBrief(testInterviewId, userId);

    expect(brief).toBeDefined();
    expect(brief.interviewId).toBe(testInterviewId);
    expect(brief.applicationId).toBe(testAppId);
    expect(brief.version).toBe(1);
    expect(brief.roleSummary).toContain('CloudCorp Global');
    expect(brief.companyContext).toContain('CloudCorp Global');
    expect(brief.keyRequirements.length).toBeGreaterThan(0);

    // Verify candidate strengths are strictly grounded in candidate verified facts
    expect(brief.candidateStrengths.length).toBeGreaterThan(0);
    const tsStrength = brief.candidateStrengths.find(
      (s) => s.evidenceTitle === 'TypeScriptArchitecture',
    );
    expect(tsStrength).toBeDefined();
    expect(tsStrength?.evidenceType).toBe('skill');
    expect(tsStrength?.evidenceId).toBe(testSkillId);

    // Verify unverified skill is strictly NOT present in candidateStrengths
    const unverifiedStrength = brief.candidateStrengths.find(
      (s) => s.evidenceTitle === 'DockerSwarmCluster',
    );
    expect(unverifiedStrength).toBeUndefined();

    // Verify unverified skill IS surfaced in candidateGaps for candidate awareness
    const gapEntry = brief.candidateGaps.find((g) => g.includes('DockerSwarmCluster'));
    expect(gapEntry).toBeDefined();
    expect(gapEntry).toContain('Unverified skill requires confirmation before citing');

    const expStrength = brief.candidateStrengths.find(
      (s) => s.evidenceType === 'experience' && s.evidenceId === testExpId,
    );
    expect(expStrength).toBeDefined();
    expect(expStrength?.evidenceTitle).toContain('Acme Technologies');

    // Verify STAR frameworks
    expect(brief.suggestedAnswerFrameworks.length).toBeGreaterThan(0);
    const starFramework = brief.suggestedAnswerFrameworks.find((f) =>
      f.situation?.includes('Acme Technologies'),
    );
    expect(starFramework).toBeDefined();

    // Verify checklist
    expect(brief.preparationChecklist.length).toBe(6);
  });

  it('2. retrieves existing brief and returns identical version idempotently', async () => {
    const fetched = await prepService.getPreparationBrief(testInterviewId, userId);
    expect(fetched).toBeDefined();
    expect(fetched?.version).toBe(1);
    expect(fetched?.interviewId).toBe(testInterviewId);
  });

  it('3. updates human candidate notes on the brief', async () => {
    const updated = await prepService.updateHumanNotes(
      testInterviewId,
      userId,
      'Remember to highlight our latency optimization project and distributed event queues.',
    );

    expect(updated.humanNotes).toBe(
      'Remember to highlight our latency optimization project and distributed event queues.',
    );
  });

  it('4. updates preparation checklist item states', async () => {
    const brief = await prepService.getPreparationBrief(testInterviewId, userId);
    expect(brief).toBeDefined();

    const checklist = [...brief!.preparationChecklist];
    checklist[0]!.isCompleted = true;

    const updated = await prepService.updateChecklist(testInterviewId, userId, checklist);
    expect(updated.preparationChecklist[0]?.isCompleted).toBe(true);
  });

  it('5. records post-interview debrief and marks interview COMPLETED', async () => {
    const debrief = await prepService.updateDebrief(testInterviewId, userId, {
      questionsAsked: 'Design a distributed rate limiter and event bus in TypeScript',
      topicsDiscussed: 'Concurrency controls, Postgres connection pooling, STAR projects',
      candidateObservations: 'Panel was very engaged and technical; great questions',
      followUpCommitments: 'Send link to GitHub open-source project by Thursday',
      concerns: 'None, strong alignment with team stack',
      expectedNextStep: 'Offer or final executive chat',
      expectedResponseDate: '2026-10-18T17:00:00.000Z',
      privateNotes: 'Interview felt very positive; Sarah seemed impressed with latency numbers',
    });

    expect(debrief).toBeDefined();
    expect(debrief.status).toBe('COMPLETED');
  });

  it('6. dynamically flags brief as stale when interview is updated and when candidate facts change', async () => {
    // 1. Debrief in previous test updated the interview record, so brief is now flagged INTERVIEW_UPDATED
    const interviewStale = await prepService.getPreparationBrief(testInterviewId, userId);
    expect(interviewStale).toBeDefined();
    expect(interviewStale?.isStale).toBe(true);
    expect(interviewStale?.stalenessReason).toBe('INTERVIEW_UPDATED');

    // 2. Refresh the brief after interview update
    const freshBrief = await prepService.generatePreparationBrief(testInterviewId, userId);
    expect(freshBrief.isStale).toBe(false);
    expect(freshBrief.version).toBe(2);

    // 3. Candidate adds a new verified skill
    await db.insert(candidateSkills).values({
      userId,
      name: 'KubernetesHelm',
      proficiency: 'ADVANCED',
      verificationStatus: 'VERIFIED',
      allowAiUse: true,
    });

    // 4. Next retrieval detects candidate data change and flags CANDIDATE_UPDATED
    const candidateStale = await prepService.getPreparationBrief(testInterviewId, userId);
    expect(candidateStale).toBeDefined();
    expect(candidateStale?.isStale).toBe(true);
    expect(candidateStale?.stalenessReason).toBe('CANDIDATE_UPDATED');
  });

  it('7. regenerates stale brief when requested, bumping version and clearing staleness', async () => {
    const refreshed = await prepService.generatePreparationBrief(testInterviewId, userId);
    expect(refreshed).toBeDefined();
    expect(refreshed.isStale).toBe(false);
    expect(refreshed.stalenessReason).toBeNull();
    expect(refreshed.version).toBe(3);
  });
});
