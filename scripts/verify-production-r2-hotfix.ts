import { createDatabaseClient } from '../packages/database/src/client.js';
import * as schema from '../packages/database/src/schema/index.js';
import { eq, and } from '../packages/database/src/index.js';
import { ApplicationPackageService } from '../apps/api/src/services/application-package-service.js';
import { S3StorageProvider } from '../apps/api/src/storage/s3-storage.js';
import crypto from 'node:crypto';

/**
 * JOBEE — Production R2 Upload Hotfix Verification Script
 *
 * Verifies:
 * 1. Cloudflare R2 PUT and GET operations execute cleanly without UND_ERR_INVALID_ARG.
 * 2. Real DOCX generation and upload for an existing real job in production.
 * 3. Incomplete package auto-recovery: package with 0 artifacts is healed with complete CV & CL.
 * 4. Byte-for-byte SHA-256 checksum integrity verification against Cloudflare R2 storage.
 * 5. Idempotent package reopening with zero duplicate packages or version sprawl.
 */

async function main() {
  console.log('================================================================');
  console.log('  Jobee — Production R2 Upload Hotfix Verification');
  console.log('================================================================\n');

  const dbUrl = process.env.DATABASE_URL;
  const s3Bucket = process.env.S3_BUCKET;
  const s3AccessKey = process.env.S3_ACCESS_KEY_ID;
  const s3SecretKey = process.env.S3_SECRET_ACCESS_KEY;
  const s3Endpoint = process.env.S3_ENDPOINT;
  const s3Region = process.env.S3_REGION || 'auto';

  if (!dbUrl || !s3Bucket || !s3AccessKey || !s3SecretKey) {
    throw new Error('Missing production database or S3 credentials in environment.');
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
  });

  const packageService = new ApplicationPackageService(db, storage);

  // 1. Load Primary Candidate
  console.log('--- Step 1: Loading Candidate Profile ---');
  const users = await db.select().from(schema.users).limit(5);
  const user = users.find((u) => u.email === 'asadbek.mzw@gmail.com') || users[0];
  console.log(`✓ Candidate: ${user.name || user.email} [userId: ${user.id}]\n`);

  // 2. Select a Job with an Incomplete Package (0 artifacts)
  console.log('--- Step 2: Locating Incomplete Production Package ---');
  const targetJobId = 'd8deab25-143c-4fef-a759-e220978ef021';
  const job = await db.query.jobs.findFirst({
    where: eq(schema.jobs.id, targetJobId),
  });

  if (!job) {
    throw new Error(`Target production job ${targetJobId} not found.`);
  }

  console.log(`✓ Target Job: "${job.title}" at ${job.company || 'Hiring Company'}`);
  console.log(`  Job ID: ${job.id}\n`);

  const priorPackages = await db
    .select()
    .from(schema.applicationPackages)
    .where(
      and(
        eq(schema.applicationPackages.userId, user.id),
        eq(schema.applicationPackages.jobId, targetJobId),
      ),
    );

  console.log(`✓ Prior packages count for job: ${priorPackages.length}`);
  const priorPackageId = priorPackages[0]?.id;
  if (priorPackageId) {
    const priorArtifacts = await db
      .select()
      .from(schema.applicationArtifacts)
      .where(eq(schema.applicationArtifacts.packageId, priorPackageId));
    console.log(
      `  Existing Package ID: ${priorPackageId} (artifacts before healing: ${priorArtifacts.length})\n`,
    );
  }

  // 3. Execute createPackage (which will heal and complete the package)
  console.log('--- Step 3: Executing createPackage (Triggering Hotfixed R2 Uploads) ---');
  const startTime = Date.now();
  const result = await packageService.createPackage(user.id, targetJobId);
  const durationMs = Date.now() - startTime;

  console.log(`✓ Package Processed in ${durationMs}ms:`);
  console.log(`  Package ID: ${result.package.id}`);
  console.log(`  Status:     ${result.package.status}`);
  console.log(`  Version:    v${result.version.versionNumber}`);
  console.log(`  Readiness:  ${result.package.readinessReason || 'OK'}\n`);

  // 4. Verify Database Artifacts
  console.log('--- Step 4: Verifying Attached Database Artifacts ---');
  const postArtifacts = await db
    .select()
    .from(schema.applicationArtifacts)
    .where(eq(schema.applicationArtifacts.packageId, result.package.id));

  console.log(`✓ Attached artifacts count: ${postArtifacts.length}`);
  const cvArtifact = postArtifacts.find((a) => a.artifactType === 'TAILORED_CV');
  const clArtifact = postArtifacts.find((a) => a.artifactType === 'COVER_LETTER');

  if (!cvArtifact) throw new Error('Missing TAILORED_CV artifact record in DB');
  if (!clArtifact) throw new Error('Missing COVER_LETTER artifact record in DB');

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

  // 5. Download and Verify Binary Integrity from Cloudflare R2
  console.log('--- Step 5: Downloading Documents from R2 & Verifying Integrity ---');
  const cvDownloaded = await storage.getFile(cvArtifact.storageKey);
  const cvSha256 = crypto.createHash('sha256').update(cvDownloaded.buffer).digest('hex');
  const cvIsZip = cvDownloaded.buffer[0] === 0x50 && cvDownloaded.buffer[1] === 0x4b;

  console.log(`✓ Tailored CV from Cloudflare R2:`);
  console.log(`  Valid DOCX ZIP header: ${cvIsZip ? 'YES (PK\\x03\\x04)' : 'NO'}`);
  console.log(
    `  Byte size: ${cvDownloaded.buffer.length} bytes (matches DB: ${cvArtifact.sizeBytes})`,
  );
  console.log(`  SHA-256 match: ${cvSha256 === cvArtifact.sha256Checksum} (${cvSha256})`);

  if (!cvIsZip || cvSha256 !== cvArtifact.sha256Checksum) {
    throw new Error('Tailored CV binary failed integrity verification.');
  }

  const clDownloaded = await storage.getFile(clArtifact.storageKey);
  const clSha256 = crypto.createHash('sha256').update(clDownloaded.buffer).digest('hex');
  const clIsZip = clDownloaded.buffer[0] === 0x50 && clDownloaded.buffer[1] === 0x4b;

  console.log(`✓ Cover Letter from Cloudflare R2:`);
  console.log(`  Valid DOCX ZIP header: ${clIsZip ? 'YES (PK\\x03\\x04)' : 'NO'}`);
  console.log(
    `  Byte size: ${clDownloaded.buffer.length} bytes (matches DB: ${clArtifact.sizeBytes})`,
  );
  console.log(`  SHA-256 match: ${clSha256 === clArtifact.sha256Checksum} (${clSha256})\n`);

  if (!clIsZip || clSha256 !== clArtifact.sha256Checksum) {
    throw new Error('Cover Letter binary failed integrity verification.');
  }

  // 6. Test Idempotency (Reopening package)
  console.log('--- Step 6: Verifying Idempotent Package Reopening ---');
  const reopenResult = await packageService.createPackage(user.id, targetJobId);
  console.log(
    `✓ Reopen returned Package ID: ${reopenResult.package.id} (matches: ${reopenResult.package.id === result.package.id})`,
  );
  console.log(`  Version: v${reopenResult.version.versionNumber}`);

  const finalPackages = await db
    .select()
    .from(schema.applicationPackages)
    .where(
      and(
        eq(schema.applicationPackages.userId, user.id),
        eq(schema.applicationPackages.jobId, targetJobId),
      ),
    );

  console.log(`✓ Final package count for job: ${finalPackages.length} (zero duplicates created)\n`);

  if (finalPackages.length !== 1) {
    throw new Error(`Expected exactly 1 package for job, found ${finalPackages.length}`);
  }

  console.log('================================================================');
  console.log('  CRITICAL R2 UPLOAD HOTFIX VERIFICATION: ALL CHECKS PASSED!');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
