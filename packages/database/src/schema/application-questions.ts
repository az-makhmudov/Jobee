import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { applicationPackages } from './application-packages.js';
import { applicationPackageVersions } from './application-package-versions.js';

export const applicationQuestions = pgTable(
  'application_questions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    packageId: uuid('package_id')
      .notNull()
      .references(() => applicationPackages.id, { onDelete: 'cascade' }),
    versionId: uuid('version_id')
      .notNull()
      .references(() => applicationPackageVersions.id, { onDelete: 'cascade' }),
    questionText: text('question_text').notNull(),
    category: text('category').default('GENERAL').notNull(),
    // 'WORK_AUTHORIZATION' | 'SPONSORSHIP' | 'RELOCATION' | 'SALARY' | 'AVAILABILITY' | 'EXPERIENCE_YEARS' | 'LANGUAGE' | 'PORTFOLIO' | 'TRAVEL' | 'MOTIVATION' | 'GENERAL'
    questionType: text('question_type').notNull(),
    // 'TEXT' | 'TEXTAREA' | 'BOOLEAN' | 'SINGLE_SELECT' | 'MULTI_SELECT' | 'NUMBER' | 'DATE'
    isRequired: boolean('is_required').default(true).notNull(),
    options: jsonb('options').$type<string[]>().default([]).notNull(),
    sensitivity: text('sensitivity').default('STANDARD').notNull(), // 'STANDARD' | 'SENSITIVE'
    answerSource: text('answer_source').default('UNRESOLVED').notNull(),
    // 'ANSWER_LIBRARY' | 'CANDIDATE_FACT' | 'AI_INTERPRETATION' | 'MANUAL_USER' | 'UNRESOLVED'
    sourceEntityId: text('source_entity_id'),
    proposedAnswer: text('proposed_answer'),
    humanEditedAnswer: text('human_edited_answer'),
    finalAnswer: text('final_answer'),
    approvalState: text('approval_state').default('PENDING').notNull(),
    // 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESOLVED' | 'CANCELLED'
    displayOrder: integer('display_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('app_questions_package_id_idx').on(table.packageId),
    index('app_questions_version_id_idx').on(table.versionId),
    index('app_questions_approval_state_idx').on(table.approvalState),
  ],
);

export type ApplicationQuestion = typeof applicationQuestions.$inferSelect;
export type NewApplicationQuestion = typeof applicationQuestions.$inferInsert;
