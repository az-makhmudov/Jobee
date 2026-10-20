import { comparableCompensation, hasCountryAuthorization } from './eligibility.js';
import { Job } from '../schema/index.js';
import {
  MatchDecision,
  CareerFitCategory,
  DimensionType,
  DimensionStatus,
  DIMENSION_DEFAULT_WEIGHTS,
  DecisionReasonCodes,
  DecisionReasonCode,
  MATCH_ALGORITHM_VERSION,
} from '@job-agent/shared';
import { CandidateMatchingContext } from './matching-context-builder.js';
import { HardPolicyResult } from './hard-policy-engine.js';
import { DeterministicEvaluationResult } from './candidate-evidence-resolver.js';
import { AiMatchResult } from './ai/types.js';

export interface DimensionScoreResult {
  dimension: DimensionType;
  score: number | null;
  weight: number;
  status: DimensionStatus;
  reason: string;
}

export interface MatchScoringResult {
  overallScore: number;
  confidenceScore: number;
  decision: MatchDecision;
  careerFitCategory: CareerFitCategory;
  autoApplyEligible: boolean;
  algorithmVersion: string;
  dimensions: DimensionScoreResult[];
  strengths: string[];
  gaps: string[];
  unknowns: string[];
  warnings: string[];
  hardBlockers: string[];
  transferableSkills: string[];
  learnedRankingAdjustment: number;
  learnedAdjustmentReason: string | null;
  reasonCodes: DecisionReasonCode[];
  summaryExplanation: string;
}

