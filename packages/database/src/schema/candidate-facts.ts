import { pgTable, uuid, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const CandidateFactVerificationStatuses = {
  UNVERIFIED: 'UNVERIFIED',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;

export type CandidateFactVerificationStatus =
  (typeof CandidateFactVerificationStatuses)[keyof typeof CandidateFactVerificationStatuses];

export const CandidateFactSourceTypes = {
  MANUAL: 'MANUAL',
  PROFILE: 'PROFILE',
  EXPERIENCE: 'EXPERIENCE',
  EDUCATION: 'EDUCATION',
  PROJECT: 'PROJECT',
  DOCUMENT: 'DOCUMENT',
  SYSTEM: 'SYSTEM',
} as const;

export type CandidateFactSourceType =
  (typeof CandidateFactSourceTypes)[keyof typeof CandidateFactSourceTypes];

export const candidateFacts = pgTable('candidate_facts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  category: text('category').notNull(), // e.g. "WORK_AUTHORIZATION", "SALARY", "LOCATION", "EXPERIENCE", "SKILL"
  factKey: text('fact_key').notNull(),
  statement: text('statement').notNull(), // Human-readable explicit factual statement
  structuredValue: jsonb('structured_value'),
  sourceType: text('source_type').default('MANUAL').notNull(),
  sourceEntityId: text('source_entity_id'),
  verificationStatus: text('verification_status').default('UNVERIFIED').notNull(),
  allowAiUse: boolean('allow_ai_use').default(false).notNull(), // Must be explicitly allowed
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type CandidateFact = typeof candidateFacts.$inferSelect;
export type NewCandidateFact = typeof candidateFacts.$inferInsert;
