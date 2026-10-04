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
    const url = 'postgresql://user:secretpass@db.neon.tech:5432/main_db';
    const redacted = redactSensitiveData(url);
    expect(redacted).not.toContain('secretpass');
  });
});
