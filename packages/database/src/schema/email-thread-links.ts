import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { emailAccounts } from './email-accounts.js';
import { applications } from './applications.js';
import { jobs } from './jobs.js';

export const emailThreadLinks = pgTable(
  'email_thread_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => emailAccounts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerThreadId: text('provider_thread_id').notNull(),
    applicationId: uuid('application_id').references(() => applications.id, {
      onDelete: 'set null',
    }),
    jobId: uuid('job_id').references(() => jobs.id, {
      onDelete: 'set null',
    }),
    company: text('company'),
    confirmedBy: text('confirmed_by').default('AUTO').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('email_thread_links_account_thread_idx').on(
      table.accountId,
      table.providerThreadId,
    ),
    index('email_thread_links_user_id_idx').on(table.userId),
    index('email_thread_links_application_id_idx').on(table.applicationId),
    index('email_thread_links_job_id_idx').on(table.jobId),
  ],
);
