import { pgTable, uuid, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const candidateLanguages = pgTable('candidate_languages', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  language: text('language').notNull(),
  proficiency: text('proficiency'), // Optional, explicitly supplied, never inferred
  cefrLevel: text('cefr_level'), // Optional CEFR e.g. B2, C1, C2
  notes: text('notes'),
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

export type CandidateLanguage = typeof candidateLanguages.$inferSelect;
export type NewCandidateLanguage = typeof candidateLanguages.$inferInsert;
