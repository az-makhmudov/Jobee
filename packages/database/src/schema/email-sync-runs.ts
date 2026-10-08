import { pgTable, uuid, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { emailAccounts } from './email-accounts.js';

export const emailSyncRuns = pgTable(
  'email_sync_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => emailAccounts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    trigger: text('trigger').default('MANUAL').notNull(),
    status: text('status').default('IN_PROGRESS').notNull(),
    messagesFound: integer('messages_found').default(0).notNull(),
    messagesIngested: integer('messages_ingested').default(0).notNull(),
    autoSyncedCount: integer('auto_synced_count').default(0).notNull(),
    reviewItemsCreated: integer('review_items_created').default(0).notNull(),
    jobsDiscoveredCount: integer('jobs_discovered_count').default(0).notNull(),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('email_sync_runs_account_id_idx').on(table.accountId),
    index('email_sync_runs_user_id_idx').on(table.userId),
    index('email_sync_runs_status_idx').on(table.status),
    index('email_sync_runs_started_at_idx').on(table.startedAt),
  ],
);
