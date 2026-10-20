import type { Job, JobPreferences } from '../schema/index.js';

/** Exact country aliases only: no citizenship, residency or regional work-rights inference. */
export function normalizeCountry(value: string): string {
  const country = value.toLowerCase().trim().replaceAll('.', '').replace(/\s+/g, ' ');
  const aliases: Record<string, string> = {
    us: 'united states',
    usa: 'united states',
    'united states of america': 'united states',
    gb: 'united kingdom',
    uk: 'united kingdom',
    'great britain': 'united kingdom',
    pl: 'poland',
    de: 'germany',
    fr: 'france',
    es: 'spain',
    nl: 'netherlands',
    ie: 'ireland',
    ca: 'canada',
    au: 'australia',
    ch: 'switzerland',
    at: 'austria',
    pt: 'portugal',
    it: 'italy',
  };
  return aliases[country] ?? country;
}
export function hasCountryAuthorization(
  country: string | null,
  preferences: JobPreferences | null,
): boolean {
  return (
    !!country?.trim() &&
    !!preferences?.workAuthorizationCountries.some(
      (value) => normalizeCountry(value) === normalizeCountry(country),
    )
  );
}
export function comparableCompensation(job: Job, preferences: JobPreferences | null): boolean {
  return (
    !!preferences?.salaryPayPeriod &&
    ['YEAR', 'MONTH', 'WEEK', 'DAY', 'HOUR'].includes(preferences.salaryPayPeriod) &&
    job.payPeriod === preferences.salaryPayPeriod &&
    !!job.currency?.trim() &&
    !!preferences.currency?.trim() &&
    job.currency.trim().toUpperCase() === preferences.currency.trim().toUpperCase()
  );
}
export const forbidsSponsorship = (text: string): boolean =>
  /\b(?:no (?:visa )?sponsorship|unable to sponsor|cannot sponsor|not (?:offering|offer|provide|providing) (?:visa )?sponsorship)\b/i.test(
    text,
  );
export const requiresCitizenshipOrClearance = (text: string): boolean =>
  /\b(?:must be (?:a |an )?(?:[a-z-]+ ){0,4}citizen|citizenship (?:is )?required|(?:requires?|required|active|current) (?:[a-z-]+ ){0,4}(?:citizenship|security clearance)|security clearance (?:is )?required)\b/i.test(
    text,
  );
