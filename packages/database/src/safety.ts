/**
 * Test Database Safety Guard
 *
 * Enforces strict test database isolation:
 * 1. Prohibits running tests against production environments (NODE_ENV=production, RAILWAY_ENVIRONMENT=production).
 * 2. Prohibits running tests against production database URLs (containing 'prod' or 'production').
 * 3. Prohibits running tests against production Neon databases (neon.tech without explicit test branch or test database name).
 * 4. Permits local PostgreSQL (localhost, 127.0.0.1, ::1) and CI service container (postgres).
 * 5. Rejects unknown or unverified remote database targets by default.
 */

export interface TestDatabaseSafetyResult {
  safe: boolean;
  reason?: string;
  target?: {
    hostname: string;
    pathname: string;
  };
}

export function evaluateTestDatabaseSafety(databaseUrl?: string): TestDatabaseSafetyResult {
  const urlStr = databaseUrl || process.env.DATABASE_URL;
  if (!urlStr || urlStr.trim() === '') {
    return {
      safe: false,
      reason: 'DATABASE_URL is not configured.',
    };
  }

  // 1. Environment checks
  if (process.env.NODE_ENV === 'production') {
    return {
      safe: false,
      reason: 'Refusing to run tests when NODE_ENV is "production".',
    };
  }

  if (process.env.RAILWAY_ENVIRONMENT === 'production') {
    return {
      safe: false,
      reason: 'Refusing to run tests on Railway production environment.',
    };
  }

  // 2. Parse URL
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return {
      safe: false,
      reason: `Malformed DATABASE_URL: ${urlStr}`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  const fullUrl = urlStr.toLowerCase();

  // 3. Prohibit production keywords
  if (hostname.includes('prod') || pathname.includes('prod') || fullUrl.includes('production')) {
    return {
      safe: false,
      reason: `Database URL targets production (host: ${parsed.hostname}, db: ${parsed.pathname}).`,
      target: { hostname, pathname },
    };
  }

  // 4. Validate allowed hosts
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname === 'postgres'; // Docker / CI service container hostname

  if (isLocalhost) {
    // Prohibit primary development databases on localhost without explicit test isolation designation
    const isPrimaryDev =
      pathname === '/ai_job_agent_dev' ||
      pathname === '/jobee_dev' ||
      pathname === '/postgres' ||
      pathname.endsWith('_dev');

    const isExplicitTestDb =
      pathname.includes('test') || pathname.includes('isolated') || pathname.includes('sandbox');

    if (isPrimaryDev && !isExplicitTestDb && process.env.ALLOW_DEV_DB_TESTING !== 'true') {
      return {
        safe: false,
        reason: `Refusing to run tests against primary development database '${parsed.pathname}' on localhost. Do not assume localhost is disposable. Tests must target an explicitly designated isolated test database (e.g. 'jobee_test_isolated').`,
        target: { hostname, pathname },
      };
    }

    if (!isExplicitTestDb && process.env.ALLOW_DEV_DB_TESTING !== 'true') {
      return {
        safe: false,
        reason: `Database '${parsed.pathname}' on localhost is not explicitly designated as an isolated test database. Integration tests require a database name containing 'test', 'isolated', or 'sandbox'.`,
        target: { hostname, pathname },
      };
    }

    return {
      safe: true,
      target: { hostname, pathname },
    };
  }

  const isNeon = hostname.endsWith('.neon.tech');
  if (isNeon) {
    // Neon databases: Only allow if explicitly designated as a disposable test branch or database
    const isExplicitTestNeon =
      hostname.includes('-test') || hostname.includes('test-') || pathname.includes('test');

    if (!isExplicitTestNeon && process.env.ALLOW_TEST_ON_NEON !== 'true') {
      return {
        safe: false,
        reason: `Refusing to run tests against Neon host '${parsed.hostname}'. Neon testing is only permitted against dedicated disposable test branches/databases containing 'test' in the host or database name.`,
        target: { hostname, pathname },
      };
    }

    return {
      safe: true,
      target: { hostname, pathname },
    };
  }

  // 5. Default Deny: Unknown remote database targets
  return {
    safe: false,
    reason: `Unknown database target '${parsed.hostname}'. Integration tests are only permitted against local PostgreSQL (localhost, 127.0.0.1, postgres) or dedicated test-branch databases.`,
    target: { hostname, pathname },
  };
}

export function assertSafeTestDatabase(databaseUrl?: string): void {
  const result = evaluateTestDatabaseSafety(databaseUrl);
  if (!result.safe) {
    throw new Error(`SAFETY VIOLATION: ${result.reason}`);
  }
}

export const SENTINEL_PRIMARY_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Asserts that a given user ID is not the genuine sentinel primary candidate user.
 * Tests and verification scripts must use disposable mock user IDs.
 */
export function assertSafeTestUser(userId: string): void {
  if (userId === SENTINEL_PRIMARY_USER_ID) {
    throw new Error(
      `SAFETY VIOLATION: Attempted to run test or mutation against sentinel primary candidate user (${SENTINEL_PRIMARY_USER_ID}). Tests must exclusively target disposable mock user IDs.`,
    );
  }
}

/**
 * Asserts that a cleanup operation is strictly scoped to specific IDs or user.
 * Prevents dangerous unscoped DELETE operations.
 */
export function assertScopedCleanup(scope: {
  userId?: string;
  ids?: string[];
  runId?: string;
  tag?: string;
}): void {
  if (!scope.userId && (!scope.ids || scope.ids.length === 0) && !scope.runId && !scope.tag) {
    throw new Error(
      'SAFETY VIOLATION: Attempted to perform unscoped or empty cleanup. Every database deletion must specify a dedicated test userId, non-empty ids array, or unique test runId/tag.',
    );
  }
  if (scope.userId) {
    assertSafeTestUser(scope.userId);
  }
}

/**
 * Verifies that a database does not contain genuine primary candidate documents.
 * Protects genuine candidate data from destructive scripts.
 */
export async function assertDatabaseHasNoPrimaryCandidateData(db: any): Promise<void> {
  try {
    const { candidateDocuments } = await import('./schema/candidate-documents.js');
    const { eq } = await import('drizzle-orm');

    const userDocs = await db
      .select()
      .from(candidateDocuments)
      .where(eq(candidateDocuments.userId, SENTINEL_PRIMARY_USER_ID))
      .limit(1);

    if (userDocs && userDocs.length > 0) {
      throw new Error(
        `SAFETY VIOLATION: Database contains genuine Master CV documents for primary candidate (${SENTINEL_PRIMARY_USER_ID}). Refusing to execute destructive test script against a database with genuine user data.`,
      );
    }
  } catch (err: any) {
    if (err.message && err.message.startsWith('SAFETY VIOLATION:')) {
      throw err;
    }
  }
}
