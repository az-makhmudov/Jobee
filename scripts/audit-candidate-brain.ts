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
} from '@job-agent/database';

async function main() {
  const config = getConfig();
  const db = getDb(config.DATABASE_URL);
  const primaryUserId = '00000000-0000-0000-0000-000000000001';

  console.log('===============================================================');
  console.log('CANDIDATE BRAIN READ-ONLY AUDIT REPORT');
  console.log(`Primary User ID: ${primaryUserId}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('===============================================================\n');

  // 1. Profile
  const [profile] = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, primaryUserId));
  console.log('--- 1. CANDIDATE PROFILE ---');
  if (profile) {
    console.log(`Name:        ${profile.fullName} (Preferred: ${profile.preferredName})`);
    console.log(`Headline:    ${profile.headline}`);
    console.log(`Summary:     ${profile.summary}`);
    console.log(`Location:    ${profile.city}, ${profile.country}`);
    console.log(`Contact:     ${profile.email} | ${profile.phone}`);
    console.log(`Status:      ${profile.availability}`);
  } else {
    console.log('No profile found.');
  }

  // 2. Experiences
  const experiences = await db
    .select()
    .from(candidateExperiences)
    .where(eq(candidateExperiences.userId, primaryUserId));
  console.log(`\n--- 2. EXPERIENCES (${experiences.length} total) ---`);
  for (const exp of experiences) {
    console.log(
      `• [${exp.verificationStatus}] ${exp.organization} - ${exp.position} (${exp.startDate} to ${exp.endDate || 'present'}) [ID: ${exp.id}]`,
    );
  }

  // 3. Education
  const education = await db
    .select()
    .from(candidateEducation)
    .where(eq(candidateEducation.userId, primaryUserId));
  console.log(`\n--- 3. EDUCATION (${education.length} total) ---`);
  for (const edu of education) {
    console.log(
      `• [${edu.verificationStatus}] ${edu.institution} - ${edu.degree || 'Degree'} (${edu.fieldOfStudy || 'General'}) [ID: ${edu.id}]`,
    );
  }

  // 4. Skills
  const skills = await db
    .select()
    .from(candidateSkills)
    .where(eq(candidateSkills.userId, primaryUserId));
  console.log(`\n--- 4. SKILLS (${skills.length} total) ---`);
  for (const sk of skills) {
    console.log(`• [${sk.verificationStatus}] ${sk.name} (${sk.proficiency || 'N/A'})`);
  }

  // 5. Languages
  const languages = await db
    .select()
    .from(candidateLanguages)
    .where(eq(candidateLanguages.userId, primaryUserId));
  console.log(`\n--- 5. LANGUAGES (${languages.length} total) ---`);
  for (const lang of languages) {
    console.log(`• [${lang.verificationStatus}] ${lang.language} (${lang.proficiency || 'N/A'})`);
  }

  // 6. Links
  const links = await db
    .select()
    .from(candidateLinks)
    .where(eq(candidateLinks.userId, primaryUserId));
  console.log(`\n--- 6. LINKS (${links.length} total) ---`);
  for (const lk of links) {
    console.log(`• ${lk.label}: ${lk.url}`);
  }

  // 7. Certifications & Projects
  const certs = await db
    .select()
    .from(candidateCertifications)
    .where(eq(candidateCertifications.userId, primaryUserId));
  const projects = await db
    .select()
    .from(candidateProjects)
    .where(eq(candidateProjects.userId, primaryUserId));
  console.log(`\n--- 7. CERTIFICATIONS (${certs.length}) & PROJECTS (${projects.length}) ---`);

  // 8. Facts
  const facts = await db
    .select()
    .from(candidateFacts)
    .where(eq(candidateFacts.userId, primaryUserId));
  console.log(`\n--- 8. CANDIDATE FACTS (${facts.length} total) ---`);
  const aiAuthorizedFacts = facts.filter((f) => f.allowAiUse);
  console.log(`AI-Authorized Facts (allowAiUse: true): ${aiAuthorizedFacts.length}`);
  for (const f of facts) {
    console.log(
      `• [AI:${f.allowAiUse ? 'YES' : 'NO'}|${f.verificationStatus}] ${f.category} (${f.sourceType}): ${f.statement.slice(0, 80)}`,
    );
  }

  // 9. Documents & Import Sessions
  const docs = await db
    .select()
    .from(candidateDocuments)
    .where(eq(candidateDocuments.userId, primaryUserId));
  const sessions = await db
    .select()
    .from(profileImportSessions)
    .where(eq(profileImportSessions.userId, primaryUserId));
  console.log(`\n--- 9. DOCUMENTS (${docs.length}) & IMPORT SESSIONS (${sessions.length}) ---`);
  for (const doc of docs.slice(0, 10)) {
    console.log(`• ${doc.originalFilename} (Type: ${doc.documentType}, Master: ${doc.isMaster})`);
  }
  if (docs.length > 10) {
    console.log(`... and ${docs.length - 10} more documents`);
  }

  console.log('\n===============================================================');
  console.log('AUDIT COMPLETED');
  console.log('===============================================================');

  await closeDbPool();
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
