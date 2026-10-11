import dns from 'node:dns/promises';
import net from 'node:net';
import { AppError } from '@job-agent/shared';

export interface RetrievedPage {
  url: string;
  finalUrl: string;
  content: string;
  contentType: string;
  statusCode: number;
}

export interface HttpFetcherOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  customFetcher?: (
    url: string,
    init: RequestInit,
  ) => Promise<{
    status: number;
    headers: Headers;
    text: () => Promise<string>;
    body?: ReadableStream<Uint8Array> | null;
  }>;
}

export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2MB
export const DEFAULT_MAX_REDIRECTS = 3;
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 (Jobee/1.0; +https://github.com/az-makhmudov/Jobee)';

/**
 * Validates whether an IP address belongs to private, loopback, link-local,
 * cloud metadata, or reserved ranges.
 */
export function isPrivateOrRestrictedIp(ip: string): boolean {
  const normalized = ip.trim().toLowerCase();

  // IPv4 checks
  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true;
    }

    const a = parts[0]!;
    const b = parts[1]!;
    const c = parts[2]!;

    // 0.0.0.0/8 - Current network (only valid as source address)
    if (a === 0) return true;

    // 10.0.0.0/8 - Private
    if (a === 10) return true;

    // 127.0.0.0/8 - Loopback
    if (a === 127) return true;

    // 100.64.0.0/10 - Shared address space (Carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // 169.254.0.0/16 - Link-local / AWS / GCP / Azure metadata (169.254.169.254)
    if (a === 169 && b === 254) return true;

    // 172.16.0.0/12 - Private
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.0.0.0/24 - IETF Protocol Assignments
    if (a === 192 && b === 0 && c === 0) return true;

    // 192.0.2.0/24 - TEST-NET-1
    if (a === 192 && b === 0 && c === 2) return true;

    // 192.168.0.0/16 - Private
    if (a === 192 && b === 168) return true;

    // 198.18.0.0/15 - Benchmarking
    if (a === 198 && (b === 18 || b === 19)) return true;

    // 198.51.100.0/24 - TEST-NET-2
    if (a === 198 && b === 51 && c === 100) return true;

    // 203.0.113.0/24 - TEST-NET-3
    if (a === 203 && b === 0 && c === 113) return true;

    // 224.0.0.0/4 - Multicast
    if (a >= 224 && a <= 239) return true;

    // 240.0.0.0/4 - Reserved
    if (a >= 240) return true;

    // 255.255.255.255/32 - Limited broadcast
    if (a === 255 && b === 255) return true;

    return false;
  }

  // IPv6 checks
  if (net.isIPv6(normalized)) {
    // Loopback
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
    // Unspecified
    if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

    // IPv4-mapped IPv6 (::ffff:192.0.2.1)
    if (normalized.startsWith('::ffff:')) {
      const v4part = normalized.replace('::ffff:', '');
      if (net.isIPv4(v4part)) {
        return isPrivateOrRestrictedIp(v4part);
      }
      return true;
    }

    // Unique Local Address (fc00::/7) - fc00 to fdff
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

    // Link-local unicast (fe80::/10) - fe80 to febf
    if (
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    ) {
      return true;
    }

    return false;
  }

  return true;
}

export class HttpRetrievalService {
  constructor(private readonly options: HttpFetcherOptions = {}) {}

  /**
   * Safely checks a target URL for SSRF vulnerabilities and protocol correctness.
   * Resolves DNS and inspects all returned IP addresses.
   */
  public async validateUrlSecurity(rawUrl: string): Promise<URL> {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw AppError.badRequest('A valid URL must be provided');
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      throw AppError.badRequest(`Invalid URL format: ${rawUrl}`);
    }

