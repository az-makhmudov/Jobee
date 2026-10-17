import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { jobs } from './jobs.js';

export const jobMatchAnalyses = pgTable(
  'job_match_analyses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    overallScore: integer('overall_score').notNull(), // 0 - 100
    confidenceScore: integer('confidence_score').notNull(), // 0 - 100
    decision: text('decision').notNull(), // 'MATCH' | 'REVIEW' | 'SKIP'
    careerFitCategory: text('career_fit_category'), // 'STRONG_MATCH' | 'GOOD_MATCH' | 'TRANSFERABLE_SKILLS_MATCH' | 'GROWTH_OPPORTUNITY' | 'NOT_CURRENTLY_ELIGIBLE' | 'INSUFFICIENT_INFORMATION'
    autoApplyEligible: boolean('auto_apply_eligible').default(false).notNull(),
    analysisMode: text('analysis_mode').notNull(), // 'DETERMINISTIC_ONLY' | 'AI_ENRICHED'
    algorithmVersion: text('algorithm_version').notNull(), // e.g. '1.0.0'
    inputFingerprint: text('input_fingerprint').notNull(),
    isStale: boolean('is_stale').default(false).notNull(),
    aiProvider: text('ai_provider'),
    aiModel: text('ai_model'),
    strengths: jsonb('strengths').$type<string[]>().default([]).notNull(),
    gaps: jsonb('gaps').$type<string[]>().default([]).notNull(),
    unknowns: jsonb('unknowns').$type<string[]>().default([]).notNull(),
    warnings: jsonb('warnings').$type<string[]>().default([]).notNull(),
    hardBlockers: jsonb('hard_blockers').$type<string[]>().default([]).notNull(),
    transferableSkills: jsonb('transferable_skills').$type<string[]>().default([]).notNull(),
    learnedRankingAdjustment: integer('learned_ranking_adjustment').default(0).notNull(),
    learnedAdjustmentReason: text('learned_adjustment_reason'),
    reasonCodes: jsonb('reason_codes').$type<string[]>().default([]).notNull(),
    summaryExplanation: text('summary_explanation').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('job_match_analyses_job_id_idx').on(table.jobId),
    index('job_match_analyses_user_id_idx').on(table.userId),
    index('job_match_analyses_decision_idx').on(table.decision),
    index('job_match_analyses_career_fit_idx').on(table.careerFitCategory),
    index('job_match_analyses_score_idx').on(table.overallScore),
    index('job_match_analyses_is_stale_idx').on(table.isStale),
    index('job_match_analyses_job_created_idx').on(table.jobId, table.createdAt),
  ],
);

export type JobMatchAnalysis = typeof jobMatchAnalyses.$inferSelect;
export type NewJobMatchAnalysis = typeof jobMatchAnalyses.$inferInsert;
