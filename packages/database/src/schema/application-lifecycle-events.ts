import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { applications } from './applications.js';

export const applicationLifecycleEvents = pgTable(
  'application_lifecycle_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    previousStatus: text('previous_status'),
    newStatus: text('new_status'),
    actor: text('actor').default('USER').notNull(),
    note: text('note'),
    safeMetadata: jsonb('safe_metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('app_events_application_id_idx').on(table.applicationId),
    index('app_events_user_id_idx').on(table.userId),
    index('app_events_event_type_idx').on(table.eventType),
    index('app_events_created_at_idx').on(table.createdAt),
  ],
);

export type ApplicationLifecycleEvent = typeof applicationLifecycleEvents.$inferSelect;
export type NewApplicationLifecycleEvent = typeof applicationLifecycleEvents.$inferInsert;
