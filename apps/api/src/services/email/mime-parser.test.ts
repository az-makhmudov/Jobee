import { describe, it, expect } from 'vitest';
import { MimeParser, type GmailMessageResource } from './mime-parser.js';

describe('MimeParser', () => {
  it('parses address headers with or without names', () => {
    expect(MimeParser.parseAddress('John Doe <john@example.com>')).toEqual({
      name: 'John Doe',
      email: 'john@example.com',
    });
    expect(MimeParser.parseAddress('"Jane Doe" <JANE@EXAMPLE.COM>')).toEqual({
      name: 'Jane Doe',
      email: 'jane@example.com',
    });
    expect(MimeParser.parseAddress('plain@example.com')).toEqual({
      email: 'plain@example.com',
    });
  });

  it('parses comma-separated address lists', () => {
    const list = MimeParser.parseAddressList('Alice <alice@a.com>, Bob <bob@b.com>');
    expect(list).toEqual(['alice@a.com', 'bob@b.com']);
  });

  it('strips email replies and quote markers', () => {
    const thread = `Hi Bek,

Looking forward to our chat tomorrow.

On Thu, Oct 8, 2026 at 10:00 AM Bek wrote:
> Hi Sarah,
> Sounds great, see you then!
`;
    const cleaned = MimeParser.stripQuotedReplies(thread);
    expect(cleaned).toBe('Hi Bek,\n\nLooking forward to our chat tomorrow.');
  });

  it('converts HTML to readable plain text', () => {
    const html = '<div><p>Hello <b>World</b>!</p><br><p>Second paragraph.</p></div>';
    const text = MimeParser.htmlToPlainText(html);
    expect(text).toContain('Hello World!');
    expect(text).toContain('Second paragraph.');
  });

  it('parses a full GmailMessageResource accurately', () => {
    const sampleResource: GmailMessageResource = {
      id: 'msg-12345',
      threadId: 'th-999',
      snippet: 'Welcome to Acme',
      payload: {
        mimeType: 'multipart/alternative',
        headers: [
          { name: 'Subject', value: 'Welcome to Acme' },
          { name: 'From', value: 'HR <hr@acme.com>' },
          { name: 'To', value: 'candidate@example.com' },
          { name: 'Date', value: 'Fri, 08 Oct 2026 12:00:00 GMT' },
        ],
        parts: [
          {
            mimeType: 'text/plain',
            body: {
              size: 24,
              data: Buffer.from('Welcome to Acme Corp!').toString('base64url'),
            },
          },
        ],
      },
    };

    const parsed = MimeParser.parseGmailMessage(sampleResource);
    expect(parsed.externalId).toBe('msg-12345');
    expect(parsed.externalThreadId).toBe('th-999');
    expect(parsed.subject).toBe('Welcome to Acme');
    expect(parsed.from.email).toBe('hr@acme.com');
    expect(parsed.from.name).toBe('HR');
    expect(parsed.to).toEqual(['candidate@example.com']);
    expect(parsed.plainText).toBe('Welcome to Acme Corp!');
  });
});
