import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { applicationPackages } from './application-packages.js';
import { candidateDocuments } from './candidate-documents.js';

export const applicationPackageVersions = pgTable(
  'application_package_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    packageId: uuid('package_id')
      .notNull()
      .references(() => applicationPackages.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    status: text('status').default('DRAFT').notNull(), // 'DRAFT' | 'NEEDS_REVIEW' | 'READY' | 'ARCHIVED'
    inputFingerprint: text('input_fingerprint').notNull(),
    baseDocumentId: uuid('base_document_id').references(() => candidateDocuments.id, {
      onDelete: 'set null',
    }),
    baseSelectionReason: text('base_selection_reason'),
    tailoredCvContent: jsonb('tailored_cv_content'), // Structured CV payload
    coverLetterContent: text('cover_letter_content'),
    coverLetterEnabled: boolean('cover_letter_enabled').default(true).notNull(),
    coverLetterApproved: boolean('cover_letter_approved').default(false).notNull(),
    changeSummary: jsonb('change_summary').$type<string[]>().default([]).notNull(),
    generationMode: text('generation_mode').default('DETERMINISTIC_ONLY').notNull(),
    aiModel: text('ai_model'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('app_pkg_versions_package_id_idx').on(table.packageId),
    uniqueIndex('app_pkg_versions_pkg_version_idx').on(table.packageId, table.versionNumber),
  ],
);

export type ApplicationPackageVersion = typeof applicationPackageVersions.$inferSelect;
export type NewApplicationPackageVersion = typeof applicationPackageVersions.$inferInsert;
