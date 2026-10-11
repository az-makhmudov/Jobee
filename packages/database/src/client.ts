import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let dbInstance: NodePgDatabase<typeof schema> | null = null;

export function getDbPool(connectionString?: string): pg.Pool {
  if (!pool) {
    const connStr = connectionString || process.env.DATABASE_URL;
    if (!connStr) {
      throw new Error('DATABASE_URL is not configured');
    }
    pool = new Pool({
      connectionString: connStr,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      process.stderr.write(`Unexpected error on idle database client: ${err.message}\n`);
    });
  }
  return pool;
}

export function getDb(connectionString?: string): NodePgDatabase<typeof schema> {
  if (!dbInstance) {
    const p = getDbPool(connectionString);
    dbInstance = drizzle(p, { schema });
  }
  return dbInstance;
}

export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
  }
}

export type Database = NodePgDatabase<typeof schema>;
