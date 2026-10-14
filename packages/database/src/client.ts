import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let dbInstance: NodePgDatabase<typeof schema> | null = null;
let activeConnectionString: string | null = null;

export interface DatabaseClientOptions {
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: boolean | pg.ConnectionConfig['ssl'];
}

export interface IsolatedDatabaseClient {
  pool: pg.Pool;
  db: NodePgDatabase<typeof schema>;
  close: () => Promise<void>;
}

/**
 * Creates an isolated, uncached database client with its own connection pool.
 * Use this when multiple distinct databases must be connected simultaneously
 * (e.g., during database migrations or cross-database sync).
 */
export function createDatabaseClient(
  connectionString: string,
  options?: DatabaseClientOptions,
): IsolatedDatabaseClient {
  if (!connectionString) {
    throw new Error('connectionString is required to create an isolated database client');
  }

  const isSsl =
    options?.ssl !== undefined
      ? options.ssl
      : connectionString.includes('sslmode=require') ||
        connectionString.includes('neon.tech') ||
        process.env.DATABASE_SSL === 'true';

  const isolatedPool = new Pool({
    connectionString,
    max: options?.max ?? 10,
    idleTimeoutMillis: options?.idleTimeoutMillis ?? 30000,
    connectionTimeoutMillis: options?.connectionTimeoutMillis ?? 10000,
    ssl: isSsl ? (typeof isSsl === 'object' ? isSsl : { rejectUnauthorized: false }) : undefined,
  });

  isolatedPool.on('error', (err) => {
    process.stderr.write(`Unexpected error on idle database client: ${err.message}\n`);
  });

  const isolatedDb = drizzle(isolatedPool, { schema });

  return {
    pool: isolatedPool,
    db: isolatedDb,
    close: async () => {
      await isolatedPool.end();
    },
  };
}

/**
 * Returns the default singleton connection pool for the primary application database.
 * If called with a different connection string while a pool is already active,
 * throws an Error to prevent silent connection leakage/cross-talk.
 */
export function getDbPool(connectionString?: string): pg.Pool {
  const connStr = connectionString || process.env.DATABASE_URL;
  if (!connStr) {
    throw new Error('DATABASE_URL is not configured');
  }

  // Prevent silent caching bug: if a pool already exists but a DIFFERENT connection string is requested
  if (
    pool &&
    activeConnectionString &&
    connectionString &&
    connectionString !== activeConnectionString
  ) {
    throw new Error(
      'getDbPool() was called with a different connection string while a singleton pool is already active. Use createDatabaseClient() for isolated connections or call closeDbPool() first.',
    );
  }

  if (!pool) {
    const isSsl =
      connStr.includes('sslmode=require') ||
      connStr.includes('neon.tech') ||
      process.env.DATABASE_SSL === 'true';

    pool = new Pool({
      connectionString: connStr,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
    });

    activeConnectionString = connStr;

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
    activeConnectionString = null;
  }
}

export type Database = NodePgDatabase<typeof schema>;
