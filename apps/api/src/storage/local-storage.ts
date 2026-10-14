import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  AppError,
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  type FileStorageProvider,
  type StorageObjectMetadata,
} from '@job-agent/shared';

export interface LocalStorageOptions {
  baseDir?: string;
}

const MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
};

export class LocalStorageProvider implements FileStorageProvider {
  public readonly baseDir: string;

  constructor(options?: LocalStorageOptions) {
    if (options?.baseDir) {
      this.baseDir = options.baseDir;
    } else {
      let rootDir = process.cwd();
      if (
        rootDir.endsWith(path.join('apps', 'api')) ||
        rootDir.endsWith(path.join('apps', 'worker')) ||
        rootDir.endsWith(path.join('apps', 'web'))
      ) {
        rootDir = path.resolve(rootDir, '../..');
      }
      this.baseDir = path.resolve(rootDir, 'uploads/documents');
    }
  }

  private async ensureBaseDir(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  public resolveSafePath(storageKey: string): string {
    const safeKey = path.basename(storageKey);
    if (
      safeKey !== storageKey ||
      storageKey.includes('..') ||
      storageKey.includes('/') ||
      storageKey.includes('\\')
    ) {
      throw AppError.badRequest('Invalid storage key: path traversal detected');
    }

    const resolved = path.resolve(this.baseDir, safeKey);
    if (!resolved.startsWith(this.baseDir)) {
      throw AppError.badRequest('Invalid storage path: destination outside storage root');
    }

    return resolved;
  }

  public async saveFile(
    fileBuffer: Buffer,
    options: { originalFilename: string; mimeType: string },
  ): Promise<StorageObjectMetadata> {
    if (
      !ALLOWED_DOCUMENT_MIME_TYPES.includes(
        options.mimeType as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number],
      )
    ) {
      throw AppError.badRequest(
        `Unsupported document format: ${options.mimeType}. Allowed formats: PDF, DOCX, TXT.`,
      );
    }

    if (fileBuffer.length > MAX_DOCUMENT_FILE_SIZE_BYTES) {
      throw AppError.badRequest(
        `File exceeds maximum limit of ${MAX_DOCUMENT_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
      );
    }

    await this.ensureBaseDir();

    const ext = MIME_TO_EXTENSION[options.mimeType] || 'bin';
    const storageKey = `${crypto.randomUUID()}.${ext}`;
    const filePath = this.resolveSafePath(storageKey);

    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    await fs.writeFile(filePath, fileBuffer);

    // Sanitize original filename (remove path separators)
    const sanitizedOriginalFilename =
      path.basename(options.originalFilename).trim() || `document.${ext}`;

    return {
      storageKey,
      originalFilename: sanitizedOriginalFilename,
      mimeType: options.mimeType,
      sizeBytes: fileBuffer.length,
      sha256Checksum: checksum,
    };
  }

  public async getFile(storageKey: string): Promise<{ buffer: Buffer; storageKey: string }> {
    const filePath = this.resolveSafePath(storageKey);
    try {
      const buffer = await fs.readFile(filePath);
      return { buffer, storageKey };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        const safeKey = path.basename(storageKey);
        const candidates = [
          path.resolve(process.cwd(), 'apps/api/uploads/documents', safeKey),
          path.resolve(process.cwd(), 'uploads/documents', safeKey),
          path.resolve(process.cwd(), '../uploads/documents', safeKey),
          path.resolve(process.cwd(), '../../uploads/documents', safeKey),
        ];
        for (const candidate of candidates) {
          try {
            const buffer = await fs.readFile(candidate);
            return { buffer, storageKey };
          } catch {
            // continue checking candidate paths
          }
        }
        throw AppError.notFound(`Stored file not found: ${storageKey}`);
      }
      throw err;
    }
  }

  public async deleteFile(storageKey: string): Promise<void> {
    const filePath = this.resolveSafePath(storageKey);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  public async exists(storageKey: string): Promise<boolean> {
    const filePath = this.resolveSafePath(storageKey);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      const safeKey = path.basename(storageKey);
      const candidates = [
        path.resolve(process.cwd(), 'apps/api/uploads/documents', safeKey),
        path.resolve(process.cwd(), 'uploads/documents', safeKey),
        path.resolve(process.cwd(), '../uploads/documents', safeKey),
        path.resolve(process.cwd(), '../../uploads/documents', safeKey),
      ];
      for (const candidate of candidates) {
        try {
          await fs.access(candidate);
          return true;
        } catch {
          // continue checking candidate paths
        }
      }
      return false;
    }
  }

  public async putFile(storageKey: string, fileBuffer: Buffer, _mimeType: string): Promise<void> {
    await this.ensureBaseDir();
    const safePath = this.resolveSafePath(storageKey);
    await fs.writeFile(safePath, fileBuffer);
  }
}
