import { pgTable, uuid, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const candidateProjects = pgTable('candidate_projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  role: text('role'),
  description: text('description'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  projectUrl: text('project_url'),
  skills: jsonb('skills').$type<string[]>().default([]).notNull(),
  achievements: jsonb('achievements').$type<string[]>().default([]).notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
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

export type CandidateProject = typeof candidateProjects.$inferSelect;
export type NewCandidateProject = typeof candidateProjects.$inferInsert;
