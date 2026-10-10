import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const calendarAccounts = pgTable(
  'calendar_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').default('GOOGLE').notNull(),
    emailAddress: text('email_address').notNull(),
    encryptedTokens: text('encrypted_tokens').notNull(),
    grantedScopes: jsonb('granted_scopes').$type<string[]>().default([]).notNull(),
    scopeLevel: text('scope_level').default('NONE').notNull(),
    status: text('status').default('CONNECTED').notNull(),
    selectedCalendarIds: jsonb('selected_calendar_ids').$type<string[]>().default([]).notNull(),
    defaultCalendarId: text('default_calendar_id'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true, mode: 'date' }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('calendar_accounts_user_email_unique_idx').on(table.userId, table.emailAddress),
    index('calendar_accounts_user_id_idx').on(table.userId),
    index('calendar_accounts_provider_idx').on(table.provider),
    index('calendar_accounts_status_idx').on(table.status),
  ],
);

export type CalendarAccount = typeof calendarAccounts.$inferSelect;
export type NewCalendarAccount = typeof calendarAccounts.$inferInsert;
