import { describe, it, expect, vi, beforeEach } from 'vitest';
import { S3StorageProvider } from './s3-storage.js';
import { LocalStorageProvider } from './local-storage.js';
import { createStorageProvider } from './index.js';
import type { AppConfig } from '@job-agent/config';
import { MAX_DOCUMENT_FILE_SIZE_BYTES } from '@job-agent/shared';

describe('Document Storage Abstraction & S3/R2 Cloud Ready Tests (BL-04)', () => {
  const dummyConfig = {
    STORAGE_BACKEND: 'local',
  } as AppConfig;

  describe('1. Storage Provider Factory Resolution', () => {
    it('creates LocalStorageProvider when STORAGE_BACKEND is local', () => {
      const provider = createStorageProvider(dummyConfig);
      expect(provider).toBeInstanceOf(LocalStorageProvider);
    });

    it('creates S3StorageProvider when STORAGE_BACKEND is s3 and credentials exist', () => {
      const s3Config = {
        STORAGE_BACKEND: 's3',
        S3_BUCKET: 'jobee-candidate-vault',
        S3_REGION: 'us-east-1',
        S3_ACCESS_KEY_ID: 'test-access-key',
        S3_SECRET_ACCESS_KEY: 'test-secret-key-12345',
      } as AppConfig;

      const provider = createStorageProvider(s3Config);
      expect(provider).toBeInstanceOf(S3StorageProvider);
    });

    it('falls back to LocalStorageProvider if s3 credentials are incomplete', () => {
      const incompleteConfig = {
        STORAGE_BACKEND: 's3',
        S3_BUCKET: 'jobee-candidate-vault',
        // missing access keys
      } as AppConfig;

      const provider = createStorageProvider(incompleteConfig);
      expect(provider).toBeInstanceOf(LocalStorageProvider);
    });
  });

  describe('2. S3StorageProvider Invariant & Validation Guards', () => {
    const s3Provider = new S3StorageProvider({
      bucket: 'my-cloud-bucket',
      region: 'auto',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      endpoint: 'https://r2.cloudflarestorage.com/v1',
    });

    it('rejects unsupported MIME types', async () => {
      const buffer = Buffer.from('hello world');
      await expect(
        s3Provider.saveFile(buffer, {
          originalFilename: 'picture.png',
          mimeType: 'image/png',
        }),
      ).rejects.toThrow(/Unsupported document format/);
    });

    it('rejects files exceeding maximum file size', async () => {
      const oversizeBuffer = Buffer.alloc(MAX_DOCUMENT_FILE_SIZE_BYTES + 1024);
      await expect(
        s3Provider.saveFile(oversizeBuffer, {
          originalFilename: 'huge.pdf',
          mimeType: 'application/pdf',
        }),
      ).rejects.toThrow(/exceeds maximum limit/);
    });
  });

  describe('3. AWS Signature Version 4 & REST API Dispatch', () => {
    const s3Provider = new S3StorageProvider({
      bucket: 'jobee-docs',
      region: 'us-west-2',
      accessKeyId: 'MY_ACCESS_KEY',
      secretAccessKey: 'MY_SECRET_KEY',
    });

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('generates valid AWS4 signature and successfully executes saveFile', async () => {
      let capturedUrl = '';
      let capturedMethod = '';
      let capturedHeaders: Record<string, string> = {};

      const mockFetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        capturedUrl = url;
        capturedMethod = init.method || 'GET';
        capturedHeaders = init.headers as Record<string, string>;
        return {
          ok: true,
          status: 200,
          text: async () => '',
        };
      });
      global.fetch = mockFetch;

      const content = Buffer.from('PDF test content for cloud vault');
      const meta = await s3Provider.saveFile(content, {
        originalFilename: 'CurriculumVitae.pdf',
        mimeType: 'application/pdf',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(capturedMethod).toBe('PUT');
      expect(capturedUrl).toContain('jobee-docs');
      expect(capturedUrl).toMatch(/\.pdf$/);

      // Verify AWS Signature v4 headers
      expect(capturedHeaders['x-amz-date']).toBeDefined();
      expect(capturedHeaders['x-amz-content-sha256']).toBe(meta.sha256Checksum);
      expect(capturedHeaders['Authorization']).toMatch(
        /^AWS4-HMAC-SHA256 Credential=MY_ACCESS_KEY\//,
      );
      expect(capturedHeaders['Authorization']).toContain('SignedHeaders=');
      expect(capturedHeaders['Authorization']).toContain('Signature=');

      expect(meta.originalFilename).toBe('CurriculumVitae.pdf');
      expect(meta.mimeType).toBe('application/pdf');
      expect(meta.sizeBytes).toBe(content.length);
    });

    it('successfully retrieves file via signed GET request', async () => {
      const testBuffer = Buffer.from('Binary PDF content returned from S3');
      const mockFetch = vi.fn().mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () =>
            testBuffer.buffer.slice(
              testBuffer.byteOffset,
              testBuffer.byteOffset + testBuffer.byteLength,
            ),
        };
      });
      global.fetch = mockFetch;

      const file = await s3Provider.getFile('test-doc-uuid.pdf');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(file.storageKey).toBe('test-doc-uuid.pdf');
      expect(file.buffer.toString()).toBe('Binary PDF content returned from S3');
    });

    it('returns true when object exists and false on 404', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ status: 200 })
        .mockResolvedValueOnce({ status: 404 });
      global.fetch = mockFetch;

      const existsFirst = await s3Provider.exists('doc-1.pdf');
      const existsSecond = await s3Provider.exists('doc-2.pdf');

      expect(existsFirst).toBe(true);
      expect(existsSecond).toBe(false);
    });

    it('successfully sends signed DELETE request on deleteFile', async () => {
      let capturedMethod = '';
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        capturedMethod = init.method || '';
        return {
          ok: true,
          status: 204,
        };
      });
      global.fetch = mockFetch;

      await s3Provider.deleteFile('obsolete-doc.pdf');
      expect(capturedMethod).toBe('DELETE');
    });

    it('retries transient network failures (fetch failed) and succeeds on subsequent attempt', async () => {
      let attemptCount = 0;
      const testBuffer = Buffer.from('Retry test content');
      const mockFetch = vi.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          const networkErr = new TypeError('fetch failed');
          (networkErr as any).cause = { code: 'UND_ERR_SOCKET', message: 'other side closed' };
          throw networkErr;
        }
        return {
          ok: true,
          status: 200,
          text: async () => '',
        };
      });
      global.fetch = mockFetch;

      const meta = await s3Provider.saveFile(testBuffer, {
        originalFilename: 'resilient.pdf',
        mimeType: 'application/pdf',
      });

      expect(attemptCount).toBe(2);
      expect(meta.originalFilename).toBe('resilient.pdf');
    });

    it('retries on 503 Service Unavailable and succeeds on next attempt', async () => {
      let attemptCount = 0;
      const testBuffer = Buffer.from('503 retry test');
      const mockFetch = vi.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          return {
            ok: false,
            status: 503,
            text: async () => 'Slow Down / Service Unavailable',
          };
        }
        return {
          ok: true,
          status: 200,
          text: async () => '',
        };
      });
      global.fetch = mockFetch;

      const meta = await s3Provider.saveFile(testBuffer, {
        originalFilename: 'service-recovery.pdf',
        mimeType: 'application/pdf',
      });

      expect(attemptCount).toBe(2);
      expect(meta.originalFilename).toBe('service-recovery.pdf');
    });

    it('fails fast without retry on 403 Forbidden with clear permission diagnostics', async () => {
      let attemptCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        attemptCount++;
        return {
          ok: false,
          status: 403,
          text: async () => 'Access Denied',
        };
      });
      global.fetch = mockFetch;

      await expect(
        s3Provider.saveFile(Buffer.from('Forbidden test'), {
          originalFilename: 'forbidden.pdf',
          mimeType: 'application/pdf',
        }),
      ).rejects.toThrow(/authorization failed \(403\)/);

      // Must NOT retry 403 authorization failures
      expect(attemptCount).toBe(1);
    });

    it('preserves and formats underlying cause details when all retries are exhausted', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        const networkErr = new TypeError('fetch failed');
        (networkErr as any).cause = { code: 'ENETUNREACH', message: 'Network unreachable' };
        throw networkErr;
      });
      global.fetch = mockFetch;

      await expect(
        s3Provider.saveFile(Buffer.from('Fail exhaust test'), {
          originalFilename: 'exhaust.pdf',
          mimeType: 'application/pdf',
        }),
      ).rejects.toThrow(/ENETUNREACH/);
    });
  });
});
