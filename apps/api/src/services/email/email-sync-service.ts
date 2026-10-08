import { eq, and, desc, sql } from 'drizzle-orm';
import {
  getDb,
  emailAccounts,
  emailMessages,
  emailReviewItems,
  emailSyncRuns,
  emailThreadLinks,
  applications,
  type Database,
} from '@job-agent/database';
import {
  AppError,
  createLogger,
  EmailClassificationType,
  EmailProcessingStatus,
  EmailProposedAction,
  EmailReviewStatus,
  EmailRiskLevel,
  EmailSyncRunStatus,
  type EmailSyncStatsDto,
} from '@job-agent/shared';
import { type EmailProvider } from './email-provider.js';
import { GmailProvider } from './gmail-provider.js';
import { FixtureEmailProvider } from './fixture-email-provider.js';
import { TokenCryptoService } from './token-crypto-service.js';
import { MimeParser } from './mime-parser.js';
import { EmailClassificationEngine } from './email-classification-engine.js';
import { EmailEntityResolver } from './email-entity-resolver.js';
import { JobAlertParser } from './job-alert-parser.js';
import { JobService } from '../job-service.js';
import { ApplicationCrmService } from '../application-crm-service.js';
import type { AppConfig } from '@job-agent/config';

const logger = createLogger({ service: 'api' });

export class EmailSyncService {
  private db: Database;
  private config: AppConfig;
  private cryptoService: TokenCryptoService;
  private classificationEngine: EmailClassificationEngine;
  private jobService: JobService;
  private fixtureProvider: FixtureEmailProvider;

  constructor(
    config: AppConfig,
    options?: {
      db?: Database;
      fixtureProvider?: FixtureEmailProvider;
    },
  ) {
    this.config = config;
    this.db = options?.db ?? getDb();
    this.cryptoService = new TokenCryptoService(config.EMAIL_TOKEN_ENCRYPTION_KEY);
    this.classificationEngine = new EmailClassificationEngine(config.GEMINI_API_KEY);
    this.jobService = new JobService(this.db);
    this.fixtureProvider = options?.fixtureProvider ?? new FixtureEmailProvider();
  }

  public getProvider(providerName: string): EmailProvider {
    if (providerName === 'FIXTURE') {
      return this.fixtureProvider;
    }

    return new GmailProvider({
      clientId: this.config.GMAIL_CLIENT_ID,
      clientSecret: this.config.GMAIL_CLIENT_SECRET,
      redirectUri: this.config.GMAIL_REDIRECT_URI,
    });
  }

  public getWebOrigin(): string {
    return this.config.WEB_ORIGIN;
  }

  public getFixtureProvider(): FixtureEmailProvider {
    return this.fixtureProvider;
  }

