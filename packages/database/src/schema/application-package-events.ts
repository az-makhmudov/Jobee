import { pgTable, uuid, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { applicationPackages } from './application-packages.js';

export const applicationPackageEvents = pgTable(
  'application_package_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    packageId: uuid('package_id')
      .notNull()
      .references(() => applicationPackages.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number'),
    eventType: text('event_type').notNull(),
    details: jsonb('details').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('app_pkg_events_package_id_idx').on(table.packageId),
    index('app_pkg_events_event_type_idx').on(table.eventType),
    index('app_pkg_events_created_idx').on(table.createdAt),
  ],
);

export type ApplicationPackageEvent = typeof applicationPackageEvents.$inferSelect;
export type NewApplicationPackageEvent = typeof applicationPackageEvents.$inferInsert;
