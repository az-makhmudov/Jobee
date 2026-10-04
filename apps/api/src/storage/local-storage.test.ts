import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { LocalStorageProvider } from './local-storage.js';
import { AppError } from '@job-agent/shared';

describe('LocalStorageProvider', () => {
  let tempDir: string;
  let storage: LocalStorageProvider;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'job-agent-test-storage-'));
    storage = new LocalStorageProvider({ baseDir: tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('saves PDF document and returns valid metadata', async () => {
    const content = Buffer.from('%PDF-1.4 test document content');
    const result = await storage.saveFile(content, {
      originalFilename: 'my-resume.pdf',
      mimeType: 'application/pdf',
    });

    expect(result.storageKey).toMatch(/\.pdf$/);
    expect(result.sizeBytes).toBe(content.length);
    expect(result.sha256Checksum).toHaveLength(64);
    expect(result.originalFilename).toBe('my-resume.pdf');

    const retrieved = await storage.getFile(result.storageKey);
    expect(retrieved.buffer.toString()).toBe(content.toString());
  });

  it('rejects unsupported MIME types including JSON and Markdown', async () => {
    const jsContent = Buffer.from('console.log("malicious");');
    await expect(
      storage.saveFile(jsContent, {
        originalFilename: 'script.js',
        mimeType: 'application/javascript',
      }),
    ).rejects.toThrow(AppError);

    const jsonContent = Buffer.from('{"key": "value"}');
    await expect(
      storage.saveFile(jsonContent, {
        originalFilename: 'profile.json',
        mimeType: 'application/json',
      }),
    ).rejects.toThrow(AppError);

    const mdContent = Buffer.from('# My CV');
    await expect(
      storage.saveFile(mdContent, {
        originalFilename: 'cv.md',
        mimeType: 'text/markdown',
      }),
    ).rejects.toThrow(AppError);
  });

  it('rejects path traversal keys', () => {
    expect(() => storage.resolveSafePath('../../../etc/passwd')).toThrow(AppError);
    expect(() => storage.resolveSafePath('/absolute/path')).toThrow(AppError);
  });

  it('deletes file safely', async () => {
    const content = Buffer.from('Plain text CV notes');
    const result = await storage.saveFile(content, {
      originalFilename: 'notes.txt',
      mimeType: 'text/plain',
    });

    expect(await storage.exists(result.storageKey)).toBe(true);
    await storage.deleteFile(result.storageKey);
    expect(await storage.exists(result.storageKey)).toBe(false);
  });
});
