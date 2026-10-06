import { Job } from '@job-agent/database';
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
        // If candidate is willing to relocate, onsite might still be acceptable
        if (prefs.willingToRelocate === true && job.workplaceType === 'ONSITE') {
          warnings.push(
            `Workplace mode '${job.workplaceType}' requires relocation (permitted by preferences)`,
          );
        } else {
          blockers.push(
            `Workplace mode '${job.workplaceType}' is not in candidate allowed modes: ${allowedWorkModes.join(', ')}`,
          );
          reasonCodes.push(DecisionReasonCodes.WORK_MODE_NOT_ALLOWED);
        }
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
          if (prefs.willingToRelocate === true) {
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

    // 6. COMPENSATION / MIN SALARY
    if (prefs.minSalary !== null && prefs.minSalary !== undefined) {
      if (job.maxSalary !== null && job.maxSalary !== undefined) {
        const currenciesMatch =
          !job.currency ||
          !prefs.currency ||
          job.currency.toUpperCase() === prefs.currency.toUpperCase();
        if (currenciesMatch && job.maxSalary < prefs.minSalary) {
          blockers.push(
            `Maximum salary ${job.currency ?? prefs.currency} ${job.maxSalary} is below candidate minimum of ${prefs.minSalary}`,
          );
          reasonCodes.push(DecisionReasonCodes.SALARY_BELOW_MINIMUM);
        }
      } else if (job.minSalary !== null && job.minSalary !== undefined) {
        const currenciesMatch =
          !job.currency ||
          !prefs.currency ||
          job.currency.toUpperCase() === prefs.currency.toUpperCase();
        if (currenciesMatch && job.minSalary < prefs.minSalary) {
          warnings.push(
            `Minimum posted salary ${job.minSalary} is below candidate threshold of ${prefs.minSalary}`,
          );
        }
      }
    } else {
      missingInformation.push('Candidate minimum salary preference is unconfigured');
    }

    // 7. SPONSORSHIP & WORK AUTHORIZATION
    if (prefs.needsSponsorship === true) {
      const forbidsSponsorship =
        textToSearch.includes('no sponsorship') ||
        textToSearch.includes('unable to sponsor') ||
        textToSearch.includes('must be a us citizen') ||
        textToSearch.includes('citizenship required') ||
        textToSearch.includes('not offering visa sponsorship');

      if (forbidsSponsorship) {
        blockers.push(
          'Candidate requires visa sponsorship, but job explicitly does not offer sponsorship',
        );
        reasonCodes.push(DecisionReasonCodes.SPONSORSHIP_CONFLICT);
      }
    } else if (prefs.needsSponsorship === null) {
      // Sponsorship is unknown
      const mentionsSponsorship =
        textToSearch.includes('sponsorship') ||
        textToSearch.includes('visa') ||
        textToSearch.includes('work authorization') ||
        textToSearch.includes('citizen');

      if (mentionsSponsorship) {
        warnings.push(
          'Job mentions work authorization or sponsorship, but candidate sponsorship preference is unconfigured',
        );
        missingInformation.push('Candidate sponsorship requirement is unconfigured');
        missingSensitiveInfo = true;
      }
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
