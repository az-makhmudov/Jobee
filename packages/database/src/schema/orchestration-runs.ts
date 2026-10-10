import { pgTable, uuid, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const orchestrationRuns = pgTable(
  'orchestration_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskType: text('task_type').default('PIPELINE_CYCLE').notNull(), // 'DISCOVERY' | 'MATCHING' | 'PREPARATION' | 'AUTO_APPLY' | 'EMAIL_SYNC' | 'REMINDERS' | 'PIPELINE_CYCLE'
    trigger: text('trigger').default('SCHEDULED').notNull(), // 'SCHEDULED' | 'MANUAL' | 'EVENT'
    status: text('status').default('PENDING').notNull(), // 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'CANCELLED'
    itemsProcessedCount: integer('items_processed_count').default(0).notNull(),
    itemsSucceededCount: integer('items_succeeded_count').default(0).notNull(),
    itemsFailedCount: integer('items_failed_count').default(0).notNull(),
    stepLogs: jsonb('step_logs').$type<unknown[]>().default([]).notNull(),
    summary: jsonb('summary').$type<Record<string, unknown>>().default({}).notNull(),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').default(0).notNull(),
    maxRetries: integer('max_retries').default(3).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('orchestration_runs_user_id_idx').on(table.userId),
    index('orchestration_runs_status_idx').on(table.status),
    index('orchestration_runs_task_type_idx').on(table.taskType),
    index('orchestration_runs_created_at_idx').on(table.createdAt),
  ],
);

export type OrchestrationRun = typeof orchestrationRuns.$inferSelect;
export type NewOrchestrationRun = typeof orchestrationRuns.$inferInsert;
