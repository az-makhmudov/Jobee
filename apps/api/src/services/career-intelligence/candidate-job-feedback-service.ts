import { eq, and, desc } from 'drizzle-orm';
import type { Database } from '@job-agent/database';
import {
  candidateJobFeedback,
  jobPreferences,
  jobs,
  candidateAuditEvents,
  CandidateJobFeedback,
} from '@job-agent/database';
import {
  CandidateJobFeedbackDto,
  CandidateJobFeedbackType,
  LearnedPreferencesDto,
} from '@job-agent/shared';

export class CandidateJobFeedbackService {
  constructor(private readonly db: Database) {}

  async recordFeedback(
    userId: string,
    jobId: string,
    feedbackType: CandidateJobFeedbackType,
    notes?: string | null,
  ): Promise<CandidateJobFeedbackDto> {
    // 1. Fetch job to extract company, location, and requirements/categories
    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, jobId));
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // 2. Fetch current job preferences
    const [prefs] = await this.db
      .select()
      .from(jobPreferences)
      .where(eq(jobPreferences.userId, userId));

    const defaultLearned: LearnedPreferencesDto = {
      downvotedIndustries: [],
      downvotedLocations: [],
      downvotedCompanies: [],
      tooSeniorCount: 0,
      tooJuniorCount: 0,
      feedbackCounts: {},
    };

    const learned: LearnedPreferencesDto =
      (prefs?.learnedPreferences as LearnedPreferencesDto) || defaultLearned;

    // 3. Update feedback counters
    const currentCounts = { ...(learned.feedbackCounts || {}) };
    currentCounts[feedbackType] = (currentCounts[feedbackType] || 0) + 1;
    learned.feedbackCounts = currentCounts;

    // 4. Update inferred preference weights based on feedback type
    if (feedbackType === 'WRONG_INDUSTRY') {
      const industry = job.department || job.title;
      if (industry && !learned.downvotedIndustries.includes(industry)) {
        learned.downvotedIndustries.push(industry);
      }
    } else if (feedbackType === 'WRONG_LOCATION') {
      const loc = job.city || job.country || job.locationText;
      if (loc && !learned.downvotedLocations.includes(loc)) {
        learned.downvotedLocations.push(loc);
      }
    } else if (feedbackType === 'NOT_INTERESTED' || feedbackType === 'IRRELEVANT') {
      if (job.company && !learned.downvotedCompanies.includes(job.company)) {
        learned.downvotedCompanies.push(job.company);
      }
    } else if (feedbackType === 'TOO_SENIOR') {
      learned.tooSeniorCount = (learned.tooSeniorCount || 0) + 1;
    }

    learned.lastUpdated = new Date().toISOString();

    // 5. Transactionally save feedback and update learnedPreferences
    let savedFeedback: CandidateJobFeedback;

    await this.db.transaction(async (tx) => {
      // Check if feedback already exists for this job by this user
      const [existing] = await tx
        .select()
        .from(candidateJobFeedback)
        .where(
          and(
            eq(candidateJobFeedback.userId, userId),
            eq(candidateJobFeedback.jobId, jobId),
          ),
        );

      if (existing) {
        const [updated] = await tx
          .update(candidateJobFeedback)
          .set({
            feedbackType,
            notes: notes !== undefined ? notes : existing.notes,
            updatedAt: new Date(),
          })
          .where(eq(candidateJobFeedback.id, existing.id))
          .returning();
        savedFeedback = updated!;
      } else {
        const [inserted] = await tx
          .insert(candidateJobFeedback)
          .values({
            userId,
            jobId,
            feedbackType,
            notes: notes || null,
          })
          .returning();
        savedFeedback = inserted!;
      }

      // Update learnedPreferences on jobPreferences
      if (prefs) {
        await tx
          .update(jobPreferences)
          .set({
            learnedPreferences: learned,
            updatedAt: new Date(),
          })
          .where(eq(jobPreferences.id, prefs.id));
      }

      // Record audit event
      await tx.insert(candidateAuditEvents).values({
        userId,
        entityType: 'JOB_FEEDBACK',
        entityId: savedFeedback.id,
        action: 'JOB_FEEDBACK_RECORDED',
        actor: 'USER',
        changedFields: ['feedbackType', 'learnedPreferences'],
        metadata: {
          jobId,
          feedbackType,
          company: job.company,
          title: job.title,
        },
      });
    });

    return this.mapToDto(savedFeedback!);
  }

  async getFeedbackForJob(
    userId: string,
    jobId: string,
  ): Promise<CandidateJobFeedbackDto | null> {
    const [row] = await this.db
      .select()
      .from(candidateJobFeedback)
      .where(
        and(
          eq(candidateJobFeedback.userId, userId),
          eq(candidateJobFeedback.jobId, jobId),
        ),
      );

    return row ? this.mapToDto(row) : null;
  }

  async listUserFeedback(
    userId: string,
    limit: number = 50,
  ): Promise<CandidateJobFeedbackDto[]> {
    const rows = await this.db
      .select()
      .from(candidateJobFeedback)
      .where(eq(candidateJobFeedback.userId, userId))
      .orderBy(desc(candidateJobFeedback.createdAt))
      .limit(limit);

    return rows.map((r) => this.mapToDto(r));
  }

  async getLearnedPreferences(userId: string): Promise<LearnedPreferencesDto> {
    const [prefs] = await this.db
      .select()
      .from(jobPreferences)
      .where(eq(jobPreferences.userId, userId));

    const defaultLearned: LearnedPreferencesDto = {
      downvotedIndustries: [],
      downvotedLocations: [],
      downvotedCompanies: [],
      tooSeniorCount: 0,
      tooJuniorCount: 0,
      feedbackCounts: {},
      lastUpdated: prefs?.updatedAt?.toISOString(),
    };

    return (prefs?.learnedPreferences as LearnedPreferencesDto) || defaultLearned;
  }

  async updateLearnedPreferences(
    userId: string,
    updates: Partial<LearnedPreferencesDto>,
  ): Promise<LearnedPreferencesDto> {
    const current = await this.getLearnedPreferences(userId);
    const updated: LearnedPreferencesDto = {
      ...current,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };

    const [prefs] = await this.db
      .select()
      .from(jobPreferences)
      .where(eq(jobPreferences.userId, userId));

    if (prefs) {
      await this.db
        .update(jobPreferences)
        .set({
          learnedPreferences: updated,
          updatedAt: new Date(),
        })
        .where(eq(jobPreferences.id, prefs.id));
    }

    await this.db.insert(candidateAuditEvents).values({
      userId,
      entityType: 'LEARNED_PREFERENCES',
      entityId: userId,
      action: 'LEARNED_PREFERENCES_UPDATED',
      actor: 'USER',
      changedFields: Object.keys(updates),
      metadata: { previous: current, updated },
    });

    return updated;
  }

  async resetLearnedPreferences(userId: string): Promise<LearnedPreferencesDto> {
    const reset: LearnedPreferencesDto = {
      downvotedIndustries: [],
      downvotedLocations: [],
      downvotedCompanies: [],
      tooSeniorCount: 0,
      tooJuniorCount: 0,
      feedbackCounts: {},
      lastUpdated: new Date().toISOString(),
    };

    const [prefs] = await this.db
      .select()
      .from(jobPreferences)
      .where(eq(jobPreferences.userId, userId));

    if (prefs) {
      await this.db
        .update(jobPreferences)
        .set({
          learnedPreferences: reset,
          updatedAt: new Date(),
        })
        .where(eq(jobPreferences.id, prefs.id));
    }

    await this.db.insert(candidateAuditEvents).values({
      userId,
      entityType: 'LEARNED_PREFERENCES',
      entityId: userId,
      action: 'LEARNED_PREFERENCES_RESET',
      actor: 'USER',
      changedFields: ['learnedPreferences'],
      metadata: { reset: true },
    });

    return reset;
  }

  private mapToDto(row: CandidateJobFeedback): CandidateJobFeedbackDto {
    return {
      id: row.id,
      userId: row.userId,
      jobId: row.jobId,
      feedbackType: row.feedbackType as CandidateJobFeedbackType,
      notes: row.notes || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
