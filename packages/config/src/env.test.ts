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

  it('succeeds in production when DATABASE_URL is provided', () => {
    const config = validateEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/testdb',
    });

    expect(config.NODE_ENV).toBe('production');
    expect(config.DATABASE_URL).toBe('postgresql://postgres:secret@localhost:5432/testdb');
  });

  it('fails if API_PORT is invalid', () => {
    expect(() =>
      validateEnv({
        API_PORT: '-10',
      }),
    ).toThrow();
  });
});
