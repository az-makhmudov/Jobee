import { pgTable, uuid, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { jobs } from './jobs.js';
import { jobMatchAnalyses } from './job-match-analyses.js';

export const jobMatchDimensions = pgTable(
  'job_match_dimensions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => jobMatchAnalyses.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    dimension: text('dimension').notNull(), // 'ROLE_FIT' | 'SKILLS_FIT' | 'EXPERIENCE_FIT' | 'EDUCATION_FIT' | 'LOCATION_FIT' | 'LANGUAGE_FIT' | 'COMPENSATION_FIT' | 'WORK_AUTHORIZATION_FIT'
    score: integer('score'), // null when status === 'UNKNOWN' or 'NOT_APPLICABLE'
    weight: integer('weight').notNull(), // dimension weight percentage
    status: text('status').notNull(), // 'SCORED' | 'UNKNOWN' | 'NOT_APPLICABLE'
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('job_match_dim_analysis_id_idx').on(table.analysisId),
    index('job_match_dim_job_id_idx').on(table.jobId),
  ],
);

export type JobMatchDimension = typeof jobMatchDimensions.$inferSelect;
export type NewJobMatchDimension = typeof jobMatchDimensions.$inferInsert;
