import { pgTable, uuid, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const candidateExperiences = pgTable('candidate_experiences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  organization: text('organization').notNull(),
  position: text('position').notNull(),
  location: text('location'),
  employmentType: text('employment_type'),
  startDate: text('start_date').notNull(), // Supports incomplete dates e.g. "2023-09"
  endDate: text('end_date'),
  isCurrent: boolean('is_current').default(false).notNull(),
  description: text('description'),
  achievements: jsonb('achievements').$type<string[]>().default([]).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  verificationStatus: text('verification_status').default('UNVERIFIED').notNull(), // 'UNVERIFIED' | 'VERIFIED' | 'REJECTED'
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type CandidateExperience = typeof candidateExperiences.$inferSelect;
export type NewCandidateExperience = typeof candidateExperiences.$inferInsert;
