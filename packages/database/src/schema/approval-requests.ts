import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { applicationPackages } from './application-packages.js';
import { applicationPackageVersions } from './application-package-versions.js';
import { applicationQuestions } from './application-questions.js';

export const approvalRequests = pgTable(
  'approval_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    packageId: uuid('package_id')
      .notNull()
      .references(() => applicationPackages.id, { onDelete: 'cascade' }),
    versionId: uuid('version_id')
      .notNull()
      .references(() => applicationPackageVersions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id').references(() => applicationQuestions.id, {
      onDelete: 'set null',
    }),
    approvalType: text('approval_type').notNull(),
    // 'QUESTION_ANSWER' | 'SENSITIVE_ANSWER' | 'CV_CONTENT' | 'COVER_LETTER' | 'POLICY_OVERRIDE' | 'OTHER'
    status: text('status').default('PENDING').notNull(),
    // 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESOLVED' | 'CANCELLED'
    subject: text('subject').notNull(),
    proposedValue: text('proposed_value'),
    userEditedValue: text('user_edited_value'),
    reason: text('reason').notNull(),
    riskLevel: text('risk_level').default('LOW').notNull(), // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    evidenceReferences: jsonb('evidence_references').$type<string[]>().default([]).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
    resolvedBy: text('resolved_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('approval_requests_pkg_idx').on(table.packageId),
    index('approval_requests_user_idx').on(table.userId),
    index('approval_requests_status_idx').on(table.status),
    index('approval_requests_type_idx').on(table.approvalType),
  ],
);

export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type NewApprovalRequest = typeof approvalRequests.$inferInsert;
