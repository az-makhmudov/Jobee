import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import type { Database } from '@job-agent/database';
import * as schema from '@job-agent/database';
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
} from '@job-agent/database';
import {
  CandidateEvidenceItemDto,
  CandidateIntelligenceSummaryDto,
  LearnedPreferencesDto,
} from '@job-agent/shared';

export interface TrustedCandidateIntelligenceContext {
  userId: string;
  contextVersion: string;
  candidateStateHash: string;
  transferableCapabilities: string[];
  profile: schema.CandidateProfile | null;
  preferences: schema.JobPreferences | null;
  policy: schema.ApplicationPolicy | null;
  // All candidate records
  allExperiences: schema.CandidateExperience[];
  allEducation: schema.CandidateEducation[];
  allSkills: schema.CandidateSkill[];
  allLanguages: schema.CandidateLanguage[];
  allCertifications: schema.CandidateCertification[];
  allProjects: schema.CandidateProject[];
  allFacts: schema.CandidateFact[];
  // Strictly verified AND authorized for AI
  verifiedAiExperiences: schema.CandidateExperience[];
  verifiedAiEducation: schema.CandidateEducation[];
  verifiedAiSkills: schema.CandidateSkill[];
  verifiedAiLanguages: schema.CandidateLanguage[];
  verifiedAiCertifications: schema.CandidateCertification[];
  verifiedAiProjects: schema.CandidateProject[];
  verifiedAiFacts: schema.CandidateFact[];
  // Evidence map
  evidenceMap: Map<string, CandidateEvidenceItemDto>;
  // Privacy-minimized prompt context for AI
  aiPromptContext: {
    targetRoles: string[];
    adjacentRoles: string[];
    preferredIndustries: string[];
    careerTransitions: string[];
    experiences: {
      id: string;
      position: string;
      organization: string;
      duration: string;
      responsibilities: string[];
      achievements: string[];
      transferableCapabilities: string[];
    }[];
    skills: {
      id: string;
      name: string;
      proficiency: string | null;
      isTool: boolean;
      transferableCapabilities: string[];
    }[];
    education: {
      id: string;
      institution: string;
      degree: string | null;
      fieldOfStudy: string | null;
    }[];
    languages: {
      id: string;
      language: string;
      proficiency: string | null;
      cefrLevel: string | null;
    }[];
    certifications: {
      id: string;
      name: string;
      issuingOrganization: string;
    }[];
    verifiedFacts: {
      id: string;
      category: string;
      statement: string;
    }[];
  };
  // Career summary for UI
  summary: CandidateIntelligenceSummaryDto;
}

export class CandidateIntelligenceContextBuilder {
  constructor(private readonly db: Database) {}

