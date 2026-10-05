import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { jobs } from './jobs.js';

export const jobSources = pgTable(
  'job_sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'GREENHOUSE' | 'LEVER' | 'ASHBY' | 'LINKEDIN' | 'GENERIC' | 'MANUAL'
    ingestionMethod: text('ingestion_method').notNull(), // 'PASTE_TEXT' | 'URL_IMPORT' | 'API'
    sourceUrl: text('source_url'),
    canonicalUrl: text('canonical_url'),
    externalJobId: text('external_job_id'),
    rawTitle: text('raw_title'),
    rawCompany: text('raw_company'),
    rawLocation: text('raw_location'),
    rawDescription: text('raw_description').notNull(),
    rawMetadata: jsonb('raw_metadata').$type<Record<string, unknown> | null>(),
    rawPayload: text('raw_payload'), // bounded snippet / page HTML up to 50KB
    contentHash: text('content_hash').notNull(),
    ingestionStatus: text('ingestion_status').default('COMPLETED').notNull(),
    parserVersion: text('parser_version').default('1.0.0').notNull(),
    errorMessage: text('error_message'),
    retrievedAt: timestamp('retrieved_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('job_sources_job_id_idx').on(table.jobId),
    index('job_sources_user_id_idx').on(table.userId),
    index('job_sources_provider_external_idx').on(table.provider, table.externalJobId),
  ],
);

export type JobSource = typeof jobSources.$inferSelect;
export type NewJobSource = typeof jobSources.$inferInsert;
