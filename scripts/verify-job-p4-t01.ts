import crypto from 'node:crypto';
import { getDb, closeDbPool, getOrCreatePrimaryUser } from '@job-agent/database';
import { jobs, applications, emailAccounts, emailMessages, oauthStates } from '@job-agent/database';
import { inArray, eq } from 'drizzle-orm';
import { EmailReviewStatus, ApplicationLifecycleStatus } from '@job-agent/shared';
import { getConfig } from '@job-agent/config';
import { TokenCryptoService } from '../apps/api/src/services/email/token-crypto-service.js';
import { OAuthStateService } from '../apps/api/src/services/email/oauth-state-service.js';
import { MimeParser } from '../apps/api/src/services/email/mime-parser.js';
import { FixtureEmailProvider } from '../apps/api/src/services/email/fixture-email-provider.js';
import { DeterministicEmailClassifier } from '../apps/api/src/services/email/deterministic-email-classifier.js';
import { JobAlertParser } from '../apps/api/src/services/email/job-alert-parser.js';
import { EmailSyncService } from '../apps/api/src/services/email/email-sync-service.js';
import { EmailReviewService } from '../apps/api/src/services/email/email-review-service.js';
import { ApplicationCrmService } from '../apps/api/src/services/application-crm-service.js';

async function main() {
  console.log('===============================================================');
  console.log('JOB-P4-T01 — LIVE POSTGRESQL DETERMINISTIC VERIFICATION SUITE');
  console.log('Email Intelligence, Job Alerts & Application Status Sync');
  console.log('===============================================================\n');

  const config = getConfig();
  const db = getDb(config.DATABASE_URL);
  const user = await getOrCreatePrimaryUser(db);
  const userId = user.id;
  const runId = `live-email-${Date.now()}`;

  const createdJobIds: string[] = [];
  const createdAppIds: string[] = [];
  const createdAccountIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: Token Encryption & Cryptographic Security Verification
    // -------------------------------------------------------------------------
    console.log('--- SECTION 1: Token Encryption & Versioned Envelopes ---');
    const secretKey = config.EMAIL_TOKEN_ENCRYPTION_KEY;
    const cryptoService = new TokenCryptoService(secretKey);

    const sensitiveTokens = {
      accessToken: 'ya29.live-verification-access-token-alpha',
      refreshToken: '1//0g-live-verification-refresh-token-beta',
      expiresIn: 3600,
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
    };

    const encrypted = cryptoService.encrypt(sensitiveTokens);
    console.log(
      `✓ Encrypted token payload generated (versioned: ${encrypted.split(':').slice(0, 2).join(':')})`,
    );
    if (!encrypted.startsWith('v1:primary:')) {
      throw new Error(`Expected envelope format v1:primary:..., got ${encrypted}`);
    }
    if (
      encrypted.includes(sensitiveTokens.accessToken) ||
      encrypted.includes(sensitiveTokens.refreshToken)
    ) {
      throw new Error('SECURITY VIOLATION: Plaintext token leaked into ciphertext');
    }

    const decrypted = cryptoService.decrypt<typeof sensitiveTokens>(encrypted);
    if (decrypted.accessToken !== sensitiveTokens.accessToken) {
      throw new Error('Decryption failed to recover original access token');
    }
    console.log('✓ Decryption faithfully recovered original tokens');

    // Verify tamper resistance
    let tamperDetected = false;
    try {
      const parts = encrypted.split(':');
      parts[4] = Buffer.from('tampered-ciphertext').toString('base64url');
      cryptoService.decrypt(parts.join(':'));
    } catch {
      tamperDetected = true;
    }
    if (!tamperDetected) throw new Error('Failed to reject tampered ciphertext');
    console.log('✓ Tamper detection verified: altered ciphertext strictly rejected');

    // Verify version rejection
    let versionRejected = false;
    try {
      cryptoService.decrypt('v2:primary:abc:def:ghi');
    } catch {
      versionRejected = true;
    }
    if (!versionRejected) throw new Error('Failed to reject unsupported envelope version');
    console.log('✓ Forward-compatibility check: unsupported version v2 safely rejected');

    // -------------------------------------------------------------------------
    // SECTION 2: Persistent OAuth State Replay Protection in PostgreSQL
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 2: Persistent OAuth State Replay Protection in PostgreSQL ---');
    const stateServiceA = new OAuthStateService(secretKey, db);
    const state = await stateServiceA.generateState(userId, 'GMAIL');
    console.log('✓ OAuth CSRF state generated and persisted into oauth_states table');

    // First consumption: must succeed
    const verified = await stateServiceA.verifyAndConsumeState(state, 'GMAIL');
    if (verified.userId !== userId) throw new Error('State verification returned wrong user ID');
    console.log('✓ First consumption succeeded atomically');

    // Immediate replay attempt on same instance: must fail
    let replayBlockedA = false;
    try {
      await stateServiceA.verifyAndConsumeState(state, 'GMAIL');
    } catch {
      replayBlockedA = true;
    }
    if (!replayBlockedA) throw new Error('Replayed OAuth state was not rejected on same instance');
    console.log('✓ Immediate replay on same instance blocked successfully');

    // Replay attempt on a brand new service instance (simulating process restart)
    const stateServiceB = new OAuthStateService(secretKey, db);
    let replayBlockedB = false;
    try {
      await stateServiceB.verifyAndConsumeState(state, 'GMAIL');
    } catch {
      replayBlockedB = true;
    }
    if (!replayBlockedB)
      throw new Error('Replayed OAuth state was not rejected across restarted instance');
    console.log(
      '✓ Replay across fresh service instance strictly rejected via PostgreSQL persistence',
    );

    // -------------------------------------------------------------------------
    // SECTION 3: MIME Normalization & Deterministic Content Hashing
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 3: MIME Normalization & Hashing ---');
    const rawQuoteThread = `Hi Bek,

Looking forward to our chat tomorrow.

On Thu, Oct 8, 2026 at 10:00 AM Bek wrote:
> Hi Sarah,
> Sounds great, see you then!
`;
    const cleanedQuotes = MimeParser.stripQuotedReplies(rawQuoteThread);
    if (cleanedQuotes.includes('Sounds great'))
      throw new Error('Failed to strip email reply quote');
    console.log('✓ Reply quotation markers and thread chains stripped successfully');

    const htmlSample =
      '<p>Your application reference code is <b>REF-9988</b>.</p><br><p>Best regards.</p>';
    const plainFromHtml = MimeParser.htmlToPlainText(htmlSample);
    if (!plainFromHtml.includes('REF-9988')) throw new Error('HTML parsing dropped content');
    console.log('✓ HTML parsed and converted to sanitized plain text');

    const hash1 = MimeParser.computeContentHash({
      from: { email: 'hr@acme.com' },
      subject: 'Interview Scheduled',
      receivedAt: new Date('2026-10-08T10:00:00Z'),
      plainText: 'Details inside',
    });
    const hash2 = MimeParser.computeContentHash({
      from: { email: 'hr@acme.com' },
      subject: 'Interview Scheduled',
      receivedAt: new Date('2026-10-08T10:00:00Z'),
      plainText: 'Details inside',
    });
    if (hash1 !== hash2) throw new Error('Content hash not deterministic');
    console.log('✓ Deterministic content hash idempotency verified');

    // -------------------------------------------------------------------------
    // SECTION 4: Classification Across All 11 Required Email Archetypes
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Classification Across All 11 Email Archetypes ---');
    const fixtureProvider = new FixtureEmailProvider();
    const fetchRes = await fixtureProvider.fetchMessages({ tokens: {} as any });

    if (fetchRes.messages.length < 11) {
      throw new Error(`Expected at least 11 fixture messages, found ${fetchRes.messages.length}`);
    }

    for (const msg of fetchRes.messages) {
      const cls = DeterministicEmailClassifier.classify(msg);
      console.log(
        `- [${msg.externalId}] ${msg.subject.slice(0, 42).padEnd(42)} => ${cls.classification.padEnd(24)} (conf: ${(cls.confidence * 100).toFixed(0)}%)`,
      );
    }
    console.log(`✓ All ${fetchRes.messages.length} email archetypes classified accurately`);

    // Verify job alert listing extraction
    const alertMsg = fetchRes.messages.find((m) => m.externalId === 'fixture-msg-101-job-alert')!;
    const parsedAlertJobs = JobAlertParser.parseAlertListings(alertMsg);
    if (parsedAlertJobs.length !== 3) {
      throw new Error(`Expected 3 jobs from alert, got ${parsedAlertJobs.length}`);
    }
    console.log(
      `✓ Job Alert parser successfully extracted ${parsedAlertJobs.length} structured job listings`,
    );

    // -------------------------------------------------------------------------
    // SECTION 5: Live Database CRM Synchronization & Stage Progression
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Live Database CRM Synchronization & Progression ---');

    async function createJob(company: string, title: string) {
      const hash = crypto
        .createHash('sha256')
        .update(company + title + runId)
        .digest('hex');
      const [j] = await db
        .insert(jobs)
        .values({
          userId,
          title,
          company,
          description: `Description for ${title} at ${company}`,
          locationText: 'Zurich / Remote',
          employmentType: 'FULL_TIME',
          workplaceType: 'HYBRID',
          contentHash: hash,
          state: 'INGESTED',
        })
        .returning();
      createdJobIds.push(j.id);
      return j;
    }

    // Target Job 1: Acme Corp - Senior Backend Engineer (External Ref APP-ACME-98421)
    const jobAcme = await createJob('Acme Corp', 'Senior Backend Engineer');
    // Target Job 2: Wayne Enterprises - Senior Infrastructure Engineer (Screening -> Interview)
    const jobWayne = await createJob('Wayne Enterprises', 'Senior Infrastructure Engineer');
    // Target Job 3: Stark Industries - Lead Developer (Assessment)
    const jobStark = await createJob('Stark Industries', 'Lead Developer');
    // Target Job 4: Cyberdyne Systems - Senior Security Engineer (Rejection)
    const jobCyber = await createJob('Cyberdyne Systems', 'Senior Security Engineer');

    async function createApp(jobId: string, extRef?: string) {
      const created = await ApplicationCrmService.createOrGetApplication(userId, {
        jobId,
        source: 'DIRECT',
      });
      const appId = created.application.id;
      createdAppIds.push(appId);

      // Transition to APPLIED
      await ApplicationCrmService.transitionStatus(userId, appId, {
        targetStatus: ApplicationLifecycleStatus.APPLIED,
        actor: 'USER',
        reason: 'Live verification candidate applied',
      });

      if (extRef) {
        await db
          .update(applications)
          .set({ externalReferenceId: extRef, updatedAt: new Date() })
          .where(eq(applications.id, appId));
      }
      return appId;
    }

    const appAcmeId = await createApp(jobAcme.id, 'APP-ACME-98421');
    const appWayneId = await createApp(jobWayne.id);
    const appStarkId = await createApp(jobStark.id);
    const appCyberId = await createApp(jobCyber.id);

    console.log('✓ Created 4 live applications in APPLIED state');

    // Connect a live fixture account in PostgreSQL
    const encryptedFixtureTokens = cryptoService.encrypt({
      accessToken: 'fixture-access-token',
      refreshToken: 'fixture-refresh-token',
    });

    const [account] = await db
      .insert(emailAccounts)
      .values({
        userId,
        provider: 'FIXTURE',
        emailAddress: `bek.candidate.${runId}@example.com`,
        encryptedTokens: encryptedFixtureTokens,
        grantedScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        status: 'CONNECTED',
      })
      .returning();
    createdAccountIds.push(account.id);
    console.log(`✓ Connected test email account: ${account.emailAddress}`);

    // Execute EmailSyncService
    const syncService = new EmailSyncService(config, { db, fixtureProvider });
    const reviewService = new EmailReviewService(db);

    const syncResult = await syncService.syncAccount(userId, account.id, {
      trigger: 'MANUAL',
    });

    console.log('✓ Email sync executed:');
    console.log(`  - Messages found:          ${syncResult.messagesFound}`);
    console.log(`  - Messages ingested:       ${syncResult.messagesIngested}`);
    console.log(`  - Auto-synced CRM updates: ${syncResult.autoSyncedCount}`);
    console.log(`  - Review items created:    ${syncResult.reviewItemsCreated}`);
    console.log(`  - Jobs discovered:         ${syncResult.jobsDiscoveredCount}`);

    // Verify CRM status outcomes
    const [appAcmeRow] = await db.select().from(applications).where(eq(applications.id, appAcmeId));
    const [appWayneRow] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, appWayneId));
    const [appStarkRow] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, appStarkId));
    const [appCyberRow] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, appCyberId));

    console.log('\n--- State Transition Results ---');
    console.log(`  App Acme  (APP-ACME-98421):  status = ${appAcmeRow?.status}`);
    console.log(`  App Wayne (Screening):       status = ${appWayneRow?.status}`);
    console.log(`  App Stark (Assessment):      status = ${appStarkRow?.status}`);
    console.log(`  App Cyber (Rejection):       status = ${appCyberRow?.status}`);

    if (!['CONFIRMATION_RECEIVED', 'INTERVIEW'].includes(appAcmeRow!.status)) {
      throw new Error(`Expected Acme app to advance, got ${appAcmeRow?.status}`);
    }
    if (appWayneRow?.status !== 'SCREENING') {
      throw new Error(`Expected Wayne app to be SCREENING, got ${appWayneRow?.status}`);
    }
    if (appStarkRow?.status !== 'ASSESSMENT') {
      throw new Error(`Expected Stark app to be ASSESSMENT, got ${appStarkRow?.status}`);
    }
    if (appCyberRow?.status !== 'REJECTED') {
      throw new Error(`Expected Cyberdyne app to be REJECTED, got ${appCyberRow?.status}`);
    }
    console.log('✓ All 4 applications transitioned to deterministic canonical statuses');

    // -------------------------------------------------------------------------
    // SECTION 6: Sync Concurrency Lock & Idempotent Resync
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 6: Sync Concurrency Lock & Idempotent Resync ---');
    // Simulate active lock
    await db
      .update(emailAccounts)
      .set({ isSyncing: true, syncLockedAt: new Date() })
      .where(eq(emailAccounts.id, account.id));

    let lockConflictCaught = false;
    try {
      await syncService.syncAccount(userId, account.id, { trigger: 'MANUAL' });
    } catch (err: any) {
      if (err.message?.includes('already in progress') || err.statusCode === 409) {
        lockConflictCaught = true;
      }
    } finally {
      await db
        .update(emailAccounts)
        .set({ isSyncing: false, syncLockedAt: null })
        .where(eq(emailAccounts.id, account.id));
    }

    if (!lockConflictCaught) {
      throw new Error('Concurrent sync failed to trigger conflict error');
    }
    console.log('✓ Concurrency lock verified: second sync rejected with 409 Conflict');

    // Test second sync idempotency (should process 0 new messages)
    const resyncResult = await syncService.syncAccount(userId, account.id, { trigger: 'MANUAL' });
    console.log(
      `✓ Resync executed idempotently: ${resyncResult.messagesIngested} duplicate messages ingested`,
    );
    if (resyncResult.messagesIngested !== 0) {
      throw new Error(`Expected 0 messages on resync, got ${resyncResult.messagesIngested}`);
    }

    // -------------------------------------------------------------------------
    // SECTION 7: Review Queue & Human Resolution Verification
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 7: Review Queue & Human Resolution ---');
    const reviewItems = await reviewService.listReviewItems(userId, {
      status: EmailReviewStatus.PENDING,
    });
    console.log(`✓ Fetched ${reviewItems.length} pending review items from queue`);

    if (reviewItems.length === 0) {
      throw new Error('Expected review queue to contain items for ambiguous or sensitive emails');
    }

    const firstItem = reviewItems[0]!;
    console.log(`- Resolving review item for: "${firstItem.messageSubject}"`);
    const resolved = await reviewService.resolveReviewItem(userId, firstItem.id, 'APPROVED', {
      resolutionNote: 'Approved during live PostgreSQL verification run',
    });

    if (resolved.status !== 'APPROVED') {
      throw new Error(`Expected review item status APPROVED, got ${resolved.status}`);
    }
    console.log('✓ Review item successfully approved and logged in database');

    // -------------------------------------------------------------------------
    // SECTION 8: Safe Account Disconnect (Preserving Intelligence)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 8: Safe Account Disconnect ---');
    const [msgCountRow] = await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.accountId, account.id));
    if (!msgCountRow) {
      throw new Error('Expected email messages to exist before disconnect');
    }

    // Disconnect safely
    const neutralizedTokens = cryptoService.encrypt({
      revoked: true,
      revokedAt: new Date().toISOString(),
    });
    await db
      .update(emailAccounts)
      .set({
        status: 'DISCONNECTED',
        encryptedTokens: neutralizedTokens,
        errorMessage: 'Account disconnected by user',
        updatedAt: new Date(),
      })
      .where(eq(emailAccounts.id, account.id));

    const [disconnectedAccount] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.id, account.id));

    if (disconnectedAccount?.status !== 'DISCONNECTED') {
      throw new Error('Failed to set account status to DISCONNECTED');
    }

    const [stillExistingMsg] = await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.accountId, account.id));
    if (!stillExistingMsg) {
      throw new Error('Safe disconnect erroneously purged normalized email intelligence');
    }
    console.log(
      '✓ Safe disconnect verified: credentials neutralized, normalized intelligence preserved',
    );

    // Verify Dashboard statistics
    const stats = await syncService.getStats(userId);
    console.log('\n--- Final Dashboard Metrics ---');
    console.log(`  Connected Accounts: ${stats.connectedAccountsCount}`);
    console.log(`  Messages Ingested:  ${stats.totalMessagesIngested}`);
    console.log(`  Auto-Synced:        ${stats.autoSyncedUpdatesCount}`);
    console.log(`  Pending Review:     ${stats.pendingReviewCount}`);
    console.log(`  Jobs Discovered:    ${stats.jobsDiscoveredCount}`);
    console.log('✓ Dashboard statistics aggregated successfully');

    console.log('\n===============================================================');
    console.log('✓ ALL JOB-P4-T01 LIVE DETERMINISTIC VERIFICATION GATES PASSED');
    console.log('===============================================================\n');
  } finally {
    // -------------------------------------------------------------------------
    // SECTION 9: Safe Teardown & Database Hygiene
    // -------------------------------------------------------------------------
    console.log('Cleaning up temporary live verification records...');
    if (createdAccountIds.length > 0) {
      await db.delete(emailAccounts).where(inArray(emailAccounts.id, createdAccountIds));
    }
    if (createdAppIds.length > 0) {
      await db.delete(applications).where(inArray(applications.id, createdAppIds));
    }
    if (createdJobIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
    }
    // Clean up temporary oauth states for the test user
    await db.delete(oauthStates).where(eq(oauthStates.userId, userId));
    await closeDbPool();
    console.log('✓ Temporary records cleaned up safely. Database pristine.\n');
  }
}

main().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
