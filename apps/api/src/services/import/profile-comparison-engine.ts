import type {
  ExtractedProfileData,
  ProfileImportSection,
  ProfileImportClassification,
  CandidateProfileDto,
  CandidateExperienceDto,
  CandidateEducationDto,
  CandidateSkillDto,
  CandidateCertificationDto,
  CandidateLanguageDto,
  CandidateProjectDto,
  CandidateLinkDto,
} from '@job-agent/shared';

export interface ComparisonItemResult {
  section: ProfileImportSection;
  classification: ProfileImportClassification;
  confidenceScore: number;
  sourceReference: string;
  extractedPayload: Record<string, unknown>;
  existingEntityId: string | null;
  existingPayload: Record<string, unknown> | null;
  conflictDetails: string | null;
}

export interface ExistingCandidateBrainState {
  profile: CandidateProfileDto | null;
  experiences: CandidateExperienceDto[];
  education: CandidateEducationDto[];
  skills: CandidateSkillDto[];
  certifications: CandidateCertificationDto[];
  languages: CandidateLanguageDto[];
  projects: CandidateProjectDto[];
  links: CandidateLinkDto[];
}

export class ProfileComparisonEngine {
  /**
   * Compares extracted candidate data against the existing Candidate Brain state
   * and classifies each item into NEW, DUPLICATE, MATCHED, CONFLICT, INCOMPLETE, or LOW_CONFIDENCE.
   */
  public static compare(
    extracted: ExtractedProfileData,
    existing: ExistingCandidateBrainState,
  ): ComparisonItemResult[] {
    const results: ComparisonItemResult[] = [];

    // 1. Personal Profile comparison
    if (extracted.profile) {
      results.push(...this.compareProfile(extracted.profile, existing.profile));
    }

    // 2. Work Experiences comparison
    for (const exp of extracted.experiences) {
      results.push(this.compareExperience(exp, existing.experiences));
    }

    // 3. Education comparison
    for (const edu of extracted.education) {
      results.push(this.compareEducation(edu, existing.education));
    }

    // 4. Skills comparison
    for (const skill of extracted.skills) {
      results.push(this.compareSkill(skill, existing.skills));
    }

    // 5. Certifications comparison
    for (const cert of extracted.certifications) {
      results.push(this.compareCertification(cert, existing.certifications));
    }

    // 6. Languages comparison
    for (const lang of extracted.languages) {
      results.push(this.compareLanguage(lang, existing.languages));
    }

    // 7. Projects comparison
    for (const proj of extracted.projects) {
      results.push(this.compareProject(proj, existing.projects));
    }

    // 8. Links comparison
    for (const link of extracted.links) {
      results.push(this.compareLink(link, existing.links));
    }

    return results;
  }

  // --- Profile Comparison ---
  private static compareProfile(
    extractedProfile: NonNullable<ExtractedProfileData['profile']>,
    existing: CandidateProfileDto | null,
  ): ComparisonItemResult[] {
    const results: ComparisonItemResult[] = [];
    const payload = extractedProfile as Record<string, unknown>;

    if (!existing) {
      results.push({
        section: 'PROFILE',
        classification: 'NEW',
        confidenceScore: 0.95,
        sourceReference: `Personal info for ${extractedProfile.fullName || 'Candidate'}`,
        extractedPayload: payload,
        existingEntityId: null,
        existingPayload: null,
        conflictDetails: null,
      });
      return results;
    }

    // Check for conflicts in existing vs imported personal profile
    const conflicts: string[] = [];
    if (
      extractedProfile.fullName &&
      existing.fullName &&
      extractedProfile.fullName.trim().toLowerCase() !== existing.fullName.trim().toLowerCase()
    ) {
      conflicts.push(
        `Full name mismatch: existing "${existing.fullName}" vs imported "${extractedProfile.fullName}"`,
      );
    }
    if (
      extractedProfile.email &&
      existing.email &&
      extractedProfile.email.trim().toLowerCase() !== existing.email.trim().toLowerCase()
    ) {
      conflicts.push(
        `Email mismatch: existing "${existing.email}" vs imported "${extractedProfile.email}"`,
      );
    }
    if (
      extractedProfile.phone &&
      existing.phone &&
      extractedProfile.phone.replace(/\D/g, '') !== existing.phone.replace(/\D/g, '')
    ) {
      conflicts.push(
        `Phone mismatch: existing "${existing.phone}" vs imported "${extractedProfile.phone}"`,
      );
    }

    if (conflicts.length > 0) {
      results.push({
        section: 'PROFILE',
        classification: 'CONFLICT',
        confidenceScore: 0.85,
        sourceReference: `Personal details in CV`,
        extractedPayload: payload,
        existingEntityId: existing.id,
        existingPayload: existing as unknown as Record<string, unknown>,
        conflictDetails: conflicts.join('; '),
      });
    } else {
      // Check if there is any new information to enrich
      const hasNewInfo =
        (!existing.headline && extractedProfile.headline) ||
        (!existing.summary && extractedProfile.summary) ||
        (!existing.city && extractedProfile.city) ||
        (!existing.country && extractedProfile.country);

      results.push({
        section: 'PROFILE',
        classification: hasNewInfo ? 'NEW' : 'MATCHED',
        confidenceScore: 0.95,
        sourceReference: `Personal details in CV`,
        extractedPayload: payload,
        existingEntityId: existing.id,
        existingPayload: existing as unknown as Record<string, unknown>,
        conflictDetails: null,
      });
    }

    return results;
  }

