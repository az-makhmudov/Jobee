import fs from 'node:fs';
import path from 'node:path';
import { eq, inArray, and } from 'drizzle-orm';
import { getConfig } from '@job-agent/config';
import {
  getDb,
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
  profileImportItems,
} from '@job-agent/database';
import { CandidateBrainClassifier, type ClassifiedRecord } from './candidate-brain-classifier.js';

export interface RemediationChangeItem {
  entityType: string;
  recordId: string;
  classification: string;
  confidence: number;
  evidence: string;
  proposedAction: string;
  summary: string;
  rollbackMethod: string;
}

export interface TargetedRemediationManifest {
  manifestVersion: string;
  timestamp: string;
  userId: string;
  environment: string;
  dryRun: boolean;
  totalChanges: number;
  aiRevocations: number;
  profileUpdate: {
    previousFields: Record<string, unknown>;
    restoredFields: Record<string, unknown>;
  } | null;
  items: RemediationChangeItem[];
  preRemediationBackup: {
    profile: any;
    experiences: any[];
    education: any[];
    skills: any[];
    languages: any[];
    links: any[];
    facts: any[];
    documents: any[];
    sessions: any[];
    items: any[];
  };
}

export async function runRemediation(
  userId: string,
  options: {
    isExecute: boolean;
    hasOwnerApproval: boolean;
    restoreProfileFields?: {
      headline?: string;
      summary?: string;
      email?: string;
      phone?: string;
    };
  },
): Promise<TargetedRemediationManifest> {
  const config = getConfig();
  const db = getDb(config.DATABASE_URL);

  const envUrl = new URL(config.DATABASE_URL!);
  const environment = `${envUrl.hostname}:${envUrl.port || 5432}${envUrl.pathname}`;

  // 1. Fetch current candidate records
  const [profile] = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, userId));
  const experiences = await db
    .select()
    .from(candidateExperiences)
    .where(eq(candidateExperiences.userId, userId));
  const education = await db
    .select()
    .from(candidateEducation)
    .where(eq(candidateEducation.userId, userId));
  const skills = await db.select().from(candidateSkills).where(eq(candidateSkills.userId, userId));
  const certs = await db
    .select()
    .from(candidateCertifications)
    .where(eq(candidateCertifications.userId, userId));
  const languages = await db
    .select()
    .from(candidateLanguages)
    .where(eq(candidateLanguages.userId, userId));
  const links = await db.select().from(candidateLinks).where(eq(candidateLinks.userId, userId));
  const facts = await db.select().from(candidateFacts).where(eq(candidateFacts.userId, userId));
  const documents = await db
    .select()
    .from(candidateDocuments)
    .where(eq(candidateDocuments.userId, userId));
  const sessions = await db
    .select()
    .from(profileImportSessions)
    .where(eq(profileImportSessions.userId, userId));
  const items = await db
    .select()
    .from(profileImportItems)
    .where(eq(profileImportItems.userId, userId));

  // 2. Classify every individual record
  const classifiedItems: ClassifiedRecord[] = [];

  if (profile) {
    classifiedItems.push(CandidateBrainClassifier.classifyProfile(profile));
  }

  const docClassificationMap = new Map<string, string>();
  for (const doc of documents) {
    const c = CandidateBrainClassifier.classifyDocument(doc);
    classifiedItems.push(c);
    docClassificationMap.set(doc.id, c.classification);
  }

  for (const session of sessions) {
    const linkedDocClass = session.documentId
      ? (docClassificationMap.get(session.documentId) as any)
      : undefined;
    classifiedItems.push(CandidateBrainClassifier.classifySession(session, linkedDocClass));
  }

  for (const exp of experiences) {
    classifiedItems.push(
      CandidateBrainClassifier.classifyExperience(exp, ['sample_cv.txt', 'elena-resume.docx']),
    );
  }

  for (const edu of education) {
    classifiedItems.push(
      CandidateBrainClassifier.classifyEducation(edu, ['sample_cv.txt', 'elena-resume.docx']),
    );
  }

  for (const sk of skills) {
    classifiedItems.push(CandidateBrainClassifier.classifySkill(sk));
  }

  for (const c of certs) {
    classifiedItems.push(CandidateBrainClassifier.classifyCertification(c));
  }

  for (const lang of languages) {
    classifiedItems.push(CandidateBrainClassifier.classifyLanguage(lang));
  }

  for (const lk of links) {
    classifiedItems.push(CandidateBrainClassifier.classifyLink(lk));
  }

  for (const f of facts) {
    classifiedItems.push(CandidateBrainClassifier.classifyFact(f));
  }

  // Filter ONLY confirmed synthetic records
  const confirmedSynthetic = classifiedItems.filter(
    (c) => c.classification === 'CONFIRMED_SYNTHETIC',
  );

  const syntheticExpIds = confirmedSynthetic
    .filter((c) => c.entityType === 'EXPERIENCE')
    .map((c) => c.id);
  const syntheticEduIds = confirmedSynthetic
    .filter((c) => c.entityType === 'EDUCATION')
    .map((c) => c.id);
  const syntheticSkillIds = confirmedSynthetic
    .filter((c) => c.entityType === 'SKILL')
    .map((c) => c.id);
  const syntheticLangIds = confirmedSynthetic
    .filter((c) => c.entityType === 'LANGUAGE')
    .map((c) => c.id);
  const syntheticLinkIds = confirmedSynthetic
    .filter((c) => c.entityType === 'LINK')
    .map((c) => c.id);
  const syntheticFactIds = confirmedSynthetic
    .filter((c) => c.entityType === 'FACT')
    .map((c) => c.id);
  const syntheticDocIds = confirmedSynthetic
    .filter((c) => c.entityType === 'DOCUMENT')
    .map((c) => c.id);
  const syntheticSessionIds = confirmedSynthetic
    .filter((c) => c.entityType === 'SESSION')
    .map((c) => c.id);

  const aiRevocations = confirmedSynthetic.filter(
    (c) => c.entityType === 'FACT' && c.allowAiUse === true,
  ).length;

  // Build targeted backup containing ONLY the records that will be mutated/deleted
  const backup = {
    profile: profile ? { ...profile } : null,
    experiences: experiences.filter((e) => syntheticExpIds.includes(e.id)),
    education: education.filter((e) => syntheticEduIds.includes(e.id)),
    skills: skills.filter((s) => syntheticSkillIds.includes(s.id)),
    languages: languages.filter((l) => syntheticLangIds.includes(l.id)),
    links: links.filter((l) => syntheticLinkIds.includes(l.id)),
    facts: facts.filter((f) => syntheticFactIds.includes(f.id)),
    documents: documents.filter((d) => syntheticDocIds.includes(d.id)),
    sessions: sessions.filter((s) => syntheticSessionIds.includes(s.id)),
    items: items.filter((i) => syntheticSessionIds.includes(i.sessionId)),
  };

  const manifest: TargetedRemediationManifest = {
    manifestVersion: '2.0.0',
    timestamp: new Date().toISOString(),
    userId,
    environment,
    dryRun: !options.isExecute,
    totalChanges: confirmedSynthetic.length,
    aiRevocations,
    profileUpdate:
      options.restoreProfileFields && profile
        ? {
            previousFields: {
              headline: profile.headline,
              summary: profile.summary,
              email: profile.email,
              phone: profile.phone,
            },
            restoredFields: options.restoreProfileFields,
          }
        : null,
    items: confirmedSynthetic.map((c) => ({
      entityType: c.entityType,
      recordId: c.id,
      classification: c.classification,
      confidence: c.confidence,
      evidence: c.evidence,
      proposedAction: c.proposedAction,
      summary: c.summary,
      rollbackMethod: c.rollbackMethod,
    })),
    preRemediationBackup: backup,
  };

  if (!options.isExecute) {
    return manifest;
  }

  // Safety Gate: Explicit owner approval required
  if (!options.hasOwnerApproval) {
    throw new Error(
      'SAFETY ABORT: Refusing to execute remediation without explicit owner authorization (--confirm-owner-approval).',
    );
  }

  // Save secure backup to disk
  const backupDir = path.resolve(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backupFilename = `candidate-brain-manifest-${Date.now()}.json`;
  const backupPath = path.join(backupDir, backupFilename);
  fs.writeFileSync(backupPath, JSON.stringify(manifest, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });

  // Execute remediation inside a single PostgreSQL transaction
  await db.transaction(async (tx) => {
    // 1. Profile Restoration (if approved and configured)
    if (options.restoreProfileFields) {
      await tx
        .update(candidateProfiles)
        .set({
          ...options.restoreProfileFields,
          updatedAt: new Date(),
        })
        .where(eq(candidateProfiles.userId, userId));
    }

    // 2. Delete synthetic experiences
    if (syntheticExpIds.length > 0) {
      await tx
        .delete(candidateExperiences)
        .where(
          and(
            eq(candidateExperiences.userId, userId),
            inArray(candidateExperiences.id, syntheticExpIds),
          ),
        );
    }

    // 3. Delete synthetic education
    if (syntheticEduIds.length > 0) {
      await tx
        .delete(candidateEducation)
        .where(
          and(
            eq(candidateEducation.userId, userId),
            inArray(candidateEducation.id, syntheticEduIds),
          ),
        );
    }

    // 4. Delete synthetic skills
    if (syntheticSkillIds.length > 0) {
      await tx
        .delete(candidateSkills)
        .where(
          and(eq(candidateSkills.userId, userId), inArray(candidateSkills.id, syntheticSkillIds)),
        );
    }

    // 5. Delete synthetic languages
    if (syntheticLangIds.length > 0) {
      await tx
        .delete(candidateLanguages)
        .where(
          and(
            eq(candidateLanguages.userId, userId),
            inArray(candidateLanguages.id, syntheticLangIds),
          ),
        );
    }

    // 6. Delete synthetic links
    if (syntheticLinkIds.length > 0) {
      await tx
        .delete(candidateLinks)
        .where(
          and(eq(candidateLinks.userId, userId), inArray(candidateLinks.id, syntheticLinkIds)),
        );
    }

    // 7. Delete synthetic candidate facts (revokes all synthetic allowAiUse: true facts)
    if (syntheticFactIds.length > 0) {
      await tx
        .delete(candidateFacts)
        .where(
          and(eq(candidateFacts.userId, userId), inArray(candidateFacts.id, syntheticFactIds)),
        );
    }

    // 8. Delete synthetic import items and sessions
    if (syntheticSessionIds.length > 0) {
      await tx
        .delete(profileImportItems)
        .where(
          and(
            eq(profileImportItems.userId, userId),
            inArray(profileImportItems.sessionId, syntheticSessionIds),
          ),
        );
      await tx
        .delete(profileImportSessions)
        .where(
          and(
            eq(profileImportSessions.userId, userId),
            inArray(profileImportSessions.id, syntheticSessionIds),
          ),
        );
    }

    // 9. Delete synthetic documents
    if (syntheticDocIds.length > 0) {
      await tx
        .delete(candidateDocuments)
        .where(
          and(
            eq(candidateDocuments.userId, userId),
            inArray(candidateDocuments.id, syntheticDocIds),
          ),
        );
    }
  });

  return manifest;
}