export class MatchingScoringEngine {
  calculate(
    job: Job,
    context: CandidateMatchingContext,
    hardPolicy: HardPolicyResult,
    evaluations: DeterministicEvaluationResult[],
    aiResult?: AiMatchResult | null,
  ): MatchScoringResult {
    const dimensions: DimensionScoreResult[] = [];
    const strengths: string[] = [];
    const gaps: string[] = [];
    const unknowns: string[] = [...hardPolicy.missingInformation];
    const warnings: string[] = [...hardPolicy.warnings];
    const reasonCodes: DecisionReasonCode[] = [...hardPolicy.reasonCodes];

    // 1. Calculate Dimension: ROLE_FIT
    const roleFit = this.calculateRoleFit(job, context, aiResult);
    dimensions.push(roleFit);
    if (roleFit.score !== null && roleFit.score >= 80) {
      strengths.push(`Target role alignment is strong (${roleFit.score}%)`);
    } else if (roleFit.score !== null && roleFit.score < 50) {
      gaps.push(`Role title differs significantly from candidate target roles (${roleFit.score}%)`);
    }

    // 2. Calculate Dimension: SKILLS_FIT
    const skillsFit = this.calculateSkillsFit(context, evaluations, aiResult);
    dimensions.push(skillsFit);
    if (skillsFit.score !== null && skillsFit.score >= 75) {
      strengths.push(`High overlap with recorded candidate competencies (${skillsFit.score}%)`);
    } else if (skillsFit.score !== null && skillsFit.score < 50) {
      gaps.push(`Multiple required technical skills not found in profile (${skillsFit.score}%)`);
    }

    // 3. Calculate Dimension: EXPERIENCE_FIT
    const expFit = this.calculateExperienceFit(context, evaluations);
    dimensions.push(expFit);
    if (expFit.score !== null && expFit.score >= 75) {
      strengths.push('Candidate experience duration and seniority align with requirements');
    } else if (expFit.score !== null && expFit.score < 50) {
      gaps.push('Experience level or duration may fall below requested requirements');
    }

    // 4. Calculate Dimension: EDUCATION_FIT
    const eduFit = this.calculateEducationFit(context, evaluations);
    dimensions.push(eduFit);

    // 5. Calculate Dimension: LOCATION_FIT
    const locFit = this.calculateLocationFit(job, context);
    dimensions.push(locFit);
    if (locFit.score !== null && locFit.score === 100) {
      strengths.push(`Workplace mode (${job.workplaceType}) and location fully match preferences`);
    } else if (locFit.score !== null && locFit.score < 60) {
      gaps.push('Location or workplace arrangement requires relocation or compromise');
    }

    // 6. Calculate Dimension: LANGUAGE_FIT
    const langFit = this.calculateLanguageFit(context, evaluations);
    dimensions.push(langFit);

    // 7. Calculate Dimension: COMPENSATION_FIT
    const compFit = this.calculateCompensationFit(job, context);
    dimensions.push(compFit);
    if (compFit.status === 'UNKNOWN') {
      unknowns.push('Job compensation is unlisted or candidate salary threshold is unconfigured');
    }

    // 8. Calculate Dimension: WORK_AUTHORIZATION_FIT
    const authFit = this.calculateWorkAuthFit(job, context, evaluations);
    dimensions.push(authFit);
    if (authFit.status === 'UNKNOWN') {
      unknowns.push('Candidate visa / work authorization requirements are unconfigured');
    }

    // Model narratives are not candidate facts. Explanations are derived from grounded evaluations.
    // Evaluate mandatory requirements penalty
    const unmetMandatory = evaluations.filter((e) => e.contributesToBlocker && e.status !== 'MET');
    if (unmetMandatory.length > 0) {
      reasonCodes.push(DecisionReasonCodes.UNMET_MANDATORY_REQUIREMENTS);
      gaps.push(`${unmetMandatory.length} mandatory requirement(s) are unmet or unconfirmed`);
    }

    // Compute Overall Composite Score
    let scoredWeightSum = 0;
    let scoredPointsSum = 0;

    for (const dim of dimensions) {
      if (dim.status === 'SCORED' && dim.score !== null) {
        scoredWeightSum += dim.weight;
        scoredPointsSum += dim.score * dim.weight;
      }
    }

    let overallScore = scoredWeightSum > 0 ? Math.round(scoredPointsSum / scoredWeightSum) : 50;

    // Apply penalty for unmet mandatory requirements: -12 points per unmet mandatory requirement
    if (unmetMandatory.length > 0) {
      const penalty = Math.min(40, unmetMandatory.length * 12);
      overallScore = Math.max(0, overallScore - penalty);
    }

    // Bound overall score between 0 and 100
    overallScore = Math.min(100, Math.max(0, overallScore));

    // Role fit safeguard: If candidate target roles are configured and role fit is very poor (< 30%),
    // cap the composite score so non-matching careers are not recommended based purely on location/language
    if (roleFit.status === 'SCORED' && roleFit.score !== null && roleFit.score < 30) {
      overallScore = Math.min(overallScore, 40);
      gaps.push(
        `Role title '${job.title}' does not align with candidate target or adjacent roles (${roleFit.score}%)`,
      );
    }

    // Compute Confidence Score
    const confidenceScore = this.calculateConfidenceScore(
      job,
      context,
      dimensions,
      evaluations,
      Boolean(aiResult),
    );

    // Policy Decision Logic
    const policy = context.policy;
    const minScoreForReview = policy?.minScoreForReview ?? 70;
    const autoApplyMinScore = policy?.autoApplyMinScore ?? 90;

    let decision: MatchDecision = 'REVIEW';

    if (hardPolicy.hasBlockers) {
      decision = 'SKIP';
    } else if (hardPolicy.missingSensitiveInfo) {
      decision = 'REVIEW';
      reasonCodes.push(DecisionReasonCodes.POLICY_INFORMATION_MISSING);
    } else if (unmetMandatory.length > 0) {
      decision = 'REVIEW';
    } else if (confidenceScore < 60) {
      decision = 'REVIEW';
      reasonCodes.push(DecisionReasonCodes.LOW_CONFIDENCE);
    } else if (overallScore >= autoApplyMinScore) {
      decision = 'MATCH';
      reasonCodes.push(DecisionReasonCodes.MATCH_THRESHOLD_MET);
    } else if (overallScore >= minScoreForReview) {
      decision = 'REVIEW';
      reasonCodes.push(DecisionReasonCodes.REVIEW_THRESHOLD_MET);
    } else {
      decision = 'SKIP';
      reasonCodes.push(DecisionReasonCodes.LOW_MATCH_SCORE);
    }

    // Auto-apply preliminary eligibility
    const autoApplyEnabled = policy?.autoApplyEnabled ?? false;
    const autoApplyEligible =
      autoApplyEnabled &&
      decision === 'MATCH' &&
      overallScore >= autoApplyMinScore &&
      confidenceScore >= 70 &&
      !hardPolicy.hasBlockers &&
      !hardPolicy.missingSensitiveInfo &&
      unmetMandatory.length === 0;

    // Summary Explanation
    let summaryExplanation = '';
    if (decision === 'MATCH') {
      summaryExplanation = `Strong match (${overallScore}%): Candidate profile aligns well with role requirements and preferences.`;
    } else if (decision === 'SKIP') {
      if (hardPolicy.hasBlockers) {
        summaryExplanation = `Excluded by policy: ${hardPolicy.blockers[0]}`;
      } else {
        summaryExplanation = `Fit below threshold (${overallScore}%): Score is below configured consideration limit of ${minScoreForReview}%.`;
      }
    } else {
      summaryExplanation = `Human review required (${overallScore}%): ${
        hardPolicy.missingSensitiveInfo
          ? 'Requires clarification of candidate preferences/sensitive policies.'
          : unmetMandatory.length > 0
            ? `${unmetMandatory.length} mandatory requirement(s) need verification.`
            : 'Candidate qualifications match partially; manual review recommended.'
      }`;
    }

    // Evaluate transferable capabilities overlap with job requirements
    const transferableSkills: string[] = [];
    const candidateCaps = context.transferableCapabilities || [];
    const jobText = `${job.title} ${job.description}`.toLowerCase();
    for (const cap of candidateCaps) {
      if (jobText.includes(cap.toLowerCase()) && !transferableSkills.includes(cap)) {
        transferableSkills.push(cap);
      }
    }
    if (transferableSkills.length > 0) {
      strengths.push(
        `Recorded ${transferableSkills.length} transferable capability(ies) relevant to role: ${transferableSkills.slice(0, 3).join(', ')}`,
      );
    }

    // Evaluate Learned Ranking Adjustments from User Feedback
    let learnedRankingAdjustment = 0;
    let learnedAdjustmentReason: string | null = null;
    const learned = context.learnedPreferences;
    if (learned) {
      const downvotedInds = learned.downvotedIndustries || [];
      const downvotedLocs = learned.downvotedLocations || [];
      const downvotedComps = learned.downvotedCompanies || [];
      const dept = (job.department || '').toLowerCase();
      const title = job.title.toLowerCase();
      const loc = `${job.city || ''} ${job.country || ''} ${job.locationText || ''}`.toLowerCase();
      const comp = job.company.toLowerCase();

      if (
        downvotedInds.some((i) => dept.includes(i.toLowerCase()) || title.includes(i.toLowerCase()))
      ) {
        learnedRankingAdjustment -= 15;
        learnedAdjustmentReason =
          'Adjusted based on learned feedback: role matches an industry you previously marked as Wrong Industry.';
      } else if (downvotedLocs.some((l) => loc.includes(l.toLowerCase()))) {
        learnedRankingAdjustment -= 15;
        learnedAdjustmentReason =
          'Adjusted based on learned feedback: location matches a region you previously marked as Wrong Location.';
      } else if (downvotedComps.some((c) => comp.includes(c.toLowerCase()))) {
        learnedRankingAdjustment -= 20;
        learnedAdjustmentReason =
          'Adjusted based on learned feedback: company matches an organization you previously marked as Not Interested.';
      } else if (
        (job.seniority === 'SENIOR' || job.seniority === 'LEAD') &&
        (learned.tooSeniorCount || 0) >= 2
      ) {
        learnedRankingAdjustment -= 15;
        learnedAdjustmentReason =
          'Adjusted based on learned feedback: seniority matches level you previously marked as Too Senior.';
      }
    }

    if (learnedRankingAdjustment !== 0) {
      overallScore = Math.max(0, Math.min(100, overallScore + learnedRankingAdjustment));
      warnings.push(`Learned ranking adjustment applied: ${learnedAdjustmentReason}`);
    }

    // Determine CareerFitCategory
    let careerFitCategory: CareerFitCategory;
    if (hardPolicy.hasBlockers) {
      careerFitCategory = 'NOT_CURRENTLY_ELIGIBLE';
    } else if (
      hardPolicy.missingSensitiveInfo ||
      confidenceScore < 50 ||
      unmetMandatory.some(
        (e) => e.status === 'UNKNOWN' || (e.status === 'NOT_MET' && !e.evidenceIds.length),
      )
    ) {
      careerFitCategory = 'INSUFFICIENT_INFORMATION';
    } else if (unmetMandatory.length > 0) {
      // Mandatory requirements are partially met or require verification
      careerFitCategory = 'GROWTH_OPPORTUNITY';
    } else if (overallScore >= 80 && (roleFit.score ?? 50) >= 70) {
      careerFitCategory = 'STRONG_MATCH';
    } else if (overallScore >= 68 && (roleFit.score ?? 50) >= 50) {
      careerFitCategory = 'GOOD_MATCH';
    } else if (
      transferableSkills.length >= 2 ||
      (transferableSkills.length >= 1 && overallScore >= 55)
    ) {
      careerFitCategory = 'TRANSFERABLE_SKILLS_MATCH';
    } else if (overallScore >= 45 && (roleFit.score ?? 50) >= 35) {
      careerFitCategory = 'GROWTH_OPPORTUNITY';
    } else {
      careerFitCategory = 'LOW_RELEVANCE';
    }

    return {
      overallScore,
      confidenceScore,
      decision,
      careerFitCategory,
      autoApplyEligible,
      algorithmVersion: MATCH_ALGORITHM_VERSION,
      dimensions,
      strengths,
      gaps,
      unknowns,
      warnings,
      hardBlockers: hardPolicy.blockers,
      transferableSkills,
      learnedRankingAdjustment,
      learnedAdjustmentReason,
      reasonCodes,
      summaryExplanation,
    };
  }