  // --- Experience Comparison ---
  private static compareExperience(
    exp: ExtractedProfileData['experiences'][number],
    existingList: CandidateExperienceDto[],
  ): ComparisonItemResult {
    const payload = exp as unknown as Record<string, unknown>;

    // 1. Check INCOMPLETE
    if (
      !exp.organization ||
      !exp.organization.trim() ||
      !exp.position ||
      !exp.position.trim() ||
      !exp.startDate ||
      !exp.startDate.trim()
    ) {
      return {
        section: 'EXPERIENCE',
        classification: 'INCOMPLETE',
        confidenceScore: exp.confidence ?? 0.5,
        sourceReference: exp.sourceReference || 'Experience section',
        extractedPayload: payload,
        existingEntityId: null,
        existingPayload: null,
        conflictDetails:
          'Missing required experience fields (organization, position, or start date)',
      };
    }

    // 2. Check LOW_CONFIDENCE
    if (
      (exp.confidence !== undefined && exp.confidence < 0.6) ||
      (exp.sourceReference && exp.sourceReference.includes('[Unverified citation]'))
    ) {
      return {
        section: 'EXPERIENCE',
        classification: 'LOW_CONFIDENCE',
        confidenceScore: exp.confidence ?? 0.35,
        sourceReference: exp.sourceReference || 'Experience section',
        extractedPayload: payload,
        existingEntityId: null,
        existingPayload: null,
        conflictDetails: exp.sourceReference?.includes('[Unverified citation]')
          ? 'Source citation could not be verified against the uploaded document text'
          : 'Ambiguous experience description extracted from document',
      };
    }

    const expOrg = exp.organization.trim().toLowerCase();
    const expPos = exp.position.trim().toLowerCase();

    // Check matches
    for (const ex of existingList) {
      const exOrg = ex.organization.trim().toLowerCase();
      const exPos = ex.position.trim().toLowerCase();

      const orgMatch = exOrg === expOrg || exOrg.includes(expOrg) || expOrg.includes(exOrg);
      const posMatch = exPos === expPos || exPos.includes(expPos) || expPos.includes(exPos);

      if (orgMatch && posMatch) {
        // Exact or close match
        const datesMatch =
          this.normalizeDate(ex.startDate) === this.normalizeDate(exp.startDate) &&
          this.normalizeDate(ex.endDate || '') === this.normalizeDate(exp.endDate || '');

        if (datesMatch) {
          return {
            section: 'EXPERIENCE',
            classification: ex.verificationStatus === 'VERIFIED' ? 'MATCHED' : 'DUPLICATE',
            confidenceScore: exp.confidence ?? 0.95,
            sourceReference: exp.sourceReference || `${exp.position} at ${exp.organization}`,
            extractedPayload: payload,
            existingEntityId: ex.id,
            existingPayload: ex as unknown as Record<string, unknown>,
            conflictDetails: null,
          };
        } else {
          // Same employer and position, but diverging dates -> CONFLICT
          return {
            section: 'EXPERIENCE',
            classification: 'CONFLICT',
            confidenceScore: exp.confidence ?? 0.9,
            sourceReference: exp.sourceReference || `${exp.position} at ${exp.organization}`,
            extractedPayload: payload,
            existingEntityId: ex.id,
            existingPayload: ex as unknown as Record<string, unknown>,
            conflictDetails: `Date mismatch for ${exp.position} at ${exp.organization}: existing dates (${ex.startDate} to ${ex.endDate || 'present'}) vs imported dates (${exp.startDate} to ${exp.endDate || 'present'})`,
          };
        }
      } else if (orgMatch && !posMatch) {
        // Same employer, overlapping dates, differing title -> CONFLICT
        const datesOverlap = this.normalizeDate(ex.startDate) === this.normalizeDate(exp.startDate);
        if (datesOverlap) {
          return {
            section: 'EXPERIENCE',
            classification: 'CONFLICT',
            confidenceScore: exp.confidence ?? 0.85,
            sourceReference: exp.sourceReference || `${exp.position} at ${exp.organization}`,
            extractedPayload: payload,
            existingEntityId: ex.id,
            existingPayload: ex as unknown as Record<string, unknown>,
            conflictDetails: `Different position for ${ex.organization} during same period: existing "${ex.position}" vs imported "${exp.position}"`,
          };
        }
      }
    }

    // No existing matching experience found -> NEW
    return {
      section: 'EXPERIENCE',
      classification: 'NEW',
      confidenceScore: exp.confidence ?? 0.9,
      sourceReference: exp.sourceReference || `${exp.position} at ${exp.organization}`,
      extractedPayload: payload,
      existingEntityId: null,
      existingPayload: null,
      conflictDetails: null,
    };
  }

