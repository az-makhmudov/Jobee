import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { TokenCryptoService } from './token-crypto-service.js';
import { OAuthStateService } from './oauth-state-service.js';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { Database } from '@job-agent/database';

interface MockOAuthStateRecord {
  id: string;
  stateHash: string;
  userId: string;
  provider: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

function createMockOAuthDb() {
  const store = new Map<string, MockOAuthStateRecord>();
  const dialect = new PgDialect();

  const mockDb = {
    insert: (_table: unknown) => ({
      values: async (data: {
        stateHash: string;
        userId: string;
        provider?: string;
        expiresAt: Date;
      }) => {
        const id = `state-${Date.now()}-${Math.random()}`;
        const record: MockOAuthStateRecord = {
          id,
          stateHash: data.stateHash,
          userId: data.userId,
          provider: data.provider || 'GMAIL',
          expiresAt: data.expiresAt instanceof Date ? data.expiresAt : new Date(data.expiresAt),
          consumedAt: null,
          createdAt: new Date(),
        };
        store.set(data.stateHash, record);
        return [record];
      },
    }),
    update: (_table: unknown) => ({
      set: (updateData: { consumedAt?: Date }) => ({
        where: (clause: unknown) => ({
          returning: async () => {
            const query = dialect.sqlToQuery(clause as never);
            const stateHash = query.params[0] as string;
            const record = store.get(stateHash);
            if (record && !record.consumedAt && record.expiresAt.getTime() > Date.now()) {
              record.consumedAt = updateData.consumedAt || new Date();
              return [record];
            }
            return [];
          },
        }),
      }),
    }),
    select: () => ({
      from: (_table: unknown) => ({
        where: (clause: unknown) => ({
          limit: async (_limitNum: number) => {
            const query = dialect.sqlToQuery(clause as never);
            const stateHash = query.params[0] as string;
            const record = store.get(stateHash);
            return record ? [record] : [];
          },
        }),
      }),
    }),
    delete: (_table: unknown) => ({
      where: (clause: unknown) => ({
        returning: async () => {
          const query = dialect.sqlToQuery(clause as never);
          const cutoff = query.params[0] as Date;
          const cutoffTime = cutoff instanceof Date ? cutoff.getTime() : new Date(cutoff).getTime();
          const deleted: { id: string }[] = [];
          for (const [hash, record] of store.entries()) {
            if (record.expiresAt.getTime() < cutoffTime) {
              deleted.push({ id: record.id });
              store.delete(hash);
            }
          }
          return deleted;
        },
      }),
    }),
  } as unknown as Database;

  return { mockDb, store };
}

describe('TokenCryptoService', () => {
  const secretKey = 'a-super-secret-encryption-key-that-is-at-least-32-chars-long';
  const cryptoService = new TokenCryptoService(secretKey);

  it('validates secret key length and entropy on construction', () => {
    expect(() => new TokenCryptoService('short-key')).toThrow(/at least 32 characters/);
    expect(() => new TokenCryptoService('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toThrow(
      /insufficient entropy/,
    );
  });

  it('encrypts tokens into versioned envelope v1:primary:<iv>:<tag>:<ciphertext>', () => {
    const tokens = {
      accessToken: 'ya29.sample-access-token-12345',
      refreshToken: '1//0g-sample-refresh-token-67890',
      expiresIn: 3600,
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
    };

    const encrypted = cryptoService.encrypt(tokens);
    expect(encrypted.startsWith('v1:primary:')).toBe(true);

    const parts = encrypted.split(':');
    expect(parts.length).toBe(5);
    expect(parts[0]).toBe('v1');
    expect(parts[1]).toBe('primary');

    expect(encrypted).not.toContain(tokens.accessToken);
    expect(encrypted).not.toContain(tokens.refreshToken);
  });

  it('encrypts and decrypts OAuth tokens accurately roundtrip', () => {
    const tokens = {
      accessToken: 'ya29.sample-access-token-12345',
      refreshToken: '1//0g-sample-refresh-token-67890',
      expiresIn: 3600,
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
    };

    const encrypted = cryptoService.encrypt(tokens);
    const decrypted = cryptoService.decrypt<typeof tokens>(encrypted);
    expect(decrypted).toEqual(tokens);
  });

  it('supports legacy JSON envelope decryption for backwards compatibility', () => {
    const tokens = {
      accessToken: 'ya29.sample-legacy-token-11111',
      refreshToken: '1//0g-sample-legacy-refresh-22222',
    };

    // Construct a legacy JSON payload by encrypting manually with crypto
    const key = crypto.createHash('sha256').update(secretKey, 'utf8').digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(tokens), 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const legacyPayload = JSON.stringify({
      version: 1,
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: encrypted.toString('base64'),
    });

    const decrypted = cryptoService.decrypt<typeof tokens>(legacyPayload);
    expect(decrypted).toEqual(tokens);
  });

  it('fails decryption gracefully when ciphertext is corrupted or tampered', () => {
    const valid = cryptoService.encrypt({ sample: 'value' });
    const parts = valid.split(':');
    // Tamper ciphertext
    parts[4] = Buffer.from('tampered-ciphertext').toString('base64url');
    const tampered = parts.join(':');

    expect(() => cryptoService.decrypt(tampered)).toThrow(/Failed to decrypt/);
  });

  it('rejects unsupported token envelope version prefix', () => {
    const unsupportedVersion = 'v2:primary:abc:def:ghi';
    expect(() => cryptoService.decrypt(unsupportedVersion)).toThrow(
      /Unsupported token envelope version: v2/,
    );
  });

  it('rejects unsupported keyId in envelope', () => {
    const tokens = { sample: 'value' };
    const valid = cryptoService.encrypt(tokens);
    const parts = valid.split(':');
    parts[1] = 'secondary-unsupported-key';
    const wrongKeyId = parts.join(':');

    expect(() => cryptoService.decrypt(wrongKeyId)).toThrow(
      /Unsupported keyId 'secondary-unsupported-key'/,
    );
  });
});

describe('OAuthStateService', () => {
  const secretKey = 'a-super-secret-encryption-key-that-is-at-least-32-chars-long';

  it('generates verifiable state token and atomically consumes it', async () => {
    const { mockDb } = createMockOAuthDb();
    const stateService = new OAuthStateService(secretKey, mockDb);
    const userId = '88888888-4444-4444-4444-121212121212';

    const state = await stateService.generateState(userId);
    expect(state).toContain('.');

    const verified = await stateService.verifyAndConsumeState(state);
    expect(verified.userId).toBe(userId);
  });

  it('rejects consumed states on replay attempt', async () => {
    const { mockDb } = createMockOAuthDb();
    const stateService = new OAuthStateService(secretKey, mockDb);
    const userId = '88888888-4444-4444-4444-121212121212';

    const state = await stateService.generateState(userId);
    await stateService.verifyAndConsumeState(state);

    await expect(stateService.verifyAndConsumeState(state)).rejects.toThrow(/already consumed/);
  });

  it('persists state consumption across restarted service instances', async () => {
    const { mockDb } = createMockOAuthDb();
    const instanceA = new OAuthStateService(secretKey, mockDb);
    const userId = '88888888-4444-4444-4444-121212121212';

    const state = await instanceA.generateState(userId);
    await instanceA.verifyAndConsumeState(state);

    // Simulate process restart with a fresh service instance sharing the database
    const instanceB = new OAuthStateService(secretKey, mockDb);
    await expect(instanceB.verifyAndConsumeState(state)).rejects.toThrow(/already consumed/);
  });

  it('allows unconsumed state across restarted service instances then blocks replay', async () => {
    const { mockDb } = createMockOAuthDb();
    const instanceA = new OAuthStateService(secretKey, mockDb);
    const userId = '88888888-4444-4444-4444-121212121212';

    const state = await instanceA.generateState(userId);

    // Simulate process restart before consumption
    const instanceB = new OAuthStateService(secretKey, mockDb);
    const verified = await instanceB.verifyAndConsumeState(state);
    expect(verified.userId).toBe(userId);

    // Subsequent attempt on instanceB or fresh instanceC must fail
    const instanceC = new OAuthStateService(secretKey, mockDb);
    await expect(instanceC.verifyAndConsumeState(state)).rejects.toThrow(/already consumed/);
  });

  it('rejects tampered state tokens', async () => {
    const { mockDb } = createMockOAuthDb();
    const stateService = new OAuthStateService(secretKey, mockDb);
    const state = await stateService.generateState('user-1');
    const [payload] = state.split('.');
    const tampered = `${payload}.invalid-signature`;

    await expect(stateService.verifyAndConsumeState(tampered)).rejects.toThrow(
      /Invalid OAuth state signature/,
    );
  });

  it('rejects expired state tokens', async () => {
    const { mockDb } = createMockOAuthDb();
    const stateService = new OAuthStateService(secretKey, mockDb);

    // Generate with negative TTL to immediately expire
    const state = await stateService.generateState('user-1', 'GMAIL', -1000);
    await expect(stateService.verifyAndConsumeState(state)).rejects.toThrow(
      /OAuth state has expired/,
    );
  });

  it('rejects provider mismatch', async () => {
    const { mockDb } = createMockOAuthDb();
    const stateService = new OAuthStateService(secretKey, mockDb);

    const state = await stateService.generateState('user-1', 'GMAIL');
    await expect(stateService.verifyAndConsumeState(state, 'OUTLOOK')).rejects.toThrow(
      /OAuth state provider mismatch/,
    );
  });

  it('rejects malformed state token formats', async () => {
    const { mockDb } = createMockOAuthDb();
    const stateService = new OAuthStateService(secretKey, mockDb);

    await expect(stateService.verifyAndConsumeState('malformed-token-no-dots')).rejects.toThrow(
      /Invalid OAuth state parameter format/,
    );
  });

  it('handles concurrent consumption collision atomically', async () => {
    const { mockDb } = createMockOAuthDb();
    const stateService = new OAuthStateService(secretKey, mockDb);
    const userId = '88888888-4444-4444-4444-121212121212';

    const state = await stateService.generateState(userId);

    const results = await Promise.allSettled([
      stateService.verifyAndConsumeState(state),
      stateService.verifyAndConsumeState(state),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    if (rejected[0]?.status === 'rejected') {
      expect(rejected[0].reason.message).toContain('already consumed');
    }
  });

  it('cleans up expired states', async () => {
    const { mockDb, store } = createMockOAuthDb();
    const stateService = new OAuthStateService(secretKey, mockDb);

    await stateService.generateState('user-1', 'GMAIL', -5000); // expired
    await stateService.generateState('user-2', 'GMAIL', 60000); // valid

    expect(store.size).toBe(2);
    const cleaned = await stateService.cleanupExpiredStates(0);
    expect(cleaned).toBe(1);
    expect(store.size).toBe(1);
  });
});
