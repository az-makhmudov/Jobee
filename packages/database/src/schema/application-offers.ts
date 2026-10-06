import { pgTable, uuid, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { applications } from './applications.js';

export const applicationOffers = pgTable(
  'application_offers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    baseSalary: integer('base_salary'),
    totalComp: integer('total_comp'),
    currency: text('currency').default('USD').notNull(),
    employmentType: text('employment_type'),
    proposedStartDate: text('proposed_start_date'),
    deadlineAt: timestamp('deadline_at', { withTimezone: true, mode: 'date' }),
    status: text('status').default('PENDING').notNull(), // 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'NEGOTIATING' | 'RESCINDED'
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('app_offers_application_id_idx').on(table.applicationId),
    index('app_offers_status_idx').on(table.status),
  ],
);

export type ApplicationOffer = typeof applicationOffers.$inferSelect;
export type NewApplicationOffer = typeof applicationOffers.$inferInsert;
