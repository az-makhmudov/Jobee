import { pgTable, uuid, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const applicationPolicy = pgTable('application_policy', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  autoApplyEnabled: boolean('auto_apply_enabled').default(false).notNull(), // ALWAYS disabled by default
  minScoreForReview: integer('min_score_for_review').default(70).notNull(),
  autoApplyMinScore: integer('auto_apply_min_score').default(90).notNull(),
  maxApplicationsPerDay: integer('max_applications_per_day').default(5).notNull(),
  blockOnUnresolvedReview: boolean('block_on_unresolved_review').default(true).notNull(),
  blockOnManual: boolean('block_on_manual').default(true).notNull(),
  blockOnUnknownSensitive: boolean('block_on_unknown_sensitive').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type ApplicationPolicy = typeof applicationPolicy.$inferSelect;
export type NewApplicationPolicy = typeof applicationPolicy.$inferInsert;
