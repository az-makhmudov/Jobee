import { pgTable, uuid, timestamp, text, boolean, index } from 'drizzle-orm/pg-core';

/**
 * Users entity.
 * Authoritative user entity powering Better Auth and candidate workspaces.
 * Preserves legacy systemKey for migration compatibility and identity resolution.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    role: text('role').default('user').notNull(), // 'admin' | admin-designated 'tester' | 'user'
    banned: boolean('banned').default(false),
    banReason: text('ban_reason'),
    banExpires: timestamp('ban_expires', { withTimezone: true, mode: 'date' }),
    invitationCode: text('invitation_code'),
    systemKey: text('system_key').unique(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('users_email_idx').on(table.email),
    index('users_system_key_idx').on(table.systemKey),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
