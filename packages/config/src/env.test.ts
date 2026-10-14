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
      }),
    ).toThrow(AppError);
  });

  it('succeeds in production when DATABASE_URL and production encryption key are provided', () => {
    const config = validateEnv({
      NODE_ENV: 'production',
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
      EMAIL_FROM: 'Jobee <notifications@asadbek.dev>',
    });

    expect(config.EMAIL_FROM).toBe('Jobee <notifications@asadbek.dev>');
    expect(config.SMTP_FROM).toBe('Jobee <notifications@asadbek.dev>');
  });
});
