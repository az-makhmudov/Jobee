import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { jobs } from './jobs.js';
import { jobMatchAnalyses } from './job-match-analyses.js';

export const applicationPackages = pgTable(
  'application_packages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    matchAnalysisId: uuid('match_analysis_id').references(() => jobMatchAnalyses.id, {
      onDelete: 'set null',
    }),
    status: text('status').default('DRAFT').notNull(), // 'DRAFT' | 'GENERATING' | 'NEEDS_REVIEW' | 'READY' | 'FAILED' | 'ARCHIVED'
    currentVersionNumber: integer('current_version_number').default(1).notNull(),
    hasPolicyBlocker: boolean('has_policy_blocker').default(false).notNull(),
    blockerOverridden: boolean('blocker_overridden').default(false).notNull(),
    blockerOverrideReason: text('blocker_override_reason'),
    blockerOverriddenAt: timestamp('blocker_overridden_at', { withTimezone: true, mode: 'date' }),
    isStale: boolean('is_stale').default(false).notNull(),
    readinessReason: text('readiness_reason'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('application_packages_job_id_idx').on(table.jobId),
    index('application_packages_user_id_idx').on(table.userId),
    index('application_packages_status_idx').on(table.status),
    index('application_packages_is_stale_idx').on(table.isStale),
    uniqueIndex('application_packages_user_job_unique_idx').on(table.userId, table.jobId),
  ],
);

export type ApplicationPackage = typeof applicationPackages.$inferSelect;
export type NewApplicationPackage = typeof applicationPackages.$inferInsert;
