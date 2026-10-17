import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { jobs } from './jobs.js';

export const CandidateJobFeedbackTypes = {
  INTERESTED: 'INTERESTED',
  NOT_INTERESTED: 'NOT_INTERESTED',
  IRRELEVANT: 'IRRELEVANT',
  ALREADY_APPLIED: 'ALREADY_APPLIED',
  TOO_SENIOR: 'TOO_SENIOR',
  WRONG_LOCATION: 'WRONG_LOCATION',
  WRONG_INDUSTRY: 'WRONG_INDUSTRY',
} as const;

export type CandidateJobFeedbackType =
  (typeof CandidateJobFeedbackTypes)[keyof typeof CandidateJobFeedbackTypes];

export const candidateJobFeedback = pgTable(
  'candidate_job_feedback',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    feedbackType: text('feedback_type').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('candidate_job_feedback_user_idx').on(table.userId),
    index('candidate_job_feedback_job_idx').on(table.jobId),
    index('candidate_job_feedback_user_job_idx').on(table.userId, table.jobId),
  ],
);

export type CandidateJobFeedback = typeof candidateJobFeedback.$inferSelect;
export type NewCandidateJobFeedback = typeof candidateJobFeedback.$inferInsert;
