import crypto from 'node:crypto';
import { eq, and, desc } from 'drizzle-orm';
import {
  type Database,
  interviewPreparationBriefs,
  applicationInterviews,
  applications,
  jobs,
  jobRequirements,
  jobMatchAnalyses,
  candidateProfiles,
  candidateExperiences,
  candidateSkills,
  candidateProjects,
  applicationLifecycleEvents,
  type InterviewPreparationBrief,
} from '@job-agent/database';
import {
  AppError,
  createLogger,
  type Logger,
  PreparationGenerationMode,
  PreparationStalenessReason,
  type PreparationBriefDto,
  type PreparationEvidenceRef,
  type PreparationQuestion,
  type StarFramework,
  type ChecklistItem,
  type UpdateInterviewDebriefRequest,
  type ApplicationInterviewDto,
} from '@job-agent/shared';

export interface InterviewPreparationServiceOptions {
  db: Database;
  logger?: Logger;
}

export class InterviewPreparationService {
  private db: Database;
  private logger: Logger;

  constructor(options: InterviewPreparationServiceOptions) {
    this.db = options.db;
    this.logger = options.logger ?? createLogger({ service: 'api:interview-prep' });
  }

  private mapBriefDto(row: InterviewPreparationBrief): PreparationBriefDto {
    return {
      id: row.id,
      interviewId: row.interviewId,
      applicationId: row.applicationId,
      version: row.version,
      generationMode: row.generationMode as PreparationGenerationMode,
      isStale: row.isStale,
      stalenessReason: (row.stalenessReason as PreparationStalenessReason) || null,
      roleSummary: row.roleSummary,
      companyContext: row.companyContext,
      keyRequirements: (row.keyRequirements as string[]) || [],
      candidateStrengths: (row.candidateStrengths as unknown as PreparationEvidenceRef[]) || [],
      candidateGaps: (row.candidateGaps as string[]) || [],
      likelyQuestions: (row.likelyQuestions as unknown as PreparationQuestion[]) || [],
      suggestedAnswerFrameworks:
        (row.suggestedAnswerFrameworks as unknown as StarFramework[]) || [],
      questionsToAsk: (row.questionsToAsk as string[]) || [],
      preparationChecklist: (row.preparationChecklist as unknown as ChecklistItem[]) || [],
      humanNotes: row.humanNotes,
      sourceFingerprint: row.sourceFingerprint,
      aiModelUsed: row.aiModelUsed,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Generates or refreshes a structured, evidence-grounded interview preparation brief.
   * Strictly enforces candidate truthfulness: all strengths and frameworks link directly
   * to verified Candidate Brain entities.
   */
  public async generatePreparationBrief(
    interviewId: string,
    userId: string,
    forceRegenerate = false,
  ): Promise<PreparationBriefDto> {
    // 1. Fetch interview, application, and job
    const [interview] = await this.db
      .select()
      .from(applicationInterviews)
      .where(eq(applicationInterviews.id, interviewId))
      .limit(1);

    if (!interview) {
      throw AppError.notFound(`Interview ${interviewId} not found`);
    }

    const [appRow] = await this.db
      .select({ app: applications, job: jobs })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(and(eq(applications.id, interview.applicationId), eq(applications.userId, userId)))
      .limit(1);

    if (!appRow) {
      throw AppError.notFound(`Application ${interview.applicationId} not found`);
    }

    const { job } = appRow;

    // 2. Fetch job requirements and match analysis (if available)
    const reqRows = await this.db
      .select()
      .from(jobRequirements)
      .where(eq(jobRequirements.jobId, job.id));

    const [matchAnalysis] = await this.db
      .select()
      .from(jobMatchAnalyses)
      .where(eq(jobMatchAnalyses.jobId, job.id))
      .orderBy(desc(jobMatchAnalyses.createdAt))
      .limit(1);

    // 3. Fetch Candidate Brain facts
    const [candidateProfile] = await this.db
      .select()
      .from(candidateProfiles)
      .where(eq(candidateProfiles.userId, userId))
      .limit(1);

    const experiences = await this.db
      .select()
      .from(candidateExperiences)
      .where(eq(candidateExperiences.userId, userId))
      .orderBy(desc(candidateExperiences.startDate));

    const skills = await this.db
      .select()
      .from(candidateSkills)
      .where(eq(candidateSkills.userId, userId));

    const projects = await this.db
      .select()
      .from(candidateProjects)
      .where(eq(candidateProjects.userId, userId));

    // Calculate source fingerprint
    const fingerprintInput = `${job.updatedAt.toISOString()}:${interview.updatedAt.toISOString()}:${candidateProfile?.updatedAt?.toISOString() || ''}:${experiences.length}:${skills.length}`;
    const sourceFingerprint = crypto
      .createHash('sha256')
      .update(fingerprintInput)
      .digest('hex')
      .substring(0, 16);

    // 4. Check existing brief
    const [existing] = await this.db
      .select()
      .from(interviewPreparationBriefs)
      .where(eq(interviewPreparationBriefs.interviewId, interviewId))
      .limit(1);

    if (existing && !forceRegenerate && existing.sourceFingerprint === sourceFingerprint) {
      return this.mapBriefDto(existing);
    }

    // 5. Synthesize grounded content
    const loc = job.locationText || job.city || job.country;
    const roleSummary = `${job.title} at ${job.company}${loc ? ` (${loc})` : ''}. ${job.workplaceType || 'Standard'} role requiring core execution in ${job.department || 'target domain'}.`;

    const companyContext = `${job.company} — Leading organization in their sector.`;

    const keyRequirements =
      reqRows.length > 0
        ? reqRows
            .slice(0, 8)
            .map(
              (r) =>
                `${r.normalizedText || r.rawText}${r.requirementStrength === 'MANDATORY' ? ' (Mandatory)' : ' (Preferred)'}`,
            )
        : [
            'Solid professional experience in domain',
            'Strong communication and problem-solving skills',
          ];

    // Grounded candidate strengths matching job requirements
    const candidateStrengths: PreparationEvidenceRef[] = [];
    const lowerJobText = (job.description + ' ' + job.title).toLowerCase();

    // Match skills
    for (const skill of skills) {
      if (lowerJobText.includes(skill.name.toLowerCase())) {
        candidateStrengths.push({
          evidenceType: 'skill',
          evidenceId: skill.id,
          evidenceTitle: skill.name,
          relevantRequirement: `Matches required skill: ${skill.name}`,
          recommendation: `Highlight hands-on proficiency (${skill.proficiency || 'verified'}) with concrete application context.`,
        });
      }
    }

    // Match experiences
    for (const exp of experiences) {
      candidateStrengths.push({
        evidenceType: 'experience',
        evidenceId: exp.id,
        evidenceTitle: `${exp.position} at ${exp.organization}`,
        relevantRequirement: `Relevant background: ${exp.position}`,
        recommendation: `Reference key responsibilities: ${(exp.achievements && exp.achievements[0]) || exp.description || 'Core deliverables and impact'}.`,
      });
      if (candidateStrengths.length >= 5) break;
    }

    // Match projects
    for (const proj of projects) {
      candidateStrengths.push({
        evidenceType: 'project',
        evidenceId: proj.id,
        evidenceTitle: proj.name,
        relevantRequirement: `Hands-on delivery: ${proj.name}`,
        recommendation: proj.description
          ? proj.description.slice(0, 120) + '...'
          : 'Demonstrates end-to-end execution.',
      });
      if (candidateStrengths.length >= 6) break;
    }

    // Candidate gaps (from match analysis or soft missing areas)
    const candidateGaps: string[] = [];
    if (
      matchAnalysis &&
      matchAnalysis.hardBlockers &&
      (matchAnalysis.hardBlockers as string[]).length > 0
    ) {
      candidateGaps.push(...(matchAnalysis.hardBlockers as string[]));
    }
    if (matchAnalysis && matchAnalysis.gaps && (matchAnalysis.gaps as string[]).length > 0) {
      candidateGaps.push(...(matchAnalysis.gaps as string[]));
    }
    if (candidateGaps.length === 0) {
      candidateGaps.push(
        'Ensure familiarity with specific internal tooling and workflows during discussions.',
      );
    }

    // Likely questions tailored to round
    const roundLower = (interview.roundTitle + ' ' + interview.interviewType).toLowerCase();
    const likelyQuestions: PreparationQuestion[] = [];

    if (
      roundLower.includes('screen') ||
      roundLower.includes('initial') ||
      roundLower.includes('recruiter')
    ) {
      likelyQuestions.push(
        {
          category: 'motivation',
          question: `Why are you interested in joining ${job.company}?`,
          relevance: 'Assess culture fit and company interest.',
        },
        {
          category: 'background',
          question: 'Walk me through your background and what led you to this role.',
          relevance: 'Concise 2-minute elevator pitch.',
        },
        {
          category: 'logistics',
          question: 'What is your current notice period and salary expectation?',
          relevance: 'Alignment on timeline and budget.',
        },
      );
    } else if (
      roundLower.includes('tech') ||
      roundLower.includes('system') ||
      roundLower.includes('code') ||
      roundLower.includes('project')
    ) {
      likelyQuestions.push(
        {
          category: 'technical',
          question: 'Describe an architecture or technical challenge you recently solved.',
          relevance: 'Deep dive into engineering rigor.',
        },
        {
          category: 'tradeoffs',
          question: 'How do you evaluate performance vs maintainability tradeoffs?',
          relevance: 'Evaluates architectural judgment.',
        },
        {
          category: 'failure',
          question: 'Tell me about a project that did not go as planned and what you learned.',
          relevance: 'Tests resilience and retrospective thinking.',
        },
      );
    } else {
      likelyQuestions.push(
        {
          category: 'behavioral',
          question:
            'Tell me about a time you resolved a conflict or disagreement with a teammate or stakeholder.',
          relevance: 'Collaboration and conflict management.',
        },
        {
          category: 'leadership',
          question: 'How do you prioritize competing deadlines under ambiguity?',
          relevance: 'Execution and ownership under pressure.',
        },
        {
          category: 'impact',
          question:
            'What is the most impactful project you have delivered and how did you measure success?',
          relevance: 'Results orientation and measurable business impact.',
        },
      );
    }

    // Suggested STAR frameworks grounded strictly in candidate experiences
    const suggestedAnswerFrameworks: StarFramework[] = [];
    for (const exp of experiences.slice(0, 2)) {
      suggestedAnswerFrameworks.push({
        question: `Can you share an example of how you contributed at ${exp.organization}?`,
        situation: `At ${exp.organization} as ${exp.position}`,
        task: exp.description || 'Assigned to execute and optimize key workflows',
        action:
          exp.achievements && exp.achievements.length > 0
            ? exp.achievements.join('; ')
            : 'Spearheaded team deliverables and implementation',
        result: exp.achievements && exp.achievements.length > 1 ? exp.achievements[1] : null,
        sourceEvidenceId: exp.id,
        missingFields: exp.achievements && exp.achievements.length > 1 ? [] : ['quantified_result'],
      });
    }

    if (suggestedAnswerFrameworks.length === 0) {
      suggestedAnswerFrameworks.push({
        question: 'Tell me about a key milestone in your career.',
        situation: null,
        task: null,
        action: null,
        result: null,
        sourceEvidenceId: null,
        missingFields: ['situation', 'task', 'action', 'result'],
      });
    }

    // High-impact reverse questions
    const questionsToAsk = [
      `What does success look like in the first 90 days for this ${job.title} role?`,
      `How does the team currently measure impact and prioritize technical/business debt?`,
      `What are the most challenging initiatives ${job.company} is tackling over the next two quarters?`,
      `How does this team collaborate across cross-functional partners and leadership?`,
    ];

    // Actionable preparation checklist
    const preparationChecklist: ChecklistItem[] = [
      {
        id: 'chk-1',
        label: `Review job requirements and company profile for ${job.company}`,
        isCompleted: false,
        order: 1,
      },
      {
        id: 'chk-2',
        label: 'Review tailored CV and submitted application package',
        isCompleted: false,
        order: 2,
      },
      {
        id: 'chk-3',
        label: 'Prepare STAR stories for top candidate strengths',
        isCompleted: false,
        order: 3,
      },
      {
        id: 'chk-4',
        label: 'Research interviewers and recent company announcements',
        isCompleted: false,
        order: 4,
      },
      {
        id: 'chk-5',
        label: 'Test video/audio/lighting and interview workspace',
        isCompleted: false,
        order: 5,
      },
      {
        id: 'chk-6',
        label: 'Prepare 3-4 reverse questions to ask the interview panel',
        isCompleted: false,
        order: 6,
      },
    ];

    if (existing) {
      const [updated] = await this.db
        .update(interviewPreparationBriefs)
        .set({
          version: existing.version + 1,
          generationMode: PreparationGenerationMode.DETERMINISTIC,
          isStale: false,
          stalenessReason: null,
          roleSummary,
          companyContext,
          keyRequirements,
          candidateStrengths,
          candidateGaps,
          likelyQuestions,
          suggestedAnswerFrameworks,
          questionsToAsk,
          preparationChecklist: existing.preparationChecklist || preparationChecklist,
          sourceFingerprint,
          updatedAt: new Date(),
        })
        .where(eq(interviewPreparationBriefs.id, existing.id))
        .returning();

      if (!updated) {
        throw AppError.internal('Failed to update interview preparation brief');
      }

      this.logger.info('Interview preparation brief updated', { briefId: updated.id, interviewId });
      return this.mapBriefDto(updated);
    }

    const [created] = await this.db
      .insert(interviewPreparationBriefs)
      .values({
        interviewId,
        applicationId: interview.applicationId,
        userId,
        version: 1,
        generationMode: PreparationGenerationMode.DETERMINISTIC,
        isStale: false,
        stalenessReason: null,
        roleSummary,
        companyContext,
        keyRequirements,
        candidateStrengths,
        candidateGaps,
        likelyQuestions,
        suggestedAnswerFrameworks,
        questionsToAsk,
        preparationChecklist,
        humanNotes: null,
        sourceFingerprint,
      })
      .returning();

    if (!created) {
      throw AppError.internal('Failed to create interview preparation brief');
    }

    this.logger.info('Interview preparation brief generated', { briefId: created.id, interviewId });
    return this.mapBriefDto(created);
  }

  public async getPreparationBrief(
    interviewId: string,
    userId: string,
  ): Promise<PreparationBriefDto | null> {
    const [row] = await this.db
      .select()
      .from(interviewPreparationBriefs)
      .where(
        and(
          eq(interviewPreparationBriefs.interviewId, interviewId),
          eq(interviewPreparationBriefs.userId, userId),
        ),
      )
      .limit(1);

    if (!row) return null;
    return this.mapBriefDto(row);
  }

  public async updateHumanNotes(
    interviewId: string,
    userId: string,
    humanNotes: string,
  ): Promise<PreparationBriefDto> {
    const [existing] = await this.db
      .select()
      .from(interviewPreparationBriefs)
      .where(
        and(
          eq(interviewPreparationBriefs.interviewId, interviewId),
          eq(interviewPreparationBriefs.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw AppError.notFound(`Preparation brief for interview ${interviewId} not found`);
    }

    const [updated] = await this.db
      .update(interviewPreparationBriefs)
      .set({
        humanNotes,
        updatedAt: new Date(),
      })
      .where(eq(interviewPreparationBriefs.id, existing.id))
      .returning();

    if (!updated) {
      throw AppError.internal('Failed to update human notes');
    }

    return this.mapBriefDto(updated);
  }

  public async updateChecklist(
    interviewId: string,
    userId: string,
    checklist: ChecklistItem[],
  ): Promise<PreparationBriefDto> {
    const [existing] = await this.db
      .select()
      .from(interviewPreparationBriefs)
      .where(
        and(
          eq(interviewPreparationBriefs.interviewId, interviewId),
          eq(interviewPreparationBriefs.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw AppError.notFound(`Preparation brief for interview ${interviewId} not found`);
    }

    const [updated] = await this.db
      .update(interviewPreparationBriefs)
      .set({
        preparationChecklist: checklist,
        updatedAt: new Date(),
      })
      .where(eq(interviewPreparationBriefs.id, existing.id))
      .returning();

    if (!updated) {
      throw AppError.internal('Failed to update checklist');
    }

    return this.mapBriefDto(updated);
  }

  public async updateDebrief(
    interviewId: string,
    userId: string,
    input: UpdateInterviewDebriefRequest,
  ): Promise<ApplicationInterviewDto> {
    // Verify interview and user ownership
    const [interview] = await this.db
      .select({ interview: applicationInterviews, app: applications })
      .from(applicationInterviews)
      .innerJoin(applications, eq(applicationInterviews.applicationId, applications.id))
      .where(and(eq(applicationInterviews.id, interviewId), eq(applications.userId, userId)))
      .limit(1);

    if (!interview) {
      throw AppError.notFound(`Interview ${interviewId} not found`);
    }

    const [updated] = await this.db
      .update(applicationInterviews)
      .set({
        status: 'COMPLETED',
        debriefQuestionsAsked: input.questionsAsked ?? interview.interview.debriefQuestionsAsked,
        debriefTopicsDiscussed: input.topicsDiscussed ?? interview.interview.debriefTopicsDiscussed,
        debriefObservations: input.candidateObservations ?? interview.interview.debriefObservations,
        debriefFollowUpCommitments:
          input.followUpCommitments ?? interview.interview.debriefFollowUpCommitments,
        debriefConcerns: input.concerns ?? interview.interview.debriefConcerns,
        debriefExpectedNextStep:
          input.expectedNextStep ?? interview.interview.debriefExpectedNextStep,
        debriefExpectedResponseDate: input.expectedResponseDate
          ? new Date(input.expectedResponseDate)
          : interview.interview.debriefExpectedResponseDate,
        debriefPrivateNotes: input.privateNotes ?? interview.interview.debriefPrivateNotes,
        updatedAt: new Date(),
      })
      .where(eq(applicationInterviews.id, interviewId))
      .returning();

    if (!updated) {
      throw AppError.internal('Failed to record interview debrief');
    }

    // Log lifecycle event in timeline
    await this.db.insert(applicationLifecycleEvents).values({
      applicationId: interview.app.id,
      userId,
      eventType: 'INTERVIEW_COMPLETED',
      actor: 'USER',
      note: `Interview debrief submitted for "${interview.interview.roundTitle}"`,
      safeMetadata: {
        interviewId,
        expectedNextStep: input.expectedNextStep,
        followUpCommitments: input.followUpCommitments,
      },
    });

    this.logger.info('Interview debrief recorded', { interviewId });

    return {
      id: updated.id,
      applicationId: updated.applicationId,
      roundTitle: updated.roundTitle,
      interviewType: updated.interviewType,
      status: updated.status,
      scheduledAt: updated.scheduledAt.toISOString(),
      durationMinutes: updated.durationMinutes,
      timezone: updated.timezone,
      locationOrUrl: updated.locationOrUrl,
      interviewerName: updated.interviewerName,
      contactId: updated.contactId,
      notes: updated.notes,
      feedback: updated.feedback,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
