import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb } from './client.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Executes pending database migrations using Drizzle ORM.
 * Idempotent: reads __drizzle_migrations table and only executes unapplied migrations.
 */
export async function runDatabaseMigrations(connectionString?: string): Promise<void> {
  const url = connectionString || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Cannot run database migrations: DATABASE_URL is not set.');
  }

  const db = getDb(url);

  // Search candidate paths for drizzle folder across dev and production container layouts
  const candidatePaths = [
    path.resolve(__dirname, '../../drizzle'),
    path.resolve(__dirname, '../drizzle'),
    path.resolve(process.cwd(), 'packages/database/drizzle'),
    path.resolve(process.cwd(), 'drizzle'),
  ];

  let migrationsFolder: string | null = null;
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      migrationsFolder = candidate;
      break;
    }
  }

  if (!migrationsFolder) {
    throw new Error(
      `Cannot locate drizzle migrations directory. Checked: ${candidatePaths.join(', ')}`,
    );
  }

  await migrate(db, { migrationsFolder });
}
