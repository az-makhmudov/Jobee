import { JobRequirement } from '@job-agent/database';
import { RequirementEvaluationStatus, CandidateEvidenceItemDto } from '@job-agent/shared';
import { CandidateMatchingContext } from './matching-context-builder.js';

export interface DeterministicEvaluationResult {
  requirementId: string;
  status: RequirementEvaluationStatus;
  evidenceIds: string[];
  evidenceItems: CandidateEvidenceItemDto[];
  reason: string;
  confidence: number; // 0 - 100
  contributesToBlocker: boolean;
}

const CEFR_RANKS: Record<string, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

function normalizeToken(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s+#.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class CandidateEvidenceResolver {
  evaluateRequirement(
    req: JobRequirement,
    context: CandidateMatchingContext,
  ): DeterministicEvaluationResult {
    const category = req.category;
    const isMandatory = req.requirementStrength === 'MANDATORY';

    // 1. SKILL
    if (category === 'SKILL') {
      return this.evaluateSkillRequirement(req, context, isMandatory);
    }

    // 2. LANGUAGE
    if (category === 'LANGUAGE') {
      return this.evaluateLanguageRequirement(req, context, isMandatory);
    }

    // 3. EDUCATION
    if (category === 'EDUCATION') {
      return this.evaluateEducationRequirement(req, context, isMandatory);
    }

    // 4. CERTIFICATION
    if (category === 'CERTIFICATION') {
      return this.evaluateCertificationRequirement(req, context, isMandatory);
    }

    // 5. EXPERIENCE
    if (category === 'EXPERIENCE') {
      return this.evaluateExperienceRequirement(req, context, isMandatory);
    }

    // 6. WORK_AUTHORIZATION
    if (category === 'WORK_AUTHORIZATION') {
      return this.evaluateWorkAuthRequirement(req, context, isMandatory);
    }

    // 7. LOCATION
    if (category === 'LOCATION') {
      return this.evaluateLocationRequirement(req, context, isMandatory);
    }

    // 8. RESPONSIBILITY: Responsibilities are NOT mandatory hiring requirements
    if (category === 'RESPONSIBILITY') {
      return {
        requirementId: req.id,
        status: 'UNKNOWN',
        evidenceIds: [],
        evidenceItems: [],
        reason:
          'Job duty/responsibility preserved for reference; not evaluated as a hiring blocker',
        confidence: 80,
        contributesToBlocker: false,
      };
    }

    // 9. OTHER / GENERIC
    // Check if any candidate skill or experience keyword is mentioned
    return this.evaluateGenericRequirement(req, context);
  }

  private evaluateSkillRequirement(
    req: JobRequirement,
    context: CandidateMatchingContext,
    isMandatory: boolean,
  ): DeterministicEvaluationResult {
    const rawNorm = normalizeToken(req.rawText);
    const matchedEvidenceIds: string[] = [];
    const matchedEvidenceItems: CandidateEvidenceItemDto[] = [];

    for (const skill of context.skills) {
      const skillNorm = normalizeToken(skill.name);
      if (
        skillNorm.length >= 2 &&
        (rawNorm.includes(skillNorm) || this.skillMatchesFuzzy(skillNorm, rawNorm))
      ) {
        const id = skill.id.startsWith('candidate_skill:')
          ? skill.id
          : `candidate_skill:${skill.id}`;
        matchedEvidenceIds.push(id);
        const item = context.evidenceMap.get(id);
        if (item) matchedEvidenceItems.push(item);
      }
    }

    // Also check candidate projects for mentioned skills
    for (const project of context.projects) {
      if (Array.isArray(project.skills)) {
        for (const projSkill of project.skills) {
          const sNorm = normalizeToken(projSkill);
          if (sNorm.length >= 2 && rawNorm.includes(sNorm)) {
            const id = `candidate_project:${project.id}`;
            if (!matchedEvidenceIds.includes(id)) {
              matchedEvidenceIds.push(id);
              const item = context.evidenceMap.get(id);
              if (item) matchedEvidenceItems.push(item);
            }
          }
        }
      }
    }

    if (matchedEvidenceIds.length > 0) {
      return {
        requirementId: req.id,
        status: 'MET',
        evidenceIds: matchedEvidenceIds,
        evidenceItems: matchedEvidenceItems,
        reason: `Matched candidate skills: ${matchedEvidenceItems.map((i) => i.label).join(', ')}`,
        confidence: 85,
        contributesToBlocker: false,
      };
    }

    return {
      requirementId: req.id,
      status: 'NOT_MET',
      evidenceIds: [],
      evidenceItems: [],
      reason: `No verified candidate skill found matching '${req.rawText}'`,
      confidence: 70,
      contributesToBlocker: isMandatory,
    };
  }

  private skillMatchesFuzzy(skill: string, text: string): boolean {
    const aliases: Record<string, string[]> = {
      'c++': ['cpp'],
      'node.js': ['nodejs', 'node'],
      react: ['react.js', 'reactjs'],
      vue: ['vue.js', 'vuejs'],
      typescript: ['ts'],
      javascript: ['js'],
      postgres: ['postgresql'],
      k8s: ['kubernetes'],
    };

    const targetAliases = aliases[skill] || [];
    for (const alias of targetAliases) {
      if (text.includes(alias)) return true;
    }
    return false;
  }

  private evaluateLanguageRequirement(
    req: JobRequirement,
    context: CandidateMatchingContext,
    isMandatory: boolean,
  ): DeterministicEvaluationResult {
    const rawLower = req.rawText.toLowerCase();

    for (const lang of context.languages) {
      const langName = lang.language.toLowerCase();
      if (rawLower.includes(langName)) {
        const id = lang.id.startsWith('candidate_language:')
          ? lang.id
          : `candidate_language:${lang.id}`;
        const item = context.evidenceMap.get(id);
        const items = item ? [item] : [];

        // Check CEFR level comparison if job explicitly specifies a CEFR code (A1..C2)
        const jobCefrMatch = req.rawText.match(/\b([A-C][1-2])\b/i);
        const candCefr =
          lang.cefrLevel || (CEFR_RANKS[lang.proficiency?.toUpperCase()] ? lang.proficiency : null);
        if (jobCefrMatch && jobCefrMatch[1] && candCefr) {
          const reqLevel = jobCefrMatch[1].toUpperCase();
          const candLevel = candCefr.toUpperCase();
          const reqRank = CEFR_RANKS[reqLevel] ?? 0;
          const candRank = CEFR_RANKS[candLevel] ?? 0;

          if (candRank < reqRank) {
            return {
              requirementId: req.id,
              status: 'NOT_MET',
              evidenceIds: [id],
              evidenceItems: items,
              reason: `Candidate ${lang.language} level (${candLevel}) is below required level (${reqLevel})`,
              confidence: 90,
              contributesToBlocker: isMandatory,
            };
          }
        }

        return {
          requirementId: req.id,
          status: 'MET',
          evidenceIds: [id],
          evidenceItems: items,
          reason: `Candidate proficient in ${lang.language} (${lang.proficiency}${lang.cefrLevel ? `, ${lang.cefrLevel}` : ''})`,
          confidence: 90,
          contributesToBlocker: false,
        };
      }
    }

    return {
      requirementId: req.id,
      status: 'UNKNOWN',
      evidenceIds: [],
      evidenceItems: [],
      reason: `No candidate language record found for language requirement '${req.rawText}'`,
      confidence: 60,
      contributesToBlocker: isMandatory,
    };
  }

  private evaluateEducationRequirement(
    req: JobRequirement,
    context: CandidateMatchingContext,
    isMandatory: boolean,
  ): DeterministicEvaluationResult {
    const rawLower = req.rawText.toLowerCase();
    const isDegreeReq =
      rawLower.includes('bachelor') ||
      rawLower.includes('master') ||
      rawLower.includes('degree') ||
      rawLower.includes('phd') ||
      rawLower.includes('doctorate');

    if (!isDegreeReq) {
      return {
        requirementId: req.id,
        status: 'UNKNOWN',
        evidenceIds: [],
        evidenceItems: [],
        reason: 'Education requirement does not specify a recognized degree',
        confidence: 50,
        contributesToBlocker: false,
      };
    }

    if (context.education.length > 0 && context.education[0]) {
      const edu = context.education[0];
      const id = `candidate_education:${edu.id}`;
      const item = context.evidenceMap.get(id);

      return {
        requirementId: req.id,
        status: 'MET',
        evidenceIds: [id],
        evidenceItems: item ? [item] : [],
        reason: `Candidate holds ${edu.degree ?? 'degree'} from ${edu.institution}`,
        confidence: 85,
        contributesToBlocker: false,
      };
    }

    return {
      requirementId: req.id,
      status: 'NOT_MET',
      evidenceIds: [],
      evidenceItems: [],
      reason: 'No completed degrees recorded in Candidate Brain',
      confidence: 75,
      contributesToBlocker: isMandatory,
    };
  }

  private evaluateCertificationRequirement(
    req: JobRequirement,
    context: CandidateMatchingContext,
    isMandatory: boolean,
  ): DeterministicEvaluationResult {
    const rawNorm = normalizeToken(req.rawText);

    for (const cert of context.certifications) {
      const certNorm = normalizeToken(cert.name);
      if (rawNorm.includes(certNorm) || certNorm.includes(rawNorm)) {
        const id = `candidate_certification:${cert.id}`;
        const item = context.evidenceMap.get(id);
        return {
          requirementId: req.id,
          status: 'MET',
          evidenceIds: [id],
          evidenceItems: item ? [item] : [],
          reason: `Candidate holds certification: ${cert.name}`,
          confidence: 90,
          contributesToBlocker: false,
        };
      }
    }

    return {
      requirementId: req.id,
      status: 'NOT_MET',
      evidenceIds: [],
      evidenceItems: [],
      reason: `Certification '${req.rawText}' not found in candidate certifications`,
      confidence: 80,
      contributesToBlocker: isMandatory,
    };
  }

  private evaluateExperienceRequirement(
    req: JobRequirement,
    context: CandidateMatchingContext,
    isMandatory: boolean,
  ): DeterministicEvaluationResult {
    const rawLower = req.rawText.toLowerCase();
    const yearsMatch = rawLower.match(/(\d+)\+?\s*years?/);
    const requiredYears = yearsMatch && yearsMatch[1] ? parseInt(yearsMatch[1], 10) : null;

    if (context.experiences.length === 0) {
      return {
        requirementId: req.id,
        status: 'NOT_MET',
        evidenceIds: [],
        evidenceItems: [],
        reason: 'No professional work experience listed in Candidate Brain',
        confidence: 80,
        contributesToBlocker: isMandatory,
      };
    }

    // Calculate approximate non-overlapping years from experiences
    const totalMonths = this.calculateExperienceMonths(context.experiences);
    const totalYears = Math.floor(totalMonths / 12);

    const relevantExps = context.experiences.map((e) =>
      e.id.startsWith('candidate_experience:') ? e.id : `candidate_experience:${e.id}`,
    );
    const evidenceItems = relevantExps
      .map((id) => context.evidenceMap.get(id))
      .filter((i): i is CandidateEvidenceItemDto => Boolean(i));

    if (requiredYears !== null) {
      if (totalYears >= requiredYears) {
        return {
          requirementId: req.id,
          status: 'MET',
          evidenceIds: relevantExps,
          evidenceItems,
          reason: `Candidate has ~${totalYears} years of cumulative experience (exceeds ${requiredYears} years required)`,
          confidence: 80,
          contributesToBlocker: false,
        };
      } else {
        return {
          requirementId: req.id,
          status: 'PARTIAL',
          evidenceIds: relevantExps,
          evidenceItems,
          reason: `Candidate has ~${totalYears} years of experience (less than ${requiredYears} years requested)`,
          confidence: 75,
          contributesToBlocker: isMandatory && totalYears === 0,
        };
      }
    }

    return {
      requirementId: req.id,
      status: 'MET',
      evidenceIds: relevantExps,
      evidenceItems,
      reason: `Candidate possesses relevant professional background across ${context.experiences.length} positions`,
      confidence: 70,
      contributesToBlocker: false,
    };
  }

  /**
   * Calculates non-overlapping cumulative months of professional experience using an interval-union algorithm.
   * Concurrently overlapping roles (e.g. 2 roles in Jan 2025 - Dec 2025) are merged into a single interval
   * to strictly prevent double-counting.
   * Partial or unknown dates are skipped without guessing.
   */
  public calculateExperienceMonths(experiences: CandidateMatchingContext['experiences']): number {
    interface MonthInterval {
      start: number; // year * 12 + (month - 1)
      end: number; // year * 12 + (month - 1)
    }

    const intervals: MonthInterval[] = [];

    const parseYearMonth = (
      dateStr: string | null | undefined,
      isEndForYearOnly: boolean,
    ): { year: number; month: number } | null => {
      if (!dateStr || typeof dateStr !== 'string') return null;
      const match = dateStr.trim().match(/^(\d{4})(?:-(\d{1,2}))?/);
      if (!match) return null;
      const year = parseInt(match[1]!, 10);
      if (isNaN(year) || year < 1960 || year > 2100) return null;

      if (match[2]) {
        const month = parseInt(match[2]!, 10);
        if (isNaN(month) || month < 1 || month > 12) return null;
        return { year, month };
      }
      return { year, month: isEndForYearOnly ? 12 : 1 };
    };

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    for (const exp of experiences) {
      const start = parseYearMonth(exp.startDate, false);
      if (!start) continue; // Unknown/partial date does not produce invented duration

      let end: { year: number; month: number } | null = null;
      if (exp.isCurrent) {
        end = { year: currentYear, month: currentMonth };
      } else if (exp.endDate) {
        end = parseYearMonth(exp.endDate, true);
      }

      if (!end) continue; // Incomplete record without end date cannot establish safe duration

      const startIndex = start.year * 12 + (start.month - 1);
      const endIndex = end.year * 12 + (end.month - 1);

      if (endIndex >= startIndex) {
        intervals.push({ start: startIndex, end: endIndex });
      }
    }

    if (intervals.length === 0) return 0;

    // Sort intervals by start ascending, then end ascending
    intervals.sort((a, b) => a.start - b.start || a.end - b.end);

    // Merge overlapping or contiguous month intervals
    const merged: MonthInterval[] = [];
    for (const interval of intervals) {
      if (merged.length === 0) {
        merged.push({ ...interval });
      } else {
        const prev = merged[merged.length - 1]!;
        if (interval.start <= prev.end + 1) {
          prev.end = Math.max(prev.end, interval.end);
        } else {
          merged.push({ ...interval });
        }
      }
    }

    let totalMonths = 0;
    for (const interval of merged) {
      totalMonths += interval.end - interval.start + 1;
    }

    return totalMonths;
  }

  private evaluateWorkAuthRequirement(
    req: JobRequirement,
    context: CandidateMatchingContext,
    _isMandatory: boolean,
  ): DeterministicEvaluationResult {
    const rawLower = req.rawText.toLowerCase();
    const mentionsSponsorship =
      rawLower.includes('sponsor') ||
      rawLower.includes('visa') ||
      rawLower.includes('work authorization') ||
      rawLower.includes('citizen');

    if (!mentionsSponsorship) {
      return {
        requirementId: req.id,
        status: 'UNKNOWN',
        evidenceIds: [],
        evidenceItems: [],
        reason: 'Work authorization requirement text is generic',
        confidence: 50,
        contributesToBlocker: false,
      };
    }

    // Check candidate preferences
    if (context.preferences?.needsSponsorship === false) {
      // Candidate does NOT need sponsorship
      return {
        requirementId: req.id,
        status: 'MET',
        evidenceIds: [],
        evidenceItems: [],
        reason: 'Candidate preference states no sponsorship required',
        confidence: 90,
        contributesToBlocker: false,
      };
    }

    if (context.preferences?.needsSponsorship === true) {
      const forbidsSponsorship =
        rawLower.includes('no sponsorship') ||
        rawLower.includes('unable to sponsor') ||
        rawLower.includes('must be a us citizen') ||
        rawLower.includes('citizenship required');

      if (forbidsSponsorship) {
        return {
          requirementId: req.id,
          status: 'NOT_MET',
          evidenceIds: [],
          evidenceItems: [],
          reason: 'Job explicitly does not offer sponsorship, and candidate requires sponsorship',
          confidence: 95,
          contributesToBlocker: true,
        };
      }
    }

    // Unknown sponsorship
    return {
      requirementId: req.id,
      status: 'UNKNOWN',
      evidenceIds: [],
      evidenceItems: [],
      reason: 'Candidate work authorization / sponsorship status is unconfigured',
      confidence: 50,
      contributesToBlocker: false,
    };
  }

  private evaluateLocationRequirement(
    req: JobRequirement,
    context: CandidateMatchingContext,
    isMandatory: boolean,
  ): DeterministicEvaluationResult {
    const rawLower = req.rawText.toLowerCase();
    const preferredLocs = context.preferences?.preferredLocations ?? [];

    for (const loc of preferredLocs) {
      if (rawLower.includes(loc.toLowerCase())) {
        return {
          requirementId: req.id,
          status: 'MET',
          evidenceIds: [],
          evidenceItems: [],
          reason: `Location matches candidate preference: ${loc}`,
          confidence: 85,
          contributesToBlocker: false,
        };
      }
    }

    return {
      requirementId: req.id,
      status: 'UNKNOWN',
      evidenceIds: [],
      evidenceItems: [],
      reason: 'Specific location requirement does not match preferred locations list',
      confidence: 60,
      contributesToBlocker: isMandatory,
    };
  }

  private evaluateGenericRequirement(
    req: JobRequirement,
    context: CandidateMatchingContext,
  ): DeterministicEvaluationResult {
    const rawNorm = normalizeToken(req.rawText);
    const matchedEvidenceIds: string[] = [];
    const matchedEvidenceItems: CandidateEvidenceItemDto[] = [];

    for (const skill of context.skills) {
      const sNorm = normalizeToken(skill.name);
      if (sNorm.length >= 3 && rawNorm.includes(sNorm)) {
        const id = `candidate_skill:${skill.id}`;
        matchedEvidenceIds.push(id);
        const item = context.evidenceMap.get(id);
        if (item) matchedEvidenceItems.push(item);
      }
    }

    if (matchedEvidenceIds.length > 0) {
      return {
        requirementId: req.id,
        status: 'MET',
        evidenceIds: matchedEvidenceIds,
        evidenceItems: matchedEvidenceItems,
        reason: `Matched candidate skills: ${matchedEvidenceItems.map((i) => i.label).join(', ')}`,
        confidence: 70,
        contributesToBlocker: false,
      };
    }

    return {
      requirementId: req.id,
      status: 'UNKNOWN',
      evidenceIds: [],
      evidenceItems: [],
      reason: 'Requirement requires semantic or qualitative evaluation',
      confidence: 50,
      contributesToBlocker: false,
    };
  }
}