  private calculateRoleFit(
    job: Job,
    context: CandidateMatchingContext,
    aiResult?: AiMatchResult | null,
  ): DimensionScoreResult {
    const targetTitles = context.preferences?.targetTitles || [];
    if (targetTitles.length === 0) {
      return {
        dimension: 'ROLE_FIT',
        score: null,
        weight: DIMENSION_DEFAULT_WEIGHTS.ROLE_FIT,
        status: 'UNKNOWN',
        reason: 'Candidate target roles are not configured in preferences',
      };
    }

    const jobTitleTokens = this.tokenize(job.title);
    let bestScore = 0;
    let bestTarget = '';

    for (const target of targetTitles) {
      const targetTokens = this.tokenize(target);
      const overlap = targetTokens.filter((t) => jobTitleTokens.includes(t));
      const score = Math.round((overlap.length / Math.max(1, targetTokens.length)) * 100);

      // Full exact phrase match bonus
      if (job.title.toLowerCase().includes(target.toLowerCase())) {
        bestScore = 100;
        bestTarget = target;
        break;
      }

      if (score > bestScore) {
        bestScore = score;
        bestTarget = target;
      }
    }

    // Seniority alignment
    const preferredSeniority = context.preferences?.seniorityLevels || [];
    if (preferredSeniority.length > 0 && job.seniority !== 'UNKNOWN') {
      const hasSeniorityMatch = preferredSeniority.some(
        (s) => s.toUpperCase() === job.seniority.toUpperCase(),
      );
      if (!hasSeniorityMatch && bestScore > 0) {
        bestScore = Math.max(30, bestScore - 20);
      }
    }

    // Blend AI soft role fit if available
    if (aiResult && aiResult.roleFitScore !== null) {
      bestScore = Math.round(bestScore * 0.6 + aiResult.roleFitScore * 0.4);
    }

    return {
      dimension: 'ROLE_FIT',
      score: bestScore,
      weight: DIMENSION_DEFAULT_WEIGHTS.ROLE_FIT,
      status: 'SCORED',
      reason: `Title '${job.title}' compared against candidate target roles (best match: '${bestTarget || targetTitles[0]}')`,
    };
  }

