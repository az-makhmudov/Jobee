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
const countries = new Set([
  'poland',
  'germany',
  'united kingdom',
  'france',
  'united states',
  'switzerland',
  'netherlands',
  'canada',
  'australia',
  'spain',
  'italy',
  'portugal',
  'ireland',
  'austria',
  'belgium',
  'czechia',
  'czech republic',
  'slovakia',
  'ukraine',
  'lithuania',
  'latvia',
  'estonia',
  'sweden',
  'norway',
  'denmark',
  'finland',
  'uzbekistan',
  'kazakhstan',
  'kyrgyzstan',
  'tajikistan',
  'turkmenistan',
]);
/** Recommendation geography requires an actual target match; willingness to relocate is separate. */
export function matchesPreferredLocation(
  job: Pick<Job, 'city' | 'region' | 'country' | 'locationText'> &
    Partial<Pick<Job, 'workplaceType'>>,
  preferences: JobPreferences | null,
): boolean {
  const locations = (preferences?.preferredLocations ?? [])
    .flatMap((value) => value.split(','))
    .map(place)
    .filter(Boolean);
  if (!locations.length) return true;
  const cities = locations.filter((value) => !countries.has(value) && value !== 'remote');
  const countryTargets = locations.filter((value) => countries.has(value));
  if (locations.includes('remote') && job.workplaceType === 'REMOTE') {
    return !countryTargets.length || countryTargets.includes(place(job.country ?? ''));
  }
  const known = [job.city, job.region, job.country]
    .filter((value): value is string => !!value)
    .map(place);
  const text = (job.locationText ?? '').split(/[,;/|]/).map(place);
  const target = cities.length ? cities : locations;
  const matches = target.some((value) => known.includes(value) || text.includes(value));
  return (
    matches &&
    (!cities.length ||
      !countryTargets.length ||
      countryTargets.some((value) => value === place(job.country ?? '') || text.includes(value)))
  );
}
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
  if (levels.length) return [...new Set(levels)];
  if (['STUDENT', 'ENTRY'].includes(profile?.careerStage ?? '')) return ['INTERNSHIP', 'ENTRY'];
  if (/\b(junior|entry.level)\b/i.test(profile?.headline ?? '')) return ['INTERNSHIP', 'ENTRY'];
  return [];
}
export function jobSeniority(job: Pick<Job, 'title' | 'seniority'>): string {
  if (
    /\b(intern|internship|trainee|staz|stazysta|stazystka|praktykant|praktykantka)\b/i.test(
      normalized(job.title),
    )
  )
    return 'INTERNSHIP';
  if (/\b(junior|entry.level|graduate|mlodszy|mlodsza)\b/i.test(normalized(job.title)))
    return 'ENTRY';
  if (/\b(senior|sr\.?|starszy|starsza)\b/i.test(normalized(job.title))) return 'SENIOR';
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
  if (locations.length) {
    const known = [job.city, job.region, job.country].filter((x): x is string => !!x).map(place);
    const matches = matchesPreferredLocation(job, preferences);
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
