import { pgTable, uuid, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const AutomationLevels = {
  AUTO: 'AUTO',
  REVIEW: 'REVIEW',
  MANUAL: 'MANUAL',
} as const;

export type AutomationLevel = (typeof AutomationLevels)[keyof typeof AutomationLevels];

export const AnswerCategories = {
  WORK_AUTHORIZATION: 'WORK_AUTHORIZATION',
  SPONSORSHIP: 'SPONSORSHIP',
  SALARY: 'SALARY',
  RELOCATION: 'RELOCATION',
  NOTICE_PERIOD: 'NOTICE_PERIOD',
  TRAVEL: 'TRAVEL',
  EXPERIENCE: 'EXPERIENCE',
  LEGAL_DECLARATIONS: 'LEGAL_DECLARATIONS',
  DIVERSITY: 'DIVERSITY',
  GENERAL: 'GENERAL',
} as const;

export type AnswerCategory = (typeof AnswerCategories)[keyof typeof AnswerCategories];

export const answerLibrary = pgTable('answer_library', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  category: text('category').default('GENERAL').notNull(),
  answer: text('answer').notNull(),
  notes: text('notes'),
  automationLevel: text('automation_level').default('REVIEW').notNull(), // 'AUTO' | 'REVIEW' | 'MANUAL'
  verificationStatus: text('verification_status').default('UNVERIFIED').notNull(),
  isSensitive: boolean('is_sensitive').default(false).notNull(), // Sensitive questions (salary, visa, legal, etc.)
  conditions: jsonb('conditions'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type AnswerLibraryEntry = typeof answerLibrary.$inferSelect;
export type NewAnswerLibraryEntry = typeof answerLibrary.$inferInsert;
