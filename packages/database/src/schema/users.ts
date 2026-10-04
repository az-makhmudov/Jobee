import { pgTable, uuid, timestamp, text } from 'drizzle-orm/pg-core';

/**
 * Users entity.
 * Single-user personal AI job search architecture is user-owned.
 * The systemKey column provides deterministic resolution of the primary local user
 * without requiring authentication or storing personal PII.
 */
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  systemKey: text('system_key').unique(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
