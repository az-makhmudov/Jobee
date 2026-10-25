import { and, eq, gte, sql } from 'drizzle-orm';
import { users } from '../schema/users.js';
import { browserApplicationRuns } from '../schema/browser-application-runs.js';
import type { Database } from '../client.js';
import { AppError } from '@job-agent/shared';
/** Call inside the queue/intent transaction. The user row serializes concurrent quota reservations. */
export async function assertDailyApplicationLimit(db: Database, userId: string) {
  await db.execute(sql`SELECT id FROM users WHERE id=${userId} FOR UPDATE`);
  const [account] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
  if (!account) throw AppError.notFound('Account not found.');
  if (['admin', 'tester'].includes(account.role)) return;
  const today = new Date(new Date().toISOString().slice(0, 10));
  const attempts = await db
    .select({ id: browserApplicationRuns.id })
    .from(browserApplicationRuns)
    .where(
      and(
        eq(browserApplicationRuns.userId, userId),
        eq(browserApplicationRuns.mode, 'SUBMIT'),
        gte(browserApplicationRuns.createdAt, today),
      ),
    )
    .limit(10);
  if (attempts.length >= 10)
    throw AppError.badRequest('Daily application limit reached (10/day). Continue tomorrow (UTC).');
}
