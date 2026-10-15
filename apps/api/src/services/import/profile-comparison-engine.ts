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
    for (const exp of extracted.experiences || []) {
      results.push(this.compareExperience(exp, existing.experiences));
    }

    // 3. Education comparison
    for (const edu of extracted.education || []) {
      results.push(this.compareEducation(edu, existing.education));
    }

    // 4. Skills comparison
    for (const skill of extracted.skills || []) {
      results.push(this.compareSkill(skill, existing.skills));
    }

    // 5. Certifications comparison
    for (const cert of extracted.certifications || []) {
      results.push(this.compareCertification(cert, existing.certifications));
    }

    // 6. Languages comparison
    for (const lang of extracted.languages || []) {
      results.push(this.compareLanguage(lang, existing.languages));
    }

    // 7. Projects comparison
    for (const proj of extracted.projects || []) {
      results.push(this.compareProject(proj, existing.projects));
    }

    // 8. Links comparison
    for (const link of extracted.links || []) {
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
    let isPotentialNameMatch = false;

    if (extractedProfile.fullName && existing.fullName) {
      const extNorm = extractedProfile.fullName.trim().toLowerCase();
      const exNorm = existing.fullName.trim().toLowerCase();
      if (extNorm !== exNorm) {
        if (this.isAbbreviatedNameMatch(existing.fullName, extractedProfile.fullName)) {
          isPotentialNameMatch = true;
        } else {
          conflicts.push(
            `Full name mismatch: existing "${existing.fullName}" vs imported "${extractedProfile.fullName}"`,
          );
        }
      }
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

    if (extractedProfile.phone && existing.phone) {
      const matchesPhone = this.isPhoneEquivalent(
        existing.phone,
        extractedProfile.phone,
        existing.country || extractedProfile.country,
      );
      if (!matchesPhone) {
        conflicts.push(
          `Phone mismatch: existing "${existing.phone}" vs imported "${extractedProfile.phone}"`,
        );
      }
    }

    if (conflicts.length > 0) {
      results.push({
        section: 'PROFILE',
        classification: 'CONFLICT',
        confidenceScore: 0.85,
        sourceReference: `Personal info for ${extractedProfile.fullName || 'Candidate'}`,
        extractedPayload: payload,
        existingEntityId: existing.id,
        existingPayload: existing as unknown as Record<string, unknown>,
        conflictDetails: conflicts.join('; '),
      });
    } else if (isPotentialNameMatch) {
      results.push({
        section: 'PROFILE',
        classification: 'POTENTIAL_MATCH',
        confidenceScore: 0.9,
        sourceReference: `Personal info for ${extractedProfile.fullName || 'Candidate'}`,
        extractedPayload: payload,
        existingEntityId: existing.id,
        existingPayload: existing as unknown as Record<string, unknown>,
        conflictDetails: `Abbreviated name matches existing profile: existing "${existing.fullName}" vs imported "${extractedProfile.fullName}"`,
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
        sourceReference: `Personal info for ${extractedProfile.fullName || 'Candidate'}`,
        extractedPayload: payload,
        existingEntityId: existing.id,
        existingPayload: existing as unknown as Record<string, unknown>,
        conflictDetails: null,
      });
    }

    return results;
  }

  // --- Experience Comparison ---
  public static compareExperience(
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
        // Standardized date comparison (e.g. "June 2023" vs "2023-06" match, while "June 2023" vs "May 2023" conflict)
        const stdExStart = this.standardizeDateString(ex.startDate);
        const stdExpStart = this.standardizeDateString(exp.startDate);
        const stdExEnd = this.standardizeDateString(ex.endDate || '');
        const stdExpEnd = this.standardizeDateString(exp.endDate || '');

        const startMatches =
          stdExStart === stdExpStart ||
          (stdExStart &&
            stdExpStart &&
            (stdExStart.startsWith(stdExpStart) || stdExpStart.startsWith(stdExStart)));

        const endMatches =
          stdExEnd === stdExpEnd ||
          (ex.isCurrent && exp.isCurrent) ||
          (stdExEnd &&
            stdExpEnd &&
            (stdExEnd.startsWith(stdExpEnd) || stdExpEnd.startsWith(stdExEnd)));

        const datesMatch = startMatches && endMatches;

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
            conflictDetails: `Date mismatch for ${exp.position} at ${exp.organization}: existing dates (${ex.startDate} to ${ex.endDate || (ex.isCurrent ? 'Present' : '')}) vs imported dates (${exp.startDate} to ${exp.endDate || (exp.isCurrent ? 'Present' : '')})`,
          };
        }
      } else if (orgMatch && !posMatch) {
        // Same employer, overlapping dates, differing title -> CONFLICT
        const stdExStart = this.standardizeDateString(ex.startDate);
        const stdExpStart = this.standardizeDateString(exp.startDate);
        const datesOverlap =
          stdExStart === stdExpStart ||
          (stdExStart &&
            stdExpStart &&
            (stdExStart.startsWith(stdExpStart) || stdExpStart.startsWith(stdExStart)));
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
  public static compareEducation(
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
    const eduDeg = (edu.degree || '').trim();
    const eduField = (edu.fieldOfStudy || '').trim();

    for (const ex of existingList) {
      const exInst = ex.institution.trim().toLowerCase();
      const exDeg = (ex.degree || '').trim();
      const exField = (ex.fieldOfStudy || '').trim();

      const instMatch = exInst === eduInst || exInst.includes(eduInst) || eduInst.includes(exInst);

      if (instMatch) {
        // Degree compatibility (e.g. "B.A." vs "Bachelor of Arts" or "Bachelor's degree")
        const degreeIsCompatible = !exDeg || !eduDeg || this.isDegreeCompatible(exDeg, eduDeg);

        // Field of study compatibility
        const fieldIsCompatible =
          !exField ||
          !eduField ||
          exField.toLowerCase() === eduField.toLowerCase() ||
          exField.toLowerCase().includes(eduField.toLowerCase()) ||
          eduField.toLowerCase().includes(exField.toLowerCase());

        // Date check: check if dates conflict or are compatible
        const exStart = this.standardizeDateString(ex.startDate || '');
        const eduStart = this.standardizeDateString(edu.startDate || '');
        const exEnd = this.standardizeDateString(ex.endDate || '');
        const eduEnd = this.standardizeDateString(edu.endDate || '');

        let dateConflict = false;
        if (exStart && eduStart && exStart !== eduStart) {
          if (!exStart.startsWith(eduStart) && !eduStart.startsWith(exStart)) {
            dateConflict = true;
          }
        }
        if (exEnd && eduEnd && exEnd !== eduEnd) {
          if (!exEnd.startsWith(eduEnd) && !eduEnd.startsWith(exEnd)) {
            dateConflict = true;
          }
        }

        if (degreeIsCompatible && fieldIsCompatible && !dateConflict) {
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
        } else if (!degreeIsCompatible) {
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
        } else if (!fieldIsCompatible) {
          return {
            section: 'EDUCATION',
            classification: 'CONFLICT',
            confidenceScore: edu.confidence ?? 0.85,
            sourceReference:
              edu.sourceReference || `${edu.degree || 'Degree'} at ${edu.institution}`,
            extractedPayload: payload,
            existingEntityId: ex.id,
            existingPayload: ex as unknown as Record<string, unknown>,
            conflictDetails: `Field of study mismatch for ${ex.institution}: existing "${ex.fieldOfStudy}" vs imported "${edu.fieldOfStudy}"`,
          };
        } else if (dateConflict) {
          return {
            section: 'EDUCATION',
            classification: 'CONFLICT',
            confidenceScore: edu.confidence ?? 0.85,
            sourceReference:
              edu.sourceReference || `${edu.degree || 'Degree'} at ${edu.institution}`,
            extractedPayload: payload,
            existingEntityId: ex.id,
            existingPayload: ex as unknown as Record<string, unknown>,
            conflictDetails: `Date mismatch for ${edu.degree || 'Degree'} at ${ex.institution}: existing (${ex.startDate || ''} to ${ex.endDate || ''}) vs imported (${edu.startDate || ''} to ${edu.endDate || ''})`,
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
  public static compareSkill(
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
    const canonicalSkill = this.getCanonicalSkill(skill.name);

    for (const ex of existingList) {
      const normEx = this.normalizeSkillName(ex.name);
      const canonicalEx = this.getCanonicalSkill(ex.name);

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

      if (canonicalSkill === canonicalEx) {
        return {
          section: 'SKILL',
          classification: 'POTENTIAL_MATCH',
          confidenceScore: skill.confidence ?? 0.9,
          sourceReference: skill.sourceReference || skill.name,
          extractedPayload: payload,
          existingEntityId: ex.id,
          existingPayload: ex as unknown as Record<string, unknown>,
          conflictDetails: `Potential equivalent of existing skill "${ex.name}"`,
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
  public static compareCertification(
    cert: ExtractedProfileData['certifications'][number],
    existingList: CandidateCertificationDto[],
  ): ComparisonItemResult {
    const payload = cert as unknown as Record<string, unknown>;

    // 1. Missing name is always incomplete
    if (!cert.name || !cert.name.trim()) {
      return {
        section: 'CERTIFICATION',
        classification: 'INCOMPLETE',
        confidenceScore: 0.5,
        sourceReference: cert.sourceReference || 'Certification',
        extractedPayload: payload,
        existingEntityId: null,
        existingPayload: null,
        conflictDetails: 'Missing certification name. You can enter it manually before approval.',
      };
    }

    // 2. Match against existing certifications BEFORE evaluating missing issuer
    const normCertName = this.normalizeCertificationName(cert.name);

    for (const ex of existingList) {
      const normExName = this.normalizeCertificationName(ex.name);
      const nameMatch =
        normCertName === normExName ||
        normCertName.includes(normExName) ||
        normExName.includes(normCertName);

      if (nameMatch) {
        const certIssuer = (cert.issuingOrganization || '').trim().toLowerCase();
        const exIssuer = (ex.issuingOrganization || '').trim().toLowerCase();

        // If imported issuer is missing/empty, OR both issuers match
        if (
          !certIssuer ||
          !exIssuer ||
          certIssuer === exIssuer ||
          certIssuer.includes(exIssuer) ||
          exIssuer.includes(certIssuer)
        ) {
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
    }

    // 3. For genuinely new certifications, missing issuer requires human review
    if (!cert.issuingOrganization || !cert.issuingOrganization.trim()) {
      return {
        section: 'CERTIFICATION',
        classification: 'INCOMPLETE',
        confidenceScore: cert.confidence ?? 0.5,
        sourceReference: cert.sourceReference || cert.name,
        extractedPayload: payload,
        existingEntityId: null,
        existingPayload: null,
        conflictDetails:
          'Issuing organization is missing. You can enter it manually before approval.',
      };
    }

    // 4. Check LOW_CONFIDENCE
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

  // Normalization & Semantic Matching Helpers
  public static isPhoneEquivalent(
    phone1?: string | null,
    phone2?: string | null,
    _countryHint?: string | null,
  ): boolean {
    if (!phone1 || !phone2) return false;
    const d1 = phone1.replace(/\D/g, '');
    const d2 = phone2.replace(/\D/g, '');
    if (!d1 || !d2) return false;
    if (d1 === d2) return true;

    // Check international prefix vs national number (e.g. "+48 884 665 207" vs "884 665 207")
    const [longer, shorter] = d1.length > d2.length ? [d1, d2] : [d2, d1];
    if (longer.endsWith(shorter) && shorter.length >= 7) {
      const prefix = longer.slice(0, longer.length - shorter.length);
      // Valid international country calling code lengths: 1 to 4 digits
      if (prefix.length >= 1 && prefix.length <= 4) {
        return true;
      }
    }
    return false;
  }

  public static isAbbreviatedNameMatch(
    existingName?: string | null,
    importedName?: string | null,
  ): boolean {
    if (!existingName || !importedName) return false;
    const clean1 = existingName.trim();
    const clean2 = importedName.trim();
    if (!clean1 || !clean2) return false;
    if (clean1.toLowerCase() === clean2.toLowerCase()) return true;

    const t1 = clean1.split(/\s+/).filter(Boolean);
    const t2 = clean2.split(/\s+/).filter(Boolean);

    if (t1.length < 2 || t2.length < 2) return false;

    const first1 = t1[0]!.toLowerCase();
    const first2 = t2[0]!.toLowerCase();
    const last1 = t1[t1.length - 1]!.toLowerCase();
    const last2 = t2[t2.length - 1]!.toLowerCase();

    // Case A: First names match, imported last name is abbreviated (e.g. "Asadbek Makhmudov" vs "Asadbek M." or "Asadbek M")
    const cleanLast2 = last2.replace(/\./g, '');
    if (first1 === first2 && cleanLast2.length === 1 && last1.startsWith(cleanLast2)) {
      return true;
    }

    // Case B: Last names match, imported first name is abbreviated (e.g. "Asadbek Makhmudov" vs "A. Makhmudov")
    const cleanFirst2 = first2.replace(/\./g, '');
    if (last1 === last2 && cleanFirst2.length === 1 && first1.startsWith(cleanFirst2)) {
      return true;
    }

    // Case C: Reverse abbreviation (existing was abbreviated "Asadbek M.", imported has full name "Asadbek Makhmudov")
    const cleanLast1 = last1.replace(/\./g, '');
    if (first1 === first2 && cleanLast1.length === 1 && last2.startsWith(cleanLast1)) {
      return true;
    }
    const cleanFirst1 = first1.replace(/\./g, '');
    if (last1 === last2 && cleanFirst1.length === 1 && first2.startsWith(cleanFirst1)) {
      return true;
    }

    return false;
  }

  public static normalizeCertificationName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[.\-_,()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public static normalizeDegreeType(degreeStr: string): string {
    const clean = degreeStr.toLowerCase().replace(/['’]/g, '');
    if (/\b(b\.?a\.?|bachelor(?:s)?\s*(?:of|in)?\s*arts?)\b/.test(clean)) {
      return 'bachelor_of_arts';
    }
    if (/\b(b\.?s\.?|b\.?sc\.?|b\.?s\.?c\.?|bachelor(?:s)?\s*(?:of|in)?\s*science)\b/.test(clean)) {
      return 'bachelor_of_science';
    }
    if (
      /\b(b\.?e\.?|b\.?tech\.?|bachelor(?:s)?\s*(?:of|in)?\s*(?:engineering|technology))\b/.test(
        clean,
      )
    ) {
      return 'bachelor_of_engineering';
    }
    if (/\b(bachelor(?:s)?(?:\s*degree)?)\b/.test(clean)) {
      return 'bachelor';
    }
    if (/\b(m\.?a\.?|master(?:s)?\s*(?:of|in)?\s*arts?)\b/.test(clean)) {
      return 'master_of_arts';
    }
    if (/\b(m\.?s\.?|m\.?sc\.?|master(?:s)?\s*(?:of|in)?\s*science)\b/.test(clean)) {
      return 'master_of_science';
    }
    if (/\b(mba|master(?:s)?\s*(?:of|in)?\s*business\s*administration)\b/.test(clean)) {
      return 'mba';
    }
    if (/\b(master(?:s)?(?:\s*degree)?)\b/.test(clean)) {
      return 'master';
    }
    if (/\b(ph\.?d\.?|doctor(?:ate)?(?:\s*of\s*philosophy)?)\b/.test(clean)) {
      return 'doctorate';
    }
    if (/\b(associate(?:s)?(?:\s*degree)?|a\.?a\.?|a\.?s\.?)\b/.test(clean)) {
      return 'associate';
    }
    return clean.replace(/[^a-z0-9]/g, '');
  }

  public static isDegreeCompatible(deg1: string, deg2: string): boolean {
    const t1 = this.normalizeDegreeType(deg1);
    const t2 = this.normalizeDegreeType(deg2);
    if (!t1 || !t2) return false;
    if (t1 === t2) return true;
    if (
      (t1 === 'bachelor' && t2.startsWith('bachelor_')) ||
      (t2 === 'bachelor' && t1.startsWith('bachelor_'))
    ) {
      return true;
    }
    if (
      (t1 === 'master' && (t2.startsWith('master_') || t2 === 'mba')) ||
      (t2 === 'master' && (t1.startsWith('master_') || t1 === 'mba'))
    ) {
      return true;
    }
    return false;
  }

  public static standardizeDateString(str: string): string {
    const clean = str.trim().toLowerCase();
    if (!clean) return '';
    const MONTH_MAP: Record<string, string> = {
      january: '01',
      jan: '01',
      february: '02',
      feb: '02',
      march: '03',
      mar: '03',
      april: '04',
      apr: '04',
      may: '05',
      june: '06',
      jun: '06',
      july: '07',
      jul: '07',
      august: '08',
      aug: '08',
      september: '09',
      sep: '09',
      sept: '09',
      october: '10',
      oct: '10',
      november: '11',
      nov: '11',
      december: '12',
      dec: '12',
    };

    // Match "June 2023" or "Jun 2023"
    const monthYear = clean.match(/^([a-z]+)\s+(\d{4})$/);
    if (monthYear && MONTH_MAP[monthYear[1]!]) {
      return `${monthYear[2]}-${MONTH_MAP[monthYear[1]!]}`;
    }

    // Match "2023-06" or "2023/06"
    const ym = clean.match(/^(\d{4})[-/.](\d{1,2})$/);
    if (ym) {
      return `${ym[1]}-${ym[2]!.padStart(2, '0')}`;
    }

    // Match "06/2023" or "06-2023"
    const my = clean.match(/^(\d{1,2})[-/.](\d{4})$/);
    if (my) {
      return `${my[2]}-${my[1]!.padStart(2, '0')}`;
    }

    // Just year "2023"
    const justYear = clean.match(/^(\d{4})$/);
    if (justYear) {
      return justYear[1]!;
    }

    return clean.replace(/[^0-9a-z]/g, '');
  }

  private static readonly SKILL_CANONICAL_MAP: Record<string, string> = {
    agile: 'agile',
    agilemethodology: 'agile',
    agilemethodologies: 'agile',
    agiledelivery: 'agile',
    agileframework: 'agile',
    agilesoftwaredevelopment: 'agile',
    scrum: 'scrum',
    scrummethodology: 'scrum',
    scrumframework: 'scrum',
    scrummaster: 'scrum',
    react: 'react',
    reactjs: 'react',
    node: 'node',
    nodejs: 'node',
    vue: 'vue',
    vuejs: 'vue',
    postgres: 'postgresql',
    postgresql: 'postgresql',
    aws: 'aws',
    amazonwebservices: 'aws',
    gcp: 'gcp',
    googlecloud: 'gcp',
    googlecloudplatform: 'gcp',
    cicd: 'cicd',
    continuousintegration: 'cicd',
    continuousdeployment: 'cicd',
    continuousintegrationcontinuousdeployment: 'cicd',
    ts: 'typescript',
    typescript: 'typescript',
    js: 'javascript',
    javascript: 'javascript',
    k8s: 'kubernetes',
    kubernetes: 'kubernetes',
    docker: 'docker',
    dockers: 'docker',
    golang: 'go',
  };

  public static getCanonicalSkill(name: string): string {
    const norm = name
      .toLowerCase()
      .replace(/[.\-_/]/g, '')
      .replace(/\s+/g, '')
      .replace(/js$/, '');
    return this.SKILL_CANONICAL_MAP[norm] || norm;
  }

  private static normalizeSkillName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[.\-_]/g, '')
      .replace(/\s+/g, '')
      .replace(/js$/, '') // React.js -> React, Node.js -> Node
      .replace(/typescript/g, 'ts')
      .replace(/javascript/g, 'js');
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
