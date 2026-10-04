import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb, closeDbPool } from '../client.js';
import { getConfig } from '@job-agent/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const config = getConfig();
  if (!config.DATABASE_URL) {
    process.stderr.write('Cannot run migrations: DATABASE_URL is not set.\n');
    process.exit(1);
  }

  process.stdout.write('Running database migrations...\n');
  const db = getDb(config.DATABASE_URL);
  const migrationsFolder = path.resolve(__dirname, '../../drizzle');

  try {
    await migrate(db, { migrationsFolder });
    process.stdout.write('Migrations applied successfully.\n');
  } catch (err) {
    process.stderr.write(`Migration failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  } finally {
    await closeDbPool();
  }
}

runMigrations();
