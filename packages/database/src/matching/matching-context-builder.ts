import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import type { Database } from '../client.js';
import * as schema from '../schema/index.js';
import {
  candidateProfiles,
  candidateExperiences,
  candidateEducation,
  candidateSkills,
  candidateLanguages,
  candidateCertifications,
  candidateProjects,
  candidateFacts,
  jobPreferences,
  applicationPolicy,
} from '../schema/index.js';
import { CandidateEvidenceItemDto, LearnedPreferencesDto } from '@job-agent/shared';
import { AiCandidateContext } from './ai/types.js';

export interface CandidateMatchingContext {
  userId: string;
  candidateProfile: schema.CandidateProfile | null;
  preferences: schema.JobPreferences | null;
  policy: schema.ApplicationPolicy | null;
  experiences: schema.CandidateExperience[];
  education: schema.CandidateEducation[];
  skills: schema.CandidateSkill[];
  languages: schema.CandidateLanguage[];
  certifications: schema.CandidateCertification[];
  projects: schema.CandidateProject[];
  verifiedFacts: schema.CandidateFact[]; // strictly verified & allowAiUse = true
  allCandidateFacts: schema.CandidateFact[];
  transferableCapabilities: string[];
  learnedPreferences: LearnedPreferencesDto | null;
  evidenceMap: Map<string, CandidateEvidenceItemDto>;
  aiContext: AiCandidateContext;
  candidateStateHash: string;
}

export class MatchingContextBuilder {
  constructor(private readonly db: Database) {}

