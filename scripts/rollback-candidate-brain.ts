import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { getConfig } from '@job-agent/config';
import {
  getDb,
  closeDbPool,
  candidateProfiles,
  candidateExperiences,
  candidateEducation,
  candidateSkills,
  candidateCertifications,
  candidateLanguages,
  candidateProjects,
  candidateLinks,
  candidateFacts,
  candidateDocuments,
  profileImportSessions,
  profileImportItems,
} from '@job-agent/database';

async function main() {
  const args = process.argv.slice(2);
  const backupDir = path.resolve(process.cwd(), 'backups');

  let targetBackupFile = args[0];
  if (!targetBackupFile) {
    if (!fs.existsSync(backupDir)) {
      console.error('No backups directory found.');
      process.exit(1);
    }
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('candidate-brain-backup-') && f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length === 0) {
      console.error('No backup files found in backups directory.');
      process.exit(1);
    }
    targetBackupFile = path.join(backupDir, files[0]);
  }

  if (!fs.existsSync(targetBackupFile)) {
    console.error(`Backup file not found at: ${targetBackupFile}`);
    process.exit(1);
  }

  console.log('===============================================================');
  console.log('JOBEE — CANDIDATE BRAIN ROLLBACK UTILITY');
  console.log(`Restoring from backup: ${targetBackupFile}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('===============================================================\n');

  const raw = fs.readFileSync(targetBackupFile, 'utf-8');
  const backup = JSON.parse(raw);
  const primaryUserId = backup.userId;

  const config = getConfig();
  const db = getDb(config.DATABASE_URL);

  console.log(`Target User ID: ${primaryUserId}`);

  // Clean current state for primary user
  await db.delete(profileImportItems).where(eq(profileImportItems.userId, primaryUserId));
  await db.delete(profileImportSessions).where(eq(profileImportSessions.userId, primaryUserId));
  await db.delete(candidateDocuments).where(eq(candidateDocuments.userId, primaryUserId));
  await db.delete(candidateFacts).where(eq(candidateFacts.userId, primaryUserId));
  await db.delete(candidateLinks).where(eq(candidateLinks.userId, primaryUserId));
  await db.delete(candidateProjects).where(eq(candidateProjects.userId, primaryUserId));
  await db.delete(candidateLanguages).where(eq(candidateLanguages.userId, primaryUserId));
  await db.delete(candidateCertifications).where(eq(candidateCertifications.userId, primaryUserId));
  await db.delete(candidateSkills).where(eq(candidateSkills.userId, primaryUserId));
  await db.delete(candidateEducation).where(eq(candidateEducation.userId, primaryUserId));
  await db.delete(candidateExperiences).where(eq(candidateExperiences.userId, primaryUserId));
  await db.delete(candidateProfiles).where(eq(candidateProfiles.userId, primaryUserId));

  // Restore profile
  if (backup.profile) {
    await db.insert(candidateProfiles).values({
      ...backup.profile,
      createdAt: new Date(backup.profile.createdAt),
      updatedAt: new Date(backup.profile.updatedAt),
    });
  }

  // Restore experiences
  if (backup.experiences?.length > 0) {
    await db.insert(candidateExperiences).values(
      backup.experiences.map((e: any) => ({
        ...e,
        createdAt: new Date(e.createdAt),
        updatedAt: new Date(e.updatedAt),
      })),
    );
  }

  // Restore education
  if (backup.education?.length > 0) {
    await db.insert(candidateEducation).values(
      backup.education.map((e: any) => ({
        ...e,
        createdAt: new Date(e.createdAt),
        updatedAt: new Date(e.updatedAt),
      })),
    );
  }

  // Restore skills
  if (backup.skills?.length > 0) {
    await db.insert(candidateSkills).values(
      backup.skills.map((s: any) => ({
        ...s,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
      })),
    );
  }

  // Restore certifications
  if (backup.certifications?.length > 0) {
    await db.insert(candidateCertifications).values(
      backup.certifications.map((c: any) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
      })),
    );
  }

  // Restore languages
  if (backup.languages?.length > 0) {
    await db.insert(candidateLanguages).values(
      backup.languages.map((l: any) => ({
        ...l,
        createdAt: new Date(l.createdAt),
        updatedAt: new Date(l.updatedAt),
      })),
    );
  }

  // Restore projects
  if (backup.projects?.length > 0) {
    await db.insert(candidateProjects).values(
      backup.projects.map((p: any) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      })),
    );
  }

  // Restore links
  if (backup.links?.length > 0) {
    await db.insert(candidateLinks).values(
      backup.links.map((l: any) => ({
        ...l,
        createdAt: new Date(l.createdAt),
        updatedAt: new Date(l.updatedAt),
      })),
    );
  }

  // Restore facts
  if (backup.facts?.length > 0) {
    await db.insert(candidateFacts).values(
      backup.facts.map((f: any) => ({
        ...f,
        createdAt: new Date(f.createdAt),
        updatedAt: new Date(f.updatedAt),
      })),
    );
  }

  // Restore documents
  if (backup.documents?.length > 0) {
    await db.insert(candidateDocuments).values(
      backup.documents.map((d: any) => ({
        ...d,
        createdAt: new Date(d.createdAt),
        updatedAt: new Date(d.updatedAt),
      })),
    );
  }

  // Restore sessions
  if (backup.sessions?.length > 0) {
    await db.insert(profileImportSessions).values(
      backup.sessions.map((s: any) => ({
        ...s,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
      })),
    );
  }

  // Restore items
  if (backup.items?.length > 0) {
    await db.insert(profileImportItems).values(
      backup.items.map((i: any) => ({
        ...i,
        createdAt: new Date(i.createdAt),
        updatedAt: new Date(i.updatedAt),
      })),
    );
  }

  console.log('✓ Successfully restored candidate data from backup.');
  console.log('===============================================================');

  await closeDbPool();
}

main().catch((err) => {
  console.error('Rollback failed:', err);
  process.exit(1);
});
