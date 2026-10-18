export type Destination =
  | 'dashboard'
  | 'jobs'
  | 'applications'
  | 'approvals'
  | 'interviews'
  | 'emails'
  | 'profile'
  | 'settings';
export function destinationFor(section: string): Destination {
  if (['profile', 'career-intelligence', 'documents', 'answers', 'preferences'].includes(section))
    return 'profile';
  if (section === 'activity') return 'settings';
  return section as Destination;
}
export const destinations = [
  { id: 'dashboard', label: 'Home', icon: 'home' },
  { id: 'jobs', label: 'Jobs', icon: 'jobs' },
  { id: 'applications', label: 'Applications', icon: 'applications' },
  { id: 'approvals', label: 'Approvals', icon: 'approvals' },
  { id: 'interviews', label: 'Interviews', icon: 'interviews' },
  { id: 'emails', label: 'Messages', icon: 'messages' },
  { id: 'profile', label: 'My Profile', icon: 'profile' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
] as const;