  // --- Education Comparison ---
  private static compareEducation(
    edu: ExtractedProfileData['education'][number],
    existingList: CandidateEducationDto[],
  ): ComparisonItemResult {
    const payload = edu as unknown as Record<string, unknown>;

    if (!edu.institution || !edu.institution.trim()) {
      return {
        section: 'EDUCATION',
        classification: 'INCOMPLETE',
        confidenceScore: edu.confidence ?? 0.5,
        sourceReference: edu.sourceReference || 'Education section',
        extractedPayload: payload,
        existingEntityId: null,
        existingPayload: null,
        conflictDetails: 'Missing institution name',
      };
    }

    if (
      (edu.confidence !== undefined && edu.confidence < 0.6) ||
      (edu.sourceReference && edu.sourceReference.includes('[Unverified citation]'))
    ) {
      return {
        section: 'EDUCATION',
        classification: 'LOW_CONFIDENCE',
        confidenceScore: edu.confidence ?? 0.35,
        sourceReference: edu.sourceReference || `${edu.degree || 'Degree'} at ${edu.institution}`,
        extractedPayload: payload,
        existingEntityId: null,
        existingPayload: null,
        conflictDetails: edu.sourceReference?.includes('[Unverified citation]')
          ? 'Source citation could not be verified against the uploaded document text'
          : 'Low confidence education record extracted from document',
      };
    }

    const eduInst = edu.institution.trim().toLowerCase();
    const eduDeg = (edu.degree || '').trim().toLowerCase();

    for (const ex of existingList) {
      const exInst = ex.institution.trim().toLowerCase();
      const exDeg = (ex.degree || '').trim().toLowerCase();

      const instMatch = exInst === eduInst || exInst.includes(eduInst) || eduInst.includes(exInst);

      if (instMatch) {
        if (
          exDeg === eduDeg ||
          (exDeg && eduDeg && (exDeg.includes(eduDeg) || eduDeg.includes(exDeg)))
        ) {
          return {
            section: 'EDUCATION',
            classification: ex.verificationStatus === 'VERIFIED' ? 'MATCHED' : 'DUPLICATE',
            confidenceScore: edu.confidence ?? 0.95,
            sourceReference:
              edu.sourceReference || `${edu.degree || 'Degree'} at ${edu.institution}`,
            extractedPayload: payload,
            existingEntityId: ex.id,
            existingPayload: ex as unknown as Record<string, unknown>,
            conflictDetails: null,
          };
        } else if (exDeg && eduDeg && exDeg !== eduDeg) {
          return {
            section: 'EDUCATION',
            classification: 'CONFLICT',
            confidenceScore: edu.confidence ?? 0.85,
            sourceReference:
              edu.sourceReference || `${edu.degree || 'Degree'} at ${edu.institution}`,
            extractedPayload: payload,
            existingEntityId: ex.id,
            existingPayload: ex as unknown as Record<string, unknown>,
            conflictDetails: `Degree mismatch for ${ex.institution}: existing "${ex.degree}" vs imported "${edu.degree}"`,
          };
        }
      }
    }

    return {
      section: 'EDUCATION',
      classification: 'NEW',
      confidenceScore: edu.confidence ?? 0.9,
      sourceReference: edu.sourceReference || `${edu.degree || 'Degree'} at ${edu.institution}`,
      extractedPayload: payload,
      existingEntityId: null,
      existingPayload: null,
      conflictDetails: null,
    };
  }

