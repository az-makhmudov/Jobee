import type { JobPreferencesDto } from './candidate.js';
export const AUTOPILOT_TERMS = 'jobee-autopilot-v1';
export interface AutopilotGrant {
  version: number;
  termsVersion: typeof AUTOPILOT_TERMS;
  acceptedAt: string;
  candidateFingerprint: string;
  intervalHours: number;
  maxPerDay: number;
  minScore: number;
  reviewMode: 'PAUSE';
  preferences: Pick<
    JobPreferencesDto,
    | 'targetTitles'
    | 'preferredLocations'
    | 'workModes'
    | 'employmentTypes'
    | 'minSalary'
    | 'currency'
    | 'salaryPayPeriod'
    | 'excludedCompanies'
    | 'excludedKeywords'
    | 'needsSponsorship'
    | 'workAuthorizationCountries'
    | 'internshipEligible'
    | 'acceptUnpaid'
  >;
}
export interface AutopilotStateDto {
  candidateFingerprint: string;
  preview: AutopilotGrant['preferences'] | null;
  available: boolean;
  enabled: boolean;
  current: boolean;
  grant: AutopilotGrant | null;
  nextRunAt: string | null;
  message: string;
}
