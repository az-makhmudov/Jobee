import crypto from 'node:crypto';
import { eq, and, isNull, gt, lt } from 'drizzle-orm';
import { getDb, oauthStates, type Database } from '@job-agent/database';
import { AppError } from '@job-agent/shared';

interface StateData {
  userId: string;
  nonce: string;
  expiresAt: number;
  provider?: string;
  scopeLevel?: 'AVAILABILITY' | 'EVENT_MANAGEMENT';
}

export class OAuthStateService {
  private secretKey: string;
  private db: Database;

  constructor(secretKey: string, db?: Database | null) {
    if (!secretKey || secretKey.length < 32) {
      throw AppError.validation('OAuth state secret key must be at least 32 characters');
    }
    this.secretKey = secretKey;
    this.db = db ?? getDb();
  }

  /**
   * Generates a signed, tamper-proof state token with persistent database backing and a 15-minute TTL.
   */
  public async generateState(
    userId: string,
    provider = 'GMAIL',
    ttlMs = 15 * 60 * 1000,
    scopeLevel?: 'AVAILABILITY' | 'EVENT_MANAGEMENT',
  ): Promise<string> {
    const nonce = crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + ttlMs;
    const payload: StateData = {
      userId,
      nonce,
      expiresAt,
      provider,
      ...(scopeLevel ? { scopeLevel } : {}),
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(encodedPayload)
      .digest('base64url');

    const stateHash = crypto.createHash('sha256').update(nonce).digest('hex');

    // Persist to database for replay protection that survives process restarts
    await this.db.insert(oauthStates).values({
      stateHash,
      userId,
      provider,
      expiresAt: new Date(expiresAt),
    });

    return `${encodedPayload}.${signature}`;
  }

  /**
   * Validates state signature, checks expiry, atomically consumes the state in PostgreSQL,
   * and returns the authenticated userId. Rejects replays, tamperings, and expired tokens.
   */
  public async verifyAndConsumeState(
    state: string,
    expectedProvider = 'GMAIL',
  ): Promise<{ userId: string; scopeLevel?: 'AVAILABILITY' | 'EVENT_MANAGEMENT' }> {
    const parts = state.split('.');
    if (parts.length !== 2) {
      throw AppError.badRequest('Invalid OAuth state parameter format');
    }

    const [encodedPayload, signature] = parts;
    if (!encodedPayload || !signature) {
      throw AppError.badRequest('Invalid OAuth state parameter format');
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(encodedPayload)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      throw AppError.badRequest('Invalid OAuth state signature');
    }

    let data: StateData;
    try {
      data = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as StateData;
    } catch {
      throw AppError.badRequest('Malformed OAuth state payload');
    }

    if (Date.now() > data.expiresAt) {
      throw AppError.badRequest('OAuth state has expired. Please initiate sign-in again.');
    }

    const provider = data.provider || expectedProvider;
    if (provider !== expectedProvider) {
      throw AppError.badRequest(
        `OAuth state provider mismatch (expected ${expectedProvider}, got ${provider})`,
      );
    }

    const stateHash = crypto.createHash('sha256').update(data.nonce).digest('hex');

    // Atomic one-time consumption: only updates where consumed_at IS NULL AND expires_at > NOW()
    const [consumed] = await this.db
      .update(oauthStates)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(oauthStates.stateHash, stateHash),
          eq(oauthStates.provider, expectedProvider),
          isNull(oauthStates.consumedAt),
          gt(oauthStates.expiresAt, new Date()),
        ),
      )
      .returning();

    if (consumed) {
      return {
        userId: consumed.userId,
        ...(['AVAILABILITY', 'EVENT_MANAGEMENT'].includes(data.scopeLevel || '')
          ? { scopeLevel: data.scopeLevel }
          : {}),
      };
    }

    // Inspect reason for failure to provide accurate error response
    const [existing] = await this.db
      .select()
      .from(oauthStates)
      .where(and(eq(oauthStates.stateHash, stateHash), eq(oauthStates.provider, expectedProvider)))
      .limit(1);

    if (!existing) {
      throw AppError.badRequest('Invalid or unknown OAuth state');
    }

    if (existing.consumedAt) {
      throw AppError.badRequest('OAuth state already consumed');
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw AppError.badRequest('OAuth state has expired. Please initiate sign-in again.');
    }

    throw AppError.badRequest('Invalid OAuth state');
  }

  /**
   * Backwards-compatible alias for verifyAndConsumeState.
   */
  public async verifyState(state: string, expectedProvider = 'GMAIL'): Promise<{ userId: string }> {
    return this.verifyAndConsumeState(state, expectedProvider);
  }

  /**
   * Cleans expired OAuth states from the database.
   */
  public async cleanupExpiredStates(olderThanMs = 60 * 60 * 1000): Promise<number> {
    const deleted = await this.db
      .delete(oauthStates)
      .where(lt(oauthStates.expiresAt, new Date(Date.now() - olderThanMs)))
      .returning({ id: oauthStates.id });
    return deleted.length;
  }
}