  // --- Skills Comparison ---
  private static compareSkill(
    skill: ExtractedProfileData['skills'][number],
    existingList: CandidateSkillDto[],
  ): ComparisonItemResult {
    const payload = skill as unknown as Record<string, unknown>;

    if (!skill.name || !skill.name.trim()) {
      return {
        section: 'SKILL',
        classification: 'INCOMPLETE',
        confidenceScore: 0.5,
        sourceReference: skill.sourceReference || 'Skill',
        extractedPayload: payload,
        existingEntityId: null,
        existingPayload: null,
        conflictDetails: 'Missing skill name',
      };
    }

    if (
      (skill.confidence !== undefined && skill.confidence < 0.6) ||
      (skill.sourceReference && skill.sourceReference.includes('[Unverified citation]'))
    ) {
      return {
        section: 'SKILL',
        classification: 'LOW_CONFIDENCE',
        confidenceScore: skill.confidence ?? 0.35,
        sourceReference: skill.sourceReference || skill.name,
        extractedPayload: payload,
        existingEntityId: null,
        existingPayload: null,
        conflictDetails: skill.sourceReference?.includes('[Unverified citation]')
          ? 'Source citation could not be verified against the uploaded document text'
          : 'Low confidence skill extracted from document',
      };
    }

    const normSkill = this.normalizeSkillName(skill.name);

    for (const ex of existingList) {
      const normEx = this.normalizeSkillName(ex.name);

      if (normSkill === normEx) {
        return {
          section: 'SKILL',
          classification:
            ex.name.trim().toLowerCase() === skill.name.trim().toLowerCase()
              ? 'MATCHED'
              : 'DUPLICATE',
          confidenceScore: skill.confidence ?? 0.95,
          sourceReference: skill.sourceReference || skill.name,
          extractedPayload: payload,
          existingEntityId: ex.id,
          existingPayload: ex as unknown as Record<string, unknown>,
          conflictDetails: null,
        };
      }
    }

    return {
      section: 'SKILL',
      classification: 'NEW',
      confidenceScore: skill.confidence ?? 0.9,
      sourceReference: skill.sourceReference || skill.name,
      extractedPayload: payload,
      existingEntityId: null,
      existingPayload: null,
      conflictDetails: null,
    };
  }

