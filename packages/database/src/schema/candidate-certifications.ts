import { pgTable, uuid, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const candidateCertifications = pgTable('candidate_certifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  issuingOrganization: text('issuing_organization').notNull(),
  issueDate: text('issue_date'),
  expirationDate: text('expiration_date'),
  credentialId: text('credential_id'),
  credentialUrl: text('credential_url'),
  verificationStatus: text('verification_status').default('UNVERIFIED').notNull(),
  sourceReference: text('source_reference'),
  sourceEntityId: text('source_entity_id'),
  allowAiUse: boolean('allow_ai_use').default(false).notNull(),
  confidence: integer('confidence'),
  lastConfirmedAt: timestamp('last_confirmed_at', { withTimezone: true, mode: 'date' }),
  hasContradiction: boolean('has_contradiction').default(false).notNull(),
  contradictionDetails: text('contradiction_details'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type CandidateCertification = typeof candidateCertifications.$inferSelect;
export type NewCandidateCertification = typeof candidateCertifications.$inferInsert;