  private calculateSkillsFit(
    context: CandidateMatchingContext,
    evaluations: DeterministicEvaluationResult[],
    aiResult?: AiMatchResult | null,
  ): DimensionScoreResult {
    if (context.skills.length === 0) {
      return {
        dimension: 'SKILLS_FIT',
        score: 30,
        weight: DIMENSION_DEFAULT_WEIGHTS.SKILLS_FIT,
        status: 'SCORED',
        reason: 'No candidate skills registered in Candidate Brain',
      };
    }

    let metCount = 0;
    let totalEvaluated = 0;

    for (const e of evaluations) {
      if (e.status === 'MET') {
        metCount += 1;
        totalEvaluated += 1;
      } else if (e.status === 'PARTIAL') {
        metCount += 0.5;
        totalEvaluated += 1;
      } else if (e.status === 'NOT_MET') {
        totalEvaluated += 1;
      }
    }

    let calculatedScore = totalEvaluated > 0 ? Math.round((metCount / totalEvaluated) * 100) : 70;

    // Blend AI soft skills rating if available
    if (aiResult && aiResult.skillsFitScore !== null) {
      calculatedScore = Math.round(calculatedScore * 0.6 + aiResult.skillsFitScore * 0.4);
    }

    return {
      dimension: 'SKILLS_FIT',
      score: calculatedScore,
      weight: DIMENSION_DEFAULT_WEIGHTS.SKILLS_FIT,
      status: 'SCORED',
      reason: `${metCount} of ${totalEvaluated} evaluated requirements supported by candidate skills/evidence`,
    };
  }

