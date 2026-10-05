/**
 * Clean and sanitize HTML for job descriptions and requirements to prevent XSS.
 * Removes script tags, iframes, styles, event handlers, and javascript: links.
 */

const DANGEROUS_TAGS_REGEX =
  /<(?:script|style|iframe|object|embed|applet|form|input|button|meta|link|svg|math)[^>]*>[\s\S]*?<\/(?:script|style|iframe|object|embed|applet|form|input|button|meta|link|svg|math)>|<(?:script|style|iframe|object|embed|applet|form|input|button|meta|link|svg|math)[^>]*\/?>/gi;

const DANGEROUS_ATTRIBUTES_REGEX =
  /\s*(?:on[a-z]+|javascript:|vbscript:|data:text\/html)[^=>]*=(?:'[^']*'|"[^"]*"|[^\s>]+)/gi;

const DISALLOWED_HREF_REGEX = /href\s*=\s*(['"])\s*(?:javascript:|data:|vbscript:)[^'"]*\1/gi;

export function sanitizeJobHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  let sanitized = rawHtml;

  // 1. Remove dangerous elements and their contents
  sanitized = sanitized.replace(DANGEROUS_TAGS_REGEX, '');

  // 2. Remove inline event handlers (onerror, onload, onclick, etc.)
  sanitized = sanitized.replace(DANGEROUS_ATTRIBUTES_REGEX, '');

  // 3. Remove javascript: or data: URIs in href
  sanitized = sanitized.replace(DISALLOWED_HREF_REGEX, 'href="#"');

  // 4. Ensure external links have safe rel attributes
  sanitized = sanitized.replace(/<a\s+([^>]*?)>/gi, (match, attrs) => {
    if (!/rel=/i.test(attrs)) {
      return `<a ${attrs} rel="noopener noreferrer" target="_blank">`;
    }
    return match;
  });

  return sanitized.trim();
}

/**
 * Strips all HTML tags and decodes common entities to obtain clean plain text.
 */
export function stripHtmlToText(html: string): string {
  if (!html) return '';

  let text = html;

  // Remove script/style contents completely
  text = text.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Replace block elements and line breaks with newlines
  text = text.replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/blockquote|hr)[^>]*>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '• ');

  // Remove remaining tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode basic HTML entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));

  // Normalize whitespace: collapse multiple horizontal spaces, limit consecutive newlines to 2
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n');

  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}
