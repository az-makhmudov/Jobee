import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { DashboardView } from './components/DashboardView.js';
import { NotificationCenterModal } from './components/NotificationCenterModal.js';
import { NotificationClient } from './api/notification-client.js';
import { authClient } from './api/auth-client.js';
import { AuthModal } from './components/AuthModal.js';
import { PilotInvitationsModal } from './components/PilotInvitationsModal.js';

import { Icon, Button, Tabs } from './ui/Primitives.js';
import { destinations, destinationFor } from './ui/navigation.js';
import { brandDot } from './ui/icons.js';
import { AppearanceSettings } from './ui/Theme.js';
import { ProfileOverview } from './components/ProfileOverview.js';
import type { CSSProperties } from 'react';

const ProfileView = lazy(() =>
  import('./components/ProfileView.js').then((module) => ({ default: module.ProfileView })),
);
const DocumentsView = lazy(() =>
  import('./components/DocumentsView.js').then((module) => ({ default: module.DocumentsView })),
);
const AnswerLibraryView = lazy(() =>
  import('./components/AnswerLibraryView.js').then((module) => ({
    default: module.AnswerLibraryView,
  })),
);
const PreferencesView = lazy(() =>
  import('./components/PreferencesView.js').then((module) => ({ default: module.PreferencesView })),
);
const ActivityView = lazy(() =>
  import('./components/ActivityView.js').then((module) => ({ default: module.ActivityView })),
);
const SettingsView = lazy(() =>
  import('./components/SettingsView.js').then((module) => ({ default: module.SettingsView })),
);
const JobInboxView = lazy(() =>
  import('./components/JobInboxView.js').then((module) => ({ default: module.JobInboxView })),
);
const JobDetailView = lazy(() =>
  import('./components/JobDetailView.js').then((module) => ({ default: module.JobDetailView })),
);
const ApplicationsCrmView = lazy(() =>
  import('./components/ApplicationsCrmView.js').then((module) => ({
    default: module.ApplicationsCrmView,
  })),
);
const ApplicationDetailView = lazy(() =>
  import('./components/ApplicationDetailView.js').then((module) => ({
    default: module.ApplicationDetailView,
  })),
);
const ApplicationPackagesListView = lazy(() =>
  import('./components/ApplicationPackagesListView.js').then((module) => ({
    default: module.ApplicationPackagesListView,
  })),
);
const ApplicationStudioView = lazy(() =>
  import('./components/ApplicationStudioView.js').then((module) => ({
    default: module.ApplicationStudioView,
  })),
);
const CareerIntelligenceView = lazy(() =>
  import('./components/CareerIntelligenceView.js').then((module) => ({
    default: module.CareerIntelligenceView,
  })),
);
const ApprovalsInboxView = lazy(() =>
  import('./components/ApprovalsInboxView.js').then((module) => ({
    default: module.ApprovalsInboxView,
  })),
);
const EmailIntelligenceView = lazy(() =>
  import('./components/EmailIntelligenceView.js').then((module) => ({
    default: module.EmailIntelligenceView,
  })),
);
const InterviewWorkspaceView = lazy(() =>
  import('./components/InterviewWorkspaceView.js').then((module) => ({
    default: module.InterviewWorkspaceView,
  })),
);

export type NavSection =
  | 'dashboard'
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