export async function runRollback(manifestPath: string): Promise<void> {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest backup file not found at: ${manifestPath}`);
  }

  const raw = fs.readFileSync(manifestPath, 'utf-8');
  const manifest: TargetedRemediationManifest = JSON.parse(raw);
  const userId = manifest.userId;
  const backup = manifest.preRemediationBackup;

  const config = getConfig();
  const db = getDb(config.DATABASE_URL);

  // Targeted rollback inside a single transaction
  await db.transaction(async (tx) => {
    // 1. Restore Profile previous fields
    if (manifest.profileUpdate?.previousFields) {
      await tx
        .update(candidateProfiles)
        .set({
          ...manifest.profileUpdate.previousFields,
          updatedAt: new Date(),
        })
        .where(eq(candidateProfiles.userId, userId));
    }

    // 2. Re-insert deleted experiences
    if (backup.experiences?.length > 0) {
      await tx.insert(candidateExperiences).values(
        backup.experiences.map((e: any) => ({
          ...e,
          createdAt: new Date(e.createdAt),
          updatedAt: new Date(e.updatedAt),
        })),
      );
    }

    // 3. Re-insert deleted education
    if (backup.education?.length > 0) {
      await tx.insert(candidateEducation).values(
        backup.education.map((e: any) => ({
          ...e,
          createdAt: new Date(e.createdAt),
          updatedAt: new Date(e.updatedAt),
        })),
      );
    }

    // 4. Re-insert deleted skills
    if (backup.skills?.length > 0) {
      await tx.insert(candidateSkills).values(
        backup.skills.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        })),
      );
    }

    // 5. Re-insert deleted languages
    if (backup.languages?.length > 0) {
      await tx.insert(candidateLanguages).values(
        backup.languages.map((l: any) => ({
          ...l,
          createdAt: new Date(l.createdAt),
          updatedAt: new Date(l.updatedAt),
        })),
      );
    }

    // 6. Re-insert deleted links
    if (backup.links?.length > 0) {
      await tx.insert(candidateLinks).values(
        backup.links.map((l: any) => ({
          ...l,
          createdAt: new Date(l.createdAt),
          updatedAt: new Date(l.updatedAt),
        })),
      );
    }

    // 7. Re-insert deleted candidate facts
    if (backup.facts?.length > 0) {
      await tx.insert(candidateFacts).values(
        backup.facts.map((f: any) => ({
          ...f,
          createdAt: new Date(f.createdAt),
          updatedAt: new Date(f.updatedAt),
        })),
      );
    }

    // 8. Re-insert deleted documents
    if (backup.documents?.length > 0) {
      await tx.insert(candidateDocuments).values(
        backup.documents.map((d: any) => ({
          ...d,
          createdAt: new Date(d.createdAt),
          updatedAt: new Date(d.updatedAt),
        })),
      );
    }

    // 9. Re-insert deleted sessions
    if (backup.sessions?.length > 0) {
      await tx.insert(profileImportSessions).values(
        backup.sessions.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        })),
      );
    }

    // 10. Re-insert deleted items
    if (backup.items?.length > 0) {
      await tx.insert(profileImportItems).values(
        backup.items.map((i: any) => ({
          ...i,
          createdAt: new Date(i.createdAt),
          updatedAt: new Date(i.updatedAt),
        })),
      );
    }
  });
}
