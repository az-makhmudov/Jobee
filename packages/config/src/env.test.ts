import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.js';
import { AppError } from '@job-agent/shared';

describe('validateEnv', () => {
  it('applies defaults for missing optional development variables', () => {
    const config = validateEnv({
      NODE_ENV: 'development',
    });

    expect(config.NODE_ENV).toBe('development');
    expect(config.API_PORT).toBe(3000);
    expect(config.API_HOST).toBe('127.0.0.1');
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.DATABASE_URL).toBeUndefined();
  });

  it('fails if DATABASE_URL is missing in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        OWNER_EMAIL: 'operator@example.test',
      }),
    ).toThrow(AppError);
  });

  it('succeeds in production when DATABASE_URL and production encryption key are provided', () => {
    const config = validateEnv({
      NODE_ENV: 'production',
      OWNER_EMAIL: 'operator@example.test',
      DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/testdb',
      EMAIL_TOKEN_ENCRYPTION_KEY:
        'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      BETTER_AUTH_SECRET: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    });

    expect(config.NODE_ENV).toBe('production');
    expect(config.DATABASE_URL).toBe('postgresql://postgres:secret@localhost:5432/testdb');
    expect(config.EMAIL_TOKEN_ENCRYPTION_KEY).toBe(
      'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    );
    expect(config.BETTER_AUTH_SECRET).toBe(
      'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    );
  });

  it('fails if API_PORT is invalid', () => {
    expect(() =>
      validateEnv({
        API_PORT: '-10',
      }),
    ).toThrow();
  });

  it('fails if EMAIL_TOKEN_ENCRYPTION_KEY is shorter than 32 characters', () => {
    expect(() =>
      validateEnv({
        EMAIL_TOKEN_ENCRYPTION_KEY: 'short_key_12345',
      }),
    ).toThrow(/at least 32 characters/);
  });

  it('fails if EMAIL_TOKEN_ENCRYPTION_KEY has insufficient character entropy', () => {
    expect(() =>
      validateEnv({
        EMAIL_TOKEN_ENCRYPTION_KEY: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
    ).toThrow(/insufficient entropy/);
  });

  it('fails in production if default EMAIL_TOKEN_ENCRYPTION_KEY is used', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        OWNER_EMAIL: 'operator@example.test',
        DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/testdb',
        EMAIL_TOKEN_ENCRYPTION_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        BETTER_AUTH_SECRET: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      }),
    ).toThrow(/secure non-default EMAIL_TOKEN_ENCRYPTION_KEY/);
  });

  it('fails in production if default BETTER_AUTH_SECRET is used', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        OWNER_EMAIL: 'operator@example.test',
        DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/testdb',
        EMAIL_TOKEN_ENCRYPTION_KEY:
          'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
        BETTER_AUTH_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      }),
    ).toThrow(/secure non-default BETTER_AUTH_SECRET/);
  });

  it('respects PORT environment variable when API_PORT is not provided (Railway support)', () => {
    const config = validateEnv({
      NODE_ENV: 'development',
      PORT: '8080',
    });
    expect(config.API_PORT).toBe(8080);
  });

  it('auto-detects Railway public domain for Better Auth and Web Origin', () => {
    const config = validateEnv({
      NODE_ENV: 'production',
      OWNER_EMAIL: 'operator@example.test',
      DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/testdb',
      EMAIL_TOKEN_ENCRYPTION_KEY:
        'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      BETTER_AUTH_SECRET: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      RAILWAY_PUBLIC_DOMAIN: 'jobee.up.railway.app',
    });

    expect(config.BETTER_AUTH_URL).toBe('https://jobee.up.railway.app');
    expect(config.WEB_ORIGIN).toBe('https://jobee.up.railway.app');
    expect(config.BETTER_AUTH_TRUSTED_ORIGINS).toBe('https://jobee.up.railway.app');
    expect(config.API_HOST).toBe('0.0.0.0');
  });

  it('auto-detects S3 storage backend when R2 credentials are provided', () => {
    const config = validateEnv({
      NODE_ENV: 'development',
      S3_BUCKET: 'jobee-bucket',
      S3_ACCESS_KEY_ID: 'key123',
      S3_SECRET_ACCESS_KEY: 'secret123',
    });

    expect(config.STORAGE_BACKEND).toBe('s3');
  });

  it('auto-detects Gemini AI provider when GEMINI_API_KEY is provided', () => {
    const config = validateEnv({
      NODE_ENV: 'development',
      GEMINI_API_KEY: 'test-gemini-key',
    });

    expect(config.AI_PROVIDER).toBe('gemini');
  });

  it('normalizes EMAIL_FROM and SMTP_FROM interchangeably', () => {
    const config = validateEnv({
      NODE_ENV: 'development',
      EMAIL_FROM: 'Jobee Team <hello@example.com>',
    });

    expect(config.EMAIL_FROM).toBe('Jobee Team <hello@example.com>');
    expect(config.SMTP_FROM).toBe('Jobee Team <hello@example.com>');
  });

  it('falls back to Resend verified testing sender if default .local address is present', () => {
    const config = validateEnv({
      NODE_ENV: 'development',
      RESEND_API_KEY: 're_test_12345',
    });

    expect(config.EMAIL_FROM).toBe('Jobee <onboarding@resend.dev>');
    expect(config.SMTP_FROM).toBe('Jobee <onboarding@resend.dev>');
  });

  it('preserves custom verified sender with Resend', () => {
    const config = validateEnv({
      NODE_ENV: 'development',
      RESEND_API_KEY: 're_test_12345',
      EMAIL_FROM: 'Jobee <notifications@example.test>',
    });

    expect(config.EMAIL_FROM).toBe('Jobee <notifications@example.test>');
    expect(config.SMTP_FROM).toBe('Jobee <notifications@example.test>');
  });

  it('defaults OWNER_EMAIL to a synthetic local owner', () => {
    const config = validateEnv({
      NODE_ENV: 'development',
    });

    expect(config.OWNER_EMAIL).toBe('owner@example.test');
  });

  it('accepts valid custom OWNER_EMAIL', () => {
    const config = validateEnv({
      NODE_ENV: 'development',
      OWNER_EMAIL: 'custom.owner@example.com',
    });

    expect(config.OWNER_EMAIL).toBe('custom.owner@example.com');
  });

  it('rejects invalid OWNER_EMAIL format', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        OWNER_EMAIL: 'not-an-email',
      }),
    ).toThrow();
  });

  it('reuses GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for Gmail and Calendar when omitted', () => {
    const config = validateEnv({
      NODE_ENV: 'development',
      GOOGLE_CLIENT_ID: 'google-oauth-client-id-123.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'GOCSPX-secret-abc-123',
    });

    expect(config.GOOGLE_CLIENT_ID).toBe('google-oauth-client-id-123.apps.googleusercontent.com');
    expect(config.GMAIL_CLIENT_ID).toBe('google-oauth-client-id-123.apps.googleusercontent.com');
    expect(config.GMAIL_CLIENT_SECRET).toBe('GOCSPX-secret-abc-123');
    expect(config.GOOGLE_CALENDAR_CLIENT_ID).toBe(
      'google-oauth-client-id-123.apps.googleusercontent.com',
    );
    expect(config.GOOGLE_CALENDAR_CLIENT_SECRET).toBe('GOCSPX-secret-abc-123');
  });

  it('preserves dedicated Gmail credentials when explicitly configured', () => {
    const config = validateEnv({
      NODE_ENV: 'development',
      GOOGLE_CLIENT_ID: 'google-oauth-client-id-123.apps.googleusercontent.com',
      GMAIL_CLIENT_ID: 'dedicated-gmail-client-id-456.apps.googleusercontent.com',
    });

    expect(config.GOOGLE_CLIENT_ID).toBe('google-oauth-client-id-123.apps.googleusercontent.com');
    expect(config.GMAIL_CLIENT_ID).toBe('dedicated-gmail-client-id-456.apps.googleusercontent.com');
    expect(config.GOOGLE_CALENDAR_CLIENT_ID).toBe(
      'google-oauth-client-id-123.apps.googleusercontent.com',
    );
  });

  it('automatically configures production OAuth redirect URIs from RAILWAY_PUBLIC_DOMAIN', () => {
    const config = validateEnv({
      NODE_ENV: 'production',
      OWNER_EMAIL: 'operator@example.test',
      DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/testdb',
      EMAIL_TOKEN_ENCRYPTION_KEY:
        'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      BETTER_AUTH_SECRET: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      RAILWAY_PUBLIC_DOMAIN: 'jobee-api-production.up.railway.app',
      GOOGLE_CLIENT_ID: 'google-oauth-client-id-123.apps.googleusercontent.com',
    });

    expect(config.BETTER_AUTH_URL).toBe('https://jobee-api-production.up.railway.app');
    expect(config.GMAIL_REDIRECT_URI).toBe(
      'https://jobee-api-production.up.railway.app/api/email/accounts/gmail/callback',
    );
    expect(config.GOOGLE_CALENDAR_REDIRECT_URI).toBe(
      'https://jobee-api-production.up.railway.app/api/calendar/google/callback',
    );
  });

  it('sanitizes and trims whitespace and trailing newlines from S3 credentials', () => {
    const config = validateEnv({
      NODE_ENV: 'development',
      S3_BUCKET: '  jobee-private-documents \n',
      S3_ACCESS_KEY_ID: '013c353b145aaa8e113791e4c74d6af4\n',
      S3_SECRET_ACCESS_KEY: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210\n',
      S3_ENDPOINT: '  https://account.r2.cloudflarestorage.com/  \n',
      S3_REGION: ' auto \n',
    });

    expect(config.S3_BUCKET).toBe('jobee-private-documents');
    expect(config.S3_ACCESS_KEY_ID).toBe('013c353b145aaa8e113791e4c74d6af4');
    expect(config.S3_SECRET_ACCESS_KEY).toBe(
      'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    );
    expect(config.S3_ENDPOINT).toBe('https://account.r2.cloudflarestorage.com/');
    expect(config.S3_REGION).toBe('auto');
    expect(config.STORAGE_BACKEND).toBe('s3');
  });

  it('defaults AI_MODEL to gemini-3.8-flash and upgrades obsolete models', () => {
    const defaultConfig = validateEnv({
      NODE_ENV: 'development',
    });
    expect(defaultConfig.AI_MODEL).toBe('gemini-3.8-flash');

    const upgradedConfig = validateEnv({
      NODE_ENV: 'development',
      AI_MODEL: 'gemini-2.5-flash',
    });
    expect(upgradedConfig.AI_MODEL).toBe('gemini-3.8-flash');

    const customValidConfig = validateEnv({
      NODE_ENV: 'development',
      AI_MODEL: 'gemini-3.5-flash-lite',
    });
    expect(customValidConfig.AI_MODEL).toBe('gemini-3.5-flash-lite');
  });
});

it('requires explicit operator enablement and bounds optional job-search provider requests', () => {
  expect(validateEnv({ SERPAPI_API_KEY: 'synthetic-key' }).SERPAPI_ENABLED).toBe(false);
  expect(() => validateEnv({ SERPAPI_ENABLED: 'true' })).toThrow('SERPAPI_API_KEY');
  expect(() => validateEnv({ SERPAPI_MAX_REQUESTS_PER_DISCOVERY: '4' })).toThrow();
  expect(
    validateEnv({ SERPAPI_ENABLED: 'true', SERPAPI_API_KEY: 'synthetic-key' }).SERPAPI_ENABLED,
  ).toBe(true);
});
