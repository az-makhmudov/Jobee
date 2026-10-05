import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { jobs } from './jobs.js';

export const jobEvents = pgTable(
  'job_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(), // 'JOB_INGESTED' | 'JOB_NORMALIZED' | 'JOB_DUPLICATE_DETECTED' | 'JOB_UPDATED' | 'JOB_ARCHIVED' | 'INGESTION_FAILED'
    changedFields: jsonb('changed_fields').$type<string[]>().default([]).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('job_events_job_id_idx').on(table.jobId),
    index('job_events_event_type_idx').on(table.eventType),
  ],
);

export type JobEvent = typeof jobEvents.$inferSelect;
export type NewJobEvent = typeof jobEvents.$inferInsert;
