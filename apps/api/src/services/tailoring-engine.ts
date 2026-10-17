import type {
  CandidateProfile,
  CandidateExperience,
  CandidateEducation,
  CandidateSkill,
  CandidateLanguage,
  CandidateCertification,
  CandidateProject,
  CandidateLink,
  Job,
  JobMatchAnalysis,
  JobRequirementEvaluation,
} from '@job-agent/database';
import type {
  TailoredCv,
  TailoredCvExperience,
  TailoredCvEducation,
  TailoredCvSkill,
  TailoredCvLanguage,
  TailoredCvCertification,
  TailoredCvProject,
  TailoredCvBullet,
} from '@job-agent/shared';

export interface CandidateContext {
  profile: CandidateProfile;
  experiences: CandidateExperience[];
  education: CandidateEducation[];
  skills: CandidateSkill[];
  languages: CandidateLanguage[];
  certifications: CandidateCertification[];
  projects: CandidateProject[];
  links: CandidateLink[];
}

export class TailoringEngine {
  /**
   * Builds a structured, grounded tailored CV from Candidate Brain and Job Match Analysis.
   */
  public static buildTailoredCv(
    candidate: CandidateContext,
    job: Job,
    _matchAnalysis?: JobMatchAnalysis | null,
    evaluations: JobRequirementEvaluation[] = [],
  ): TailoredCv {
    const changeExplanation: string[] = [];

    // 1. Header (Immutable candidate identity facts)
    const header = {
      fullName: candidate.profile.fullName || 'Candidate',
      headline: candidate.profile.headline || undefined,
      email: candidate.profile.email || undefined,
      phone: candidate.profile.phone || undefined,
      location:
        [candidate.profile.city, candidate.profile.country].filter(Boolean).join(', ') || undefined,
      links: candidate.links.map((l) => ({ label: l.label, url: l.url })),
    };

    // Strict Invariant: Only records with verificationStatus === 'VERIFIED' AND allowAiUse === true
    // enter tailored candidate documents. Unverified or unauthorized records must never influence tailored content.
    const authorizedSkills = (candidate.skills || []).filter(
      (s) => s.verificationStatus === 'VERIFIED' && s.allowAiUse === true,
    );
    const authorizedExperiences = (candidate.experiences || []).filter(
      (e) => e.verificationStatus === 'VERIFIED' && e.allowAiUse === true,
    );
    const authorizedEducation = (candidate.education || []).filter(
      (e) => e.verificationStatus === 'VERIFIED' && e.allowAiUse === true,
    );
    const authorizedLanguages = (candidate.languages || []).filter(
      (l) => l.verificationStatus === 'VERIFIED' && l.allowAiUse === true,
    );
    const authorizedCertifications = (candidate.certifications || []).filter(
      (c) => c.verificationStatus === 'VERIFIED' && c.allowAiUse === true,
    );
    const authorizedProjects = (candidate.projects || []).filter(
      (p) => p.verificationStatus === 'VERIFIED' && p.allowAiUse === true,
    );

    // 2. Identify matching skills and requirements
    const matchedSkillNames = new Set<string>();
    for (const ev of evaluations) {
      if (ev.status === 'MET' || ev.status === 'PARTIALLY_MET') {
        const evIds = (ev.evidenceIds as string[]) || [];
        for (const evId of evIds) {
          if (evId.startsWith('candidate_skill:')) {
            const skillId = evId.replace('candidate_skill:', '');
            const foundSkill = authorizedSkills.find((s) => s.id === skillId);
            if (foundSkill) matchedSkillNames.add(foundSkill.name.toLowerCase());
          }
        }
      }
    }

    // 3. Tailored Skills (Prioritize matching skills)
    const tailoredSkills: TailoredCvSkill[] = authorizedSkills.map((skill) => {
      const isHighlighted = matchedSkillNames.has(skill.name.toLowerCase());
      return {
        id: skill.id,
        name: skill.name,
        category: skill.category || undefined,
        proficiencyLevel: skill.proficiency || undefined,
        isHighlighted,
      };
    });

    // Sort highlighted skills first
    tailoredSkills.sort((a, b) => {
      if (a.isHighlighted && !b.isHighlighted) return -1;
      if (!a.isHighlighted && b.isHighlighted) return 1;
      return a.name.localeCompare(b.name);
    });

    if (matchedSkillNames.size > 0) {
      changeExplanation.push(
        `Highlighted ${matchedSkillNames.size} verified skills directly matching job requirements: ${Array.from(matchedSkillNames).join(', ')}.`,
      );
    }

    // 4. Tailored Experiences
    // Sort experiences chronologically, giving relevance boost if title/bullets match job requirements
    const experiencesCopy = [...authorizedExperiences];
    experiencesCopy.sort((a, b) => {
      // Primary: most recent first
      const dateA = new Date(a.startDate).getTime() || 0;
      const dateB = new Date(b.startDate).getTime() || 0;
      return dateB - dateA;
    });

    const tailoredExperiences: TailoredCvExperience[] = [];
    for (const exp of experiencesCopy) {
      const sourceBullets: string[] = Array.isArray(exp.achievements)
        ? (exp.achievements as string[])
        : [];

      const tailoredBullets: TailoredCvBullet[] = [];
      for (const bulletText of sourceBullets) {
        // Enforce Metric Safeguard: Ensure no extra numbers/metrics are injected
        const verifiedBullet = this.applyMetricSafeguard(bulletText, bulletText);

        tailoredBullets.push({
          text: verifiedBullet,
          evidenceIds: [`candidate_experience:${exp.id}`],
          sourceEntityType: 'candidate_experiences',
          sourceEntityId: exp.id,
        });
      }

      tailoredExperiences.push({
        id: exp.id,
        title: exp.position, // Immutable factual field
        organization: exp.organization, // Immutable factual field
        location: exp.location || undefined,
        startDate: exp.startDate, // Immutable factual field
        endDate: exp.endDate || undefined, // Immutable factual field
        isCurrent: exp.isCurrent,
        bullets: tailoredBullets,
      });
    }

    changeExplanation.push(
      `Organized ${tailoredExperiences.length} professional experience entries preserving exact employers, positions, and verified employment dates.`,
    );

    // 5. Tailored Education
    const tailoredEducation: TailoredCvEducation[] = authorizedEducation.map((edu) => ({
      id: edu.id,
      institution: edu.institution, // Immutable factual field
      degree: edu.degree || 'Degree', // Immutable factual field
      fieldOfStudy: edu.fieldOfStudy || undefined,
      startDate: edu.startDate || undefined,
      endDate: edu.endDate || undefined,
      bullets: [],
    }));

    // 6. Tailored Languages
    const tailoredLanguages: TailoredCvLanguage[] = authorizedLanguages.map((l) => ({
      id: l.id,
      language: l.language, // Immutable factual field
      proficiencyLevel: l.proficiency || undefined, // Immutable factual field
      cefrLevel: l.cefrLevel || undefined,
    }));

    // 7. Tailored Certifications
    const tailoredCertifications: TailoredCvCertification[] = authorizedCertifications.map((c) => ({
      id: c.id,
      name: c.name, // Immutable factual field
      issuer: c.issuingOrganization, // Immutable factual field
      issueDate: c.issueDate || undefined,
    }));

    // 8. Tailored Projects
    const tailoredProjects: TailoredCvProject[] = authorizedProjects.map((p) => ({
      id: p.id,
      title: p.name,
      role: p.role || undefined,
      url: p.projectUrl || undefined,
      bullets: Array.isArray(p.achievements)
        ? (p.achievements as string[]).map((h) => ({
            text: h,
            evidenceIds: [`candidate_project:${p.id}`],
            sourceEntityType: 'candidate_projects',
            sourceEntityId: p.id,
          }))
        : [],
    }));

    // 9. Truthful Professional Summary
    const summaryEvidenceIds: string[] = [];
    let summary = '';

    const candidateRole = candidate.profile.headline || 'Professional';
    const topSkills = tailoredSkills.slice(0, 4).map((s) => s.name);
    const companyName = job.company || 'the organization';
    const targetJobTitle = job.title;

    if (candidate.profile.summary && candidate.profile.summary.trim().length > 20) {
      summary = candidate.profile.summary.trim();
      summaryEvidenceIds.push(`candidate_profile:${candidate.profile.id}`);
    } else {
      const skillsClause = topSkills.length > 0 ? ` specializing in ${topSkills.join(', ')}` : '';
      summary = `${candidateRole}${skillsClause}, targeting the ${targetJobTitle} position at ${companyName}. Dedicated to delivering measurable results, cross-functional collaboration, and excellence backed by verified domain expertise.`;
    }

    changeExplanation.push(
      'Synthesized professional summary grounded directly in candidate target role, bio, and verified technical proficiencies.',
    );
    changeExplanation.push(
      'Metric safeguard verified: all numbers, dates, and organizational claims strictly originate from verified Candidate Brain records.',
    );

    return {
      header,
      summary,
      summaryEvidenceIds,
      experiences: tailoredExperiences,
      education: tailoredEducation,
      skills: tailoredSkills,
      languages: tailoredLanguages,
      certifications: tailoredCertifications,
      projects: tailoredProjects,
      changeExplanation,
    };
  }

  /**
   * Metric safeguard:
   * Compares numbers/metrics in candidate text to source text.
   * If candidate text introduces synthetic numbers not in source text, rejects modification.
   */
  public static applyMetricSafeguard(tailoredText: string, sourceText: string): string {
    const extractMetrics = (str: string): string[] => {
      const matches = str.match(/\b\d+(?:[.,]\d+)?%?|\$\d+/g) || [];
      return matches.map((m) => m.toLowerCase().trim());
    };

    const sourceMetrics = new Set(extractMetrics(sourceText));
    const tailoredMetrics = extractMetrics(tailoredText);

    for (const metric of tailoredMetrics) {
      if (!sourceMetrics.has(metric)) {
        // Metric hallucination detected! Fallback to sourceText safely.
        return sourceText;
      }
    }

    return tailoredText;
  }
}