  // --- Certifications Comparison ---
  private static compareCertification(
    cert: ExtractedProfileData['certifications'][number],
    existingList: CandidateCertificationDto[],
  ): ComparisonItemResult {
    const payload = cert as unknown as Record<string, unknown>;

    if (
      !cert.name ||
      !cert.name.trim() ||
      !cert.issuingOrganization ||
      !cert.issuingOrganization.trim()
    ) {
      return {
        section: 'CERTIFICATION',
        classification: 'INCOMPLETE',
        confidenceScore: 0.5,
        sourceReference: cert.sourceReference || 'Certification',
        extractedPayload: payload,
        existingEntityId: null,
        existingPayload: null,
        conflictDetails: 'Missing certification name or issuing organization',
      };
    }

    if (
      (cert.confidence !== undefined && cert.confidence < 0.6) ||
      (cert.sourceReference && cert.sourceReference.includes('[Unverified citation]'))
    ) {
      return {
        section: 'CERTIFICATION',
        classification: 'LOW_CONFIDENCE',
        confidenceScore: cert.confidence ?? 0.35,
        sourceReference: cert.sourceReference || cert.name,
        extractedPayload: payload,
        existingEntityId: null,
        existingPayload: null,
        conflictDetails: cert.sourceReference?.includes('[Unverified citation]')
          ? 'Source citation could not be verified against the uploaded document text'
          : 'Low confidence certification record extracted from document',
      };
    }

    const certName = cert.name.trim().toLowerCase();

    for (const ex of existingList) {
      const exName = ex.name.trim().toLowerCase();
      if (certName === exName || certName.includes(exName) || exName.includes(certName)) {
        return {
          section: 'CERTIFICATION',
          classification: 'MATCHED',
          confidenceScore: cert.confidence ?? 0.95,
          sourceReference: cert.sourceReference || cert.name,
          extractedPayload: payload,
          existingEntityId: ex.id,
          existingPayload: ex as unknown as Record<string, unknown>,
          conflictDetails: null,
        };
      }
    }

    return {
      section: 'CERTIFICATION',
      classification: 'NEW',
      confidenceScore: cert.confidence ?? 0.9,
      sourceReference: cert.sourceReference || cert.name,
      extractedPayload: payload,
      existingEntityId: null,
      existingPayload: null,
      conflictDetails: null,
    };
  }

  // --- Languages Comparison ---
  public static compareLanguage(
    lang: ExtractedProfileData['languages'][number],
    existingList: CandidateLanguageDto[],
  ): ComparisonItemResult {
    const payload = lang as unknown as Record<string, unknown>;

    if (!lang.language || !lang.language.trim()) {
      return {
        section: 'LANGUAGE',
        classification: 'INCOMPLETE',
        confidenceScore: 0.5,
        sourceReference: lang.sourceReference || 'Language',
        extractedPayload: payload,
        existingEntityId: null,
        existingPayload: null,
        conflictDetails: 'Missing required fields: language. Please provide a language name.',
      };
    }

    if (
      (lang.confidence !== undefined && lang.confidence < 0.6) ||
      (lang.sourceReference && lang.sourceReference.includes('[Unverified citation]'))
    ) {
      return {
        section: 'LANGUAGE',
        classification: 'LOW_CONFIDENCE',
        confidenceScore: lang.confidence ?? 0.35,
        sourceReference: lang.sourceReference || lang.language,
        extractedPayload: payload,
        existingEntityId: null,
        existingPayload: null,
        conflictDetails: lang.sourceReference?.includes('[Unverified citation]')
          ? 'Source citation could not be verified against the uploaded document text'
          : 'Low confidence language record extracted from document',
      };
    }

    const langName = lang.language.trim().toLowerCase();

    for (const ex of existingList) {
      if (ex.language.trim().toLowerCase() === langName) {
        return {
          section: 'LANGUAGE',
          classification: 'MATCHED',
          confidenceScore: lang.confidence ?? 0.95,
          sourceReference: lang.sourceReference || lang.language,
          extractedPayload: payload,
          existingEntityId: ex.id,
          existingPayload: ex as unknown as Record<string, unknown>,
          conflictDetails: null,
        };
      }
    }

    return {
      section: 'LANGUAGE',
      classification: 'NEW',
      confidenceScore: lang.confidence ?? 0.9,
      sourceReference: lang.sourceReference || lang.language,
      extractedPayload: payload,
      existingEntityId: null,
      existingPayload: null,
      conflictDetails: null,
    };
  }

