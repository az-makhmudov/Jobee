import { and, eq, lt, sql } from 'drizzle-orm';
import { browserApplicationRuns, type Database } from '@job-agent/database';
import { createLogger, type FileStorageProvider } from '@job-agent/shared';
/** Bounded private-evidence retention; failures retain references and remain retryable. */
export async function pruneBrowserEvidence(
  db: Database,
  storage: FileStorageProvider,
  userId?: string,
) {
  const expired = await db
    .select()
    .from(browserApplicationRuns)
    .where(
      and(
        userId ? eq(browserApplicationRuns.userId, userId) : undefined,
        lt(browserApplicationRuns.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60_000)),
        sql`jsonb_array_length(${browserApplicationRuns.screenshotPaths}) > 0`,
      ),
    )
    .limit(100);
  let objectsDeleted = 0,
    failures = 0,
    unrecognized = 0;
  for (const run of expired) {
    const remaining: string[] = [];
    for (const key of run.screenshotPaths) {
      if (!key.startsWith(`browser-${run.id}-`) || /[\\/]/.test(key) || key.includes('..')) {
        remaining.push(key);
        unrecognized++;
        continue;
      }
      try {
        await storage.deleteFile(key);
        objectsDeleted++;
      } catch {
        remaining.push(key);
        failures++;
      }
    }
    if (remaining.length !== run.screenshotPaths.length)
      await db
        .update(browserApplicationRuns)
        .set({ screenshotPaths: remaining })
        .where(
          and(
            eq(browserApplicationRuns.id, run.id),
            eq(browserApplicationRuns.screenshotPaths, run.screenshotPaths),
          ),
        );
  }
  if (failures || unrecognized)
    createLogger({ service: 'api' }).warn('Browser evidence cleanup needs attention', {
      failures,
      unrecognized,
    });
  return { runsExamined: expired.length, objectsDeleted, failures, unrecognized };
}
