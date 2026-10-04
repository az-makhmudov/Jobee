import type { DatabaseHealthCheck } from '@job-agent/shared';
import { getDbPool } from './client.js';

export async function checkDatabaseHealth(databaseUrl?: string): Promise<DatabaseHealthCheck> {
  if (!databaseUrl || databaseUrl.trim() === '') {
    return {
      status: 'unconfigured',
      message: 'DATABASE_URL is not set',
    };
  }

  const startTime = Date.now();
  try {
    const pool = getDbPool(databaseUrl);
    // Probe database with simple query
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - startTime;
    return {
      status: 'connected',
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      status: 'disconnected',
      latencyMs,
      message: errorMessage,
    };
  }
}