  // --- Projects Comparison ---
  private static compareProject(
    proj: ExtractedProfileData['projects'][number],
    existingList: CandidateProjectDto[],
  ): ComparisonItemResult {
    const payload = proj as unknown as Record<string, unknown>;

    if (!proj.name || !proj.name.trim()) {
      return {
        section: 'PROJECT',
        classification: 'INCOMPLETE',
        confidenceScore: 0.5,
        sourceReference: proj.sourceReference || 'Project',
        extractedPayload: payload,
        existingEntityId: null,
        existingPayload: null,
        conflictDetails: 'Missing project name',
      };
    }

    if (
      (proj.confidence !== undefined && proj.confidence < 0.6) ||
      (proj.sourceReference && proj.sourceReference.includes('[Unverified citation]'))
    ) {
      return {
        section: 'PROJECT',
        classification: 'LOW_CONFIDENCE',
        confidenceScore: proj.confidence ?? 0.35,
        sourceReference: proj.sourceReference || proj.name,
        extractedPayload: payload,
        existingEntityId: null,
        existingPayload: null,
        conflictDetails: proj.sourceReference?.includes('[Unverified citation]')
          ? 'Source citation could not be verified against the uploaded document text'
          : 'Low confidence project record extracted from document',
      };
    }

    const projName = proj.name.trim().toLowerCase();

    for (const ex of existingList) {
      if (ex.name.trim().toLowerCase() === projName) {
        return {
          section: 'PROJECT',
          classification: 'MATCHED',
          confidenceScore: proj.confidence ?? 0.95,
          sourceReference: proj.sourceReference || proj.name,
          extractedPayload: payload,
          existingEntityId: ex.id,
          existingPayload: ex as unknown as Record<string, unknown>,
          conflictDetails: null,
        };
      }
    }

    return {
      section: 'PROJECT',
      classification: 'NEW',
      confidenceScore: proj.confidence ?? 0.9,
      sourceReference: proj.sourceReference || proj.name,
      extractedPayload: payload,
      existingEntityId: null,
      existingPayload: null,
      conflictDetails: null,
    };
  }

  // --- Links Comparison ---
  private static compareLink(
    link: ExtractedProfileData['links'][number],
    existingList: CandidateLinkDto[],
  ): ComparisonItemResult {
    const payload = link as unknown as Record<string, unknown>;

    if (!link.url || !link.url.trim() || !link.label || !link.label.trim()) {
      return {
        section: 'LINK',
        classification: 'INCOMPLETE',
        confidenceScore: 0.5,
        sourceReference: link.sourceReference || 'Link',
        extractedPayload: payload,
        existingEntityId: null,
        existingPayload: null,
        conflictDetails: !link.url?.trim()
          ? 'Missing link URL'
          : 'Missing link label (e.g. GitHub, Portfolio, LinkedIn)',
      };
    }

    if (
      (link.confidence !== undefined && link.confidence < 0.6) ||
      (link.sourceReference && link.sourceReference.includes('[Unverified citation]'))
    ) {
      return {
        section: 'LINK',
        classification: 'LOW_CONFIDENCE',
        confidenceScore: link.confidence ?? 0.35,
        sourceReference: link.sourceReference || link.url,
        extractedPayload: payload,
        existingEntityId: null,
        existingPayload: null,
        conflictDetails: link.sourceReference?.includes('[Unverified citation]')
          ? 'Source citation could not be verified against the uploaded document text'
          : 'Low confidence link record extracted from document',
      };
    }

    const normUrl = this.normalizeUrl(link.url);

    for (const ex of existingList) {
      if (this.normalizeUrl(ex.url) === normUrl) {
        return {
          section: 'LINK',
          classification: 'MATCHED',
          confidenceScore: link.confidence ?? 0.95,
          sourceReference: link.sourceReference || link.url,
          extractedPayload: payload,
          existingEntityId: ex.id,
          existingPayload: ex as unknown as Record<string, unknown>,
          conflictDetails: null,
        };
      }
    }

    return {
      section: 'LINK',
      classification: 'NEW',
      confidenceScore: link.confidence ?? 0.9,
      sourceReference: link.sourceReference || link.url,
      extractedPayload: payload,
      existingEntityId: null,
      existingPayload: null,
      conflictDetails: null,
    };
  }

  // Normalization Helpers
  private static normalizeSkillName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[.\-_]/g, '')
      .replace(/\s+/g, '')
      .replace(/js$/, '') // React.js -> React, Node.js -> Node
      .replace(/typescript/g, 'ts')
      .replace(/javascript/g, 'js');
  }

  private static normalizeDate(dateStr: string): string {
    return dateStr
      .toLowerCase()
      .replace(/[^0-9a-z]/g, '')
      .trim();
  }

  private static normalizeUrl(url: string): string {
    return url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .trim();
  }
}
