import { pgTable, uuid, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const DocumentTypes = {
  MASTER_CV: 'MASTER_CV',
  ROLE_CV: 'ROLE_CV',
  COVER_LETTER_TEMPLATE: 'COVER_LETTER_TEMPLATE',
  CERTIFICATE: 'CERTIFICATE',
  PORTFOLIO: 'PORTFOLIO',
  OTHER: 'OTHER',
} as const;

export type DocumentType = (typeof DocumentTypes)[keyof typeof DocumentTypes];

export const candidateDocuments = pgTable('candidate_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  documentType: text('document_type').notNull(),
  displayName: text('display_name').notNull(),
  originalFilename: text('original_filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  storageKey: text('storage_key').notNull(),
  sha256Checksum: text('sha256_checksum'),
  roleFocus: text('role_focus'), // e.g. "Project Management", "Operations", etc.
  version: text('version').default('1.0').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isMaster: boolean('is_master').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type CandidateDocument = typeof candidateDocuments.$inferSelect;
export type NewCandidateDocument = typeof candidateDocuments.$inferInsert;
