import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { applications } from './applications.js';

export const applicationAssessments = pgTable(
  'application_assessments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    assessmentType: text('assessment_type').notNull(),
    provider: text('provider'),
    status: text('status').default('RECEIVED').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' }),
    dueAt: timestamp('due_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    url: text('url'),
    score: text('score'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('app_assessments_application_id_idx').on(table.applicationId),
    index('app_assessments_status_idx').on(table.status),
  ],
);

export type ApplicationAssessment = typeof applicationAssessments.$inferSelect;
export type NewApplicationAssessment = typeof applicationAssessments.$inferInsert;