  private calculateExperienceFit(
    context: CandidateMatchingContext,
    evaluations: DeterministicEvaluationResult[],
  ): DimensionScoreResult {
    if (context.experiences.length === 0) {
      return {
        dimension: 'EXPERIENCE_FIT',
        score: 20,
        weight: DIMENSION_DEFAULT_WEIGHTS.EXPERIENCE_FIT,
        status: 'SCORED',
        reason: 'No work experience listed in Candidate Brain',
      };
    }

    const expEvals = evaluations.filter(
      (e) =>
        e.status === 'MET' && e.evidenceIds.some((id) => id.startsWith('candidate_experience:')),
    );

    const nonRejectedExps = context.experiences.filter((e) => e.verificationStatus !== 'REJECTED');
    const verifiedExps = nonRejectedExps.filter((e) => e.verificationStatus === 'VERIFIED');
    const isUnverifiedOnly = nonRejectedExps.length > 0 && verifiedExps.length === 0;

    let baseScore = 65;
    if (expEvals.length > 0) {
      baseScore = 85;
    } else if (isUnverifiedOnly) {
      baseScore = 50;
    }

    return {
      dimension: 'EXPERIENCE_FIT',
      score: baseScore,
      weight: DIMENSION_DEFAULT_WEIGHTS.EXPERIENCE_FIT,
      status: 'SCORED',
      reason: isUnverifiedOnly
        ? `Evaluated across ${context.experiences.length} unverified career positions (verification required)`
        : `Evaluated across ${context.experiences.length} career positions and matching role requirements`,
    };
  }

  private calculateEducationFit(
    context: CandidateMatchingContext,
    evaluations: DeterministicEvaluationResult[],
  ): DimensionScoreResult {
    const eduEval = evaluations.find((e) =>
      e.evidenceIds.some((id) => id.startsWith('candidate_education:')),
    );

    if (eduEval) {
      return {
        dimension: 'EDUCATION_FIT',
        score: eduEval.status === 'MET' ? 100 : eduEval.status === 'PARTIAL' ? 70 : 30,
        weight: DIMENSION_DEFAULT_WEIGHTS.EDUCATION_FIT,
        status: 'SCORED',
        reason: eduEval.reason,
      };
    }

    const nonRejectedEdus = context.education.filter((e) => e.verificationStatus !== 'REJECTED');
    if (nonRejectedEdus.length > 0 && nonRejectedEdus[0]) {
      const isVerified = nonRejectedEdus[0].verificationStatus === 'VERIFIED';
      return {
        dimension: 'EDUCATION_FIT',
        score: isVerified ? 90 : 60,
        weight: DIMENSION_DEFAULT_WEIGHTS.EDUCATION_FIT,
        status: 'SCORED',
        reason: isVerified
          ? `Candidate holds formal credentials from ${nonRejectedEdus[0].institution}`
          : `Candidate lists unverified credentials from ${nonRejectedEdus[0].institution} (verification required)`,
      };
    }

    return {
      dimension: 'EDUCATION_FIT',
      score: null,
      weight: DIMENSION_DEFAULT_WEIGHTS.EDUCATION_FIT,
      status: 'UNKNOWN',
      reason: 'No education requirements identified and no degrees configured',
    };
  }

