import { describe, it, expect } from 'vitest';
import { checkDatabaseHealth } from './health.js';

describe('checkDatabaseHealth', () => {
  it('returns unconfigured status when databaseUrl is not provided', async () => {
    const health = await checkDatabaseHealth(undefined);
    expect(health.status).toBe('unconfigured');
    expect(health.message).toBe('DATABASE_URL is not set');
  });

  it('returns unconfigured status when databaseUrl is empty string', async () => {
    const health = await checkDatabaseHealth('');
    expect(health.status).toBe('unconfigured');
  });

  it('handles connection failure gracefully', async () => {
    // Attempt connecting to a non-existent port
    const health = await checkDatabaseHealth(
      'postgresql://postgres:postgres@localhost:59999/nonexistent',
    );
    expect(health.status).toBe('disconnected');
    expect(health.message).toBeDefined();
    expect(health.latencyMs).toBeTypeOf('number');
  });

  it('configures SSL parameters when neon.tech or sslmode=require is in connection string', async () => {
    const { getDbPool, closeDbPool } = await import('./client.js');
    await closeDbPool();
    const neonPool = getDbPool(
      'postgresql://user:pass@ep-demo-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require',
    );
    // Verify pool is instantiated with SSL options
    expect(neonPool).toBeDefined();
    expect(
      (neonPool as unknown as { options: { ssl?: { rejectUnauthorized: boolean } } }).options.ssl,
    ).toEqual({
      rejectUnauthorized: false,
    });
    await closeDbPool();
  });
});
