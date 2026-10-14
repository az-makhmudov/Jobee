import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDbPool, closeDbPool, createDatabaseClient } from './client.js';

describe('Database Client Connection Isolation & Singleton Guard', () => {
  const urlA = 'postgresql://bek@localhost:5432/db_test_a';
  const urlB = 'postgresql://bek@localhost:5432/db_test_b';

  beforeEach(async () => {
    await closeDbPool();
  });

  afterEach(async () => {
    await closeDbPool();
  });

  it('prevents getDbPool cross-talk when called with a different connection string', () => {
    const poolA = getDbPool(urlA);
    expect(poolA).toBeDefined();

    // Re-calling with the same URL returns the singleton
    const poolASame = getDbPool(urlA);
    expect(poolASame).toBe(poolA);

    // Calling with a DIFFERENT URL throws an explicit Error rather than silently returning poolA
    expect(() => getDbPool(urlB)).toThrow(
      /getDbPool\(\) was called with a different connection string while a singleton pool is already active/,
    );
  });

  it('allows resetting the pool via closeDbPool', async () => {
    const poolA = getDbPool(urlA);
    expect(poolA).toBeDefined();

    await closeDbPool();

    // Now urlB can be initialized without error
    const poolB = getDbPool(urlB);
    expect(poolB).toBeDefined();
    expect(poolB).not.toBe(poolA);
  });

  it('creates completely isolated database clients without touching the singleton', async () => {
    const client1 = createDatabaseClient(urlA);
    const client2 = createDatabaseClient(urlB);

    expect(client1.pool).toBeDefined();
    expect(client2.pool).toBeDefined();
    expect(client1.pool).not.toBe(client2.pool);
    expect(client1.db).not.toBe(client2.db);

    // Default getDbPool can still be initialized independently
    const defaultPool = getDbPool(urlA);
    expect(defaultPool).not.toBe(client1.pool);
    expect(defaultPool).not.toBe(client2.pool);

    await client1.close();
    await client2.close();
  });
});
