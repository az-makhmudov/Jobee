import type { CandidateProfile, Job, JobPreferences } from '../schema/index.js';
import { normalizeCountry } from './eligibility.js';
const normalized = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ł/g, 'l').trim();
const place = (value: string) => {
  const text = normalized(value);
  return (
    (
      { warsaw: 'warszawa', cracow: 'krakow', lodz: 'lodz', wroclaw: 'wroclaw' } as Record<
        string,
        string
      >
    )[text] ?? normalizeCountry(text)
  );
};
const levelName = (value: string) => {
  const level = value.trim().toUpperCase();
  if (['JUNIOR', 'ENTRY'].includes(level)) return 'ENTRY';
  if (['INTERN', 'INTERNSHIP', 'TRAINEE'].includes(level)) return 'INTERNSHIP';
  return level;
};
export function preferredLevels(
  preferences: JobPreferences | null,
  profile: CandidateProfile | null,
): string[] {
  const levels = preferences?.seniorityLevels.map(levelName) ?? [];
  if (levels.length) return levels;
  if (['STUDENT', 'ENTRY'].includes(profile?.careerStage ?? '')) return ['INTERNSHIP', 'ENTRY'];
  if (/\b(junior|entry.level)\b/i.test(profile?.headline ?? '')) return ['INTERNSHIP', 'ENTRY'];
  return [];
}
export function jobSeniority(job: Pick<Job, 'title' | 'seniority'>): string {
  if (/\b(intern|internship|trainee)\b/i.test(job.title)) return 'INTERNSHIP';
  if (/\b(junior|entry.level|graduate)\b/i.test(job.title)) return 'ENTRY';
  if (/\b(senior|sr\.?)\b/i.test(job.title)) return 'SENIOR';
  if (/\b(director|head of)\b/i.test(job.title)) return 'DIRECTOR';
  if (
    /\bprincipal\b|\b(?:staff|lead) (?:engineer|developer|architect|scientist|designer|software|data)\b/i.test(
      job.title,
    )
  )
    return 'LEAD';
  return levelName(job.seniority);
}
/** Explicit compatibility only. Unknown location/level is not fabricated or treated as eligibility. */
export function relevanceIssues(
  job: Pick<Job, 'title' | 'seniority' | 'city' | 'region' | 'country' | 'locationText'>,
  preferences: JobPreferences | null,
  profile: CandidateProfile | null,
): string[] {
  const issues: string[] = [];
  const levels = preferredLevels(preferences, profile);
  const level = jobSeniority(job);
  if (levels.length && level !== 'UNKNOWN' && !levels.includes(level)) issues.push('seniority');
  const locations = preferences?.preferredLocations.filter((x) => x.trim()) ?? [];
  if (locations.length && preferences?.willingToRelocate !== true) {
    const known = [job.city, job.region, job.country].filter((x): x is string => !!x).map(place);
    const text = normalized(job.locationText ?? '');
    const matches = locations.some(
      (value) =>
        known.includes(place(value)) ||
        text.split(/[,;/|]/).some((part) => place(part) === place(value)),
    );
    // A country-only posting cannot disprove a city preference within that country.
    const countryPreference = locations.some((value) => place(value) === place(job.country ?? ''));
    const explicitCityMismatch =
      !!job.city && locations.every((value) => !known.includes(place(value)));
    const knownForeignCountry =
      !!job.country &&
      locations.some((value) =>
        ['poland', 'germany', 'united kingdom', 'france', 'united states', 'switzerland'].includes(
          place(value),
        ),
      ) &&
      !countryPreference;
    if (!matches && (explicitCityMismatch || knownForeignCountry)) issues.push('location');
  }
  return issues;
}