  async build(userId: string): Promise<TrustedCandidateIntelligenceContext> {
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

    // Filter strictly verified AND allowAiUse = true
    // Note: If an experience/education/skill is VERIFIED and allowAiUse is true, it is AI-authorized.
    // If allowAiUse is not yet set (legacy data) but verificationStatus is VERIFIED, we check allowAiUse.
    const verifiedAiExperiences = expRows.filter(
      (e) => e.verificationStatus === 'VERIFIED' && e.allowAiUse === true,
    );
    const verifiedAiEducation = eduRows.filter(
      (ed) => ed.verificationStatus === 'VERIFIED' && ed.allowAiUse === true,
    );
    const verifiedAiSkills = skillRows.filter(
      (s) => s.verificationStatus === 'VERIFIED' && s.allowAiUse === true,
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
    const verifiedAiFacts = factRows.filter(
      (f) => f.verificationStatus === 'VERIFIED' && f.allowAiUse === true,
    );

    // Build evidence items map with deterministic IDs
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

    for (const fact of factRows) {
      const id = `candidate_fact:${fact.id}`;
      evidenceMap.set(id, {
        id,
        type: 'fact',
        label: `Fact: ${fact.statement}`,
      });
    }

    // Build privacy-minimized context for generative AI
    // Strips PII (email, phone, street address), sends only professional qualifications
    // For experiences/skills: only include items authorized for AI use!
    // If no items have allowAiUse=true yet (initial candidate state), include verified items with minimal footprint
    const experiencesForAi =
      verifiedAiExperiences.length > 0
        ? verifiedAiExperiences
        : expRows.filter((e) => e.verificationStatus === 'VERIFIED');
    const skillsForAi =
      verifiedAiSkills.length > 0
        ? verifiedAiSkills
        : skillRows.filter((s) => s.verificationStatus === 'VERIFIED');
    const educationForAi =
      verifiedAiEducation.length > 0
        ? verifiedAiEducation
        : eduRows.filter((e) => e.verificationStatus === 'VERIFIED');
    const languagesForAi =
      verifiedAiLanguages.length > 0
        ? verifiedAiLanguages
        : langRows.filter((l) => l.verificationStatus === 'VERIFIED');
    const certsForAi =
      verifiedAiCertifications.length > 0
        ? verifiedAiCertifications
        : certRows.filter((c) => c.verificationStatus === 'VERIFIED');

    const aiPromptContext = {
      targetRoles: preferences?.targetTitles ?? [],
      adjacentRoles: (preferences?.adjacentRoles as string[]) ?? [],
      preferredIndustries: (preferences?.preferredIndustries as string[]) ?? [],
      careerTransitions: (preferences?.careerTransitions as string[]) ?? [],
      experiences: experiencesForAi.map((e) => ({
        id: `candidate_experience:${e.id}`,
        position: e.position,
        organization: e.organization,
        duration: e.endDate ? `${e.startDate} to ${e.endDate}` : `${e.startDate} to present`,
        responsibilities: Array.isArray(e.responsibilities) ? (e.responsibilities as string[]) : [],
        achievements: Array.isArray(e.achievements) ? (e.achievements as string[]) : [],
        transferableCapabilities: Array.isArray(e.transferableCapabilities)
          ? (e.transferableCapabilities as string[])
          : [],
      })),
      skills: skillsForAi.map((s) => ({
        id: `candidate_skill:${s.id}`,
        name: s.name,
        proficiency: s.proficiency,
        isTool: s.isTool ?? false,
        transferableCapabilities: Array.isArray(s.transferableCapabilities)
          ? (s.transferableCapabilities as string[])
          : [],
      })),
      education: educationForAi.map((ed) => ({
        id: `candidate_education:${ed.id}`,
        institution: ed.institution,
        degree: ed.degree,
        fieldOfStudy: ed.fieldOfStudy,
      })),
      languages: languagesForAi.map((l) => ({
        id: `candidate_language:${l.id}`,
        language: l.language,
        proficiency: l.proficiency,
        cefrLevel: l.cefrLevel,
      })),
      certifications: certsForAi.map((c) => ({
        id: `candidate_certification:${c.id}`,
        name: c.name,
        issuingOrganization: c.issuingOrganization,
      })),
      verifiedFacts: verifiedAiFacts.map((f) => ({
        id: `candidate_fact:${f.id}`,
        category: f.category,
        statement: f.statement,
      })),
    };

    // Deterministic state hash for cache invalidation & staleness
    const hash = crypto.createHash('sha256');
    hash.update('v2.0.0:');
    hash.update(profile?.updatedAt?.toISOString() ?? 'none');
    hash.update(preferences?.updatedAt?.toISOString() ?? 'none');
    hash.update(policy?.updatedAt?.toISOString() ?? 'none');
    for (const e of expRows)
      hash.update(`${e.id}:${e.updatedAt?.toISOString()}:${e.verificationStatus}:${e.allowAiUse}`);
    for (const s of skillRows)
      hash.update(`${s.id}:${s.updatedAt?.toISOString()}:${s.verificationStatus}:${s.allowAiUse}`);
    for (const ed of eduRows)
      hash.update(`${ed.id}:${ed.updatedAt?.toISOString()}:${ed.verificationStatus}:${ed.allowAiUse}`);
    for (const l of langRows)
      hash.update(`${l.id}:${l.updatedAt?.toISOString()}:${l.verificationStatus}:${l.allowAiUse}`);
    for (const c of certRows)
      hash.update(`${c.id}:${c.updatedAt?.toISOString()}:${c.verificationStatus}:${c.allowAiUse}`);
    for (const p of projectRows)
      hash.update(`${p.id}:${p.updatedAt?.toISOString()}:${p.verificationStatus}:${p.allowAiUse}`);
    for (const f of factRows)
      hash.update(`${f.id}:${f.updatedAt?.toISOString()}:${f.verificationStatus}:${f.allowAiUse}`);
    const candidateStateHash = hash.digest('hex');

    // Aggregate transferable capabilities from experiences, skills, and profile
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
    }

    // High-impact questions for clarification
    const clarifications: CandidateIntelligenceSummaryDto['whatNeedsClarification'] = [];

    // 1. Work authorization countries
    const workAuthCountries = (preferences?.workAuthorizationCountries as string[]) ?? [];
    if (workAuthCountries.length === 0) {
      clarifications.push({
        category: 'ELIGIBILITY',
        question: 'Which countries or regions are you legally authorized to work in?',
        field: 'workAuthorizationCountries',
        impact: 'HIGH',
        suggestedValues: ['Poland', 'European Union', 'United States', 'United Kingdom'],
      });
    }

    // 2. Sponsorship requirements
    if (preferences?.needsSponsorship === null || preferences?.needsSponsorship === undefined) {
      clarifications.push({
        category: 'ELIGIBILITY',
        question: 'Do you require employer visa sponsorship for work authorization?',
        field: 'needsSponsorship',
        impact: 'HIGH',
        suggestedValues: ['No, I do not require sponsorship', 'Yes, I require sponsorship'],
      });
    }

    // 3. Availability / Notice Period
    if (!profile?.availability && !preferences?.availability) {
      clarifications.push({
        category: 'AVAILABILITY',
        question: 'What is your current availability or notice period?',
        field: 'availability',
        impact: 'MEDIUM',
        suggestedValues: ['Immediate', '2 weeks', '1 month', '3 months'],
      });
    }

    // 4. Target Compensation
    if (!preferences?.minSalary && !profile?.targetSalary) {
      clarifications.push({
        category: 'COMPENSATION',
        question: 'What is your minimum acceptable or target annual salary?',
        field: 'minSalary',
        impact: 'MEDIUM',
      });
    }

    // 5. Unverified sensitive facts
    const unverifiedFacts = factRows.filter((f) => f.verificationStatus !== 'VERIFIED');
    for (const uf of unverifiedFacts.slice(0, 3)) {
      clarifications.push({
        category: 'VERIFICATION',
        question: `Confirm statement: "${uf.statement}"`,
        field: `fact:${uf.id}`,
        impact: 'HIGH',
        suggestedValues: ['Verify and allow AI use', 'Reject statement'],
      });
    }

    // Learned preferences
    const defaultLearnedPrefs: LearnedPreferencesDto = {
      downvotedIndustries: [],
      downvotedLocations: [],
      downvotedCompanies: [],
      tooSeniorCount: 0,
      tooJuniorCount: 0,
      feedbackCounts: {},
    };
    const learnedPreferences: LearnedPreferencesDto =
      (preferences?.learnedPreferences as LearnedPreferencesDto) || defaultLearnedPrefs;

    // Industries from experiences and preferences
    const industrySet = new Set<string>();
    for (const e of expRows) {
      if (e.industry) industrySet.add(e.industry);
    }
    for (const ind of (preferences?.preferredIndustries as string[]) || []) {
      industrySet.add(ind);
    }

    const summary: CandidateIntelligenceSummaryDto = {
      whatJobeeKnows: {
        verifiedSkills: skillRows
          .filter((s) => s.verificationStatus === 'VERIFIED')
          .map((s) => s.name),
        verifiedExperiences: expRows
          .filter((e) => e.verificationStatus === 'VERIFIED')
          .map((e) => ({
            position: e.position,
            organization: e.organization,
            duration: e.endDate ? `${e.startDate} - ${e.endDate}` : `${e.startDate} - Present`,
          })),
        verifiedEducation: eduRows
          .filter((ed) => ed.verificationStatus === 'VERIFIED')
          .map((ed) => ({
            institution: ed.institution,
            degree: ed.degree,
          })),
        workAuthorization: workAuthCountries.length > 0 ? workAuthCountries : ['Poland', 'EU'],
        industries: Array.from(industrySet),
        transferableCapabilities: Array.from(transferableSet),
      },
      whatNeedsClarification: clarifications,
      verifiedCount:
        skillRows.filter((s) => s.verificationStatus === 'VERIFIED').length +
        expRows.filter((e) => e.verificationStatus === 'VERIFIED').length +
        eduRows.filter((e) => e.verificationStatus === 'VERIFIED').length +
        certRows.filter((c) => c.verificationStatus === 'VERIFIED').length +
        factRows.filter((f) => f.verificationStatus === 'VERIFIED').length,
      aiSuggestedCount: 0, // Will be filled dynamically by querying pending suggestions
      suitableCareerPaths: {
        primaryRoles: preferences?.targetTitles || [],
        adjacentRoles: (preferences?.adjacentRoles as string[]) || [],
        careerTransitions: (preferences?.careerTransitions as string[]) || [],
        transferableCapabilities: Array.from(transferableSet),
      },
      matchingConstraints: {
        workModes: preferences?.workModes || [],
        locations: preferences?.preferredLocations || [],
        minSalary: preferences?.minSalary || profile?.targetSalary || null,
        excludedCompanies: preferences?.excludedCompanies || [],
        excludedKeywords: preferences?.excludedKeywords || [],
        sponsorshipNeeded: preferences?.needsSponsorship ?? null,
      },
      learnedPreferences,
    };

    return {
      userId,
      contextVersion: '2.0.0',
      candidateStateHash,
      transferableCapabilities: Array.from(transferableSet),
      profile,
      preferences,
      policy,
      allExperiences: expRows,
      allEducation: eduRows,
      allSkills: skillRows,
      allLanguages: langRows,
      allCertifications: certRows,
      allProjects: projectRows,
      allFacts: factRows,
      verifiedAiExperiences,
      verifiedAiEducation,
      verifiedAiSkills,
      verifiedAiLanguages,
      verifiedAiCertifications,
      verifiedAiProjects,
      verifiedAiFacts,
      evidenceMap,
      aiPromptContext,
      summary,
    };
  }
}
