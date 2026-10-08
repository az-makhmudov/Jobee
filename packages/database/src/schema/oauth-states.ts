import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const oauthStates = pgTable(
  'oauth_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stateHash: text('state_hash').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('oauth_states_hash_idx').on(table.stateHash),
    index('oauth_states_user_id_idx').on(table.userId),
    index('oauth_states_expires_at_idx').on(table.expiresAt),
  ],
);

export type OAuthState = typeof oauthStates.$inferSelect;
export type NewOAuthState = typeof oauthStates.$inferInsert;
