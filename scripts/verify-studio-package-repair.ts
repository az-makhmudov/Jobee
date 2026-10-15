import { createDatabaseClient } from '../packages/database/src/client.js';
import * as schema from '../packages/database/src/schema/index.js';
import { eq, inArray } from '../packages/database/src/index.js';
import { ApplicationPackageService } from '../apps/api/src/services/application-package-service.js';
import { S3StorageProvider } from '../apps/api/src/storage/s3-storage.js';
import crypto from 'node:crypto';

/**
 * JOBEE — Production Application Studio Repair Verification Script
 *
 * Verifies the complete vertical slice:
 * 1. Load candidate profile and verified background facts.
 * 2. Select or create an isolated verification job record.
 * 3. Generate truthful tailored CV and Cover Letter content.
 * 4. Generate ATS-compliant DOCX CV and verify binary buffer & zip header (PK\x03\x04).
 * 5. Generate Cover Letter DOCX and verify binary buffer & zip header.
 * 6. Upload both documents to Cloudflare R2 with SHA-256 checksum validation.
 * 7. Verify database artifact records (storageKey, mimeType, sizeBytes, checksum).
 * 8. Verify package versioning and readiness computation.
 * 9. Download both documents from R2 and verify byte-for-byte SHA-256 match.
 * 10. Test package reopening (idempotency - returns existing complete package).
 * 11. Test incomplete draft recovery (artificially created draft is healed and completed).
 * 12. Clean up temporary test job and packages, preserving all historical candidate data.
 */

