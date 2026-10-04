import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const AuditActions = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  VERIFY: 'VERIFY',
  UPLOAD: 'UPLOAD',
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

export const candidateAuditEvents = pgTable('candidate_audit_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(), // 'PROFILE', 'EXPERIENCE', 'DOCUMENT', 'ANSWER', 'PREFERENCES', etc.
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(), // 'CREATE', 'UPDATE', 'DELETE', 'VERIFY', 'UPLOAD'
  actor: text('actor').default('USER').notNull(), // 'USER' | 'SYSTEM'
  changedFields: jsonb('changed_fields').$type<string[]>().default([]).notNull(), // Field identifiers, e.g. ['headline', 'city']
  metadata: jsonb('metadata').$type<Record<string, unknown> | null>(), // Safe operational metadata only (NO PII)
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export type CandidateAuditEvent = typeof candidateAuditEvents.$inferSelect;
export type NewCandidateAuditEvent = typeof candidateAuditEvents.$inferInsert;