export default function App() {
  const [currentSection, setCurrentSection] = useState<NavSection>('dashboard');
  const [profileTab, setProfileTab] = useState<string | undefined>(undefined);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [applicationsSubView, setApplicationsSubView] = useState<'crm' | 'packages'>('crm');
  const [, setRefreshKey] = useState<number>(0);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const sidebarRef = useRef<HTMLElement>(null),
    menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => {
      setIsNarrow(query.matches);
      if (!query.matches) setIsMobileMenuOpen(false);
    };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!isNarrow || !isMobileMenuOpen) return;
    const first = sidebarRef.current?.querySelector<HTMLElement>('button');
    first?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
        menuRef.current?.focus();
      }
      if (event.key === 'Tab') {
        const nodes = Array.from(
          sidebarRef.current?.querySelectorAll<HTMLElement>('button,a[href]') || [],
        ).filter((node) => node.getClientRects().length > 0);
        if (event.shiftKey && document.activeElement === nodes[0]) {
          event.preventDefault();
          nodes.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) {
          event.preventDefault();
          nodes[0]?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [isNarrow, isMobileMenuOpen]);

  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPilotModalOpen, setIsPilotModalOpen] = useState(false);

  const fetchUnread = async () => {
    try {
      const count = await NotificationClient.getUnreadCount();
      setUnreadNotifsCount(count);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);

    // Deep-link invite query parameter support (?invite=...)
    try {
      const params = new URLSearchParams(window.location.search);
      const inviteCode = params.get('invite');
      if (inviteCode && inviteCode.trim().length > 0) {
        sessionStorage.setItem('jobee_invite_code', inviteCode.trim());
        setIsAuthModalOpen(true);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch {
      // Safe fallback
    }

    return () => clearInterval(interval);
  }, []);

  const handleNavigate = (section: string, tabOrId?: string) => {
    setCurrentSection(section as NavSection);
    if (section === 'profile') {
      setProfileTab(tabOrId);
    } else if (section === 'jobs') {
      setSelectedJobId(tabOrId || null);
    } else if (section === 'applications') {
      if (tabOrId) {
        setSelectedApplicationId(tabOrId);
        setSelectedPackageId(null);
      } else {
        setSelectedApplicationId(null);
        setSelectedPackageId(null);
      }
    }
  };

  const destination = destinationFor(currentSection);
  const destinationLabel = destinations.find((item) => item.id === destination)?.label || 'Home';
  const profileGroup = destination === 'profile';
  const settingsGroup = destination === 'settings';
  const role = (session?.user as { role?: string } | undefined)?.role;
  const navigate = (section: string, tabOrId?: string) => {
    handleNavigate(section, tabOrId);
    setIsMobileMenuOpen(false);
    if (isNarrow) requestAnimationFrame(() => document.getElementById('main-content')?.focus());
  };
  const selectDestination = (section: NavSection) => {
    if (section === 'jobs') setSelectedJobId(null);
    if (section === 'applications') {
      setSelectedPackageId(null);
      setSelectedApplicationId(null);
    }
    navigate(section);
  };
  return (
    <div className="app-container">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {isMobileMenuOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsMobileMenuOpen(false)} />
      )}
      <aside
        ref={sidebarRef}
        inert={isNarrow && !isMobileMenuOpen}
        aria-hidden={isNarrow && !isMobileMenuOpen ? true : undefined}
        className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}
        aria-label="Workspace sidebar"
      >
        <div className="sidebar-title">
          <a
            href="#main-content"
            className="wordmark"
            onClick={() => selectDestination('dashboard')}
            aria-label="Jobee Home"
          >
            jobee
            <span
              className="brand-dot"
              aria-hidden="true"
              style={{ '--brand-dot': `url("${brandDot}")` } as CSSProperties}
            />
          </a>
          <button
            className="sidebar-close-btn btn btn-ghost"
            aria-label="Close navigation"
            onClick={() => {
              setIsMobileMenuOpen(false);
              menuRef.current?.focus();
            }}
          >
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label="Main navigation">
          <ul className="nav-list">
            {destinations.slice(0, 6).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`nav-button ${destination === item.id ? 'active' : ''}`}
                  aria-current={destination === item.id ? 'page' : undefined}
                  onClick={() => selectDestination(item.id)}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Profile and settings" className="sidebar-utilities">
          <ul className="nav-list">
            {destinations.slice(6).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`nav-button ${destination === item.id ? 'active' : ''}`}
                  aria-current={destination === item.id ? 'page' : undefined}
                  onClick={() => selectDestination(item.id)}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          {isSessionPending ? (
            <p role="status">Checking account…</p>
          ) : session?.user ? (
            <>
              <div className="account-identity">
                <Icon name="account" />
                <div>
                  <span>{session.user.name || 'Your account'}</span>
                  <small>{session.user.email}</small>
                  <small>{role === 'admin' ? 'Owner / Admin' : 'Pilot Tester'}</small>
                </div>
              </div>
              <div className="account-actions">
                {role === 'admin' && (
                  <Button className="btn-ghost btn-sm" onClick={() => setIsPilotModalOpen(true)}>
                    Invites
                  </Button>
                )}
                <Button
                  className="btn-ghost btn-sm"
                  onClick={async () => {
                    await authClient.signOut();
                    window.location.reload();
                  }}
                >
                  Sign Out
                </Button>
              </div>
            </>
          ) : (
            <Button className="btn-primary" onClick={() => setIsAuthModalOpen(true)}>
              Sign in / Join pilot
            </Button>
          )}
        </div>
      </aside>
      <div className="workspace" inert={isNarrow && isMobileMenuOpen}>
        <header className="desktop-topbar">
          <div className="account-actions">
            <button
              ref={menuRef}
              className="mobile-menu-button btn btn-ghost"
              type="button"
              aria-label="Open navigation"
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((v) => !v)}
            >
              <Icon name="menu" />
            </button>
            <span className="breadcrumb">Your workspace / {destinationLabel}</span>
          </div>
          <button
            className="notification-button"
            aria-label={`Notifications${unreadNotifsCount ? `, ${unreadNotifsCount} unread` : ''}`}
            onClick={() => setIsNotifModalOpen(true)}
          >
            <Icon name="notifications" />
            {unreadNotifsCount > 0 && (
              <span className="notification-count">{unreadNotifsCount}</span>
            )}
          </button>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className={`main-content ${profileGroup || settingsGroup ? 'grouped-view' : ''}`}
        >
          {profileGroup && (
            <>
              <header className="group-heading">
                <h1>My Profile</h1>
                <p className="page-subtitle">Your studies, skills and next steps, in one place.</p>
              </header>
              <Tabs
                label="My Profile"
                value={
                  ['documents', 'answers', 'preferences'].includes(currentSection)
                    ? currentSection
                    : 'profile'
                }
                items={[
                  { id: 'profile', label: 'Profile' },
                  { id: 'documents', label: 'CV & Documents' },
                  { id: 'answers', label: 'Saved Answers' },
                  { id: 'preferences', label: 'Preferences' },
                ]}
                onChange={navigate}
              />
              {(currentSection === 'profile' || currentSection === 'career-intelligence') && (
                <Tabs
                  label="Profile workspace"
                  value={
                    currentSection === 'career-intelligence'
                      ? 'review'
                      : profileTab === undefined
                        ? 'overview'
                        : 'records'
                  }
                  items={[
                    { id: 'overview', label: 'Overview' },
                    { id: 'records', label: 'Your details' },
                    { id: 'review', label: 'Review & suggestions' },
                  ]}
                  onChange={(id) =>
                    navigate(
                      id === 'review' ? 'career-intelligence' : 'profile',
                      id === 'records' ? 'personal' : undefined,
                    )
                  }
                />
              )}
              {currentSection === 'profile' && profileTab === undefined && (
                <ProfileOverview onNavigate={navigate} />
              )}
            </>
          )}
          {settingsGroup && (
            <>
              <header className="group-heading">
                <h1>Settings</h1>
                <p className="page-subtitle">Manage connections, appearance and system activity.</p>
              </header>
              <Tabs
                label="Settings"
                value={currentSection}
                items={[
                  { id: 'settings', label: 'Configuration' },
                  { id: 'activity', label: 'System activity' },
                ]}
                onChange={navigate}
              />
            </>
          )}
          {currentSection === 'applications' && !selectedApplicationId && !selectedPackageId && (
            <Tabs
              label="Applications"
              value={applicationsSubView}
              items={[
                { id: 'crm', label: 'Tracker' },
                { id: 'packages', label: 'Prepared materials' },
              ]}
              onChange={(id) => setApplicationsSubView(id as 'crm' | 'packages')}
            />
          )}
          <Suspense
            fallback={
              <div className="card" role="status">
                Loading your workspace…
              </div>
            }
          >
            {currentSection === 'dashboard' && (
              <DashboardView
                onNavigate={handleNavigate}
                onOpenAuth={() => setIsAuthModalOpen(true)}
              />
            )}

            {currentSection === 'profile' && profileTab !== undefined && (
              <ProfileView
                key={profileTab}
                initialTab={profileTab}
                onUpdate={() => setRefreshKey((k) => k + 1)}
              />
            )}

            {currentSection === 'career-intelligence' && <CareerIntelligenceView />}

            {currentSection === 'documents' && (
              <DocumentsView onUpdate={() => setRefreshKey((k) => k + 1)} />
            )}

            {currentSection === 'answers' && (
              <AnswerLibraryView onUpdate={() => setRefreshKey((k) => k + 1)} />
            )}

            {currentSection === 'preferences' && (
              <PreferencesView onUpdate={() => setRefreshKey((k) => k + 1)} />
            )}

            {currentSection === 'activity' && <ActivityView />}

            {/* Phase 2: Job Inbox and Detail */}
            {currentSection === 'jobs' &&
              (selectedJobId ? (
                <JobDetailView
                  jobId={selectedJobId}
                  onBack={() => setSelectedJobId(null)}
                  onJobUpdated={() => setRefreshKey((k) => k + 1)}
                  onPrepareApplication={(pkgId) => {
                    setSelectedPackageId(pkgId);
                    setSelectedApplicationId(null);
                    setCurrentSection('applications');
                  }}
                  onViewApplicationInCrm={(appId) => {
                    setSelectedApplicationId(appId);
                    setSelectedPackageId(null);
                    setCurrentSection('applications');
                  }}
                />
              ) : (
                <JobInboxView onSelectJob={(id) => setSelectedJobId(id)} />
              ))}

            {/* Phase 3: Application CRM & Studio */}
            {currentSection === 'applications' &&
              (selectedApplicationId ? (
                <ApplicationDetailView
                  applicationId={selectedApplicationId}
                  onBack={() => setSelectedApplicationId(null)}
                  onOpenStudio={(pkgId) => {
                    setSelectedPackageId(pkgId);
                    setSelectedApplicationId(null);
                  }}
                  onNavigateToJob={(jId) => {
                    setSelectedJobId(jId);
                    setCurrentSection('jobs');
                  }}
                />
              ) : selectedPackageId ? (
                <ApplicationStudioView
                  packageId={selectedPackageId}
                  onBack={() => setSelectedPackageId(null)}
                  onNavigateToJob={(jId) => {
                    setSelectedJobId(jId);
                    setCurrentSection('jobs');
                  }}
                  onNavigateToApplication={(appId) => {
                    setSelectedApplicationId(appId);
                    setSelectedPackageId(null);
                  }}
                />
              ) : applicationsSubView === 'packages' ? (
                <ApplicationPackagesListView
                  onOpenPackage={(pkgId) => setSelectedPackageId(pkgId)}
                  onNavigateToJobs={() => setCurrentSection('jobs')}
                  onNavigateToCrm={() => setApplicationsSubView('crm')}
                />
              ) : (
                <ApplicationsCrmView
                  onSelectApplication={(id) => setSelectedApplicationId(id)}
                  onOpenStudio={(pkgId) => setSelectedPackageId(pkgId)}
                  onNavigateToStudioList={() => setApplicationsSubView('packages')}
                />
              ))}

            {/* Phase 3: Approvals Inbox */}
            {currentSection === 'approvals' && (
              <ApprovalsInboxView
                onOpenPackage={(pkgId) => {
                  setSelectedPackageId(pkgId);
                  setSelectedApplicationId(null);
                  setCurrentSection('applications');
                }}
              />
            )}

            {/* Phase 4: Email Intelligence & Status Sync */}
            {currentSection === 'emails' && <EmailIntelligenceView />}

            {currentSection === 'settings' && (
              <>
                <AppearanceSettings />
                <SettingsView />
              </>
            )}

            {currentSection === 'interviews' && (
              <InterviewWorkspaceView
                onNavigateToApplication={(appId) => {
                  setSelectedApplicationId(appId);
                  setSelectedPackageId(null);
                  setCurrentSection('applications');
                }}
              />
            )}
          </Suspense>
        </main>
      </div>
      {/* Phase 5: Notification Center Modal */}
      <NotificationCenterModal
        isOpen={isNotifModalOpen}
        onClose={() => {
          setIsNotifModalOpen(false);
          fetchUnread();
        }}
        onNavigate={handleNavigate}
      />

      {/* Better Auth: Sign In & Private Pilot Registration Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Admin: Pilot Invitations Management Modal */}
      <PilotInvitationsModal isOpen={isPilotModalOpen} onClose={() => setIsPilotModalOpen(false)} />
    </div>
  );
}
