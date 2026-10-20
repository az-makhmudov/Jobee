import { LocalStorageProvider } from './local-storage.js';
import { S3StorageProvider } from './s3-storage.js';
import type { FileStorageProvider } from '../types/storage.js';
export * from './local-storage.js';
export * from './s3-storage.js';
export function createFileStorage(config: {
  STORAGE_BACKEND?: string;
  S3_BUCKET?: string;
  S3_REGION?: string;
  S3_ENDPOINT?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
}): FileStorageProvider {
  if (config.STORAGE_BACKEND === 's3') {
    if (!config.S3_BUCKET || !config.S3_ACCESS_KEY_ID || !config.S3_SECRET_ACCESS_KEY)
      throw new Error('Configured object storage is missing credentials.');
    return new S3StorageProvider({
      bucket: config.S3_BUCKET,
      region: config.S3_REGION || 'auto',
      endpoint: config.S3_ENDPOINT,
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    });
  }
  return new LocalStorageProvider();
}
