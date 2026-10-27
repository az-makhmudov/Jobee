/** Discovery is a recall step; completed matching decides whether a role is recommended. */
const words = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .match(/[a-z0-9]+/g) ?? [];
const modifiers = new Set([
  'junior',
  'senior',
  'entry',
  'level',
  'intern',
  'internship',
  'trainee',
  'graduate',
  'lead',
]);
const roles = new Set([
  'manager',
  'management',
  'coordinator',
  'coordination',
  'specialist',
  'analyst',
  'assistant',
  'administrator',
  'support',
  'master',
]);
export function matchesDiscoveryRole(title: string, targets: string[]): boolean {
  if (!targets.length) return true;
  const titleWords = new Set(words(title));
  return targets.some((target) => {
    const tokens = words(target).filter((word) => !modifiers.has(word));
    const domain = tokens.filter((word) => !roles.has(word));
    const required = domain.length ? domain : tokens;
    return required.length > 0 && required.every((word) => titleWords.has(word));
  });
}
/** Search hint only: publication still requires the independently checked saved target city. */
export function discoveryCountry(locations: string[]): string | undefined {
  const polish = new Set([
    'poland',
    'polska',
    'warsaw',
    'warszawa',
    'krakow',
    'cracow',
    'wroclaw',
    'lodz',
    'poznan',
    'gdansk',
    'katowice',
  ]);
  return locations.length &&
    locations.every((location) => words(location).some((word) => polish.has(word)))
    ? 'pl'
    : undefined;
}

/** Employer metadata can explicitly rule out an early-career discovery target even when its title is generic. */
export function matchesDiscoveryExperience(
  experience: string | undefined,
  levels: string[],
): boolean {
  const earlyOnly =
    levels.length > 0 && levels.every((level) => ['ENTRY', 'INTERNSHIP'].includes(level));
  return !earlyOnly || !['mid_senior_level', 'director', 'executive'].includes(experience ?? '');
}
