// Legacy section identifiers remain compatible with record links and notifications.
export type Destination = 'jobs' | 'applications' | 'profile';
export type NavSection =
  | 'profile'
  | 'career-intelligence'
  | 'documents'
  | 'answers'
  | 'preferences'
  | 'activity'
  | 'jobs'
  | 'applications'
  | 'approvals'
  | 'emails'
  | 'interviews'
  | 'settings';

const sections: readonly string[] = [
  'profile',
  'career-intelligence',
  'documents',
  'answers',
  'preferences',
  'activity',
  'jobs',
  'applications',
  'approvals',
  'emails',
  'interviews',
  'settings',
];

/** Retired Home links and unknown destinations return to Explore; stored record IDs stay intact. */
export function resolveSection(section: string): NavSection {
  return sections.includes(section) ? (section as NavSection) : 'jobs';
}

export function destinationFor(section: string): Destination {
  if (
    [
      'profile',
      'career-intelligence',
      'documents',
      'answers',
      'preferences',
      'settings',
      'activity',
    ].includes(section)
  )
    return 'profile';
  if (['applications', 'approvals', 'interviews', 'emails'].includes(section))
    return 'applications';
  return 'jobs';
}
export const destinations = [
  { id: 'jobs', label: 'Explore', icon: 'jobs' },
  { id: 'applications', label: 'Applications', icon: 'applications' },
  { id: 'profile', label: 'Profile', icon: 'profile' },
] as const;
export const applicationViews = [
  { id: 'applications', label: 'All applications' },
  { id: 'approvals', label: 'Needs review' },
  { id: 'interviews', label: 'Interviews' },
  { id: 'emails', label: 'Messages' },
];
