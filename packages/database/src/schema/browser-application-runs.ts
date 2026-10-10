import { pgTable, uuid, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { applications } from './applications.js';
import { applicationPackageVersions } from './application-package-versions.js';

export const browserApplicationRuns = pgTable(
  'browser_application_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    packageVersionId: uuid('package_version_id').references(() => applicationPackageVersions.id, {
      onDelete: 'set null',
    }),
    atsProvider: text('ats_provider').default('UNKNOWN').notNull(), // 'GREENHOUSE' | 'LEVER' | 'ASHBY' | 'OTHER' | 'UNKNOWN'
    targetUrl: text('target_url').notNull(),
    mode: text('mode').default('DRY_RUN').notNull(), // 'DRY_RUN' | 'PREFILL_ONLY' | 'SUBMIT'
    status: text('status').default('PENDING').notNull(), // 'PENDING' | 'RUNNING' | 'SUCCESS' | 'STOPPED_CAPTCHA' | 'STOPPED_MANUAL_REVIEW' | 'VALIDATION_FAILED' | 'FAILED'
    fieldsDetectedCount: integer('fields_detected_count').default(0).notNull(),
    fieldsFilledCount: integer('fields_filled_count').default(0).notNull(),
    unmatchedRequiredFields: jsonb('unmatched_required_fields')
      .$type<unknown[]>()
      .default([])
      .notNull(),
    stepLogs: jsonb('step_logs').$type<unknown[]>().default([]).notNull(),
    screenshotPaths: jsonb('screenshot_paths').$type<string[]>().default([]).notNull(),
    confirmationReference: text('confirmation_reference'),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('browser_runs_application_id_idx').on(table.applicationId),
    index('browser_runs_user_id_idx').on(table.userId),
    index('browser_runs_status_idx').on(table.status),
    index('browser_runs_created_at_idx').on(table.createdAt),
  ],
);

export type BrowserApplicationRun = typeof browserApplicationRuns.$inferSelect;
export type NewBrowserApplicationRun = typeof browserApplicationRuns.$inferInsert;
