import crypto from 'node:crypto';
import path from 'node:path';
import {
  AppError,
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  type FileStorageProvider,
  type StorageObjectMetadata,
} from '@job-agent/shared';

export interface S3StorageOptions {
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
};

export class S3StorageProvider implements FileStorageProvider {
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;

  constructor(options: S3StorageOptions) {
    if (!options.bucket || !options.accessKeyId || !options.secretAccessKey) {
      throw AppError.internal(
        'S3StorageProvider requires bucket, accessKeyId, and secretAccessKey',
      );
    }
    this.bucket = options.bucket.trim();
    this.region = (options.region || 'auto').trim();
    this.accessKeyId = options.accessKeyId.trim();
    this.secretAccessKey = options.secretAccessKey.trim();

    if (options.endpoint) {
      // Custom endpoint (e.g. Cloudflare R2, MinIO, or local mock)
      this.endpoint = options.endpoint.trim().replace(/\/+$/, '');
    } else {
      // Standard AWS S3 endpoint
      this.endpoint = `https://${this.bucket}.s3.${this.region === 'auto' ? 'us-east-1' : this.region}.amazonaws.com`;
    }
  }

  private hmacSha256(key: Buffer | string, data: string): Buffer {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
  }

  private sha256Hex(data: Buffer | string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Computes AWS Signature Version 4 (AWS4-HMAC-SHA256) headers for S3/R2 requests.
   */
  private signRequest(
    method: string,
    url: URL,
    headers: Record<string, string>,
    payloadHash: string,
  ): Record<string, string> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const signedHeadersList: Record<string, string> = {
      ...headers,
      host: url.host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
    };

    const sortedHeaderKeys = Object.keys(signedHeadersList).sort();
    const canonicalHeaders = sortedHeaderKeys
      .map((k) => `${k.toLowerCase()}:${(signedHeadersList[k] || '').trim()}\n`)
      .join('');
    const signedHeadersStr = sortedHeaderKeys.map((k) => k.toLowerCase()).join(';');

    const canonicalUri = url.pathname || '/';
    const canonicalQuery = url.searchParams.toString();

    const canonicalRequest = [
      method.toUpperCase(),
      canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      signedHeadersStr,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      this.sha256Hex(canonicalRequest),
    ].join('\n');

    const kDate = this.hmacSha256(`AWS4${this.secretAccessKey}`, dateStamp);
    const kRegion = this.hmacSha256(kDate, this.region);
    const kService = this.hmacSha256(kRegion, 's3');
    const kSigning = this.hmacSha256(kService, 'aws4_request');
    const signature = crypto
      .createHmac('sha256', kSigning)
      .update(stringToSign, 'utf8')
      .digest('hex');

    const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

    return {
      ...signedHeadersList,
      Authorization: authorization,
    };
  }

  private getObjectUrl(storageKey: string): URL {
    // If endpoint has path, append bucket/key or direct key
    const base = new URL(this.endpoint);
    if (base.pathname.length > 1) {
      return new URL(`${this.endpoint}/${storageKey}`);
    }
    // Path-style S3 URL fallback
    return new URL(`${this.endpoint}/${this.bucket}/${storageKey}`);
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

    const ext = MIME_TO_EXTENSION[options.mimeType] || 'bin';
    const storageKey = `${crypto.randomUUID()}.${ext}`;
    const checksum = this.sha256Hex(fileBuffer);
    const url = this.getObjectUrl(storageKey);

    const headers = this.signRequest(
      'PUT',
      url,
      {
        'content-type': options.mimeType,
        'content-length': String(fileBuffer.length),
      },
      checksum,
    );

    const response = await fetch(url.toString(), {
      method: 'PUT',
      headers,
      body: fileBuffer,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw AppError.internal(
        `S3 upload failed with status ${response.status}: ${errText.slice(0, 150)}`,
      );
    }

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
    const url = this.getObjectUrl(storageKey);
    const headers = this.signRequest('GET', url, {}, this.sha256Hex(''));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    if (response.status === 404) {
      throw AppError.notFound(`Storage object ${storageKey} not found in S3`);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw AppError.internal(
        `S3 get failed with status ${response.status}: ${errText.slice(0, 150)}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      storageKey,
    };
  }

  public async deleteFile(storageKey: string): Promise<void> {
    const url = this.getObjectUrl(storageKey);
    const headers = this.signRequest('DELETE', url, {}, this.sha256Hex(''));

    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers,
    });

    if (!response.ok && response.status !== 404) {
      const errText = await response.text().catch(() => '');
      throw AppError.internal(
        `S3 delete failed with status ${response.status}: ${errText.slice(0, 150)}`,
      );
    }
  }

  public async exists(storageKey: string): Promise<boolean> {
    const url = this.getObjectUrl(storageKey);
    const headers = this.signRequest('HEAD', url, {}, this.sha256Hex(''));

    try {
      const response = await fetch(url.toString(), {
        method: 'HEAD',
        headers,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  public async putFile(storageKey: string, fileBuffer: Buffer, mimeType: string): Promise<void> {
    const checksum = this.sha256Hex(fileBuffer);
    const url = this.getObjectUrl(storageKey);
    const headers = this.signRequest(
      'PUT',
      url,
      {
        'content-type': mimeType,
        'content-length': String(fileBuffer.length),
      },
      checksum,
    );

    const response = await fetch(url.toString(), {
      method: 'PUT',
      headers,
      body: fileBuffer,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw AppError.internal(
        `S3 upload failed with status ${response.status}: ${errText.slice(0, 150)}`,
      );
    }
  }
}
