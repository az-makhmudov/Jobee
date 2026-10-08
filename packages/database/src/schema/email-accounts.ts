import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const emailAccounts = pgTable(
  'email_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').default('GMAIL').notNull(),
    emailAddress: text('email_address').notNull(),
    encryptedTokens: text('encrypted_tokens').notNull(),
    grantedScopes: jsonb('granted_scopes').$type<string[]>().default([]).notNull(),
    status: text('status').default('CONNECTED').notNull(),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true, mode: 'date' }),
    syncCursor: text('sync_cursor'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true, mode: 'date' }),
    errorMessage: text('error_message'),
    isSyncing: boolean('is_syncing').default(false).notNull(),
    syncLockedAt: timestamp('sync_locked_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('email_accounts_user_email_unique_idx').on(table.userId, table.emailAddress),
    index('email_accounts_user_id_idx').on(table.userId),
    index('email_accounts_provider_idx').on(table.provider),
    index('email_accounts_status_idx').on(table.status),
  ],
);
