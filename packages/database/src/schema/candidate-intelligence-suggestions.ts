import { pgTable, uuid, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const CandidateIntelligenceSuggestionTypes = {
  TRANSFERABLE_SKILL: 'TRANSFERABLE_SKILL',
  CAREER_PATH: 'CAREER_PATH',
  MISSING_DETAIL: 'MISSING_DETAIL',
  ACHIEVEMENT: 'ACHIEVEMENT',
  INCONSISTENCY: 'INCONSISTENCY',
  PREFERENCE_UPDATE: 'PREFERENCE_UPDATE',
} as const;

export type CandidateIntelligenceSuggestionType =
  (typeof CandidateIntelligenceSuggestionTypes)[keyof typeof CandidateIntelligenceSuggestionTypes];

export const CandidateIntelligenceSuggestionStatuses = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DISMISSED: 'DISMISSED',
} as const;

export type CandidateIntelligenceSuggestionStatus =
  (typeof CandidateIntelligenceSuggestionStatuses)[keyof typeof CandidateIntelligenceSuggestionStatuses];

export const candidateIntelligenceSuggestions = pgTable(
  'candidate_intelligence_suggestions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    suggestionType: text('suggestion_type').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    payload: jsonb('payload').notNull(),
    evidence: text('evidence'),
    sourceDocumentId: text('source_document_id'),
    confidence: integer('confidence'), // 0 - 100
    status: text('status').default('PENDING').notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('candidate_intelligence_suggestions_user_idx').on(table.userId),
    index('candidate_intelligence_suggestions_status_idx').on(table.status),
    index('candidate_intelligence_suggestions_user_status_idx').on(table.userId, table.status),
  ],
);

export type CandidateIntelligenceSuggestion = typeof candidateIntelligenceSuggestions.$inferSelect;
export type NewCandidateIntelligenceSuggestion =
  typeof candidateIntelligenceSuggestions.$inferInsert;
