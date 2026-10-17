import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getConfig } from '@job-agent/config';
import {
  getDb,
  closeDbPool,
  users,
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
import { CandidateBrainClassifier } from './candidate-brain-classifier.js';
import { runRemediation, runRollback } from './candidate-brain-remediation-service.js';

describe('Candidate Brain Remediation Safety & Rollback Rehearsal (JOB-SMART-PROFILE-IMPORT)', () => {
  const config = getConfig();
  const db = getDb(config.DATABASE_URL);
  const testUserId = crypto.randomUUID();

  // Authentic entity IDs
  const authExpId = crypto.randomUUID();
  const authEduId = crypto.randomUUID();
  const authSkillId = crypto.randomUUID();
  const authCertId = crypto.randomUUID();
  const authLangId = crypto.randomUUID();
  const authLinkId = crypto.randomUUID();
  const authFactId = crypto.randomUUID();
  const authDocId = crypto.randomUUID();

  // Synthetic entity IDs
  const synthExpId = crypto.randomUUID();
  const synthEduId = crypto.randomUUID();
  const synthSkillId1 = crypto.randomUUID();
  const synthSkillId2 = crypto.randomUUID();
  const synthLangId = crypto.randomUUID();
  const synthLinkId = crypto.randomUUID();
  const synthAiFactId = crypto.randomUUID();
  const synthUnverifiedFactId = crypto.randomUUID();
  const synthDocId = crypto.randomUUID();
  const synthSessionId = crypto.randomUUID();

  let backupFilePath = '';

  beforeAll(async () => {
    // 1. Create isolated test user
    await db.insert(users).values({
      id: testUserId,
      systemKey: `test_remediation_${Date.now()}`,
      name: 'Asadbek Makhmudov',
      email: `test-remediation-${Date.now()}@example.com`,
      emailVerified: true,
      role: 'user',
    });

    // 2. Insert corrupted candidate profile (simulating sample_cv.txt overwrite)
    await db.insert(candidateProfiles).values({
      userId: testUserId,
      fullName: 'Asadbek Makhmudov',
      preferredName: 'Asadbek',
      email: 'asadbek.dev@example.com', // Corrupted
      phone: '+49 151 9876543', // Corrupted
      headline: 'Lead Systems Architect', // Corrupted
      summary: 'Senior architect with extensive experience in cloud distributed systems.', // Corrupted
      city: 'Warsaw',
      country: 'Poland',
      availability: '2 weeks notice',
    });

    // 3. Seed AUTHENTIC records
    await db.insert(candidateExperiences).values({
      id: authExpId,
      userId: testUserId,
      organization: 'Asia Alliance Bank',
      position: 'Operations Assistant',
      startDate: '2023-05',
      endDate: '2023-08',
      isCurrent: false,
      verificationStatus: 'UNVERIFIED',
    });

    await db.insert(candidateEducation).values({
      id: authEduId,
      userId: testUserId,
      institution: 'Vistula University',
      degree: 'Bachelor',
      fieldOfStudy: 'Project Management in Organization',
      startDate: '2023-10',
      isCurrent: true,
      verificationStatus: 'UNVERIFIED',
    });

    await db.insert(candidateSkills).values({
      id: authSkillId,
      userId: testUserId,
      name: 'Project Management',
      category: 'Project Management',
      proficiency: 'ADVANCED',
      verificationStatus: 'UNVERIFIED',
    });

    await db.insert(candidateCertifications).values({
      id: authCertId,
      userId: testUserId,
      name: 'Google Project Management Professional Certificate',
      issuingOrganization: 'Coursera / Google',
      issueDate: '2024-03',
      verificationStatus: 'UNVERIFIED',
    });

    await db.insert(candidateLanguages).values({
      id: authLangId,
      userId: testUserId,
      language: 'English',
      proficiency: 'FLUENT',
      verificationStatus: 'VERIFIED',
    });

    await db.insert(candidateLinks).values({
      id: authLinkId,
      userId: testUserId,
      label: 'LinkedIn',
      url: 'https://linkedin.com/in/asadbekm',
    });

    await db.insert(candidateFacts).values({
      id: authFactId,
      userId: testUserId,
      factKey: 'work_authorization',
      category: 'WORK_AUTHORIZATION',
      statement: 'Legally authorized to work in Poland and the European Union.',
      sourceType: 'MANUAL',
      verificationStatus: 'UNVERIFIED',
      allowAiUse: false,
    });

    await db.insert(candidateDocuments).values({
      id: authDocId,
      userId: testUserId,
      documentType: 'MASTER_CV',
      displayName: 'Resume - Asadbek M.pdf',
      originalFilename: 'Resume - Asadbek M.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 104857,
      storageKey: 'mock-auth-storage-key.pdf',
      isMaster: true,
    });

    // 4. Seed SYNTHETIC test records (simulating test run leakage)
    await db.insert(candidateExperiences).values({
      id: synthExpId,
      userId: testUserId,
      organization: 'Apex Neural Dynamics',
      position: 'Staff Architect',
      startDate: '2022-03',
      isCurrent: true,
      verificationStatus: 'VERIFIED', // Corrupted into verified status
    });

    await db.insert(candidateEducation).values({
      id: synthEduId,
      userId: testUserId,
      institution: 'Stanford University - Ph.D. in Computer Science, 2021',
      degree: 'Ph.D.',
      fieldOfStudy: 'Computer Science',
      startDate: '2017-09',
      endDate: '2021-06',
      verificationStatus: 'UNVERIFIED',
    });

    await db.insert(candidateSkills).values([
      {
        id: synthSkillId1,
        userId: testUserId,
        name: 'PyTorch',
        verificationStatus: 'UNVERIFIED',
      },
      {
        id: synthSkillId2,
        userId: testUserId,
        name: 'TypeScript',
        verificationStatus: 'UNVERIFIED',
      },
    ]);

    await db.insert(candidateLanguages).values({
      id: synthLangId,
      userId: testUserId,
      language: 'German',
      proficiency: 'Full professional proficiency',
      verificationStatus: 'UNVERIFIED',
    });

    await db.insert(candidateLinks).values({
      id: synthLinkId,
      userId: testUserId,
      label: 'LinkedIn',
      url: 'https://linkedin.com/in/asadbek-dev',
    });

    await db.insert(candidateFacts).values([
      {
        id: synthAiFactId,
        userId: testUserId,
        factKey: 'experience_apex',
        category: 'EXPERIENCE',
        statement: 'Staff Architect at Apex Neural Dynamics (2022-03 - present)',
        sourceType: 'DOCUMENT',
        verificationStatus: 'VERIFIED',
        allowAiUse: true, // Corrupted: authorized for AI use!
      },
      {
        id: synthUnverifiedFactId,
        userId: testUserId,
        factKey: 'education_tu_berlin',
        category: 'EDUCATION',
        statement: 'Degree from Technical University Berlin',
        sourceType: 'DOCUMENT',
        verificationStatus: 'UNVERIFIED',
        allowAiUse: false,
      },
    ]);

    await db.insert(candidateDocuments).values({
      id: synthDocId,
      userId: testUserId,
      documentType: 'CV',
      displayName: 'sample_cv.txt',
      originalFilename: 'sample_cv.txt',
      mimeType: 'text/plain',
      sizeBytes: 638,
      storageKey: 'mock-sample-storage-key.txt',
      isMaster: false,
    });

    await db.insert(profileImportSessions).values({
      id: synthSessionId,
      userId: testUserId,
      documentId: synthDocId,
      sourceType: 'CV',
      status: 'COMMITTED',
      originalFilename: 'sample_cv.txt',
      mimeType: 'text/plain',
      storageKey: 'mock-sample-storage-key.txt',
    });
  });

  afterAll(async () => {
    // Teardown isolated test user
    try {
      await db.delete(profileImportSessions).where(eq(profileImportSessions.userId, testUserId));
      await db.delete(candidateDocuments).where(eq(candidateDocuments.userId, testUserId));
      await db.delete(candidateFacts).where(eq(candidateFacts.userId, testUserId));
      await db.delete(candidateLinks).where(eq(candidateLinks.userId, testUserId));
      await db.delete(candidateLanguages).where(eq(candidateLanguages.userId, testUserId));
      await db
        .delete(candidateCertifications)
        .where(eq(candidateCertifications.userId, testUserId));
      await db.delete(candidateSkills).where(eq(candidateSkills.userId, testUserId));
      await db.delete(candidateEducation).where(eq(candidateEducation.userId, testUserId));
      await db.delete(candidateExperiences).where(eq(candidateExperiences.userId, testUserId));
      await db.delete(candidateProfiles).where(eq(candidateProfiles.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));

      if (backupFilePath && fs.existsSync(backupFilePath)) {
        fs.unlinkSync(backupFilePath);
      }
    } catch {
      // Non-blocking teardown
    }
    await closeDbPool();
  });

  it('TEST 1: Record-level classifier correctly distinguishes authentic vs synthetic data without false positives', async () => {
    // 1. Profile classification
    const [p] = await db
      .select()
      .from(candidateProfiles)
      .where(eq(candidateProfiles.userId, testUserId));
    const pClass = CandidateBrainClassifier.classifyProfile(p);
    expect(pClass.classification).toBe('CONFIRMED_SYNTHETIC');
    expect(pClass.proposedAction).toBe('UPDATE_PROFILE');

    // 2. Experience classification
    const exps = await db
      .select()
      .from(candidateExperiences)
      .where(eq(candidateExperiences.userId, testUserId));
    const authExp = exps.find((e) => e.id === authExpId);
    const synthExp = exps.find((e) => e.id === synthExpId);

    expect(CandidateBrainClassifier.classifyExperience(authExp).classification).toBe(
      'CONFIRMED_AUTHENTIC',
    );
    expect(CandidateBrainClassifier.classifyExperience(authExp).proposedAction).toBe('RETAIN');

    expect(CandidateBrainClassifier.classifyExperience(synthExp).classification).toBe(
      'CONFIRMED_SYNTHETIC',
    );
    expect(CandidateBrainClassifier.classifyExperience(synthExp).proposedAction).toBe('DELETE');

    // 3. Education classification
    const edus = await db
      .select()
      .from(candidateEducation)
      .where(eq(candidateEducation.userId, testUserId));
    const authEdu = edus.find((e) => e.id === authEduId);
    const synthEdu = edus.find((e) => e.id === synthEduId);

    expect(CandidateBrainClassifier.classifyEducation(authEdu).classification).toBe(
      'CONFIRMED_AUTHENTIC',
    );
    expect(CandidateBrainClassifier.classifyEducation(synthEdu).classification).toBe(
      'CONFIRMED_SYNTHETIC',
    );

    // 4. Skills classification
    const sks = await db
      .select()
      .from(candidateSkills)
      .where(eq(candidateSkills.userId, testUserId));
    const authSkill = sks.find((s) => s.id === authSkillId);
    const synthSkill1 = sks.find((s) => s.id === synthSkillId1);

    expect(CandidateBrainClassifier.classifySkill(authSkill).classification).toBe(
      'CONFIRMED_AUTHENTIC',
    );
    expect(CandidateBrainClassifier.classifySkill(synthSkill1).classification).toBe(
      'CONFIRMED_SYNTHETIC',
    );

    // 5. Certification classification (Authentic PM certification MUST survive)
    const [cert] = await db
      .select()
      .from(candidateCertifications)
      .where(eq(candidateCertifications.userId, testUserId));
    expect(CandidateBrainClassifier.classifyCertification(cert).classification).toBe(
      'CONFIRMED_AUTHENTIC',
    );
    expect(CandidateBrainClassifier.classifyCertification(cert).proposedAction).toBe('RETAIN');

    // 6. Language classification
    const langs = await db
      .select()
      .from(candidateLanguages)
      .where(eq(candidateLanguages.userId, testUserId));
    const authLang = langs.find((l) => l.id === authLangId);
    const synthLang = langs.find((l) => l.id === synthLangId);

    expect(CandidateBrainClassifier.classifyLanguage(authLang).classification).toBe(
      'CONFIRMED_AUTHENTIC',
    );
    expect(CandidateBrainClassifier.classifyLanguage(synthLang).classification).toBe(
      'CONFIRMED_SYNTHETIC',
    );

    // 7. Facts classification & AI authorization detection
    const fcts = await db
      .select()
      .from(candidateFacts)
      .where(eq(candidateFacts.userId, testUserId));
    const authFact = fcts.find((f) => f.id === authFactId);
    const synthAiFact = fcts.find((f) => f.id === synthAiFactId);

    expect(CandidateBrainClassifier.classifyFact(authFact).classification).toBe(
      'CONFIRMED_AUTHENTIC',
    );
    expect(CandidateBrainClassifier.classifyFact(synthAiFact).classification).toBe(
      'CONFIRMED_SYNTHETIC',
    );
    expect(CandidateBrainClassifier.classifyFact(synthAiFact).proposedAction).toBe('REVOKE_AI');
  });

  it('TEST 2: Dry-run remediation produces manifest but mutates ZERO rows in database', async () => {
    const manifest = await runRemediation(testUserId, {
      isExecute: false,
      hasOwnerApproval: false,
      restoreProfileFields: {
        headline: 'Project Manager',
      },
    });

    expect(manifest.dryRun).toBe(true);
    expect(manifest.totalChanges).toBeGreaterThan(0);
    expect(manifest.aiRevocations).toBe(1);

    // Verify database is completely untouched
    const [p] = await db
      .select()
      .from(candidateProfiles)
      .where(eq(candidateProfiles.userId, testUserId));
    expect(p?.headline).toBe('Lead Systems Architect'); // Still corrupted in DB during dry-run

    const exps = await db
      .select()
      .from(candidateExperiences)
      .where(eq(candidateExperiences.userId, testUserId));
    expect(exps.length).toBe(2); // Both authentic and synthetic still present
  });

  it('TEST 3: Transactional remediation requires owner approval and revokes AI permissions safely', async () => {
    // Attempting to execute without owner approval must throw safety error
    await expect(
      runRemediation(testUserId, {
        isExecute: true,
        hasOwnerApproval: false,
      }),
    ).rejects.toThrow('SAFETY ABORT');

    // Execute with explicit owner approval
    const manifest = await runRemediation(testUserId, {
      isExecute: true,
      hasOwnerApproval: true,
      restoreProfileFields: {
        headline: 'Project Manager',
        summary: 'Project Management student with banking operations experience.',
        email: 'asadbek.mzw@gmail.com',
        phone: '+48884665207',
      },
    });

    expect(manifest.dryRun).toBe(false);

    // Locate the saved backup manifest
    const backupDir = path.resolve(process.cwd(), 'backups');
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('candidate-brain-manifest-') && f.endsWith('.json'))
      .sort()
      .reverse();
    backupFilePath = path.join(backupDir, files[0]!);
    expect(fs.existsSync(backupFilePath)).toBe(true);

    // Assert AUTHENTIC records SURVIVE:
    const exps = await db
      .select()
      .from(candidateExperiences)
      .where(eq(candidateExperiences.userId, testUserId));
    expect(exps.length).toBe(1);
    expect(exps[0]?.organization).toBe('Asia Alliance Bank');

    const edus = await db
      .select()
      .from(candidateEducation)
      .where(eq(candidateEducation.userId, testUserId));
    expect(edus.length).toBe(1);
    expect(edus[0]?.institution).toBe('Vistula University');

    const sks = await db
      .select()
      .from(candidateSkills)
      .where(eq(candidateSkills.userId, testUserId));
    expect(sks.length).toBe(1);
    expect(sks[0]?.name).toBe('Project Management');

    const certs = await db
      .select()
      .from(candidateCertifications)
      .where(eq(candidateCertifications.userId, testUserId));
    expect(certs.length).toBe(1);
    expect(certs[0]?.name).toBe('Google Project Management Professional Certificate');

    const langs = await db
      .select()
      .from(candidateLanguages)
      .where(eq(candidateLanguages.userId, testUserId));
    expect(langs.length).toBe(1);
    expect(langs[0]?.language).toBe('English');

    const docs = await db
      .select()
      .from(candidateDocuments)
      .where(eq(candidateDocuments.userId, testUserId));
    expect(docs.length).toBe(1);
    expect(docs[0]?.originalFilename).toBe('Resume - Asadbek M.pdf');

    // Assert SYNTHETIC records are REMOVED & AI PERMISSIONS REVOKED:
    const fcts = await db
      .select()
      .from(candidateFacts)
      .where(eq(candidateFacts.userId, testUserId));
    expect(fcts.length).toBe(1);
    expect(fcts[0]?.factKey).toBe('work_authorization');
    // Zero facts with allowAiUse remain!
    const aiFacts = fcts.filter((f) => f.allowAiUse);
    expect(aiFacts.length).toBe(0);

    // Assert Profile was restored
    const [p] = await db
      .select()
      .from(candidateProfiles)
      .where(eq(candidateProfiles.userId, testUserId));
    expect(p?.headline).toBe('Project Manager');
    expect(p?.email).toBe('asadbek.mzw@gmail.com');
  });

  it('TEST 4: Targeted rollback restores deleted synthetic records without wiping authentic data', async () => {
    // Run rollback from the saved backup manifest
    await runRollback(backupFilePath);

    // Verify profile restored to previous corrupted state
    const [p] = await db
      .select()
      .from(candidateProfiles)
      .where(eq(candidateProfiles.userId, testUserId));
    expect(p?.headline).toBe('Lead Systems Architect');

    // Verify experiences restored
    const exps = await db
      .select()
      .from(candidateExperiences)
      .where(eq(candidateExperiences.userId, testUserId));
    expect(exps.length).toBe(2);
    expect(exps.some((e) => e.organization === 'Apex Neural Dynamics')).toBe(true);

    // Verify AI fact restored
    const fcts = await db
      .select()
      .from(candidateFacts)
      .where(eq(candidateFacts.userId, testUserId));
    expect(fcts.length).toBe(3);
    const restoredAiFact = fcts.find((f) => f.id === synthAiFactId);
    expect(restoredAiFact?.allowAiUse).toBe(true);
    expect(restoredAiFact?.verificationStatus).toBe('VERIFIED');
  });

  it('TEST 5: Remediation is idempotent and safely re-executable', async () => {
    // Execute remediation again
    await runRemediation(testUserId, {
      isExecute: true,
      hasOwnerApproval: true,
      restoreProfileFields: {
        headline: 'Project Manager',
        email: 'asadbek.mzw@gmail.com',
        phone: '+48884665207',
      },
    });

    // Execute remediation a second time immediately
    const secondManifest = await runRemediation(testUserId, {
      isExecute: true,
      hasOwnerApproval: true,
      restoreProfileFields: {
        headline: 'Project Manager',
        email: 'asadbek.mzw@gmail.com',
        phone: '+48884665207',
      },
    });

    // On second execution, zero synthetic items remain to be deleted
    expect(secondManifest.items.length).toBe(0);
    expect(secondManifest.aiRevocations).toBe(0);

    // Authentic records remain untouched
    const exps = await db
      .select()
      .from(candidateExperiences)
      .where(eq(candidateExperiences.userId, testUserId));
    expect(exps.length).toBe(1);
    expect(exps[0]?.organization).toBe('Asia Alliance Bank');
  });
});
