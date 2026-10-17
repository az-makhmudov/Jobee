import { pgTable, uuid, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const candidateProfiles = pgTable('candidate_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  preferredName: text('preferred_name'),
  fullName: text('full_name'),
  headline: text('headline'),
  email: text('email'),
  phone: text('phone'),
  city: text('city'),
  region: text('region'),
  country: text('country'),
  summary: text('summary'),
  availability: text('availability'),
  careerStage: text('career_stage'), // 'STUDENT' | 'ENTRY' | 'MID' | 'SENIOR' | 'LEAD' | 'TRANSITIONING'
  targetSalary: integer('target_salary'),
  targetSalaryCurrency: text('target_salary_currency').default('USD'),
  transferableCapabilities: jsonb('transferable_capabilities').$type<string[]>().default([]),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type CandidateProfile = typeof candidateProfiles.$inferSelect;
export type NewCandidateProfile = typeof candidateProfiles.$inferInsert;
