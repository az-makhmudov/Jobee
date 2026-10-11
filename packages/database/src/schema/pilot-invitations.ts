import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const PilotInvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
} as const;

export type PilotInvitationStatus =
  (typeof PilotInvitationStatus)[keyof typeof PilotInvitationStatus];

/**
 * Pilot Invitations table.
 * Enforces invite-only registration for the Jobee private pilot.
 */
export const pilotInvitations = pgTable(
  'pilot_invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull().unique(),
    inviterUserId: uuid('inviter_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    invitedEmail: text('invited_email'), // optional: bind code to specific email address
    role: text('role').default('user').notNull(),
    status: text('status').default(PilotInvitationStatus.PENDING).notNull(),
    acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('pilot_invitations_code_idx').on(table.code),
    index('pilot_invitations_inviter_idx').on(table.inviterUserId),
    index('pilot_invitations_status_idx').on(table.status),
  ],
);

export type PilotInvitation = typeof pilotInvitations.$inferSelect;
export type NewPilotInvitation = typeof pilotInvitations.$inferInsert;
