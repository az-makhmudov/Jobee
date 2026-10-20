import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { jobs } from './jobs.js';
import { applicationPackages } from './application-packages.js';
import { candidateDocuments } from './candidate-documents.js';
import type { JobSearchSettings } from '@job-agent/shared';
export const jobSearchSettings = pgTable('job_search_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  settings: jsonb('settings').$type<JobSearchSettings>().notNull(),
  cursors: jsonb('cursors').$type<Record<string, number>>().default({}).notNull(),
  discoveryLeaseAt: timestamp('discovery_lease_at', { withTimezone: true, mode: 'date' }),
  dailyLeaseAt: timestamp('daily_lease_at', { withTimezone: true, mode: 'date' }),
  lastDailyAt: timestamp('last_daily_at', { withTimezone: true, mode: 'date' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});
export const preparationBatches = pgTable('preparation_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
});
export const preparationItems = pgTable(
  'preparation_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => preparationBatches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    status: text('status').default('QUEUED').notNull(),
    packageId: uuid('package_id').references(() => applicationPackages.id, {
      onDelete: 'set null',
    }),
    inputFingerprint: text('input_fingerprint').notNull(),
    error: text('error'),
    attempts: integer('attempts').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'date' }),
    selectedCvId: uuid('selected_cv_id').references(() => candidateDocuments.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    uniqueIndex('preparation_active_job_idx')
      .on(t.userId, t.jobId)
      .where(sql`${t.status} IN ('QUEUED','PREPARING')`),
    index('preparation_queue_idx').on(t.status, t.createdAt),
    index('preparation_user_batch_idx').on(t.userId, t.batchId),
  ],
);
