import { pgTable, uuid, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const candidateSkills = pgTable('candidate_skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category'),
  proficiency: text('proficiency'), // Explicitly supplied, never inferred
  yearsExperience: integer('years_experience'),
  isActive: boolean('is_active').default(true).notNull(),
  isTool: boolean('is_tool').default(false).notNull(),
  transferableCapabilities: jsonb('transferable_capabilities').$type<string[]>().default([]),
  verificationStatus: text('verification_status').default('UNVERIFIED').notNull(),
  sourceReference: text('source_reference'),
  sourceEntityId: text('source_entity_id'),
  allowAiUse: boolean('allow_ai_use').default(false).notNull(),
  confidence: integer('confidence'),
  lastConfirmedAt: timestamp('last_confirmed_at', { withTimezone: true, mode: 'date' }),
  hasContradiction: boolean('has_contradiction').default(false).notNull(),
  contradictionDetails: text('contradiction_details'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type CandidateSkill = typeof candidateSkills.$inferSelect;
export type NewCandidateSkill = typeof candidateSkills.$inferInsert;
