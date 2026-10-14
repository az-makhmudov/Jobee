export interface StorageObjectMetadata {
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256Checksum: string;
}

export interface FileStorageProvider {
  saveFile(
    fileBuffer: Buffer,
    options: { originalFilename: string; mimeType: string },
  ): Promise<StorageObjectMetadata>;

  getFile(storageKey: string): Promise<{
    buffer: Buffer;
    storageKey: string;
  }>;

  deleteFile(storageKey: string): Promise<void>;

  exists(storageKey: string): Promise<boolean>;

  putFile?(storageKey: string, fileBuffer: Buffer, mimeType: string): Promise<void>;
}

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
