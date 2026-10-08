import { pgTable, uuid, text, timestamp, real, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { emailMessages } from './email-messages.js';
import { applications } from './applications.js';
import { jobs } from './jobs.js';

export const emailReviewItems = pgTable(
  'email_review_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id')
      .notNull()
      .references(() => emailMessages.id, { onDelete: 'cascade' }),
    classification: text('classification').notNull(),
    confidence: real('confidence').notNull(),
    proposedAction: text('proposed_action').notNull(),
    proposedTargetStatus: text('proposed_target_status'),
    proposedApplicationId: uuid('proposed_application_id').references(() => applications.id, {
      onDelete: 'set null',
    }),
    proposedJobId: uuid('proposed_job_id').references(() => jobs.id, {
      onDelete: 'set null',
    }),
    explanation: text('explanation').notNull(),
    extractedDetails: jsonb('extracted_details')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    riskLevel: text('risk_level').default('LOW').notNull(),
    status: text('status').default('PENDING').notNull(),
    resolutionNote: text('resolution_note'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('email_review_items_user_id_idx').on(table.userId),
    index('email_review_items_message_id_idx').on(table.messageId),
    index('email_review_items_status_idx').on(table.status),
    index('email_review_items_risk_level_idx').on(table.riskLevel),
    index('email_review_items_proposed_app_idx').on(table.proposedApplicationId),
  ],
);
