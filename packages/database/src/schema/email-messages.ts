import {
  pgTable,
  uuid,
  text,
  timestamp,
  real,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { emailAccounts } from './email-accounts.js';
import { jobs } from './jobs.js';
import { applications } from './applications.js';
import { applicationContacts } from './application-contacts.js';

export const emailMessages = pgTable(
  'email_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => emailAccounts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerMessageId: text('provider_message_id').notNull(),
    providerThreadId: text('provider_thread_id'),
    senderEmail: text('sender_email').notNull(),
    senderName: text('sender_name'),
    recipientEmail: text('recipient_email'),
    subject: text('subject').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' }).notNull(),
    snippet: text('snippet'),
    bodyText: text('body_text').default('').notNull(),
    classification: text('classification').default('UNKNOWN').notNull(),
    confidence: real('confidence').default(0).notNull(),
    classificationReason: text('classification_reason'),
    processingStatus: text('processing_status').default('PENDING').notNull(),
    linkedJobId: uuid('linked_job_id').references(() => jobs.id, { onDelete: 'set null' }),
    linkedApplicationId: uuid('linked_application_id').references(() => applications.id, {
      onDelete: 'set null',
    }),
    linkedContactId: uuid('linked_contact_id').references(() => applicationContacts.id, {
      onDelete: 'set null',
    }),
    contentHash: text('content_hash').notNull(),
    rawMetadata: jsonb('raw_metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('email_messages_account_provider_msg_idx').on(
      table.accountId,
      table.providerMessageId,
    ),
    index('email_messages_account_id_idx').on(table.accountId),
    index('email_messages_user_id_idx').on(table.userId),
    index('email_messages_provider_thread_id_idx').on(table.providerThreadId),
    index('email_messages_received_at_idx').on(table.receivedAt),
    index('email_messages_classification_idx').on(table.classification),
    index('email_messages_processing_status_idx').on(table.processingStatus),
    index('email_messages_linked_app_idx').on(table.linkedApplicationId),
    index('email_messages_linked_job_idx').on(table.linkedJobId),
  ],
);
