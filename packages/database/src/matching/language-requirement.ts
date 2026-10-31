/** Conservative language grammar. Each group is required; alternatives within a group are OR. */
export function languageRequirementGroups(text: string): string[][] | null {
  const names =
    /\b(english|french|german|italian|spanish|polish|russian|uzbek|ukrainian|portuguese|arabic|chinese|dutch|japanese|korean|turkish|hindi|romanian|swedish|danish|norwegian|finnish|czech|slovak|hungarian|greek|hebrew|kazakh|kyrgyz|tajik|serbian|croatian|lithuanian|latvian|estonian|georgian|azerbaijani|urdu|persian)\b/gi;
  const clauses = text
    .split(/[;\n]/)
    .filter((part) => !/optional|a plus|advantage|atut|mile widzian/i.test(part));
  const required = clauses.join(';').toLowerCase();
  if (/\bor\b.*\band\b/.test(required)) return null;
  const parts = required.split(/\b(?:and|oraz)\b/);
  const groups: string[][] = [];
  for (const part of parts) {
    if (new Set(part.match(/\b[A-C][1-2]\b/gi)?.map((value) => value.toUpperCase())).size > 1)
      return null;
    const matches = [...part.matchAll(names)].map((m) => m[1]!.toLowerCase());
    if (!matches.length) return null;
    const unique = [...new Set(matches)];
    if (unique.length > 1 && !/\b(?:or|lub|either)\b/.test(part)) return null;
    groups.push(unique);
  }
  return groups.length ? groups : null;
}
