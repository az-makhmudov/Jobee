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
  timeoutMs?: number;
  maxRetries?: number;
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
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

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
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxRetries = options.maxRetries ?? 3;

    if (options.endpoint) {
      // Custom endpoint (e.g. Cloudflare R2, MinIO, or local mock)
      this.endpoint = options.endpoint.trim().replace(/\/+$/, '');
    } else {
      // Standard AWS S3 endpoint
      this.endpoint = `https://${this.bucket}.s3.${this.region === 'auto' ? 'us-east-1' : this.region}.amazonaws.com`;
    }
  }

  private isRetryableError(err: unknown, status?: number): boolean {
    if (status) {
      // 5xx Server Errors or 429 Rate Limiting are retryable
      return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
    }
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();
      const cause = (err as any).cause;
      const causeCode = (cause?.code || '').toString().toLowerCase();
      const causeMsg = (cause?.message || '').toString().toLowerCase();

      return (
        msg.includes('fetch failed') ||
        msg.includes('network') ||
        msg.includes('timeout') ||
        msg.includes('socket') ||
        msg.includes('abort') ||
        causeCode.includes('econnreset') ||
        causeCode.includes('und_err_socket') ||
        causeCode.includes('etimedout') ||
        causeCode.includes('ehostunreach') ||
        causeCode.includes('enetunreach') ||
        causeCode.includes('eai_again') ||
        causeCode.includes('econnrefused') ||
        causeMsg.includes('other side closed') ||
        causeMsg.includes('socket')
      );
    }
    return false;
  }

  private formatStorageError(operation: string, err: unknown): Error {
    if (err instanceof AppError) {
      return err;
    }
    const cause = (err as any)?.cause;
    const causeDetails = cause
      ? ` (cause: ${cause.name || 'Error'}: ${cause.message || ''}${cause.code ? ` [code: ${cause.code}]` : ''})`
      : '';
    const errMessage = err instanceof Error ? err.message : String(err);
    const status = (err as any)?.statusCode || (err as any)?.status;

    if (status === 401 || status === 403) {
      return AppError.forbidden(
        `Cloudflare R2/S3 ${operation} authorization failed (${status}): ${errMessage}${causeDetails}. Check S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY permissions.`,
      );
    }

    return AppError.internal(
      `Cloudflare R2/S3 ${operation} operation failed: ${errMessage}${causeDetails}`,
    );
  }

  private async executeWithRetry<T>(
    operation: string,
    action: (attempt: number) => Promise<T>,
    maxRetries = this.maxRetries,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await action(attempt);
      } catch (err: any) {
        lastError = err;
        const status = err?.statusCode || err?.status;
        if (!this.isRetryableError(err, status) || attempt === maxRetries) {
          throw this.formatStorageError(operation, err);
        }
        // Exponential backoff with jitter (e.g. 150ms, 300ms, 600ms)
        const delayMs = Math.min(150 * Math.pow(2, attempt - 1) + Math.random() * 50, 2000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw this.formatStorageError(operation, lastError);
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

    // Ensure 'content-length' is never included in signed headers or headers passed to fetch.
    // Node.js/Undici calculates Content-Length automatically from request body buffers.
    // Explicitly setting Content-Length causes UND_ERR_INVALID_ARG in modern Node.js/Undici runtimes.
    const cleanHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() !== 'content-length') {
        cleanHeaders[k] = v;
      }
    }

    const signedHeadersList: Record<string, string> = {
      ...cleanHeaders,
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

    await this.executeWithRetry(`PUT (${storageKey})`, async () => {
      const headers = this.signRequest(
        'PUT',
        url,
        {
          'content-type': options.mimeType,
        },
        checksum,
      );

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers,
        body: fileBuffer,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        const err: any = new Error(
          `S3 upload failed with status ${response.status}: ${errText.slice(0, 200)}`,
        );
        err.statusCode = response.status;
        throw err;
      }
    });

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

    return await this.executeWithRetry(`GET (${storageKey})`, async () => {
      const headers = this.signRequest('GET', url, {}, this.sha256Hex(''));

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (response.status === 404) {
        throw AppError.notFound(`Storage object ${storageKey} not found in S3`);
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        const err: any = new Error(
          `S3 get failed with status ${response.status}: ${errText.slice(0, 200)}`,
        );
        err.statusCode = response.status;
        throw err;
      }

      const arrayBuffer = await response.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        storageKey,
      };
    });
  }

  public async deleteFile(storageKey: string): Promise<void> {
    const url = this.getObjectUrl(storageKey);

    await this.executeWithRetry(`DELETE (${storageKey})`, async () => {
      const headers = this.signRequest('DELETE', url, {}, this.sha256Hex(''));

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok && response.status !== 404) {
        const errText = await response.text().catch(() => '');
        const err: any = new Error(
          `S3 delete failed with status ${response.status}: ${errText.slice(0, 200)}`,
        );
        err.statusCode = response.status;
        throw err;
      }
    });
  }

  public async exists(storageKey: string): Promise<boolean> {
    const url = this.getObjectUrl(storageKey);

    try {
      return await this.executeWithRetry(`HEAD (${storageKey})`, async () => {
        const headers = this.signRequest('HEAD', url, {}, this.sha256Hex(''));
        const response = await fetch(url.toString(), {
          method: 'HEAD',
          headers,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (response.status === 200) return true;
        if (response.status === 404) return false;
        const err: any = new Error(`S3 HEAD failed with status ${response.status}`);
        err.statusCode = response.status;
        throw err;
      });
    } catch {
      return false;
    }
  }

  public async putFile(storageKey: string, fileBuffer: Buffer, mimeType: string): Promise<void> {
    const checksum = this.sha256Hex(fileBuffer);
    const url = this.getObjectUrl(storageKey);

    await this.executeWithRetry(`PUT (${storageKey})`, async () => {
      const headers = this.signRequest(
        'PUT',
        url,
        {
          'content-type': mimeType,
        },
        checksum,
      );

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers,
        body: fileBuffer,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        const err: any = new Error(
          `S3 upload failed with status ${response.status}: ${errText.slice(0, 200)}`,
        );
        err.statusCode = response.status;
        throw err;
      }
    });
  }
}
