import { pgTable, uuid, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { applications } from './applications.js';

export const applicationContacts = pgTable(
  'application_contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    title: text('title'),
    company: text('company'),
    linkedinUrl: text('linkedin_url'),
    isPrimary: boolean('is_primary').default(false).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('app_contacts_application_id_idx').on(table.applicationId),
    index('app_contacts_user_id_idx').on(table.userId),
  ],
);

export type ApplicationContact = typeof applicationContacts.$inferSelect;
export type NewApplicationContact = typeof applicationContacts.$inferInsert;
