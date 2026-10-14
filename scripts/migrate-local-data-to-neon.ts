import { getDbPool } from '../packages/database/src/client.js';
import * as schema from '../packages/database/src/schema/index.js';
import { drizzle } from 'drizzle-orm/node-postgres';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Jobee — Production Data Migration Utility (Local PostgreSQL -> Neon PostgreSQL)
 *
 * Safely migrates candidate profile, brain facts, verified skills, job applications,
 * and documents from local development database to production Neon PostgreSQL.
 *
 * Invariants:
 * 1. Safe by default: Requires explicit `--execute` flag to perform writes.
 * 2. Idempotent: Uses `ON CONFLICT DO NOTHING` for all tables.
 * 3. Never deletes or mutates existing records in source or target.
 * 4. Preserves primary owner user ID (00000000-0000-0000-0000-000000000001) and email.
 *
 * Usage:
 *   # Dry run (inspection only, zero writes):
 *   TARGET_DATABASE_URL="postgresql://..." npx tsx scripts/migrate-local-data-to-neon.ts
 *
 *   # Execute real migration:
 *   TARGET_DATABASE_URL="postgresql://..." npx tsx scripts/migrate-local-data-to-neon.ts --execute
 */

interface MigrationStats {
  table: string;
  sourceCount: number;
  migratedCount: number;
}

