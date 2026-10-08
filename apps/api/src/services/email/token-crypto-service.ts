import crypto from 'node:crypto';
import { AppError } from '@job-agent/shared';

export interface EncryptedTokenPayload {
  version: 1;
  algorithm: 'aes-256-gcm';
  keyId?: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

export class TokenCryptoService {
  private key: Buffer;
  private keyId: string;

  constructor(secretKey: string, keyId = 'primary') {
    if (!secretKey || secretKey.length < 32) {
      throw AppError.validation('Email token encryption key must be at least 32 characters');
    }
    const uniqueChars = new Set(secretKey);
    if (uniqueChars.size < 8) {
      throw AppError.validation('Email token encryption key has insufficient entropy');
    }
    this.keyId = keyId;
    // Deterministically derive 256-bit key using SHA-256
    this.key = crypto.createHash('sha256').update(secretKey, 'utf8').digest();
  }

  /**
   * Encrypts token data using authenticated AES-256-GCM.
   * Returns a versioned envelope string: `v1:<keyId>:<ivBase64>:<tagBase64>:<ciphertextBase64>`
   */
  public encrypt<T extends Record<string, unknown>>(data: T): string {
    try {
      const iv = crypto.randomBytes(12); // 96-bit random IV
      const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
      const plaintext = JSON.stringify(data);
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag(); // 128-bit authentication tag

      const ivB64 = iv.toString('base64url');
      const tagB64 = tag.toString('base64url');
      const cipherB64 = encrypted.toString('base64url');

      return `v1:${this.keyId}:${ivB64}:${tagB64}:${cipherB64}`;
    } catch (err) {
      throw AppError.internal(`Token encryption failed: ${(err as Error).message}`);
    }
  }

  /**
   * Decrypts a versioned envelope string using AES-256-GCM.
   * Safely rejects unsupported versions or tampered ciphertexts.
   */
  public decrypt<T = Record<string, unknown>>(encryptedEnvelope: string): T {
    try {
      if (!encryptedEnvelope || typeof encryptedEnvelope !== 'string') {
        throw new Error('Missing or empty encrypted token envelope');
      }

      let iv: Buffer;
      let tag: Buffer;
      let ciphertext: Buffer;

      if (encryptedEnvelope.startsWith('v1:')) {
        const parts = encryptedEnvelope.split(':');
        if (parts.length === 5) {
          // Format: v1:keyId:iv:tag:ciphertext
          const [, keyId, ivStr, tagStr, cipherStr] = parts;
          if (keyId !== this.keyId) {
            throw new Error(`Unsupported keyId '${keyId}' in token envelope`);
          }
          iv = Buffer.from(ivStr!, 'base64url');
          tag = Buffer.from(tagStr!, 'base64url');
          ciphertext = Buffer.from(cipherStr!, 'base64url');
        } else if (parts.length === 4) {
          // Format: v1:iv:tag:ciphertext
          const [, ivStr, tagStr, cipherStr] = parts;
          iv = Buffer.from(ivStr!, 'base64url');
          tag = Buffer.from(tagStr!, 'base64url');
          ciphertext = Buffer.from(cipherStr!, 'base64url');
        } else {
          throw new Error('Malformed v1 token encryption envelope structure');
        }
      } else if (encryptedEnvelope.startsWith('{')) {
        // Legacy JSON envelope backwards compatibility
        const envelope = JSON.parse(encryptedEnvelope) as EncryptedTokenPayload;
        if (envelope.version !== 1 || envelope.algorithm !== 'aes-256-gcm') {
          throw new Error('Unsupported envelope version or algorithm');
        }
        iv = Buffer.from(envelope.iv, 'base64');
        tag = Buffer.from(envelope.tag, 'base64');
        ciphertext = Buffer.from(envelope.ciphertext, 'base64');
      } else {
        const versionPrefix = encryptedEnvelope.split(':')[0];
        throw new Error(`Unsupported token envelope version: ${versionPrefix || 'unknown'}`);
      }

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return JSON.parse(decrypted.toString('utf8')) as T;
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('Unsupported token envelope version') || msg.includes('Unsupported keyId')) {
        throw AppError.internal(msg);
      }
      throw AppError.internal(
        'Failed to decrypt credentials. Tokens may be corrupted or key was altered.',
      );
    }
  }
}
