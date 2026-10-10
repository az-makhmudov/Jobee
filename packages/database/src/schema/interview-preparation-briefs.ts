import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { applicationInterviews } from './application-interviews.js';
import { applications } from './applications.js';
import { users } from './users.js';

export const interviewPreparationBriefs = pgTable(
  'interview_preparation_briefs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    interviewId: uuid('interview_id')
      .notNull()
      .references(() => applicationInterviews.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    version: integer('version').default(1).notNull(),
    generationMode: text('generation_mode').default('DETERMINISTIC').notNull(),
    isStale: boolean('is_stale').default(false).notNull(),
    stalenessReason: text('staleness_reason'),

    // Structured preparation content
    roleSummary: text('role_summary').default('').notNull(),
    companyContext: text('company_context').default('').notNull(),
    keyRequirements: jsonb('key_requirements').$type<string[]>().default([]).notNull(),
    candidateStrengths: jsonb('candidate_strengths').$type<unknown[]>().default([]).notNull(),
    candidateGaps: jsonb('candidate_gaps').$type<string[]>().default([]).notNull(),
    likelyQuestions: jsonb('likely_questions').$type<unknown[]>().default([]).notNull(),
    suggestedAnswerFrameworks: jsonb('suggested_answer_frameworks')
      .$type<unknown[]>()
      .default([])
      .notNull(),
    questionsToAsk: jsonb('questions_to_ask').$type<string[]>().default([]).notNull(),
    preparationChecklist: jsonb('preparation_checklist').$type<unknown[]>().default([]).notNull(),

    humanNotes: text('human_notes'),
    sourceFingerprint: text('source_fingerprint').default('').notNull(),
    aiModelUsed: text('ai_model_used'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('preparation_briefs_interview_idx').on(table.interviewId),
    index('preparation_briefs_application_idx').on(table.applicationId),
    index('preparation_briefs_user_idx').on(table.userId),
    index('preparation_briefs_stale_idx').on(table.isStale),
  ],
);

export type InterviewPreparationBrief = typeof interviewPreparationBriefs.$inferSelect;
export type NewInterviewPreparationBrief = typeof interviewPreparationBriefs.$inferInsert;