async function main() {
  const isExecute = process.argv.includes('--execute');
  const sourceUrl =
    process.env.SOURCE_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://bek@localhost:5432/ai_job_agent_dev';
  const targetUrl = process.env.TARGET_DATABASE_URL;

  console.log('================================================================');
  console.log('  Jobee — Production Data Migration Utility (Local -> Neon)');
  console.log('================================================================\n');
  console.log(`Mode:       ${isExecute ? '🚀 EXECUTE (LIVE WRITE)' : '🔍 DRY RUN (READ ONLY)'}`);
  console.log(`Source DB:  ${sourceUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log(
    `Target DB:  ${targetUrl ? targetUrl.replace(/:[^:@]+@/, ':****@') : '❌ NOT CONFIGURED (Pass TARGET_DATABASE_URL)'}`,
  );
  console.log();

  if (!targetUrl && isExecute) {
    console.error('ERROR: TARGET_DATABASE_URL must be specified to execute migration.');
    process.exit(1);
  }

  // Connect to source DB
  const sourcePool = getDbPool(sourceUrl);
  const sourceDb = drizzle(sourcePool, { schema });

  // Connect to target DB if provided
  let targetDb = null;
  let targetPool = null;
  if (targetUrl) {
    targetPool = getDbPool(targetUrl);
    targetDb = drizzle(targetPool, { schema });
  }

  const stats: MigrationStats[] = [];

  async function migrateTable<T extends { id: string | number }>(
    tableName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tableObj: any,
    queryFn: () => Promise<T[]>,
  ) {
    const rows = await queryFn();
    let migrated = 0;

    if (isExecute && targetDb && rows.length > 0) {
      // Chunk inserts in batches of 50
      const chunkSize = 50;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const res = await targetDb
          .insert(tableObj)
          .values(chunk)
          .onConflictDoNothing()
          .returning({ id: tableObj.id });
        migrated += res.length;
      }
    }

    stats.push({
      table: tableName,
      sourceCount: rows.length,
      migratedCount: isExecute ? migrated : rows.length,
    });

    console.log(
      `  [${tableName.padEnd(30)}] Source: ${String(rows.length).padStart(4)} rows | ${
        isExecute ? `Migrated: ${String(migrated).padStart(4)} new rows` : 'Staged for migration'
      }`,
    );
  }

  try {
    console.log('Reading and validating source data...\n');

    // 1. Users
    await migrateTable('users', schema.users, () => sourceDb.select().from(schema.users));

    // 2. Candidate Profiles & Core Brain
    await migrateTable('candidate_profiles', schema.candidateProfiles, () =>
      sourceDb.select().from(schema.candidateProfiles),
    );
    await migrateTable('candidate_experiences', schema.candidateExperiences, () =>
      sourceDb.select().from(schema.candidateExperiences),
    );
    await migrateTable('candidate_education', schema.candidateEducation, () =>
      sourceDb.select().from(schema.candidateEducation),
    );
    await migrateTable('candidate_projects', schema.candidateProjects, () =>
      sourceDb.select().from(schema.candidateProjects),
    );
    await migrateTable('candidate_skills', schema.candidateSkills, () =>
      sourceDb.select().from(schema.candidateSkills),
    );
    await migrateTable('candidate_languages', schema.candidateLanguages, () =>
      sourceDb.select().from(schema.candidateLanguages),
    );
    await migrateTable('candidate_certifications', schema.candidateCertifications, () =>
      sourceDb.select().from(schema.candidateCertifications),
    );
    await migrateTable('candidate_links', schema.candidateLinks, () =>
      sourceDb.select().from(schema.candidateLinks),
    );
    await migrateTable('candidate_facts', schema.candidateFacts, () =>
      sourceDb.select().from(schema.candidateFacts),
    );
    await migrateTable('candidate_documents', schema.candidateDocuments, () =>
      sourceDb.select().from(schema.candidateDocuments),
    );
    await migrateTable('answer_library', schema.answerLibrary, () =>
      sourceDb.select().from(schema.answerLibrary),
    );
    await migrateTable('job_preferences', schema.jobPreferences, () =>
      sourceDb.select().from(schema.jobPreferences),
    );
    await migrateTable('application_policy', schema.applicationPolicy, () =>
      sourceDb.select().from(schema.applicationPolicy),
    );

    // 3. Jobs & Ingestion
    await migrateTable('job_sources', schema.jobSources, () =>
      sourceDb.select().from(schema.jobSources),
    );
    await migrateTable('jobs', schema.jobs, () => sourceDb.select().from(schema.jobs));
    await migrateTable('job_requirements', schema.jobRequirements, () =>
      sourceDb.select().from(schema.jobRequirements),
    );
    await migrateTable('job_sections', schema.jobSections, () =>
      sourceDb.select().from(schema.jobSections),
    );
    await migrateTable('job_match_analyses', schema.jobMatchAnalyses, () =>
      sourceDb.select().from(schema.jobMatchAnalyses),
    );
    await migrateTable('job_match_dimensions', schema.jobMatchDimensions, () =>
      sourceDb.select().from(schema.jobMatchDimensions),
    );
    await migrateTable('job_requirement_evaluations', schema.jobRequirementEvaluations, () =>
      sourceDb.select().from(schema.jobRequirementEvaluations),
    );

    // 4. Applications, Studio Materials & CRM
    await migrateTable('applications', schema.applications, () =>
      sourceDb.select().from(schema.applications),
    );
    await migrateTable('application_packages', schema.applicationPackages, () =>
      sourceDb.select().from(schema.applicationPackages),
    );
    await migrateTable('application_package_versions', schema.applicationPackageVersions, () =>
      sourceDb.select().from(schema.applicationPackageVersions),
    );
    await migrateTable('application_artifacts', schema.applicationArtifacts, () =>
      sourceDb.select().from(schema.applicationArtifacts),
    );
    await migrateTable('application_questions', schema.applicationQuestions, () =>
      sourceDb.select().from(schema.applicationQuestions),
    );
    await migrateTable('approval_requests', schema.approvalRequests, () =>
      sourceDb.select().from(schema.approvalRequests),
    );
    await migrateTable('application_lifecycle_events', schema.applicationLifecycleEvents, () =>
      sourceDb.select().from(schema.applicationLifecycleEvents),
    );

    // 5. Cloudflare R2 Document Sync
    const s3Bucket = process.env.S3_BUCKET;
    const s3AccessKey = process.env.S3_ACCESS_KEY_ID;
    const s3SecretKey = process.env.S3_SECRET_ACCESS_KEY;
    const s3Endpoint = process.env.S3_ENDPOINT;

    console.log('\n----------------------------------------------------------------');
    console.log('  Cloudflare R2 Document Storage Sync');
    console.log('----------------------------------------------------------------');

    if (s3Bucket && s3AccessKey && s3SecretKey) {
      console.log(`Target R2 Bucket: ${s3Bucket} (${s3Endpoint || 'Cloudflare R2'})`);
      const uploadDir = path.resolve(process.cwd(), 'uploads/documents');

      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir).filter((f) => !f.startsWith('.'));
        console.log(`Found ${files.length} document file(s) in local uploads/documents directory.`);

        if (isExecute) {
          let uploadedCount = 0;
          for (const file of files) {
            const filePath = path.join(uploadDir, file);
            const content = fs.readFileSync(filePath);
            const key = `documents/${file}`;
            const mimeType = file.endsWith('.docx')
              ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              : 'application/pdf';

            // Sign and upload using AWS Signature V4
            const region = process.env.S3_REGION || 'auto';
            const hostEndpoint = s3Endpoint
              ? s3Endpoint.replace(/\/+$/, '')
              : `https://${s3Bucket}.s3.${region === 'auto' ? 'us-east-1' : region}.amazonaws.com`;
            const base = new URL(hostEndpoint);
            const targetUrl =
              base.pathname.length > 1
                ? `${hostEndpoint}/${key}`
                : `${hostEndpoint}/${s3Bucket}/${key}`;
            const url = new URL(targetUrl);

            const now = new Date();
            const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
            const dateStamp = amzDate.slice(0, 8);
            const payloadHash = crypto.createHash('sha256').update(content).digest('hex');

            const headers: Record<string, string> = {
              host: url.host,
              'x-amz-content-sha256': payloadHash,
              'x-amz-date': amzDate,
              'content-type': mimeType,
              'content-length': String(content.length),
            };

            const signedHeaders = Object.keys(headers).sort().map((k) => k.toLowerCase()).join(';');
            const canonicalHeaders = Object.keys(headers)
              .sort()
              .map((k) => `${k.toLowerCase()}:${headers[k]}\n`)
              .join('');

            const canonicalRequest = [
              'PUT',
              url.pathname,
              url.searchParams.toString(),
              canonicalHeaders,
              signedHeaders,
              payloadHash,
            ].join('\n');

            const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
            const stringToSign = [
              'AWS4-HMAC-SHA256',
              amzDate,
              credentialScope,
              crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
            ].join('\n');

            const kDate = crypto.createHmac('sha256', `AWS4${s3SecretKey}`).update(dateStamp).digest();
            const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
            const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
            const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
            const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

            headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${s3AccessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

            const res = await fetch(url.toString(), {
              method: 'PUT',
              headers,
              body: content,
            });

            if (!res.ok) {
              const errText = await res.text().catch(() => '');
              throw new Error(`R2 upload failed (${res.status}): ${errText.slice(0, 100)}`);
            }
            uploadedCount++;
          }
          console.log(`✓ Successfully uploaded ${uploadedCount} documents to Cloudflare R2.`);
        } else {
          console.log(`🔍 [DRY RUN] Would upload ${files.length} documents to Cloudflare R2.`);
        }
      } else {
        console.log('No local uploads/documents directory found to sync.');
      }
    } else {
      console.log('Cloudflare R2 credentials not provided in environment; skipping R2 file sync.');
    }

    console.log('\n================================================================');
    if (isExecute) {
      console.log('  ✅ MIGRATION COMPLETED SUCCESSFULLY');
      console.log('  All candidate data and history have been migrated to Neon.');
    } else {
      console.log('  🔍 DRY RUN COMPLETED — ZERO CHANGES MADE TO TARGET DATABASE');
      console.log('  To apply these changes, rerun with: --execute');
    }
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ Migration error:', err);
    process.exit(1);
  } finally {
    await sourcePool.end().catch(() => {});
    if (targetPool) {
      await targetPool.end().catch(() => {});
    }
  }
}

main();
