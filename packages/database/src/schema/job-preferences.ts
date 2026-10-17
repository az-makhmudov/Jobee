import { pgTable, uuid, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const jobPreferences = pgTable('job_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  targetTitles: jsonb('target_titles').$type<string[]>().default([]).notNull(),
  targetCategories: jsonb('target_categories').$type<string[]>().default([]).notNull(),
  adjacentRoles: jsonb('adjacent_roles').$type<string[]>().default([]).notNull(),
  preferredIndustries: jsonb('preferred_industries').$type<string[]>().default([]).notNull(),
  careerTransitions: jsonb('career_transitions').$type<string[]>().default([]).notNull(),
  longTermGoals: text('long_term_goals'),
  developmentPriorities: jsonb('development_priorities').$type<string[]>().default([]).notNull(),
  preferredLocations: jsonb('preferred_locations').$type<string[]>().default([]).notNull(),
  workModes: jsonb('work_modes').$type<string[]>().default([]).notNull(), // 'remote', 'hybrid', 'onsite'
  employmentTypes: jsonb('employment_types').$type<string[]>().default([]).notNull(), // 'full-time', 'part-time', 'contract', 'internship'
  seniorityLevels: jsonb('seniority_levels').$type<string[]>().default([]).notNull(), // 'intern', 'entry', 'mid', 'senior', 'lead'
  minSalary: integer('min_salary'), // null = not configured
  maxSalary: integer('max_salary'),
  currency: text('currency').default('USD').notNull(),
  preferredLanguages: jsonb('preferred_languages').$type<string[]>().default([]).notNull(),
  excludedCompanies: jsonb('excluded_companies').$type<string[]>().default([]).notNull(),
  excludedKeywords: jsonb('excluded_keywords').$type<string[]>().default([]).notNull(),
  acceptUnpaid: boolean('accept_unpaid').default(false).notNull(),
  willingToRelocate: boolean('willing_to_relocate'), // null = not configured
  needsSponsorship: boolean('needs_sponsorship'), // null = not configured
  workAuthorizationCountries: jsonb('work_authorization_countries')
    .$type<string[]>()
    .default([])
    .notNull(),
  internshipEligible: boolean('internship_eligible'),
  availability: text('availability'),
  customPreferences: jsonb('custom_preferences'),
  learnedPreferences: jsonb('learned_preferences'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type JobPreferences = typeof jobPreferences.$inferSelect;
export type NewJobPreferences = typeof jobPreferences.$inferInsert;
