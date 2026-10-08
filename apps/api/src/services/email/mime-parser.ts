import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import type { NormalizedEmailMessage } from '@job-agent/shared';

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailPart {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    size: number;
    data?: string;
  };
  parts?: GmailPart[];
}

export interface GmailMessageResource {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload: GmailPart;
}

export class MimeParser {
  /**
   * Parse a recipient or sender string like 'John Doe <john@acme.com>' or 'john@acme.com'
   */
  public static parseAddress(raw: string): { email: string; name?: string } {
    if (!raw) return { email: '' };

    const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/);
    if (match) {
      const name = match[1]?.trim();
      const email = match[2]?.trim().toLowerCase() || '';
      return { email, name: name || undefined };
    }

    return { email: raw.trim().toLowerCase() };
  }

  /**
   * Parse a comma-separated list of addresses
   */
  public static parseAddressList(raw?: string): string[] {
    if (!raw) return [];
    return raw
      .split(',')
      .map((item) => this.parseAddress(item.trim()).email)
      .filter((email) => email.length > 0);
  }

  /**
   * Strips email reply threads, forwarded quotation chains, and '>' quote lines.
   */
  public static stripQuotedReplies(text: string): string {
    if (!text) return '';

    // Split at common reply marker boundaries
    const replyMarkerRegexes = [
      /\n\s*On\s+.+?at\s+.+?,\s+.+?\s+wrote:\s*\n/is,
      /\n\s*On\s+.+?wrote:\s*\n/is,
      /\n\s*-----Original Message-----\s*\n/is,
      /\n\s*_{5,}\s*\n/is,
      /\n\s*From:\s+.+?\nSent:\s+.+?\n/is,
      /\n\s*From:\s+.+?\nDate:\s+.+?\n/is,
    ];

    let cleaned = text;
    for (const regex of replyMarkerRegexes) {
      const parts = cleaned.split(regex);
      if (parts.length > 1) {
        cleaned = parts[0]!;
      }
    }

    // Filter out lines that start with '>'
    cleaned = cleaned
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('>'))
      .join('\n');

    return cleaned.trim();
  }

  /**
   * Cleans HTML markup into clear readable plain text
   */
  public static htmlToPlainText(html: string): string {
    if (!html) return '';
    try {
      const $ = cheerio.load(html);
      // Remove style, script, noscript
      $('style, script, noscript').remove();
      // Replace breaks and paragraphs with newlines
      $('br').replaceWith('\n');
      $('p, div, tr').each((_, el) => {
        $(el).append('\n');
      });
      return $('body')
        .text()
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    } catch {
      // Fallback simple regex tag strip
      return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }
  }

  /**
   * Extracts headers and bodies recursively from a Gmail message payload
   */
  public static parseGmailMessage(resource: GmailMessageResource): NormalizedEmailMessage {
    const headers = resource.payload.headers || [];
    const getHeader = (name: string): string =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const subject = getHeader('subject') || '(No Subject)';
    const fromRaw = getHeader('from') || '';
    const toRaw = getHeader('to') || '';
    const ccRaw = getHeader('cc') || '';
    const dateRaw = getHeader('date') || '';

    const from = this.parseAddress(fromRaw);
    const to = this.parseAddressList(toRaw);
    const cc = this.parseAddressList(ccRaw);

    let receivedAt = dateRaw ? new Date(dateRaw) : new Date();
    if (isNaN(receivedAt.getTime()) && resource.internalDate) {
      receivedAt = new Date(parseInt(resource.internalDate, 10));
    }
    if (isNaN(receivedAt.getTime())) {
      receivedAt = new Date();
    }

    let plainText = '';
    let htmlText = '';
    let hasAttachments = false;

    const extractPart = (part: GmailPart): void => {
      const mime = part.mimeType.toLowerCase();
      if (part.filename && part.filename.length > 0) {
        hasAttachments = true;
      }

      if (mime === 'text/plain' && part.body?.data && !plainText) {
        plainText = Buffer.from(part.body.data, 'base64url').toString('utf8');
      } else if (mime === 'text/html' && part.body?.data && !htmlText) {
        htmlText = Buffer.from(part.body.data, 'base64url').toString('utf8');
      }

      if (part.parts && part.parts.length > 0) {
        for (const subPart of part.parts) {
          extractPart(subPart);
        }
      }
    };

    extractPart(resource.payload);

    // If no plain text was found, convert html to plain text
    if (!plainText && htmlText) {
      plainText = this.htmlToPlainText(htmlText);
    }

    // Strip reply history from plain text
    const cleanPlainText = this.stripQuotedReplies(plainText);

    return {
      externalId: resource.id,
      externalThreadId: resource.threadId,
      from,
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject,
      receivedAt,
      snippet: resource.snippet || cleanPlainText.slice(0, 160),
      plainText: cleanPlainText,
      sanitizedHtml: htmlText || undefined,
      labels: resource.labelIds || [],
      provider: 'GMAIL',
      providerMetadata: {
        historyId: resource.historyId,
      },
      hasAttachments,
    };
  }

  /**
   * Generates a deterministic content hash for idempotency checking
   */
  public static computeContentHash(message: {
    from: { email: string };
    subject: string;
    receivedAt: Date;
    plainText: string;
  }): string {
    const raw = `${message.from.email.toLowerCase()}|${message.subject.trim().toLowerCase()}|${message.receivedAt.toISOString()}|${message.plainText.trim()}`;
    return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
  }
}
