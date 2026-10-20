import { runDatabaseMigrations } from '../migrator.js';
import { closeDbPool } from '../client.js';
import { getConfig } from '@job-agent/config';

async function run() {
  const config = getConfig();
  if (!config.DATABASE_URL) {
    process.stderr.write('Cannot run migrations: DATABASE_URL is not set.\n');
    process.exit(1);
  }

  process.stdout.write('Running database migrations...\n');
  try {
    await runDatabaseMigrations(config.DATABASE_URL);
    // Production identity is owned by Better Auth; schema migration must never seed a legacy candidate.
    if (config.NODE_ENV !== 'production') {
      const { getDb } = await import('../client.js');
      const { getOrCreatePrimaryUser } = await import('../user.js');
      const db = getDb(config.DATABASE_URL);
      await getOrCreatePrimaryUser(db);
    }
    process.stdout.write('Migrations applied successfully.\n');
  } catch (err) {
    process.stderr.write(`Migration failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  } finally {
    await closeDbPool();
  }
}

run();