  private calculateLocationFit(job: Job, context: CandidateMatchingContext): DimensionScoreResult {
    const prefs = context.preferences;
    if (!prefs) {
      return {
        dimension: 'LOCATION_FIT',
        score: null,
        weight: DIMENSION_DEFAULT_WEIGHTS.LOCATION_FIT,
        status: 'UNKNOWN',
        reason: 'Candidate location preferences unconfigured',
      };
    }

    if (job.workplaceType === 'REMOTE') {
      const remoteAllowed = (prefs.workModes || []).map((m) => m.toUpperCase()).includes('REMOTE');
      return {
        dimension: 'LOCATION_FIT',
        score: remoteAllowed ? 100 : 40,
        weight: DIMENSION_DEFAULT_WEIGHTS.LOCATION_FIT,
        status: 'SCORED',
        reason: remoteAllowed
          ? 'Fully remote role matches candidate preference'
          : 'Remote mode not in preferred work modes',
      };
    }

    const jobLoc =
      `${job.city || ''} ${job.region || ''} ${job.country || ''} ${job.locationText || ''}`.toLowerCase();
    const matchesPref = prefs.preferredLocations.some((loc) => jobLoc.includes(loc.toLowerCase()));

    if (matchesPref) {
      return {
        dimension: 'LOCATION_FIT',
        score: 100,
        weight: DIMENSION_DEFAULT_WEIGHTS.LOCATION_FIT,
        status: 'SCORED',
        reason: `Job location matches preferred location: ${job.locationText ?? 'specified'}`,
      };
    }

    if (prefs.willingToRelocate === true) {
      return {
        dimension: 'LOCATION_FIT',
        score: 75,
        weight: DIMENSION_DEFAULT_WEIGHTS.LOCATION_FIT,
        status: 'SCORED',
        reason: 'Location differs from preferred list, but candidate is willing to relocate',
      };
    }

    return {
      dimension: 'LOCATION_FIT',
      score: 30,
      weight: DIMENSION_DEFAULT_WEIGHTS.LOCATION_FIT,
      status: 'SCORED',
      reason: `Location '${job.locationText ?? 'unspecified'}' is outside preferred locations`,
    };
  }

  private calculateLanguageFit(
    context: CandidateMatchingContext,
    evaluations: DeterministicEvaluationResult[],
  ): DimensionScoreResult {
    const langEvals = evaluations.filter((e) =>
      e.evidenceIds.some((id) => id.startsWith('candidate_language:')),
    );

    if (langEvals.length > 0) {
      const allMet = langEvals.every((e) => e.status === 'MET');
      return {
        dimension: 'LANGUAGE_FIT',
        score: allMet ? 100 : 50,
        weight: DIMENSION_DEFAULT_WEIGHTS.LANGUAGE_FIT,
        status: 'SCORED',
        reason: `${langEvals.length} job language requirement(s) evaluated against candidate fluencies`,
      };
    }

    if (context.languages.length > 0) {
      const nonRejectedLangs = context.languages.filter((l) => l.verificationStatus !== 'REJECTED');
      const hasVerified = nonRejectedLangs.some((l) => l.verificationStatus === 'VERIFIED');
      if (nonRejectedLangs.length > 0) {
        return {
          dimension: 'LANGUAGE_FIT',
          score: hasVerified ? 100 : 70,
          weight: DIMENSION_DEFAULT_WEIGHTS.LANGUAGE_FIT,
          status: 'SCORED',
          reason: hasVerified
            ? 'Standard language competencies confirmed in Candidate Brain'
            : 'Language proficiencies listed in Candidate Brain (verification required)',
        };
      }
    }

    return {
      dimension: 'LANGUAGE_FIT',
      score: null,
      weight: DIMENSION_DEFAULT_WEIGHTS.LANGUAGE_FIT,
      status: 'UNKNOWN',
      reason: 'No explicit language requirements found',
    };
  }

  private calculateCompensationFit(
    job: Job,
    context: CandidateMatchingContext,
  ): DimensionScoreResult {
    const prefs = context.preferences;
    if (
      prefs?.minSalary == null ||
      !comparableCompensation(job, prefs) ||
      (job.maxSalary == null && job.minSalary == null)
    ) {
      return {
        dimension: 'COMPENSATION_FIT',
        score: null,
        weight: DIMENSION_DEFAULT_WEIGHTS.COMPENSATION_FIT,
        status: 'UNKNOWN',
        reason:
          'Compensation needs an explicit comparable currency, pay period and candidate threshold',
      };
    }

    const jobSalary = job.maxSalary ?? job.minSalary ?? 0;
    if (jobSalary >= prefs.minSalary) {
      return {
        dimension: 'COMPENSATION_FIT',
        score: 100,
        weight: DIMENSION_DEFAULT_WEIGHTS.COMPENSATION_FIT,
        status: 'SCORED',
        reason: `Posted compensation meets candidate threshold (${job.currency ?? prefs.currency} ${jobSalary} >= ${prefs.minSalary})`,
      };
    }

    const ratio = jobSalary / prefs.minSalary;
    return {
      dimension: 'COMPENSATION_FIT',
      score: Math.round(ratio * 100),
      weight: DIMENSION_DEFAULT_WEIGHTS.COMPENSATION_FIT,
      status: 'SCORED',
      reason: `Posted compensation is below candidate target (${jobSalary} vs ${prefs.minSalary})`,
    };
  }