  /**
   * Synchronize an email account by fetching recent messages, classifying, resolving entities,
   * applying deterministic CRM status transitions, and routing uncertain cases to review.
   */
  public async syncAccount(
    userId: string,
    accountId: string,
    options: { trigger?: string; lookbackDays?: number } = {},
  ): Promise<{
    syncRunId: string;
    messagesFound: number;
    messagesIngested: number;
    autoSyncedCount: number;
    reviewItemsCreated: number;
    jobsDiscoveredCount: number;
  }> {
    // 1. Atomic concurrency lock on account row (claim lock where isSyncing is false or lock expired > 5m ago)
    const [lockedAccount] = await this.db
      .update(emailAccounts)
      .set({
        isSyncing: true,
        syncLockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(emailAccounts.id, accountId),
          eq(emailAccounts.userId, userId),
          sql`(${emailAccounts.isSyncing} = false OR ${emailAccounts.syncLockedAt} < NOW() - INTERVAL '5 minutes')`,
        ),
      )
      .returning();

    if (!lockedAccount) {
      const [existing] = await this.db
        .select({ id: emailAccounts.id, status: emailAccounts.status })
        .from(emailAccounts)
        .where(and(eq(emailAccounts.id, accountId), eq(emailAccounts.userId, userId)))
        .limit(1);

      if (!existing) {
        throw AppError.notFound(`Email account ${accountId} not found`);
      }
      throw AppError.conflict('Email synchronization is already in progress for this account');
    }

    if (lockedAccount.status === 'DISCONNECTED') {
      await this.db
        .update(emailAccounts)
        .set({ isSyncing: false, syncLockedAt: null })
        .where(eq(emailAccounts.id, accountId));
      throw AppError.badRequest('Cannot sync disconnected email account');
    }

    if (lockedAccount.status === 'REAUTH_REQUIRED') {
      await this.db
        .update(emailAccounts)
        .set({ isSyncing: false, syncLockedAt: null })
        .where(eq(emailAccounts.id, accountId));
      throw AppError.unauthorized('Email account requires re-authentication before syncing');
    }

    // 2. Create a sync run record
    const [syncRun] = await this.db
      .insert(emailSyncRuns)
      .values({
        accountId,
        userId,
        trigger: options.trigger || 'MANUAL',
        status: EmailSyncRunStatus.IN_PROGRESS,
        startedAt: new Date(),
      })
      .returning();

    if (!syncRun) {
      await this.db
        .update(emailAccounts)
        .set({ isSyncing: false, syncLockedAt: null })
        .where(eq(emailAccounts.id, accountId));
      throw AppError.internal('Failed to create sync run log');
    }

    let messagesFound = 0;
    let messagesIngested = 0;
    let autoSyncedCount = 0;
    let reviewItemsCreated = 0;
    let jobsDiscoveredCount = 0;

    try {
      // 3. Obtain decrypted OAuth tokens and provider instance
      let tokens = this.cryptoService.decrypt<any>(lockedAccount.encryptedTokens);
      if (tokens?.revoked) {
        throw AppError.unauthorized('Account tokens have been revoked. Please re-authenticate.');
      }

      const provider = this.getProvider(lockedAccount.provider);

      // Check if token is expired or close to expiry (within 60 seconds)
      const isTokenExpired =
        lockedAccount.tokenExpiresAt &&
        Date.now() >= lockedAccount.tokenExpiresAt.getTime() - 60000;

      if (isTokenExpired && lockedAccount.provider !== 'FIXTURE') {
        try {
          const refreshed = await provider.refreshTokens(tokens);
          tokens = refreshed.tokens;
          await this.db
            .update(emailAccounts)
            .set({
              encryptedTokens: this.cryptoService.encrypt(tokens),
              tokenExpiresAt: refreshed.tokenExpiresAt,
              status: 'CONNECTED',
              errorMessage: null,
              updatedAt: new Date(),
            })
            .where(eq(emailAccounts.id, accountId));
        } catch (refreshErr) {
          const errMsg = (refreshErr as Error).message;
          if (errMsg.includes('invalid_grant') || errMsg.includes('revoked')) {
            await this.db
              .update(emailAccounts)
              .set({
                status: 'REAUTH_REQUIRED',
                errorMessage: 'OAuth refresh token expired or revoked. Please re-authenticate.',
                updatedAt: new Date(),
              })
              .where(eq(emailAccounts.id, accountId));
            throw AppError.unauthorized(
              'Email account authorization has expired. Re-authentication required.',
            );
          }
          throw refreshErr;
        }
      }

      // 4. Fetch messages from provider with bounded lookback
      const DEFAULT_LOOKBACK_DAYS = 30;
      const MAX_LOOKBACK_DAYS = 60;
      const lookbackDays = Math.min(
        Math.max(options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS, 1),
        MAX_LOOKBACK_DAYS,
      );

      const since = lockedAccount.lastSyncAt
        ? lockedAccount.lastSyncAt
        : new Date(Date.now() - lookbackDays * 86400 * 1000);

      const fetchResult = await provider.fetchMessages({
        tokens,
        since,
        cursor: lockedAccount.syncCursor || undefined,
        maxResults: 50,
      });

      messagesFound = fetchResult.messages.length;

      // 5. Process each message
      for (const msg of fetchResult.messages) {
        const contentHash = MimeParser.computeContentHash(msg);

        // Check deduplication
        const [existingMsg] = await this.db
          .select({ id: emailMessages.id })
          .from(emailMessages)
          .where(
            and(
              eq(emailMessages.accountId, accountId),
              sql`(${emailMessages.providerMessageId} = ${msg.externalId} OR ${emailMessages.contentHash} = ${contentHash})`,
            ),
          )
          .limit(1);

        if (existingMsg) {
          // Already ingested, skip to preserve idempotency
          continue;
        }

        messagesIngested++;

        // A. Classify message (deterministic + optional AI fallback)
        const classification = await this.classificationEngine.classifyMessage(msg);

        // B. Resolve entities against candidate brain and CRM
        const resolution = await EmailEntityResolver.resolve({
          userId,
          accountId,
          message: msg,
          classification,
        });

        let processingStatus: EmailProcessingStatus = EmailProcessingStatus.PENDING;
        const linkedJobId = resolution.jobId || null;
        const linkedAppId = resolution.applicationId || null;
        const linkedContactId = resolution.contactId || null;

        // C. Record thread link if resolution succeeded
        if (msg.externalThreadId && (linkedAppId || linkedJobId)) {
          await this.db
            .insert(emailThreadLinks)
            .values({
              accountId,
              userId,
              providerThreadId: msg.externalThreadId,
              applicationId: linkedAppId,
              jobId: linkedJobId,
              company: resolution.matchedCompany || classification.extractedDetails.company,
              confirmedBy: 'AUTO',
            })
            .onConflictDoUpdate({
              target: [emailThreadLinks.accountId, emailThreadLinks.providerThreadId],
              set: {
                applicationId: linkedAppId,
                jobId: linkedJobId,
                updatedAt: new Date(),
              },
            });
        }

        // D. Deterministic Action & CRM State Authorization
        let createdReviewItem = false;

        switch (classification.classification) {
          case EmailClassificationType.JOB_ALERT: {
            const ingestRes = await JobAlertParser.ingestAlertJobs({
              userId,
              message: msg,
              jobService: this.jobService,
            });
            jobsDiscoveredCount += ingestRes.newJobsCount;
            processingStatus = EmailProcessingStatus.AUTO_SYNCED;
            break;
          }

          case EmailClassificationType.APPLICATION_CONFIRMATION: {
            if (linkedAppId && classification.confidence >= 0.85) {
              const [app] = await this.db
                .select()
                .from(applications)
                .where(eq(applications.id, linkedAppId))
                .limit(1);

              if (app && app.status === 'APPLIED') {
                await ApplicationCrmService.transitionStatus(userId, linkedAppId, {
                  targetStatus: 'CONFIRMATION_RECEIVED',
                  actor: 'SYSTEM',
                  reason: 'Application confirmation email received',
                  note: `Confirmation received from ${msg.from.name || msg.from.email}`,
                });

                if (
                  classification.extractedDetails.externalReferenceId &&
                  !app.externalReferenceId
                ) {
                  await this.db
                    .update(applications)
                    .set({
                      externalReferenceId: classification.extractedDetails.externalReferenceId,
                      updatedAt: new Date(),
                    })
                    .where(eq(applications.id, linkedAppId));
                }

                autoSyncedCount++;
                processingStatus = EmailProcessingStatus.AUTO_SYNCED;
              } else if (
                app &&
                [
                  'CONFIRMATION_RECEIVED',
                  'SCREENING',
                  'ASSESSMENT',
                  'INTERVIEW',
                  'FINAL_INTERVIEW',
                  'OFFER',
                ].includes(app.status)
              ) {
                // Idempotent: already confirmed or past confirmation
                processingStatus = EmailProcessingStatus.AUTO_SYNCED;
              } else {
                createdReviewItem = true;
              }
            } else {
              createdReviewItem = true;
            }
            break;
          }

          case EmailClassificationType.SCREENING_REQUEST: {
            if (linkedAppId && classification.confidence >= 0.85) {
              const [app] = await this.db
                .select()
                .from(applications)
                .where(eq(applications.id, linkedAppId))
                .limit(1);

              if (app && ['APPLIED', 'CONFIRMATION_RECEIVED'].includes(app.status)) {
                await ApplicationCrmService.transitionStatus(userId, linkedAppId, {
                  targetStatus: 'SCREENING',
                  actor: 'SYSTEM',
                  reason: 'Recruiter phone screening invitation received via email',
                  note: `Screening invitation from ${msg.from.name || msg.from.email}`,
                });
                autoSyncedCount++;
                processingStatus = EmailProcessingStatus.AUTO_SYNCED;
              } else if (
                app &&
                ['SCREENING', 'ASSESSMENT', 'INTERVIEW', 'FINAL_INTERVIEW', 'OFFER'].includes(
                  app.status,
                )
              ) {
                // Idempotent: already at screening or subsequent stage
                processingStatus = EmailProcessingStatus.AUTO_SYNCED;
              } else {
                createdReviewItem = true;
              }
            } else {
              createdReviewItem = true;
            }
            break;
          }

          case EmailClassificationType.ASSESSMENT_REQUEST: {
            if (linkedAppId && classification.confidence >= 0.85) {
              const [app] = await this.db
                .select()
                .from(applications)
                .where(eq(applications.id, linkedAppId))
                .limit(1);

              if (app && ['APPLIED', 'CONFIRMATION_RECEIVED', 'SCREENING'].includes(app.status)) {
                await ApplicationCrmService.transitionStatus(userId, linkedAppId, {
                  targetStatus: 'ASSESSMENT',
                  actor: 'SYSTEM',
                  reason: 'Technical assessment invitation received via email',
                  note: `Assessment request from ${msg.from.name || msg.from.email}`,
                });
                autoSyncedCount++;
                processingStatus = EmailProcessingStatus.AUTO_SYNCED;
              } else if (
                app &&
                ['ASSESSMENT', 'INTERVIEW', 'FINAL_INTERVIEW', 'OFFER'].includes(app.status)
              ) {
                // Idempotent: already at assessment or subsequent stage
                processingStatus = EmailProcessingStatus.AUTO_SYNCED;
              } else {
                createdReviewItem = true;
              }
            } else {
              createdReviewItem = true;
            }
            break;
          }

          case EmailClassificationType.INTERVIEW_CONFIRMATION:
          case EmailClassificationType.INTERVIEW_REQUEST: {
            if (linkedAppId && classification.confidence >= 0.85) {
              const [app] = await this.db
                .select()
                .from(applications)
                .where(eq(applications.id, linkedAppId))
                .limit(1);

              if (
                app &&
                ['APPLIED', 'CONFIRMATION_RECEIVED', 'SCREENING', 'ASSESSMENT'].includes(app.status)
              ) {
                await ApplicationCrmService.transitionStatus(userId, linkedAppId, {
                  targetStatus: 'INTERVIEW',
                  actor: 'SYSTEM',
                  reason: 'Interview invitation/confirmation received via email',
                  note: `Interview notice from ${msg.from.name || msg.from.email}`,
                });
                autoSyncedCount++;
                processingStatus = EmailProcessingStatus.AUTO_SYNCED;
              } else if (app && ['INTERVIEW', 'FINAL_INTERVIEW', 'OFFER'].includes(app.status)) {
                // Idempotent: already in interview/offer stage
                processingStatus = EmailProcessingStatus.AUTO_SYNCED;
              } else {
                createdReviewItem = true;
              }
            } else {
              createdReviewItem = true;
            }
            break;
          }

          case EmailClassificationType.APPLICATION_REJECTION: {
            // PRIME INVARIANT: Conservative Rejection handling
            // Only auto-transition if confidence >= 0.95 AND entity match is high certainty
            const isHighCertaintyMatch =
              linkedAppId &&
              ['EXTERNAL_REF', 'COMPANY_AND_ROLE'].includes(resolution.matchMethod) &&
              classification.confidence >= 0.95;

            if (isHighCertaintyMatch) {
              await ApplicationCrmService.transitionStatus(userId, linkedAppId, {
                targetStatus: 'REJECTED',
                actor: 'SYSTEM',
                reason: 'APPLICATION_REJECTED',
                note: `Rejection notice received from ${msg.from.name || msg.from.email}`,
              });
              autoSyncedCount++;
              processingStatus = EmailProcessingStatus.AUTO_SYNCED;
            } else {
              // Ambiguous or single-company match: escalate to human review queue
              createdReviewItem = true;
            }
            break;
          }

          case EmailClassificationType.OFFER_RELATED: {
            // Offers always require human approval to verify details
            createdReviewItem = true;
            break;
          }

          case EmailClassificationType.RECRUITER_OUTREACH: {
            createdReviewItem = true;
            break;
          }

          case EmailClassificationType.IRRELEVANT: {
            processingStatus = EmailProcessingStatus.IRRELEVANT;
            break;
          }

          default: {
            // UNKNOWN or ambiguous
            createdReviewItem = true;
            break;
          }
        }

        // E. Insert message record
        const [savedMsg] = await this.db
          .insert(emailMessages)
          .values({
            accountId,
            userId,
            providerMessageId: msg.externalId,
            providerThreadId: msg.externalThreadId,
            senderEmail: msg.from.email,
            senderName: msg.from.name || null,
            recipientEmail: msg.to[0] || null,
            subject: msg.subject,
            receivedAt: msg.receivedAt,
            snippet: msg.snippet,
            bodyText: msg.plainText,
            classification: classification.classification,
            confidence: classification.confidence,
            classificationReason: classification.reason,
            processingStatus: createdReviewItem
              ? EmailProcessingStatus.NEEDS_REVIEW
              : processingStatus,
            linkedJobId,
            linkedApplicationId: linkedAppId,
            linkedContactId,
            contentHash,
            rawMetadata: {
              labels: msg.labels,
              provider: msg.provider,
              extractedDetails: classification.extractedDetails,
              resolutionMethod: resolution.matchMethod,
            },
          })
          .returning();

        // F. Create Review Item if needed
        if (createdReviewItem && savedMsg) {
          reviewItemsCreated++;

          let proposedAction: EmailProposedAction = EmailProposedAction.NONE;
          let proposedTargetStatus: any = null;
          let riskLevel: EmailRiskLevel = EmailRiskLevel.LOW;

          if (classification.classification === EmailClassificationType.APPLICATION_REJECTION) {
            proposedAction = EmailProposedAction.SYNC_STATUS;
            proposedTargetStatus = 'REJECTED';
            riskLevel = EmailRiskLevel.HIGH;
          } else if (classification.classification === EmailClassificationType.OFFER_RELATED) {
            proposedAction = EmailProposedAction.SYNC_STATUS;
            proposedTargetStatus = 'OFFER';
            riskLevel = EmailRiskLevel.HIGH;
          } else if (classification.classification === EmailClassificationType.RECRUITER_OUTREACH) {
            proposedAction = linkedAppId
              ? EmailProposedAction.LINK_CONTACT
              : EmailProposedAction.CREATE_JOB;
            riskLevel = EmailRiskLevel.LOW;
          } else if (
            classification.classification === EmailClassificationType.INTERVIEW_CONFIRMATION
          ) {
            proposedAction = EmailProposedAction.PROPOSE_INTERVIEW;
            proposedTargetStatus = 'INTERVIEW';
            riskLevel = EmailRiskLevel.MEDIUM;
          } else if (classification.classification === EmailClassificationType.ASSESSMENT_REQUEST) {
            proposedAction = EmailProposedAction.CREATE_ASSESSMENT;
            proposedTargetStatus = 'ASSESSMENT';
            riskLevel = EmailRiskLevel.MEDIUM;
          } else if (classification.classification === EmailClassificationType.SCREENING_REQUEST) {
            proposedAction = EmailProposedAction.SYNC_STATUS;
            proposedTargetStatus = 'SCREENING';
            riskLevel = EmailRiskLevel.MEDIUM;
          } else if (
            classification.classification === EmailClassificationType.APPLICATION_CONFIRMATION
          ) {
            proposedAction = EmailProposedAction.SYNC_STATUS;
            proposedTargetStatus = 'CONFIRMATION_RECEIVED';
            riskLevel = EmailRiskLevel.LOW;
          } else if (
            classification.classification === EmailClassificationType.APPLICATION_UPDATE ||
            classification.classification === EmailClassificationType.UNKNOWN
          ) {
            proposedAction = EmailProposedAction.NONE;
            proposedTargetStatus = null;
            riskLevel = EmailRiskLevel.LOW;
          }

          await this.db.insert(emailReviewItems).values({
            userId,
            messageId: savedMsg.id,
            classification: classification.classification,
            confidence: classification.confidence,
            proposedAction,
            proposedTargetStatus,
            proposedApplicationId: linkedAppId,
            proposedJobId: linkedJobId,
            explanation: `Email classified as ${classification.classification} (confidence ${(classification.confidence * 100).toFixed(0)}%). Review required to confirm action.`,
            extractedDetails: classification.extractedDetails,
            riskLevel,
            status: EmailReviewStatus.PENDING,
          });
        }
      }

      // 6. Update account sync cursor and lastSyncAt (only after successful processing of batch)
      await this.db
        .update(emailAccounts)
        .set({
          lastSyncAt: new Date(),
          syncCursor: fetchResult.nextCursor || lockedAccount.syncCursor,
          status: 'CONNECTED',
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(emailAccounts.id, accountId));

      // 7. Complete the sync run log
      await this.db
        .update(emailSyncRuns)
        .set({
          status: EmailSyncRunStatus.COMPLETED,
          messagesFound,
          messagesIngested,
          autoSyncedCount,
          reviewItemsCreated,
          jobsDiscoveredCount,
          completedAt: new Date(),
        })
        .where(eq(emailSyncRuns.id, syncRun.id));

      logger.info('Email sync completed successfully', {
        accountId,
        messagesFound,
        messagesIngested,
        autoSyncedCount,
        reviewItemsCreated,
        jobsDiscoveredCount,
      });

      return {
        syncRunId: syncRun.id,
        messagesFound,
        messagesIngested,
        autoSyncedCount,
        reviewItemsCreated,
        jobsDiscoveredCount,
      };
    } catch (err) {
      const errorMessage = (err as Error).message;
      logger.error('Email sync failed', { accountId, error: errorMessage });

      await this.db
        .update(emailSyncRuns)
        .set({
          status: EmailSyncRunStatus.FAILED,
          errorMessage,
          completedAt: new Date(),
        })
        .where(eq(emailSyncRuns.id, syncRun.id));

      const isAuthError =
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('revoked') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('401');

      await this.db
        .update(emailAccounts)
        .set({
          status: isAuthError ? 'REAUTH_REQUIRED' : 'SYNC_ERROR',
          errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(emailAccounts.id, accountId));

      throw err;
    } finally {
      // Always release sync lock atomically
      await this.db
        .update(emailAccounts)
        .set({
          isSyncing: false,
          syncLockedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(emailAccounts.id, accountId));
    }
  }

  /**
   * Retrieves high level metrics for email intelligence dashboard.
   */
  public async getStats(userId: string): Promise<EmailSyncStatsDto> {
    const [accountsCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailAccounts)
      .where(and(eq(emailAccounts.userId, userId), eq(emailAccounts.status, 'CONNECTED')));

    const [messagesCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailMessages)
      .where(eq(emailMessages.userId, userId));

    const [pendingReview] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailReviewItems)
      .where(
        and(
          eq(emailReviewItems.userId, userId),
          eq(emailReviewItems.status, EmailReviewStatus.PENDING),
        ),
      );

    const [autoSynced] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.userId, userId),
          eq(emailMessages.processingStatus, EmailProcessingStatus.AUTO_SYNCED),
        ),
      );

    const [discoveredJobs] = await this.db
      .select({
        total: sql<number>`coalesce(sum(${emailSyncRuns.jobsDiscoveredCount}), 0)::int`,
      })
      .from(emailSyncRuns)
      .where(eq(emailSyncRuns.userId, userId));

    const [latestSync] = await this.db
      .select({ lastSyncAt: emailAccounts.lastSyncAt })
      .from(emailAccounts)
      .where(eq(emailAccounts.userId, userId))
      .orderBy(desc(emailAccounts.lastSyncAt))
      .limit(1);

    return {
      connectedAccountsCount: accountsCount?.count || 0,
      totalMessagesIngested: messagesCount?.count || 0,
      pendingReviewCount: pendingReview?.count || 0,
      autoSyncedUpdatesCount: autoSynced?.count || 0,
      jobsDiscoveredCount: discoveredJobs?.total || 0,
      lastSyncAt: latestSync?.lastSyncAt?.toISOString() || null,
    };
  }
}
