import { AppError } from '@job-agent/shared';
import type { NormalizedEmailMessage } from '@job-agent/shared';
import {
  type EmailProvider,
  type OAuthTokens,
  type FetchMessagesOptions,
  type FetchMessagesResult,
} from './email-provider.js';
import { MimeParser, type GmailMessageResource } from './mime-parser.js';

export interface GmailProviderConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri: string;
}

export class GmailProvider implements EmailProvider {
  public readonly name = 'GMAIL';
  private clientId?: string;
  private clientSecret?: string;
  private redirectUri: string;

  constructor(config: GmailProviderConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
  }

  public get isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  public getAuthorizationUrl(state: string): string {
    if (!this.clientId) {
      throw AppError.badRequest('GMAIL_CLIENT_ID is not configured in environment');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope:
        'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  public async exchangeCodeForTokens(code: string): Promise<{
    tokens: OAuthTokens;
    emailAddress: string;
    grantedScopes: string[];
    tokenExpiresAt?: Date;
  }> {
    if (!this.clientId || !this.clientSecret) {
      throw AppError.badRequest('Gmail OAuth client credentials are not configured');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw AppError.badRequest(`Failed to exchange authorization code: ${errText}`);
    }

    const data = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
    const grantedScopes = data.scope ? data.scope.split(' ') : [];

    // Fetch user email address
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });

    if (!userRes.ok) {
      throw AppError.badRequest('Failed to fetch user email address from Google');
    }

    const userData = (await userRes.json()) as { email: string };

    return {
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenType: data.token_type,
        expiresAt: tokenExpiresAt.toISOString(),
        scopes: grantedScopes,
      },
      emailAddress: userData.email.toLowerCase(),
      grantedScopes,
      tokenExpiresAt,
    };
  }

  public async refreshTokens(tokens: OAuthTokens): Promise<{
    tokens: OAuthTokens;
    tokenExpiresAt?: Date;
  }> {
    if (!this.clientId || !this.clientSecret) {
      throw AppError.badRequest('Gmail OAuth client credentials are not configured');
    }
    if (!tokens.refreshToken) {
      throw AppError.badRequest('No refresh token available to refresh access token');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw AppError.badRequest(`Failed to refresh OAuth token: ${errText}`);
    }

    const data = (await tokenRes.json()) as {
      access_token: string;
      expires_in: number;
      token_type: string;
    };

    const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    return {
      tokens: {
        ...tokens,
        accessToken: data.access_token,
        expiresAt: tokenExpiresAt.toISOString(),
      },
      tokenExpiresAt,
    };
  }

  public async fetchMessages(options: FetchMessagesOptions): Promise<FetchMessagesResult> {
    const { tokens, since, cursor, maxResults = 25 } = options;
    const queryParts: string[] = ['in:inbox'];

    if (since) {
      const epochSeconds = Math.floor(since.getTime() / 1000);
      queryParts.push(`after:${epochSeconds}`);
    }

    const params = new URLSearchParams({
      maxResults: String(maxResults),
      q: queryParts.join(' '),
    });
    if (cursor) {
      params.set('pageToken', cursor);
    }

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      },
    );

    if (!listRes.ok) {
      const errText = await listRes.text();
      throw AppError.badRequest(`Failed to query Gmail messages: ${errText}`);
    }

    const listData = (await listRes.json()) as {
      messages?: { id: string; threadId: string }[];
      nextPageToken?: string;
    };

    const messages: NormalizedEmailMessage[] = [];
    if (listData.messages && listData.messages.length > 0) {
      for (const item of listData.messages) {
        try {
          const msg = await this.getMessage(tokens, item.id);
          messages.push(msg);
        } catch {
          // If a single message fails to fetch, continue with others
        }
      }
    }

    return {
      messages,
      nextCursor: listData.nextPageToken,
      hasMore: Boolean(listData.nextPageToken),
    };
  }

  public async getMessage(tokens: OAuthTokens, messageId: string): Promise<NormalizedEmailMessage> {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      throw AppError.badRequest(`Failed to retrieve message ${messageId}: ${errText}`);
    }

    const raw = (await res.json()) as GmailMessageResource;
    return MimeParser.parseGmailMessage(raw);
  }
}
