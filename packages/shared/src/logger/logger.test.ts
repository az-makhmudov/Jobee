import { describe, it, expect } from 'vitest';
import { redactSensitiveData } from './logger.js';

describe('redactSensitiveData', () => {
  it('redacts sensitive keys in objects', () => {
    const input = {
      username: 'bek',
      password: 'supersecretpassword123',
      api_key: 'key-12345',
      nested: {
        token: 'jwt.token.here',
        safeField: 'hello',
      },
    };

    const redacted = redactSensitiveData(input) as Record<string, unknown>;
    expect(redacted['username']).toBe('bek');
    expect(redacted['password']).toBe('[REDACTED]');
    expect(redacted['api_key']).toBe('[REDACTED]');
    const nested = redacted['nested'] as Record<string, unknown>;
    expect(nested['token']).toBe('[REDACTED]');
    expect(nested['safeField']).toBe('hello');
  });

  it('redacts database credentials in URLs', () => {
    // Unmistakably fictional example URL using RFC 2606 reserved domain and fixture credentials.
    // Replaces previous db.neon.tech example that triggered false-positive GitGuardian alerts.
    const url =
      'postgresql://fixture-user:fixture-secret-password-xyz@db.example.internal:5432/test_db';
    const redacted = redactSensitiveData(url);
    expect(redacted).not.toContain('fixture-secret-password-xyz');
    expect(redacted).not.toContain('fixture-user');
    expect(redacted).toBe('postgres://[REDACTED]@[REDACTED]/db.example.internal:5432/test_db');
  });

  it('redacts Bearer tokens in strings', () => {
    const header = 'Authorization: Bearer mock_access_token_fixture_value_12345';
    const redacted = redactSensitiveData(header);
    expect(redacted).toBe('Authorization: Bearer [REDACTED]');
    expect(redacted).not.toContain('mock_access_token_fixture_value_12345');
  });

  it('redacts case-insensitive bearer tokens in strings', () => {
    const lowercase = 'using bearer token_xyz_987 in auth flow';
    const redacted = redactSensitiveData(lowercase);
    expect(redacted).toBe('using Bearer [REDACTED] in auth flow');
    expect(redacted).not.toContain('token_xyz_987');
  });
});
