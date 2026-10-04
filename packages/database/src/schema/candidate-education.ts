import { pgTable, uuid, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const candidateEducation = pgTable('candidate_education', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  institution: text('institution').notNull(),
  degree: text('degree'),
  fieldOfStudy: text('field_of_study'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  isCurrent: boolean('is_current').default(false).notNull(),
  location: text('location'),
  description: text('description'),
  activities: text('activities'),
  displayOrder: integer('display_order').default(0).notNull(),
  verificationStatus: text('verification_status').default('UNVERIFIED').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type CandidateEducation = typeof candidateEducation.$inferSelect;
export type NewCandidateEducation = typeof candidateEducation.$inferInsert;
