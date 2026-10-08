import type { NormalizedEmailMessage } from '@job-agent/shared';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: string; // ISO date string
  scopes?: string[];
  [key: string]: unknown;
}

export interface FetchMessagesOptions {
  tokens: OAuthTokens;
  since?: Date;
  cursor?: string;
  maxResults?: number;
}

export interface FetchMessagesResult {
  messages: NormalizedEmailMessage[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface EmailProvider {
  readonly name: 'GMAIL' | 'FIXTURE';

  getAuthorizationUrl(state: string): string;

  exchangeCodeForTokens(code: string): Promise<{
    tokens: OAuthTokens;
    emailAddress: string;
    grantedScopes: string[];
    tokenExpiresAt?: Date;
  }>;

  refreshTokens(tokens: OAuthTokens): Promise<{
    tokens: OAuthTokens;
    tokenExpiresAt?: Date;
  }>;

  fetchMessages(options: FetchMessagesOptions): Promise<FetchMessagesResult>;

  getMessage(tokens: OAuthTokens, messageId: string): Promise<NormalizedEmailMessage>;
}
