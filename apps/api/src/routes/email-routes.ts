import type { FastifyPluginAsync } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { getDb, emailAccounts, emailMessages, jobs } from '@job-agent/database';
import { AppError } from '@job-agent/shared';
import type { CandidateService } from '../services/candidate-service.js';
import type { EmailSyncService } from '../services/email/email-sync-service.js';
import type { EmailReviewService } from '../services/email/email-review-service.js';
import type { OAuthStateService } from '../services/email/oauth-state-service.js';
import type { TokenCryptoService } from '../services/email/token-crypto-service.js';
import {
  connectUrlSchema,
  fixtureConnectSchema,
  syncAccountSchema,
  listMessagesQuerySchema,
  resolveReviewItemSchema,
} from './email-schemas.js';
import { requireCurrentUserId } from '../plugins/auth-plugin.js';

export function createEmailRoutes(options: {
  candidateService?: CandidateService;
  emailSyncService: EmailSyncService;
  emailReviewService: EmailReviewService;
  oauthStateService: OAuthStateService;
  tokenCryptoService: TokenCryptoService;
}): FastifyPluginAsync {
  const { emailSyncService, emailReviewService, oauthStateService, tokenCryptoService } = options;

  return async (app) => {
    const getUserId = async (req?: any) => requireCurrentUserId(req);
    const db = getDb();

    // 1. List connected email accounts
    app.get('/email/accounts', async () => {
      const userId = await getUserId();
      const accounts = await db
        .select({
          id: emailAccounts.id,
          provider: emailAccounts.provider,
          emailAddress: emailAccounts.emailAddress,
          status: emailAccounts.status,
          lastSyncAt: emailAccounts.lastSyncAt,
          syncCursor: emailAccounts.syncCursor,
          tokenExpiresAt: emailAccounts.tokenExpiresAt,
          errorMessage: emailAccounts.errorMessage,
          createdAt: emailAccounts.createdAt,
          updatedAt: emailAccounts.updatedAt,
        })
        .from(emailAccounts)
        .where(eq(emailAccounts.userId, userId))
        .orderBy(desc(emailAccounts.createdAt));

      return {
        status: 'ok',
        data: accounts.map((acc) => ({
          ...acc,
          lastSyncAt: acc.lastSyncAt?.toISOString() || null,
          tokenExpiresAt: acc.tokenExpiresAt?.toISOString() || null,
          createdAt: acc.createdAt.toISOString(),
          updatedAt: acc.updatedAt.toISOString(),
        })),
        timestamp: new Date().toISOString(),
      };
    });

    // 2. Generate authorization URL for connecting account
    app.post('/email/accounts/connect-url', async (req) => {
      const userId = await getUserId();
      const body = connectUrlSchema.parse(req.body || {});
      const state = await oauthStateService.generateState(userId, body.provider);
      const provider = emailSyncService.getProvider(body.provider);
      const authorizationUrl = provider.getAuthorizationUrl(state);

      return {
        status: 'ok',
        data: {
          authorizationUrl,
          provider: body.provider,
          state,
        },
        timestamp: new Date().toISOString(),
      };
    });

    // 3. Connect Fixture account directly for local demo / testing without external OAuth
    app.post('/email/accounts/fixture-connect', async (req, reply) => {
      const userId = await getUserId();
      const body = fixtureConnectSchema.parse(req.body || {});
      const emailAddress = body.emailAddress || 'bek.fixture.candidate@example.com';

      const fixtureProvider = emailSyncService.getProvider('FIXTURE');
      const exchanged = await fixtureProvider.exchangeCodeForTokens('fixture-code');
      const encryptedTokens = tokenCryptoService.encrypt(exchanged.tokens);

      const [account] = await db
        .insert(emailAccounts)
        .values({
          userId,
          provider: 'FIXTURE',
          emailAddress,
          encryptedTokens,
          grantedScopes: exchanged.grantedScopes,
          status: 'CONNECTED',
          tokenExpiresAt: exchanged.tokenExpiresAt,
        })
        .onConflictDoUpdate({
          target: [emailAccounts.userId, emailAccounts.emailAddress],
          set: {
            encryptedTokens,
            status: 'CONNECTED',
            errorMessage: null,
            updatedAt: new Date(),
          },
        })
        .returning();

      reply.status(201);
      return {
        status: 'ok',
        data: {
          id: account!.id,
          provider: account!.provider,
          emailAddress: account!.emailAddress,
          status: account!.status,
          createdAt: account!.createdAt.toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    });

    // 4. OAuth callback handler
    const handleOAuthCallback = async (req: any, reply: any) => {
      const { code, state, error } = req.query;

      if (error) {
        throw AppError.badRequest(`OAuth provider returned error: ${error}`);
      }
      if (!code || !state) {
        throw AppError.badRequest('Missing code or state parameter in OAuth callback');
      }

      // Verify CSRF state token with atomic consumption
      const { userId } = await oauthStateService.verifyAndConsumeState(state, 'GMAIL');

      const provider = emailSyncService.getProvider('GMAIL');
      const exchanged = await provider.exchangeCodeForTokens(code);
      const encryptedTokens = tokenCryptoService.encrypt(exchanged.tokens);

      const [account] = await db
        .insert(emailAccounts)
        .values({
          userId,
          provider: 'GMAIL',
          emailAddress: exchanged.emailAddress,
          encryptedTokens,
          grantedScopes: exchanged.grantedScopes,
          status: 'CONNECTED',
          tokenExpiresAt: exchanged.tokenExpiresAt,
        })
        .onConflictDoUpdate({
          target: [emailAccounts.userId, emailAccounts.emailAddress],
          set: {
            encryptedTokens,
            status: 'CONNECTED',
            errorMessage: null,
            tokenExpiresAt: exchanged.tokenExpiresAt,
            updatedAt: new Date(),
          },
        })
        .returning();

      // Redirect to web application with success parameter
      return reply.redirect('/email?connected=true&accountId=' + account!.id);
    };

    app.get('/email/oauth/callback', handleOAuthCallback);
    app.get('/email/accounts/gmail/callback', handleOAuthCallback);

    // 5. Trigger manual synchronization for an account
    app.post('/email/accounts/:accountId/sync', async (req: any) => {
      const userId = await getUserId();
      const accountId = req.params.accountId;
      const body = syncAccountSchema.parse(req.body || {});

      const result = await emailSyncService.syncAccount(userId, accountId, {
        trigger: 'MANUAL',
        lookbackDays: body.lookbackDays,
      });

      return {
        status: 'ok',
        data: result,
        timestamp: new Date().toISOString(),
      };
    });

    // 6. Disconnect / delete an email account
    app.delete('/email/accounts/:accountId', async (req: any) => {
      const userId = await getUserId();
      const accountId = req.params.accountId;
      const purge = req.query?.purge === 'true';

      const [account] = await db
        .select()
        .from(emailAccounts)
        .where(and(eq(emailAccounts.id, accountId), eq(emailAccounts.userId, userId)))
        .limit(1);

      if (!account) {
        throw AppError.notFound(`Email account ${accountId} not found`);
      }

      if (purge) {
        await db.delete(emailAccounts).where(eq(emailAccounts.id, accountId));
        return {
          status: 'ok',
          data: { id: account.id, emailAddress: account.emailAddress, status: 'PURGED' },
          timestamp: new Date().toISOString(),
        };
      }

      // Safe disconnect: revoke token material and set DISCONNECTED status, preserving intelligence history
      const neutralizedTokens = tokenCryptoService.encrypt({
        revoked: true,
        revokedAt: new Date().toISOString(),
      });

      const [updated] = await db
        .update(emailAccounts)
        .set({
          status: 'DISCONNECTED',
          encryptedTokens: neutralizedTokens,
          isSyncing: false,
          syncLockedAt: null,
          errorMessage: 'Account disconnected by user',
          updatedAt: new Date(),
        })
        .where(eq(emailAccounts.id, accountId))
        .returning();

      return {
        status: 'ok',
        data: { id: updated!.id, emailAddress: updated!.emailAddress, status: updated!.status },
        timestamp: new Date().toISOString(),
      };
    });

    // 7. High-level dashboard statistics
    app.get('/email/stats', async () => {
      const userId = await getUserId();
      const stats = await emailSyncService.getStats(userId);

      return {
        status: 'ok',
        data: stats,
        timestamp: new Date().toISOString(),
      };
    });

    // 8. List ingested messages
    app.get('/email/messages', async (req: any) => {
      const userId = await getUserId();
      const query = listMessagesQuerySchema.parse(req.query || {});

      const conditions = [eq(emailMessages.userId, userId)];
      if (query.accountId) conditions.push(eq(emailMessages.accountId, query.accountId));
      if (query.classification)
        conditions.push(eq(emailMessages.classification, query.classification));
      if (query.processingStatus)
        conditions.push(eq(emailMessages.processingStatus, query.processingStatus));
      if (query.linkedApplicationId)
        conditions.push(eq(emailMessages.linkedApplicationId, query.linkedApplicationId));

      const rows = await db
        .select({
          msg: emailMessages,
          jobTitle: jobs.title,
          company: jobs.company,
        })
        .from(emailMessages)
        .leftJoin(jobs, eq(emailMessages.linkedJobId, jobs.id))
        .where(and(...conditions))
        .orderBy(desc(emailMessages.receivedAt))
        .limit(query.limit)
        .offset(query.offset);

      const items = rows.map(({ msg, jobTitle, company }) => ({
        id: msg.id,
        accountId: msg.accountId,
        providerMessageId: msg.providerMessageId,
        providerThreadId: msg.providerThreadId,
        senderEmail: msg.senderEmail,
        senderName: msg.senderName,
        recipientEmail: msg.recipientEmail,
        subject: msg.subject,
        receivedAt: msg.receivedAt.toISOString(),
        snippet: msg.snippet,
        bodyText: msg.bodyText,
        classification: msg.classification as any,
        confidence: msg.confidence,
        classificationReason: msg.classificationReason,
        processingStatus: msg.processingStatus as any,
        linkedJobId: msg.linkedJobId,
        linkedApplicationId: msg.linkedApplicationId,
        linkedContactId: msg.linkedContactId,
        linkedJobTitle: jobTitle,
        linkedCompanyName: company,
        contentHash: msg.contentHash,
        rawMetadata: msg.rawMetadata as any,
        createdAt: msg.createdAt.toISOString(),
        updatedAt: msg.updatedAt.toISOString(),
      }));

      return {
        status: 'ok',
        data: items,
        timestamp: new Date().toISOString(),
      };
    });

    // 9. List pending email review items
    app.get('/email/review-queue', async (req: any) => {
      const userId = await getUserId();
      const status = req.query?.status;
      const items = await emailReviewService.listReviewItems(userId, { status });

      return {
        status: 'ok',
        data: items,
        timestamp: new Date().toISOString(),
      };
    });

    // 10. Resolve review item
    app.post('/email/review-queue/:id/resolve', async (req: any) => {
      const userId = await getUserId();
      const reviewItemId = req.params.id;
      const body = resolveReviewItemSchema.parse(req.body);

      const resolved = await emailReviewService.resolveReviewItem(
        userId,
        reviewItemId,
        body.resolution,
        {
          resolutionNote: body.resolutionNote,
          overrideTargetStatus: body.overrideTargetStatus as any,
          overrideApplicationId: body.overrideApplicationId,
        },
      );

      return {
        status: 'ok',
        data: resolved,
        timestamp: new Date().toISOString(),
      };
    });
  };
}