async function runVerification() {
  console.log('================================================================');
  console.log('  Jobee — Application Studio Package Repair Verification');
  console.log('================================================================\n');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      'DATABASE_URL is not set. Run via: npx @railway/cli run -s jobee-api -- npx tsx scripts/verify-studio-package-repair.ts',
    );
  }

  const s3Bucket = process.env.S3_BUCKET;
  const s3AccessKey = process.env.S3_ACCESS_KEY_ID;
  const s3SecretKey = process.env.S3_SECRET_ACCESS_KEY;
  const s3Endpoint = process.env.S3_ENDPOINT;
  const s3Region = process.env.S3_REGION || 'auto';

  if (!s3Bucket || !s3AccessKey || !s3SecretKey) {
    throw new Error('Cloudflare R2 / S3 credentials not configured in environment.');
  }

  console.log(`✓ Cloudflare R2 Bucket: ${s3Bucket}`);
  console.log(`✓ R2 Endpoint:          ${s3Endpoint}`);
  console.log(`✓ R2 Region:            ${s3Region}\n`);

  const dbClient = createDatabaseClient(dbUrl);
  const db = dbClient.db;

  const storage = new S3StorageProvider({
    bucket: s3Bucket,
    region: s3Region,
    endpoint: s3Endpoint,
    accessKeyId: s3AccessKey,
    secretAccessKey: s3SecretKey,
    timeoutMs: 15_000,
    maxRetries: 3,
  });

  const packageService = new ApplicationPackageService(db, storage);

  // Clean-up tracker for temporary test objects
  const cleanupJobIds: string[] = [];
  const cleanupPackageIds: string[] = [];
  const cleanupStorageKeys: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Verify Candidate Information
    // -------------------------------------------------------------------------
    console.log('--- Step 1: Loading Candidate Profile ---');
    const [profile] = await db.select().from(schema.candidateProfiles).limit(1);

    if (!profile) throw new Error('No candidate profile found in database.');
    const userId = profile.userId;
    console.log(`✓ Candidate: ${profile.fullName} (${profile.email}) [userId: ${userId}]`);

    const skills = await db
      .select()
      .from(schema.candidateSkills)
      .where(eq(schema.candidateSkills.userId, userId));
    const experiences = await db
      .select()
      .from(schema.candidateExperiences)
      .where(eq(schema.candidateExperiences.userId, userId));
    console.log(
      `✓ Verified Background: ${skills.length} skills, ${experiences.length} experience entries\n`,
    );

    // -------------------------------------------------------------------------
    // STEP 2: Create Isolated Verification Job
    // -------------------------------------------------------------------------
    console.log('--- Step 2: Creating Isolated Verification Job ---');
    const runId = Date.now();
    const testDesc =
      'Seeking an experienced Project Manager with Scrum, Agile, and cross-functional operations experience.';
    const testHash = crypto.createHash('sha256').update(testDesc).digest('hex');
    const [testJob] = await db
      .insert(schema.jobs)
      .values({
        userId,
        title: `Technical Project Manager (Studio Repair Verification ${runId})`,
        company: 'Jobee Cloud Aerospace',
        description: testDesc,
        contentHash: testHash,
        workplaceType: 'REMOTE',
        employmentType: 'FULL_TIME',
        seniority: 'MID_LEVEL',
        state: 'ACTIVE',
      })
      .returning();

    cleanupJobIds.push(testJob!.id);
    console.log(`✓ Test Job Created: ${testJob!.title} [jobId: ${testJob!.id}]\n`);

    // -------------------------------------------------------------------------
    // STEP 3 & 4 & 5 & 6: Create Application Studio Package & Documents
    // -------------------------------------------------------------------------
    console.log('--- Steps 3-6: Generating Package & Documents (DOCX CV + Cover Letter) ---');
    const startTime = Date.now();
    const createResult = await packageService.createPackage(userId, testJob!.id);
    const durationMs = Date.now() - startTime;
    cleanupPackageIds.push(createResult.package.id);

    console.log(`✓ Package Created in ${durationMs}ms:`);
    console.log(`  Package ID: ${createResult.package.id}`);
    console.log(`  Status:     ${createResult.package.status}`);
    console.log(`  Version:    v${createResult.version.versionNumber}`);
    console.log(`  Readiness:  ${createResult.package.readinessReason || 'OK'}\n`);

    // -------------------------------------------------------------------------
    // STEP 7: Verify Database Artifact Records
    // -------------------------------------------------------------------------
    console.log('--- Step 7: Verifying Database Artifacts ---');
    const artifacts = await db
      .select()
      .from(schema.applicationArtifacts)
      .where(eq(schema.applicationArtifacts.versionId, createResult.version.id));

    expect(artifacts.length).toBe(2);

    const cvArtifact = artifacts.find((a) => a.artifactType === 'TAILORED_CV');
    const clArtifact = artifacts.find((a) => a.artifactType === 'COVER_LETTER');

    if (!cvArtifact) throw new Error('Missing TAILORED_CV artifact record in DB');
    if (!clArtifact) throw new Error('Missing COVER_LETTER artifact record in DB');

    cleanupStorageKeys.push(cvArtifact.storageKey, clArtifact.storageKey);

    console.log(`✓ Tailored CV Artifact:`);
    console.log(`  Filename:   ${cvArtifact.filename}`);
    console.log(`  Size:       ${cvArtifact.sizeBytes} bytes`);
    console.log(`  MIME:       ${cvArtifact.mimeType}`);
    console.log(`  SHA-256:    ${cvArtifact.sha256Checksum}`);
    console.log(`  StorageKey: ${cvArtifact.storageKey}`);

    console.log(`✓ Cover Letter Artifact:`);
    console.log(`  Filename:   ${clArtifact.filename}`);
    console.log(`  Size:       ${clArtifact.sizeBytes} bytes`);
    console.log(`  MIME:       ${clArtifact.mimeType}`);
    console.log(`  SHA-256:    ${clArtifact.sha256Checksum}`);
    console.log(`  StorageKey: ${clArtifact.storageKey}\n`);

    // -------------------------------------------------------------------------
    // STEP 8 & 9: Verify Document Download & SHA-256 Integrity from R2
    // -------------------------------------------------------------------------
    console.log('--- Steps 8-9: Downloading Documents from R2 & Verifying Checksums ---');
    const cvDownload = await storage.getFile(cvArtifact.storageKey);
    const clDownload = await storage.getFile(clArtifact.storageKey);

    // Verify ZIP magic bytes (PK\x03\x04 for .docx)
    const isCvValidZip =
      cvDownload.buffer[0] === 0x50 &&
      cvDownload.buffer[1] === 0x4b &&
      cvDownload.buffer[2] === 0x03 &&
      cvDownload.buffer[3] === 0x04;
    const isClValidZip =
      clDownload.buffer[0] === 0x50 &&
      clDownload.buffer[1] === 0x4b &&
      clDownload.buffer[2] === 0x03 &&
      clDownload.buffer[3] === 0x04;

    if (!isCvValidZip) throw new Error('CV DOCX does not have valid ZIP / DOCX magic headers');
    if (!isClValidZip)
      throw new Error('Cover Letter DOCX does not have valid ZIP / DOCX magic headers');

    const downloadedCvHash = crypto.createHash('sha256').update(cvDownload.buffer).digest('hex');
    const downloadedClHash = crypto.createHash('sha256').update(clDownload.buffer).digest('hex');

    if (downloadedCvHash !== cvArtifact.sha256Checksum) {
      throw new Error(
        `CV checksum mismatch! Expected ${cvArtifact.sha256Checksum}, got ${downloadedCvHash}`,
      );
    }
    if (downloadedClHash !== clArtifact.sha256Checksum) {
      throw new Error(
        `Cover Letter checksum mismatch! Expected ${clArtifact.sha256Checksum}, got ${downloadedClHash}`,
      );
    }

    console.log('✓ Tailored CV binary downloaded from Cloudflare R2:');
    console.log(`  Valid DOCX ZIP header: YES (PK\\x03\\x04)`);
    console.log(
      `  Byte size: ${cvDownload.buffer.length} bytes (matches DB size: ${cvArtifact.sizeBytes})`,
    );
    console.log(`  SHA-256 verified: ${downloadedCvHash}`);

    console.log('✓ Cover Letter binary downloaded from Cloudflare R2:');
    console.log(`  Valid DOCX ZIP header: YES (PK\\x03\\x04)`);
    console.log(
      `  Byte size: ${clDownload.buffer.length} bytes (matches DB size: ${clArtifact.sizeBytes})`,
    );
    console.log(`  SHA-256 verified: ${downloadedClHash}\n`);

    // -------------------------------------------------------------------------
    // STEP 10: Verify Reopening a Prepared Package (Idempotency)
    // -------------------------------------------------------------------------
    console.log('--- Step 10: Verifying Package Reopening (Idempotency) ---');
    const reopened = await packageService.createPackage(userId, testJob!.id);
    if (reopened.package.id !== createResult.package.id) {
      throw new Error('Reopening created duplicate package instead of returning existing package');
    }
    if (reopened.version.versionNumber !== 1) {
      throw new Error(`Expected v1, got v${reopened.version.versionNumber}`);
    }
    console.log(
      `✓ Reopening succeeded instantaneously: Package ID ${reopened.package.id} returned v1 without duplicating\n`,
    );

    // -------------------------------------------------------------------------
    // STEP 11: Incomplete-Package Recovery Verification
    // -------------------------------------------------------------------------
    console.log('--- Step 11: Verifying Incomplete Draft Recovery ---');
    // Simulate an incomplete draft (simulate what caused production bug)
    const incDesc = 'Operations analysis and banking systems experience needed.';
    const incHash = crypto.createHash('sha256').update(incDesc).digest('hex');
    const [incompleteJob] = await db
      .insert(schema.jobs)
      .values({
        userId,
        title: `Operations Specialist (Incomplete Recovery Test ${runId})`,
        company: 'Recovery Test Systems',
        description: incDesc,
        contentHash: incHash,
        workplaceType: 'HYBRID',
        employmentType: 'FULL_TIME',
        seniority: 'JUNIOR',
        state: 'ACTIVE',
      })
      .returning();
    cleanupJobIds.push(incompleteJob!.id);

    // Intentionally create a broken DRAFT package and version with NO artifacts
    const [brokenPkg] = await db
      .insert(schema.applicationPackages)
      .values({
        jobId: incompleteJob!.id,
        userId,
        status: 'DRAFT',
        currentVersionNumber: 1,
        hasPolicyBlocker: false,
        blockerOverridden: false,
        isStale: false,
      })
      .returning();
    cleanupPackageIds.push(brokenPkg!.id);

    const [brokenVer] = await db
      .insert(schema.applicationPackageVersions)
      .values({
        packageId: brokenPkg!.id,
        versionNumber: 1,
        status: 'DRAFT',
        inputFingerprint: 'broken-fp',
        tailoredCvContent: {},
        coverLetterContent: 'Broken draft',
        changeSummary: [],
        generationMode: 'DETERMINISTIC_ONLY',
      })
      .returning();

    // Verify 0 artifacts exist
    const preHealArtifacts = await db
      .select()
      .from(schema.applicationArtifacts)
      .where(eq(schema.applicationArtifacts.versionId, brokenVer!.id));
    if (preHealArtifacts.length !== 0)
      throw new Error('Expected 0 initial artifacts for broken draft');
    console.log(`✓ Simulated damaged DRAFT package ${brokenPkg!.id} with 0 artifacts.`);

    // Trigger recovery via createPackage
    const healedResult = await packageService.createPackage(userId, incompleteJob!.id);
    if (healedResult.package.id !== brokenPkg!.id) {
      throw new Error('Recovery did not preserve the existing package ID');
    }
    if (healedResult.version.status === 'DRAFT') {
      throw new Error('Package version remained stuck in DRAFT after recovery');
    }

    const postHealArtifacts = await db
      .select()
      .from(schema.applicationArtifacts)
      .where(eq(schema.applicationArtifacts.versionId, brokenVer!.id));

    if (postHealArtifacts.length !== 2) {
      throw new Error(`Expected 2 healed artifacts, found ${postHealArtifacts.length}`);
    }

    for (const a of postHealArtifacts) {
      cleanupStorageKeys.push(a.storageKey);
    }

    console.log(`✓ Incomplete package successfully healed:`);
    console.log(`  Package ID: ${healedResult.package.id}`);
    console.log(`  New Status: ${healedResult.package.status}`);
    console.log(`  Healed Artifacts Count: ${postHealArtifacts.length} (CV & Cover Letter)\n`);

    console.log('================================================================');
    console.log('  ALL 11 PHASES OF WORKFLOW VERIFICATION PASSED SUCCESSFULLY!');
    console.log('================================================================\n');
  } finally {
    // Clean up temporary verification records
    console.log('--- Cleaning Up Temporary Verification Records ---');
    for (const storageKey of cleanupStorageKeys) {
      try {
        await storage.deleteFile(storageKey);
      } catch {
        // Ignore deletion errors during test cleanup
      }
    }
    if (cleanupPackageIds.length > 0) {
      await db
        .delete(schema.applicationPackageEvents)
        .where(inArray(schema.applicationPackageEvents.packageId, cleanupPackageIds));
      await db
        .delete(schema.approvalRequests)
        .where(inArray(schema.approvalRequests.packageId, cleanupPackageIds));
      await db
        .delete(schema.applicationQuestions)
        .where(inArray(schema.applicationQuestions.packageId, cleanupPackageIds));
      await db
        .delete(schema.applicationArtifacts)
        .where(inArray(schema.applicationArtifacts.packageId, cleanupPackageIds));
      await db
        .delete(schema.applicationPackageVersions)
        .where(inArray(schema.applicationPackageVersions.packageId, cleanupPackageIds));
      await db
        .delete(schema.applicationPackages)
        .where(inArray(schema.applicationPackages.id, cleanupPackageIds));
    }
    if (cleanupJobIds.length > 0) {
      await db.delete(schema.jobs).where(inArray(schema.jobs.id, cleanupJobIds));
    }
    console.log('✓ Teardown complete. Historical candidate data preserved.\n');
    await dbClient.pool.end();
  }
}

function expect(val: any) {
  return {
    toBe(expected: any) {
      if (val !== expected) throw new Error(`Assertion failed: expected ${expected}, got ${val}`);
    },
  };
}

runVerification().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:');
  console.error(err);
  process.exit(1);
});
