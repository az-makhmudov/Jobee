import { pgTable, uuid, text, timestamp, jsonb, real } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { profileImportSessions } from './profile-import-sessions.js';

export const ProfileImportSections = {
  PROFILE: 'PROFILE',
  EXPERIENCE: 'EXPERIENCE',
  EDUCATION: 'EDUCATION',
  SKILL: 'SKILL',
  CERTIFICATION: 'CERTIFICATION',
  LANGUAGE: 'LANGUAGE',
  PROJECT: 'PROJECT',
  LINK: 'LINK',
} as const;

export type ProfileImportSection =
  (typeof ProfileImportSections)[keyof typeof ProfileImportSections];

export const ProfileImportClassifications = {
  NEW: 'NEW',
  DUPLICATE: 'DUPLICATE',
  MATCHED: 'MATCHED',
  POTENTIAL_MATCH: 'POTENTIAL_MATCH',
  CONFLICT: 'CONFLICT',
  INCOMPLETE: 'INCOMPLETE',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
} as const;

export type ProfileImportClassification =
  (typeof ProfileImportClassifications)[keyof typeof ProfileImportClassifications];

export const ProfileImportReviewStatuses = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EDITED: 'EDITED',
} as const;

export type ProfileImportReviewStatus =
  (typeof ProfileImportReviewStatuses)[keyof typeof ProfileImportReviewStatuses];

export const profileImportItems = pgTable('profile_import_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => profileImportSessions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  section: text('section').notNull(),
  classification: text('classification').notNull(),
  confidenceScore: real('confidence_score').default(1.0).notNull(),
  sourceReference: text('source_reference').notNull(),
  extractedPayload: jsonb('extracted_payload').$type<Record<string, unknown>>().notNull(),
  existingEntityId: text('existing_entity_id'),
  existingPayload: jsonb('existing_payload').$type<Record<string, unknown> | null>(),
  conflictDetails: text('conflict_details'),
  reviewStatus: text('review_status').default('PENDING').notNull(),
  userEditedPayload: jsonb('user_edited_payload').$type<Record<string, unknown> | null>(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type ProfileImportItem = typeof profileImportItems.$inferSelect;
export type NewProfileImportItem = typeof profileImportItems.$inferInsert;
