import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { applications } from './applications.js';
import { jobs } from './jobs.js';
import { candidateDocuments } from './candidate-documents.js';
import { preparationBatches } from './job-search.js';
import { browserApplicationRuns } from './browser-application-runs.js';
import type { ApplicationIntentDto, AutopilotGrant } from '@job-agent/shared';
export type ApplicationIntentEvent = ApplicationIntentDto['events'][number] & {
  answerSources?: Record<string, string>;
  autopilotGrant?: AutopilotGrant;
};

// Permission exists before a package/version does; queues and materials remain authoritative.
export const applicationIntents = pgTable(
  'application_intents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    selectedCvId: uuid('selected_cv_id').references(() => candidateDocuments.id, {
      onDelete: 'set null',
    }),
    batchId: uuid('batch_id').references(() => preparationBatches.id, { onDelete: 'set null' }),
    runId: uuid('run_id').references(() => browserApplicationRuns.id, { onDelete: 'restrict' }),
    autopilotGrant: jsonb('autopilot_grant').$type<AutopilotGrant>(),
    termsVersion: text('terms_version').notNull(),
    targetUrl: text('target_url').notNull(),
    inputFingerprint: text('input_fingerprint').notNull(),
    manifestChecksum: text('manifest_checksum'),
    status: text('status').default('AUTHORIZED').notNull(),
    message: text('message').default('Preparing your application in the background.').notNull(),
    events: jsonb('events').$type<ApplicationIntentEvent[]>().default([]).notNull(),
    authorizedAt: timestamp('authorized_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    dispatchStartedAt: timestamp('dispatch_started_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('application_intents_user_job_idx').on(t.userId, t.jobId),
    index('application_intents_queue_idx').on(t.status, t.createdAt),
  ],
);