    // Protocol check
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw AppError.badRequest(
        `Unsupported protocol '${parsed.protocol}'. Only HTTP and HTTPS are permitted`,
      );
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check for obvious localhost / cloud metadata aliases
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === 'metadata.google.internal' ||
      hostname === 'instance-data'
    ) {
      throw AppError.badRequest('Access to internal hostnames or metadata endpoints is prohibited');
    }

    // Normalize bracketed IPv6 addresses, e.g. [::1] -> ::1
    const ipCheckHost =
      hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

    // If hostname is directly an IP address
    if (net.isIP(ipCheckHost)) {
      if (isPrivateOrRestrictedIp(ipCheckHost)) {
        throw AppError.badRequest(
          'Access to internal, loopback, or private IP addresses is prohibited',
        );
      }
      return parsed;
    }

    // Resolve domain name via DNS and check all IP addresses
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      if (!addresses || addresses.length === 0) {
        throw AppError.badRequest(`Could not resolve domain name: ${hostname}`);
      }

      for (const entry of addresses) {
        if (isPrivateOrRestrictedIp(entry.address)) {
          throw AppError.badRequest(
            `Target host '${hostname}' resolved to private/restricted IP (${entry.address})`,
          );
        }
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.badRequest(
        `DNS resolution failed for '${hostname}': ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return parsed;
  }

  /**
   * Safely fetches a public job page with redirect following, SSRF checks on each hop,
   * size limit, timeout, and content-type verification.
   */
  public async fetchPublicPage(rawUrl: string): Promise<RetrievedPage> {
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxBytes = this.options.maxBytes ?? DEFAULT_MAX_BYTES;
    const maxRedirects = this.options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

    let currentUrl = (await this.validateUrlSecurity(rawUrl)).toString();
    let redirectCount = 0;

    while (redirectCount <= maxRedirects) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const fetchFn =
          this.options.customFetcher ??
          ((u, init) => fetch(u, init as Parameters<typeof fetch>[1]));

        const response = await fetchFn(currentUrl, {
          method: 'GET',
          redirect: 'manual', // Manual handling to validate each redirect for SSRF
          signal: controller.signal,
          headers: {
            'User-Agent': USER_AGENT,
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.1',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });

        clearTimeout(timeoutId);

        // Handle redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          redirectCount++;
          if (redirectCount > maxRedirects) {
            throw AppError.badRequest(`Too many redirects (exceeded limit of ${maxRedirects})`);
          }

          const location = response.headers.get('location');
          if (!location) {
            throw AppError.badRequest(
              `Redirect status ${response.status} returned without Location header`,
            );
          }

          // Resolve relative redirect against current URL
          const nextUrl = new URL(location, currentUrl).toString();

          // Validate target of redirect for SSRF!
          const validatedNext = await this.validateUrlSecurity(nextUrl);
          currentUrl = validatedNext.toString();
          continue;
        }

        if (response.status === 404 || response.status === 410) {
          throw AppError.notFound(`Job posting not found or expired (HTTP ${response.status})`);
        }

        if (response.status === 403 || response.status === 429) {
          throw AppError.badRequest(
            `Access to job page was blocked or rate limited by provider (HTTP ${response.status})`,
          );
        }

        if (response.status >= 400) {
          throw AppError.badRequest(`HTTP retrieval error from source (HTTP ${response.status})`);
        }

        // Validate content-type
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        const isHtmlOrText =
          contentType.includes('text/html') ||
          contentType.includes('application/xhtml+xml') ||
          contentType.includes('text/plain') ||
          contentType.includes('application/json'); // Some modern ATS endpoints serve JSON

        if (contentType && !isHtmlOrText) {
          throw AppError.badRequest(
            `Unsupported content type: ${contentType}. Only HTML and text job postings are supported.`,
          );
        }

        // Read text and check size
        let bodyText: string;
        if (response.body) {
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let totalBytes = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              totalBytes += value.length;
              if (totalBytes > maxBytes) {
                reader.cancel();
                throw AppError.badRequest(`Job page exceeded maximum allowed size of 2MB`);
              }
              chunks.push(value);
            }
          }

          const decoder = new TextDecoder('utf-8');
          bodyText = chunks.map((c) => decoder.decode(c, { stream: true })).join('');
        } else {
          bodyText = await response.text();
          if (Buffer.byteLength(bodyText, 'utf8') > maxBytes) {
            throw AppError.badRequest(`Job page exceeded maximum allowed size of 2MB`);
          }
        }

        return {
          url: rawUrl,
          finalUrl: currentUrl,
          content: bodyText,
          contentType: contentType || 'text/html',
          statusCode: response.status,
        };
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof AppError) throw err;
        if ((err as Error)?.name === 'AbortError') {
          throw AppError.badRequest(`HTTP request timed out after ${timeoutMs}ms`);
        }
        throw AppError.badRequest(
          `Failed to retrieve job page: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    throw AppError.badRequest(`Exceeded maximum redirect limit (${maxRedirects})`);
  }
}
