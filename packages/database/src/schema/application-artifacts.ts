import { pgTable, uuid, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { applicationPackages } from './application-packages.js';
import { applicationPackageVersions } from './application-package-versions.js';

export const applicationArtifacts = pgTable(
  'application_artifacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    packageId: uuid('package_id')
      .notNull()
      .references(() => applicationPackages.id, { onDelete: 'cascade' }),
    versionId: uuid('version_id')
      .notNull()
      .references(() => applicationPackageVersions.id, { onDelete: 'cascade' }),
    artifactType: text('artifact_type').notNull(), // 'TAILORED_CV' | 'COVER_LETTER' | 'OTHER_SUPPORTING_DOCUMENT'
    storageKey: text('storage_key').notNull(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256Checksum: text('sha256_checksum').notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('app_artifacts_package_id_idx').on(table.packageId),
    index('app_artifacts_version_id_idx').on(table.versionId),
    index('app_artifacts_type_idx').on(table.artifactType),
  ],
);

export type ApplicationArtifact = typeof applicationArtifacts.$inferSelect;
export type NewApplicationArtifact = typeof applicationArtifacts.$inferInsert;
