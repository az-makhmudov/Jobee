import { relevanceIssues } from './job-relevance.js';
import {
  comparableCompensation,
  hasCountryAuthorization,
  forbidsSponsorship,
  requiresCitizenshipOrClearance,
} from './eligibility.js';
import { Job } from '../schema/index.js';
import { DecisionReasonCodes, DecisionReasonCode } from '@job-agent/shared';
import { CandidateMatchingContext } from './matching-context-builder.js';

export interface HardPolicyResult {
  hasBlockers: boolean;
  blockers: string[];
  warnings: string[];
  missingInformation: string[];
  reasonCodes: DecisionReasonCode[];
  missingSensitiveInfo: boolean;
}

export class HardPolicyEngine {
  evaluate(job: Job, context: CandidateMatchingContext): HardPolicyResult {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const missingInformation: string[] = [];
    const reasonCodes: DecisionReasonCode[] = [];
    let missingSensitiveInfo = false;

    const prefs = context.preferences;
    if (!prefs) {
      missingInformation.push('No candidate job preferences configured');
      return {
        hasBlockers: false,
        blockers,
        warnings,
        missingInformation,
        reasonCodes: [DecisionReasonCodes.POLICY_INFORMATION_MISSING],
        missingSensitiveInfo: true,
      };
    }

    const compatibility = relevanceIssues(job, prefs, context.candidateProfile);
    if (compatibility.includes('seniority')) {
      blockers.push('Job seniority is outside the candidate target levels');
      reasonCodes.push(DecisionReasonCodes.SENIORITY_NOT_ALLOWED);
    }
    if (compatibility.includes('location') && prefs.willingToRelocate === false) {
      blockers.push('Job location is outside candidate preferences; relocation is not enabled');
      reasonCodes.push(DecisionReasonCodes.LOCATION_NOT_ALLOWED);
    }

    // 1. EXCLUDED COMPANY
    const excludedCompanies = prefs.excludedCompanies || [];
    const jobCompanyLower = job.company.toLowerCase().trim();
    for (const excluded of excludedCompanies) {
      const exclLower = excluded.toLowerCase().trim();
      if (
        exclLower.length > 0 &&
        (jobCompanyLower.includes(exclLower) || exclLower.includes(jobCompanyLower))
      ) {
        blockers.push(`Company '${job.company}' matches excluded company '${excluded}'`);
        reasonCodes.push(DecisionReasonCodes.EXCLUDED_COMPANY);
        break;
      }
    }

    // 2. EXCLUDED KEYWORD
    const excludedKeywords = prefs.excludedKeywords || [];
    const textToSearch = `${job.title} ${job.description}`.toLowerCase();
    for (const keyword of excludedKeywords) {
      const kwLower = keyword.toLowerCase().trim();
      if (kwLower.length > 0 && textToSearch.includes(kwLower)) {
        blockers.push(`Job contains excluded keyword '${keyword}'`);
        reasonCodes.push(DecisionReasonCodes.EXCLUDED_KEYWORD);
        break;
      }
    }

    // 3. UNPAID / VOLUNTEER ROLE
    if (!prefs.acceptUnpaid) {
      if (
        job.employmentType === 'VOLUNTEER' ||
        textToSearch.includes('unpaid internship') ||
        textToSearch.includes('volunteer role')
      ) {
        blockers.push('Unpaid/volunteer position rejected by candidate policy');
        reasonCodes.push(DecisionReasonCodes.UNPAID_ROLE_REJECTED);
      }
    }

    // 4. WORK MODE & LOCATION
    const allowedWorkModes = (prefs.workModes || []).map((m) => m.toUpperCase());
    if (allowedWorkModes.length > 0 && job.workplaceType !== 'UNKNOWN') {
      const isWorkModeAllowed = allowedWorkModes.includes(job.workplaceType);
      if (!isWorkModeAllowed) {
        blockers.push(
          `Workplace mode '${job.workplaceType}' is not in candidate allowed modes: ${allowedWorkModes.join(', ')}`,
        );
        reasonCodes.push(DecisionReasonCodes.WORK_MODE_NOT_ALLOWED);
      }
    }

    // Location checking for onsite/hybrid roles
    if (
      (job.workplaceType === 'ONSITE' || job.workplaceType === 'HYBRID') &&
      prefs.preferredLocations.length > 0
    ) {
      const jobLocText =
        `${job.city || ''} ${job.region || ''} ${job.country || ''} ${job.locationText || ''}`
          .toLowerCase()
          .trim();
      if (jobLocText.length > 0) {
        const matchesPreferred = prefs.preferredLocations.some((loc) =>
          jobLocText.includes(loc.toLowerCase().trim()),
        );

        if (!matchesPreferred) {
          if (!job.city && prefs.willingToRelocate !== true) {
            missingInformation.push(
              'Job city is unspecified; preferred-location compatibility is unconfirmed',
            );
            missingSensitiveInfo = true;
          } else if (prefs.willingToRelocate === true) {
            warnings.push(
              `Location '${job.locationText ?? 'unspecified'}' is outside preferred locations but relocation is allowed`,
            );
          } else if (prefs.willingToRelocate === false) {
            blockers.push(
              `Location '${job.locationText ?? 'unspecified'}' is outside preferred locations and relocation is not accepted`,
            );
            reasonCodes.push(DecisionReasonCodes.LOCATION_NOT_ALLOWED);
          } else {
            // willingToRelocate is unknown (null)
            warnings.push(
              `Location '${job.locationText ?? 'unspecified'}' is outside preferred locations; relocation preference is unconfigured`,
            );
            missingInformation.push('Candidate relocation preference is unconfigured');
            missingSensitiveInfo = true;
          }
        }
      }
    }

    // 5. EMPLOYMENT TYPE
    const allowedEmpTypes = (prefs.employmentTypes || []).map((t) =>
      t.toUpperCase().replace('-', '_'),
    );
    if (allowedEmpTypes.length > 0 && job.employmentType !== 'UNKNOWN') {
      if (!allowedEmpTypes.includes(job.employmentType)) {
        blockers.push(
          `Employment type '${job.employmentType}' is not in candidate allowed types: ${allowedEmpTypes.join(', ')}`,
        );
        reasonCodes.push(DecisionReasonCodes.EMPLOYMENT_TYPE_NOT_ALLOWED);
      }
    }

    if (job.workplaceType === 'UNKNOWN' && allowedWorkModes.length) {
      missingInformation.push('Job workplace arrangement is unspecified');
      missingSensitiveInfo = true;
    }
    if (job.employmentType === 'UNKNOWN' && allowedEmpTypes.length) {
      missingInformation.push('Job employment type is unspecified');
      missingSensitiveInfo = true;
    }
    if (job.employmentType === 'INTERNSHIP') {
      if (prefs.internshipEligible === false) {
        blockers.push('Candidate has confirmed they are not eligible for internships');
        reasonCodes.push(DecisionReasonCodes.INTERNSHIP_NOT_ALLOWED);
      } else if (prefs.internshipEligible !== true) {
        missingInformation.push('Candidate internship eligibility is unconfirmed');
        missingSensitiveInfo = true;
      }
    }

    // Compare only explicit, matching units and currencies; never convert or assume annual pay.
    if (prefs.minSalary != null) {
      if (!comparableCompensation(job, prefs) || (job.minSalary == null && job.maxSalary == null)) {
        missingInformation.push(
          'Salary cannot be compared without explicit matching currency and pay period',
        );
        missingSensitiveInfo = true;
      } else if (job.maxSalary != null && job.maxSalary < prefs.minSalary) {
        blockers.push(
          `Maximum salary ${job.currency} ${job.maxSalary} per ${job.payPeriod?.toLowerCase()} is below candidate minimum ${prefs.minSalary}`,
        );
        reasonCodes.push(DecisionReasonCodes.SALARY_BELOW_MINIMUM);
      } else if (job.minSalary != null && job.minSalary < prefs.minSalary) {
        warnings.push('The lower end of the posted salary range is below the candidate minimum');
      }
    }

    // Work location is not citizenship or permission to work. Remote never implies worldwide authorization.
    if (!hasCountryAuthorization(job.country, prefs)) {
      missingInformation.push(
        job.country
          ? `Work authorization for '${job.country}' is unconfirmed`
          : 'Job hiring jurisdiction and country-specific work authorization are unconfirmed',
      );
      missingSensitiveInfo = true;
    }
    if (requiresCitizenshipOrClearance(textToSearch)) {
      missingInformation.push(
        'Citizenship or clearance requirements need explicit verified evidence',
      );
      missingSensitiveInfo = true;
    }
    if (prefs.needsSponsorship === true && forbidsSponsorship(textToSearch)) {
      if (hasCountryAuthorization(job.country, prefs)) {
        missingInformation.push('Confirm sponsorship needs for this hiring jurisdiction');
        missingSensitiveInfo = true;
      } else {
        blockers.push(
          'Candidate requires visa sponsorship, but job explicitly does not offer sponsorship',
        );
        reasonCodes.push(DecisionReasonCodes.SPONSORSHIP_CONFLICT);
      }
    } else if (prefs.needsSponsorship == null && /sponsor|visa/i.test(textToSearch)) {
      missingInformation.push('Candidate sponsorship requirement is unconfigured');
      missingSensitiveInfo = true;
    }

    return {
      hasBlockers: blockers.length > 0,
      blockers,
      warnings,
      missingInformation,
      reasonCodes,
      missingSensitiveInfo,
    };
  }
}
