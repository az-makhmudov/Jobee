import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const ProfileImportSourceTypes = {
  CV: 'CV',
  LINKEDIN_PDF: 'LINKEDIN_PDF',
  LINKEDIN_ARCHIVE: 'LINKEDIN_ARCHIVE',
} as const;

export type ProfileImportSourceType =
  (typeof ProfileImportSourceTypes)[keyof typeof ProfileImportSourceTypes];

export const ProfileImportSessionStatuses = {
  PENDING: 'PENDING',
  EXTRACTING: 'EXTRACTING',
  REVIEW_READY: 'REVIEW_READY',
  COMMITTED: 'COMMITTED',
  DISCARDED: 'DISCARDED',
  FAILED: 'FAILED',
} as const;

export type ProfileImportSessionStatus =
  (typeof ProfileImportSessionStatuses)[keyof typeof ProfileImportSessionStatuses];

export const profileImportSessions = pgTable('profile_import_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sourceType: text('source_type').default('CV').notNull(),
  status: text('status').default('PENDING').notNull(),
  originalFilename: text('original_filename').notNull(),
  mimeType: text('mime_type').notNull(),
  storageKey: text('storage_key').notNull(),
  documentId: uuid('document_id'),
  aiConsentGiven: boolean('ai_consent_given').default(false).notNull(),
  extractorUsed: text('extractor_used'), // 'GEMINI_AI' | 'HEURISTIC_PARSER'
  rawTextSnippet: text('raw_text_snippet'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type ProfileImportSession = typeof profileImportSessions.$inferSelect;
export type NewProfileImportSession = typeof profileImportSessions.$inferInsert;
