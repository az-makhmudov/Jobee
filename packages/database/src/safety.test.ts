import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  evaluateTestDatabaseSafety,
  assertSafeTestDatabase,
  assertSafeTestUser,
  assertScopedCleanup,
} from './safety.js';

describe('Test Database Safety Guard (JOB-CAREER-INTEL-2.0)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
    delete process.env.RAILWAY_ENVIRONMENT;
    delete process.env.ALLOW_TEST_ON_NEON;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('permits localhost and 127.0.0.1 explicitly isolated test databases', () => {
    const res1 = evaluateTestDatabaseSafety(
      'postgresql://user:pass@localhost:5432/jobee_test_isolated',
    );
    expect(res1.safe).toBe(true);

    const res2 = evaluateTestDatabaseSafety(
      'postgresql://jobee_ci_user:pass@127.0.0.1:5432/jobee_ci_test',
    );
    expect(res2.safe).toBe(true);

    const res3 = evaluateTestDatabaseSafety('postgresql://user:pass@[::1]:5432/test_db');
    expect(res3.safe).toBe(true);
  });

  it('rejects primary development database on localhost without explicit isolated test designation', () => {
    const res = evaluateTestDatabaseSafety(
      'postgresql://user:pass@localhost:5432/ai_job_agent_dev',
    );
    expect(res.safe).toBe(false);
    expect(res.reason).toContain('Refusing to run tests against primary development database');

    const resPostgres = evaluateTestDatabaseSafety(
      'postgresql://user:pass@localhost:5432/postgres',
    );
    expect(resPostgres.safe).toBe(false);
    expect(resPostgres.reason).toContain(
      'Refusing to run tests against primary development database',
    );
  });

  it('permits CI Docker service container "postgres"', () => {
    const res = evaluateTestDatabaseSafety('postgresql://user:pass@postgres:5432/jobee_test');
    expect(res.safe).toBe(true);
  });

  it('rejects database URLs with production keywords in hostname or pathname', () => {
    const res1 = evaluateTestDatabaseSafety('postgresql://user:pass@localhost:5432/jobee_prod');
    expect(res1.safe).toBe(false);
    expect(res1.reason).toContain('targets production');

    const res2 = evaluateTestDatabaseSafety(
      'postgresql://user:pass@prod-db.internal:5432/jobee_test',
    );
    expect(res2.safe).toBe(false);
    expect(res2.reason).toContain('targets production');
  });

  it('rejects production Neon database URLs without test branch or test db', () => {
    const res = evaluateTestDatabaseSafety(
      'postgresql://bek:secret@ep-proud-water-1234.eu-central-1.aws.neon.tech/jobee?sslmode=require',
    );
    expect(res.safe).toBe(false);
    expect(res.reason).toContain('Refusing to run tests against Neon host');
  });

  it('permits Neon databases when explicitly targeting a test branch or test db', () => {
    const res1 = evaluateTestDatabaseSafety(
      'postgresql://bek:secret@ep-proud-water-1234.eu-central-1.aws.neon.tech/jobee_test?sslmode=require',
    );
    expect(res1.safe).toBe(true);

    const res2 = evaluateTestDatabaseSafety(
      'postgresql://bek:secret@ep-test-branch-5678.eu-central-1.aws.neon.tech/jobee?sslmode=require',
    );
    expect(res2.safe).toBe(true);

    process.env.ALLOW_TEST_ON_NEON = 'true';
    const res3 = evaluateTestDatabaseSafety(
      'postgresql://bek:secret@ep-disposable-sandbox-999.eu-central-1.aws.neon.tech/jobee?sslmode=require',
    );
    expect(res3.safe).toBe(true);
  });

  it('rejects unknown remote database hosts by default', () => {
    const res = evaluateTestDatabaseSafety(
      'postgresql://user:pass@db.example.com:5432/some_database',
    );
    expect(res.safe).toBe(false);
    expect(res.reason).toContain('Unknown database target');
  });

  it('rejects when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    const res = evaluateTestDatabaseSafety('postgresql://user:pass@localhost:5432/jobee_test');
    expect(res.safe).toBe(false);
    expect(res.reason).toContain('NODE_ENV is "production"');
  });

  it('rejects when RAILWAY_ENVIRONMENT is production', () => {
    process.env.RAILWAY_ENVIRONMENT = 'production';
    const res = evaluateTestDatabaseSafety('postgresql://user:pass@localhost:5432/jobee_test');
    expect(res.safe).toBe(false);
    expect(res.reason).toContain('Railway production environment');
  });

  it('assertSafeTestDatabase throws descriptive error on unsafe URL', () => {
    expect(() =>
      assertSafeTestDatabase(
        'postgresql://bek:secret@ep-proud-water-1234.eu-central-1.aws.neon.tech/jobee',
      ),
    ).toThrow(/SAFETY VIOLATION/);

    expect(() =>
      assertSafeTestDatabase('postgresql://user:pass@localhost:5432/jobee_test'),
    ).not.toThrow();
  });

  it('assertSafeTestUser rejects sentinel primary user ID', () => {
    expect(() => assertSafeTestUser('00000000-0000-0000-0000-000000000001')).toThrow(
      /Attempted to run test or mutation against sentinel primary candidate user/,
    );
    expect(() => assertSafeTestUser('11111111-2222-3333-4444-555555555555')).not.toThrow();
  });

  it('assertScopedCleanup enforces non-empty scoped targets and rejects primary user', () => {
    expect(() => assertScopedCleanup({})).toThrow(/Attempted to perform unscoped or empty cleanup/);
    expect(() => assertScopedCleanup({ ids: [] })).toThrow(
      /Attempted to perform unscoped or empty cleanup/,
    );
    expect(() => assertScopedCleanup({ userId: '00000000-0000-0000-0000-000000000001' })).toThrow(
      /sentinel primary candidate user/,
    );
    expect(() =>
      assertScopedCleanup({ userId: '11111111-2222-3333-4444-555555555555' }),
    ).not.toThrow();
    expect(() => assertScopedCleanup({ ids: ['some-id'] })).not.toThrow();
    expect(() => assertScopedCleanup({ runId: 'run-123' })).not.toThrow();
  });
});