  async buildContext(userId: string): Promise<CandidateMatchingContext> {
    const [
      profileRows,
      prefRows,
      policyRows,
      expRows,
      eduRows,
      skillRows,
      langRows,
      certRows,
      projectRows,
      factRows,
    ] = await Promise.all([
      this.db.select().from(candidateProfiles).where(eq(candidateProfiles.userId, userId)).limit(1),
      this.db.select().from(jobPreferences).where(eq(jobPreferences.userId, userId)).limit(1),
      this.db.select().from(applicationPolicy).where(eq(applicationPolicy.userId, userId)).limit(1),
      this.db.select().from(candidateExperiences).where(eq(candidateExperiences.userId, userId)),
      this.db.select().from(candidateEducation).where(eq(candidateEducation.userId, userId)),
      this.db.select().from(candidateSkills).where(eq(candidateSkills.userId, userId)),
      this.db.select().from(candidateLanguages).where(eq(candidateLanguages.userId, userId)),
      this.db
        .select()
        .from(candidateCertifications)
        .where(eq(candidateCertifications.userId, userId)),
      this.db.select().from(candidateProjects).where(eq(candidateProjects.userId, userId)),
      this.db.select().from(candidateFacts).where(eq(candidateFacts.userId, userId)),
    ]);

    const profile = profileRows[0] ?? null;
    const preferences = prefRows[0] ?? null;
    const policy = policyRows[0] ?? null;

    // Filter verified facts for deterministic evidence resolution
    const verifiedFacts = factRows.filter((f) => f.verificationStatus === 'VERIFIED');
    // Strict Invariant: Only verified facts with allowAiUse === true may enter generative AI contexts
    const verifiedAiFacts = factRows.filter(
      (f) => f.verificationStatus === 'VERIFIED' && f.allowAiUse === true,
    );

    // Map evidence items
    const evidenceMap = new Map<string, CandidateEvidenceItemDto>();

    for (const exp of expRows) {
      const id = `candidate_experience:${exp.id}`;
      evidenceMap.set(id, {
        id,
        type: 'experience',
        label: `Experience: ${exp.position} at ${exp.organization}`,
      });
    }

    for (const skl of skillRows) {
      const id = `candidate_skill:${skl.id}`;
      const level = skl.proficiency ? ` (${skl.proficiency})` : '';
      evidenceMap.set(id, {
        id,
        type: 'skill',
        label: `Skill: ${skl.name}${level}`,
      });
    }

    for (const edu of eduRows) {
      const id = `candidate_education:${edu.id}`;
      const degree = edu.degree ? `${edu.degree} in ` : '';
      evidenceMap.set(id, {
        id,
        type: 'education',
        label: `Education: ${degree}${edu.fieldOfStudy ?? 'Studies'} at ${edu.institution}`,
      });
    }

    for (const lang of langRows) {
      const id = `candidate_language:${lang.id}`;
      const cefr = lang.cefrLevel ? ` [${lang.cefrLevel}]` : '';
      const profDetails = [lang.proficiency, cefr ? cefr.trim() : null].filter(Boolean).join(' ');
      const profSuffix = profDetails ? ` (${profDetails})` : '';
      evidenceMap.set(id, {
        id,
        type: 'language',
        label: `Language: ${lang.language}${profSuffix}`,
      });
    }

    for (const cert of certRows) {
      const id = `candidate_certification:${cert.id}`;
      evidenceMap.set(id, {
        id,
        type: 'certification',
        label: `Certification: ${cert.name} (${cert.issuingOrganization})`,
      });
    }

    for (const proj of projectRows) {
      const id = `candidate_project:${proj.id}`;
      const role = proj.role ? ` (${proj.role})` : '';
      evidenceMap.set(id, {
        id,
        type: 'project',
        label: `Project: ${proj.name}${role}`,
      });
    }

    for (const fact of verifiedFacts) {
      const id = `candidate_fact:${fact.id}`;
      evidenceMap.set(id, {
        id,
        type: 'fact',
        label: `Verified Fact: ${fact.statement}`,
      });
    }

    // Strict Invariant: Only records with verificationStatus === 'VERIFIED' AND allowAiUse === true
    // enter generative AI contexts. Never pass unverified or unauthorized claims to AI.
    const verifiedAiExperiences = expRows.filter(
      (e) => e.verificationStatus === 'VERIFIED' && e.allowAiUse === true,
    );
    const verifiedAiSkills = skillRows.filter(
      (s) => s.verificationStatus === 'VERIFIED' && s.allowAiUse === true,
    );
    const verifiedAiEducation = eduRows.filter(
      (ed) => ed.verificationStatus === 'VERIFIED' && ed.allowAiUse === true,
    );
    const verifiedAiLanguages = langRows.filter(
      (l) => l.verificationStatus === 'VERIFIED' && l.allowAiUse === true,
    );
    const verifiedAiCertifications = certRows.filter(
      (c) => c.verificationStatus === 'VERIFIED' && c.allowAiUse === true,
    );
    const verifiedAiProjects = projectRows.filter(
      (p) => p.verificationStatus === 'VERIFIED' && p.allowAiUse === true,
    );

    // Build privacy-minimized context for AI
    const aiContext: AiCandidateContext = {
      targetRoles: preferences?.targetTitles ?? [],
      experiences: verifiedAiExperiences.map((e) => ({
        id: `candidate_experience:${e.id}`,
        position: e.position,
        organization: e.organization,
        duration: e.endDate ? `${e.startDate} to ${e.endDate}` : `${e.startDate} to present`,
        highlights: Array.isArray(e.achievements) ? e.achievements : [],
      })),
      skills: verifiedAiSkills.map((s) => ({
        id: `candidate_skill:${s.id}`,
        name: s.name,
        proficiency: s.proficiency,
      })),
      education: verifiedAiEducation.map((ed) => ({
        id: `candidate_education:${ed.id}`,
        institution: ed.institution,
        degree: ed.degree,
        fieldOfStudy: ed.fieldOfStudy,
      })),
      languages: verifiedAiLanguages.map((l) => ({
        id: `candidate_language:${l.id}`,
        language: l.language,
        proficiency: l.proficiency,
        cefrLevel: l.cefrLevel,
      })),
      certifications: verifiedAiCertifications.map((c) => ({
        id: `candidate_certification:${c.id}`,
        name: c.name,
        issuingOrganization: c.issuingOrganization,
      })),
      verifiedFacts: verifiedAiFacts.map((f) => ({
        id: `candidate_fact:${f.id}`,
        category: f.category,
        statement: f.statement,
      })),
      projects: verifiedAiProjects.map((p) => ({
        id: `candidate_project:${p.id}`,
        name: p.name,
        role: p.role,
        description: p.description,
      })),
    };

    // Aggregate transferable capabilities
    const transferableSet = new Set<string>();
    if (Array.isArray(profile?.transferableCapabilities)) {
      for (const cap of profile.transferableCapabilities as string[]) transferableSet.add(cap);
    }
    for (const e of expRows) {
      if (Array.isArray(e.transferableCapabilities)) {
        for (const cap of e.transferableCapabilities as string[]) transferableSet.add(cap);
      }
    }
    for (const s of skillRows) {
      if (Array.isArray(s.transferableCapabilities)) {
        for (const cap of s.transferableCapabilities as string[]) transferableSet.add(cap);
      }
      if (s.verificationStatus === 'VERIFIED') {
        const sLower = s.name.toLowerCase();
        if (
          sLower.includes('operation') ||
          sLower.includes('process') ||
          sLower.includes('agile') ||
          sLower.includes('scrum') ||
          sLower.includes('project') ||
          sLower.includes('coordination') ||
          sLower.includes('stakeholder') ||
          sLower.includes('communication') ||
          sLower.includes('analytical') ||
          sLower.includes('workflow') ||
          sLower.includes('jira') ||
          sLower.includes('management')
        ) {
          transferableSet.add(s.name);
        }
      }
    }

    const learnedPreferences = (preferences?.learnedPreferences as LearnedPreferencesDto) || null;

    // Deterministic state hash for staleness detection
    const hash = crypto.createHash('sha256');
    hash.update('v2.0.0:');
    hash.update(profile?.updatedAt?.toISOString() ?? 'none');
    hash.update(preferences?.updatedAt?.toISOString() ?? 'none');
    hash.update(policy?.updatedAt?.toISOString() ?? 'none');
    for (const e of [...expRows].sort((a, b) => a.id.localeCompare(b.id)))
      hash.update(`${e.id}:${e.updatedAt?.toISOString()}:${e.verificationStatus}:${e.allowAiUse}`);
    for (const s of [...skillRows].sort((a, b) => a.id.localeCompare(b.id)))
      hash.update(`${s.id}:${s.updatedAt?.toISOString()}:${s.verificationStatus}:${s.allowAiUse}`);
    for (const ed of [...eduRows].sort((a, b) => a.id.localeCompare(b.id)))
      hash.update(
        `${ed.id}:${ed.updatedAt?.toISOString()}:${ed.verificationStatus}:${ed.allowAiUse}`,
      );
    for (const l of [...langRows].sort((a, b) => a.id.localeCompare(b.id)))
      hash.update(`${l.id}:${l.updatedAt?.toISOString()}:${l.verificationStatus}:${l.allowAiUse}`);
    for (const c of [...certRows].sort((a, b) => a.id.localeCompare(b.id)))
      hash.update(`${c.id}:${c.updatedAt?.toISOString()}:${c.verificationStatus}:${c.allowAiUse}`);
    for (const p of [...projectRows].sort((a, b) => a.id.localeCompare(b.id)))
      hash.update(`${p.id}:${p.updatedAt?.toISOString()}:${p.verificationStatus}:${p.allowAiUse}`);
    for (const f of [...factRows].sort((a, b) => a.id.localeCompare(b.id)))
      hash.update(`${f.id}:${f.updatedAt?.toISOString()}:${f.verificationStatus}:${f.allowAiUse}`);
    const candidateStateHash = hash.digest('hex');

    return {
      userId,
      candidateProfile: profile,
      preferences,
      policy,
      experiences: expRows,
      education: eduRows,
      skills: skillRows,
      languages: langRows,
      certifications: certRows,
      projects: projectRows,
      verifiedFacts,
      allCandidateFacts: factRows,
      transferableCapabilities: Array.from(transferableSet),
      learnedPreferences,
      evidenceMap,
      aiContext,
      candidateStateHash,
    };
  }
}
