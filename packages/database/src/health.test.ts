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
});