  private calculateWorkAuthFit(
    job: Job,
    context: CandidateMatchingContext,
    evaluations: DeterministicEvaluationResult[],
  ): DimensionScoreResult {
    const authEval = evaluations.find((e) => e.contributesToBlocker && e.status === 'NOT_MET');
    if (authEval) {
      return {
        dimension: 'WORK_AUTHORIZATION_FIT',
        score: 0,
        weight: DIMENSION_DEFAULT_WEIGHTS.WORK_AUTHORIZATION_FIT,
        status: 'SCORED',
        reason: authEval.reason,
      };
    }

    const authPartial = evaluations.find((e) => e.contributesToBlocker && e.status === 'PARTIAL');
    if (authPartial) {
      return {
        dimension: 'WORK_AUTHORIZATION_FIT',
        score: 50,
        weight: DIMENSION_DEFAULT_WEIGHTS.WORK_AUTHORIZATION_FIT,
        status: 'SCORED',
        reason: authPartial.reason,
      };
    }

    if (hasCountryAuthorization(job.country, context.preferences)) {
      return {
        dimension: 'WORK_AUTHORIZATION_FIT',
        score: 100,
        weight: DIMENSION_DEFAULT_WEIGHTS.WORK_AUTHORIZATION_FIT,
        status: 'SCORED',
        reason: `Candidate lists work authorization for ${job.country}`,
      };
    }

    return {
      dimension: 'WORK_AUTHORIZATION_FIT',
      score: null,
      weight: DIMENSION_DEFAULT_WEIGHTS.WORK_AUTHORIZATION_FIT,
      status: 'UNKNOWN',
      reason: 'Work authorization / sponsorship configuration is unconfirmed',
    };
  }

  private calculateConfidenceScore(
    job: Job,
    context: CandidateMatchingContext,
    dimensions: DimensionScoreResult[],
    evaluations: DeterministicEvaluationResult[],
    hasAiEnrichment: boolean,
  ): number {
    let confidence = 0;

    // 1. Job posting information density (up to 30%)
    const descLength = job.description?.length ?? 0;
    if (descLength >= 600) {
      confidence += 15;
    } else if (descLength >= 300) {
      confidence += 10;
    } else if (descLength >= 100) {
      confidence += 5;
    }

    if (job.workplaceType && job.workplaceType !== 'UNKNOWN') confidence += 5;
    if (job.locationText && job.locationText.trim().length > 0) confidence += 5;
    if (job.minSalary || job.maxSalary) confidence += 5;

    // 2. Requirement evaluation completeness (up to 30%)
    if (evaluations.length >= 2) {
      const knownCount = evaluations.filter((e) => e.status !== 'UNKNOWN').length;
      confidence += Math.round((knownCount / evaluations.length) * 30);
    } else if (evaluations.length === 1) {
      const knownCount = evaluations.filter((e) => e.status !== 'UNKNOWN').length;
      confidence += Math.round((knownCount / evaluations.length) * 20);
    } else {
      // 0 requirements extracted from job
      confidence += 5;
    }

    // 3. Scored dimensions ratio (up to 20%)
    if (dimensions.length > 0) {
      const scoredCount = dimensions.filter((d) => d.status === 'SCORED').length;
      confidence += Math.round((scoredCount / dimensions.length) * 20);
    }

    // 4. Candidate profile grounding completeness (up to 20%)
    if (context.experiences.length > 0) confidence += 5;
    if (context.skills.length > 0) confidence += 5;
    if (context.education.length > 0) confidence += 5;
    if (context.preferences?.targetTitles?.length) confidence += 5;

    // AI enrichment quality boost (up to 5% bonus capped at 100)
    if (hasAiEnrichment) confidence += 5;

    return Math.min(100, Math.max(15, confidence));
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3);
  }
}
