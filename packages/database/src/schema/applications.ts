import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { jobs } from './jobs.js';
import { applicationPackages } from './application-packages.js';
import { applicationPackageVersions } from './application-package-versions.js';
import { applicationArtifacts } from './application-artifacts.js';

export const applications = pgTable(
  'applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    currentPackageId: uuid('current_package_id').references(() => applicationPackages.id, {
      onDelete: 'set null',
    }),
    submittedPackageVersionId: uuid('submitted_package_version_id').references(
      () => applicationPackageVersions.id,
      { onDelete: 'set null' },
    ),
    submittedCvArtifactId: uuid('submitted_cv_artifact_id').references(
      () => applicationArtifacts.id,
      { onDelete: 'set null' },
    ),
    submittedCoverLetterArtifactId: uuid('submitted_cover_letter_artifact_id').references(
      () => applicationArtifacts.id,
      { onDelete: 'set null' },
    ),
    status: text('status').default('READY_TO_APPLY').notNull(),
    source: text('source').default('DIRECT').notNull(),
    applicationUrl: text('application_url'),
    submissionMethod: text('submission_method'),
    externalReferenceId: text('external_reference_id'),
    appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'date' }),
    lastStatusChangeAt: timestamp('last_status_change_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' }),
    terminalReason: text('terminal_reason'),
    terminalStage: text('terminal_stage'),
    nextAction: text('next_action'),
    nextActionType: text('next_action_type'),
    followUpAt: timestamp('follow_up_at', { withTimezone: true, mode: 'date' }),
    notes: text('notes'),
    isArchived: boolean('is_archived').default(false).notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('applications_user_job_unique_idx').on(table.userId, table.jobId),
    index('applications_user_id_idx').on(table.userId),
    index('applications_job_id_idx').on(table.jobId),
    index('applications_status_idx').on(table.status),
    index('applications_follow_up_at_idx').on(table.followUpAt),
    index('applications_applied_at_idx').on(table.appliedAt),
    index('applications_is_archived_idx').on(table.isArchived),
    index('applications_archived_at_idx').on(table.archivedAt),
  ],
);

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
