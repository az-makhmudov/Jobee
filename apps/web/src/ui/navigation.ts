// Legacy section identifiers remain the navigation contract for record links and notifications.
export type Destination = 'dashboard' | 'jobs' | 'applications' | 'profile' | 'settings';
export function destinationFor(section: string): Destination {
  if (['profile', 'career-intelligence', 'documents', 'answers', 'preferences'].includes(section))
    return 'profile';
  if (['applications', 'approvals', 'interviews', 'emails'].includes(section))
    return 'applications';
  if (section === 'activity') return 'settings';
  if (section === 'jobs' || section === 'settings') return section;
  return 'dashboard';
}
export const destinations = [
  { id: 'dashboard', label: 'Home', icon: 'home' },
  { id: 'jobs', label: 'Find jobs', icon: 'jobs' },
  { id: 'applications', label: 'My applications', icon: 'applications' },
  { id: 'profile', label: 'My profile', icon: 'profile' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
] as const;
export const applicationViews = [
  { id: 'applications', label: 'All applications' },
  { id: 'approvals', label: 'Needs review' },
  { id: 'interviews', label: 'Interviews' },
  { id: 'emails', label: 'Messages' },
];
