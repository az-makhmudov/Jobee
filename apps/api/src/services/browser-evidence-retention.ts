import { and, eq, lt, sql } from 'drizzle-orm';
import { browserApplicationRuns, type Database } from '@job-agent/database';
import type { FileStorageProvider } from '@job-agent/shared';
export async function pruneBrowserEvidence(db: Database, storage: FileStorageProvider) {
  const expired = await db
    .select()
    .from(browserApplicationRuns)
    .where(
      and(
        lt(browserApplicationRuns.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60_000)),
        sql`jsonb_array_length(${browserApplicationRuns.screenshotPaths}) > 0`,
      ),
    )
    .limit(100);
  for (const run of expired) {
    for (const key of run.screenshotPaths)
      if (key.startsWith(`browser-${run.id}-`)) await storage.deleteFile(key);
    await db
      .update(browserApplicationRuns)
      .set({ screenshotPaths: [] })
      .where(eq(browserApplicationRuns.id, run.id));
  }
}
