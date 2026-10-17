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
  candidateLinks,
  candidateFacts,
  candidateDocuments,
  profileImportSessions,
} from '@job-agent/database';
import {
  CandidateBrainClassifier,
  type ClassifiedRecord,
} from '../apps/api/src/services/import/candidate-brain-classifier.js';

async function main() {
  const config = getConfig();
  const db = getDb(config.DATABASE_URL);
  const primaryUserId = '00000000-0000-0000-0000-000000000001';

  console.log('===============================================================');
  console.log('JOBEE — RECORD-LEVEL CANDIDATE BRAIN AUDIT REPORT');
  console.log(`Primary User ID: ${primaryUserId}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('===============================================================\n');

  const classifications: ClassifiedRecord[] = [];

  // 1. Profile
  const [profile] = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, primaryUserId));
  console.log('--- 1. CANDIDATE PROFILE ---');
  if (profile) {
    const classified = CandidateBrainClassifier.classifyProfile(profile);
    classifications.push(classified);
    console.log(
      `[${classified.classification}] ${profile.fullName} (Preferred: ${profile.preferredName})`,
    );
    console.log(`  Headline:    ${profile.headline}`);
    console.log(`  Summary:     ${profile.summary}`);
    console.log(`  Contact:     ${profile.email} | ${profile.phone}`);
    console.log(`  Location:    ${profile.city}, ${profile.country}`);
    console.log(`  Evidence:    ${classified.evidence}`);
    console.log(`  Action:      ${classified.proposedAction}`);
  }

  // 2. Documents
  const docs = await db
    .select()
    .from(candidateDocuments)
    .where(eq(candidateDocuments.userId, primaryUserId));
  console.log(`\n--- 2. CANDIDATE DOCUMENTS (${docs.length} total) ---`);
  const docClassificationMap = new Map<string, string>();
  for (const doc of docs) {
    const classified = CandidateBrainClassifier.classifyDocument(doc);
    classifications.push(classified);
    docClassificationMap.set(doc.id, classified.classification);
  }
  const syntheticDocs = classifications.filter(
    (c) => c.entityType === 'DOCUMENT' && c.classification === 'CONFIRMED_SYNTHETIC',
  );
  const authenticDocs = classifications.filter(
    (c) => c.entityType === 'DOCUMENT' && c.classification === 'CONFIRMED_AUTHENTIC',
  );
  console.log(`• CONFIRMED_AUTHENTIC Documents: ${authenticDocs.length}`);
  for (const ad of authenticDocs) {
    console.log(`  ✓ ${ad.summary} [ID: ${ad.id}]`);
  }
  console.log(`• CONFIRMED_SYNTHETIC Documents: ${syntheticDocs.length}`);
  for (const sd of syntheticDocs.slice(0, 5)) {
    console.log(`  ✗ ${sd.summary}`);
  }
  if (syntheticDocs.length > 5) {
    console.log(`  ... and ${syntheticDocs.length - 5} more synthetic test files`);
  }

  // 3. Import Sessions
  const sessions = await db
    .select()
    .from(profileImportSessions)
    .where(eq(profileImportSessions.userId, primaryUserId));
  console.log(`\n--- 3. IMPORT SESSIONS (${sessions.length} total) ---`);
  for (const session of sessions) {
    const linkedDocClass = session.documentId
      ? (docClassificationMap.get(session.documentId) as any)
      : undefined;
    const classified = CandidateBrainClassifier.classifySession(session, linkedDocClass);
    classifications.push(classified);
  }
  const syntheticSessions = classifications.filter(
    (c) => c.entityType === 'SESSION' && c.classification === 'CONFIRMED_SYNTHETIC',
  );
  console.log(`• CONFIRMED_SYNTHETIC Sessions: ${syntheticSessions.length}`);

  // 4. Experiences
  const experiences = await db
    .select()
    .from(candidateExperiences)
    .where(eq(candidateExperiences.userId, primaryUserId));
  console.log(`\n--- 4. EXPERIENCES (${experiences.length} total) ---`);
  for (const exp of experiences) {
    const classified = CandidateBrainClassifier.classifyExperience(exp, [
      'sample_cv.txt',
      'elena-resume.docx',
    ]);
    classifications.push(classified);
    console.log(
      `• [${classified.classification}] ${exp.organization} — ${exp.position} (${exp.startDate} to ${exp.endDate || 'present'}) [ID: ${exp.id}]`,
    );
    console.log(`  Evidence: ${classified.evidence}`);
    console.log(`  Action:   ${classified.proposedAction}`);
  }

  // 5. Education
  const education = await db
    .select()
    .from(candidateEducation)
    .where(eq(candidateEducation.userId, primaryUserId));
  console.log(`\n--- 5. EDUCATION (${education.length} total) ---`);
  for (const edu of education) {
    const classified = CandidateBrainClassifier.classifyEducation(edu, [
      'sample_cv.txt',
      'elena-resume.docx',
    ]);
    classifications.push(classified);
    console.log(
      `• [${classified.classification}] ${edu.institution} — ${edu.degree || 'Degree'} [ID: ${edu.id}]`,
    );
    console.log(`  Evidence: ${classified.evidence}`);
    console.log(`  Action:   ${classified.proposedAction}`);
  }

  // 6. Skills
  const skills = await db
    .select()
    .from(candidateSkills)
    .where(eq(candidateSkills.userId, primaryUserId));
  console.log(`\n--- 6. SKILLS (${skills.length} total) ---`);
  for (const sk of skills) {
    const classified = CandidateBrainClassifier.classifySkill(sk);
    classifications.push(classified);
    console.log(
      `• [${classified.classification}] ${sk.name} (${sk.proficiency || 'N/A'}) [ID: ${sk.id}]`,
    );
  }

  // 7. Certifications
  const certs = await db
    .select()
    .from(candidateCertifications)
    .where(eq(candidateCertifications.userId, primaryUserId));
  console.log(`\n--- 7. CERTIFICATIONS (${certs.length} total) ---`);
  for (const cert of certs) {
    const classified = CandidateBrainClassifier.classifyCertification(cert);
    classifications.push(classified);
    console.log(
      `• [${classified.classification}] ${cert.name} (${cert.issuingOrganization}) [ID: ${cert.id}]`,
    );
  }

  // 8. Languages
  const languages = await db
    .select()
    .from(candidateLanguages)
    .where(eq(candidateLanguages.userId, primaryUserId));
  console.log(`\n--- 8. LANGUAGES (${languages.length} total) ---`);
  for (const lang of languages) {
    const classified = CandidateBrainClassifier.classifyLanguage(lang);
    classifications.push(classified);
    console.log(
      `• [${classified.classification}] ${lang.language} (${lang.proficiency || 'N/A'}) [ID: ${lang.id}]`,
    );
    console.log(`  Evidence: ${classified.evidence}`);
  }

  // 9. Links
  const links = await db
    .select()
    .from(candidateLinks)
    .where(eq(candidateLinks.userId, primaryUserId));
  console.log(`\n--- 9. LINKS (${links.length} total) ---`);
  for (const lk of links) {
    const classified = CandidateBrainClassifier.classifyLink(lk);
    classifications.push(classified);
    console.log(`• [${classified.classification}] ${lk.label}: ${lk.url} [ID: ${lk.id}]`);
    console.log(`  Evidence: ${classified.evidence}`);
  }

  // 10. Candidate Facts & AI Permissions
  const facts = await db
    .select()
    .from(candidateFacts)
    .where(eq(candidateFacts.userId, primaryUserId));
  console.log(`\n--- 10. CANDIDATE FACTS (${facts.length} total) ---`);
  for (const f of facts) {
    const classified = CandidateBrainClassifier.classifyFact(f);
    classifications.push(classified);
    console.log(
      `• [${classified.classification}] [AI:${f.allowAiUse ? 'YES' : 'NO'}|${f.verificationStatus}] ${f.category}: ${f.statement.slice(0, 60)} [ID: ${f.id}]`,
    );
    if (f.allowAiUse) {
      console.log(`  ⚠️ AI AUTHORIZED! Proposed Action: ${classified.proposedAction}`);
    }
  }

  // Summary Table
  console.log('\n===============================================================');
  console.log('RECORD CLASSIFICATION TALLY');
  console.log('===============================================================');
  const tally = {
    CONFIRMED_AUTHENTIC: classifications.filter((c) => c.classification === 'CONFIRMED_AUTHENTIC')
      .length,
    CONFIRMED_SYNTHETIC: classifications.filter((c) => c.classification === 'CONFIRMED_SYNTHETIC')
      .length,
    POSSIBLY_SYNTHETIC: classifications.filter((c) => c.classification === 'POSSIBLY_SYNTHETIC')
      .length,
    UNDETERMINED: classifications.filter((c) => c.classification === 'UNDETERMINED').length,
  };
  console.log(JSON.stringify(tally, null, 2));

  const aiAuthorizedSyntheticFacts = classifications.filter(
    (c) =>
      c.entityType === 'FACT' &&
      c.classification === 'CONFIRMED_SYNTHETIC' &&
      c.allowAiUse === true,
  );
  console.log(
    `\nSynthetic Facts Requiring AI Permission Revocation: ${aiAuthorizedSyntheticFacts.length}`,
  );
  for (const f of aiAuthorizedSyntheticFacts) {
    console.log(`• ID: ${f.id} — ${f.summary}`);
  }

  await closeDbPool();
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
