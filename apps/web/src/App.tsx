import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { NotificationCenterModal } from './components/NotificationCenterModal.js';
import { NotificationClient } from './api/notification-client.js';
import { authClient } from './api/auth-client.js';
import { AuthModal } from './components/AuthModal.js';
import { PilotInvitationsModal } from './components/PilotInvitationsModal.js';

import { Icon, Button, Card, Tabs } from './ui/Primitives.js';
import {
  destinations,
  destinationFor,
  resolveSection,
  applicationViews,
  type NavSection,
} from './ui/navigation.js';
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
const ApplicationWorkspaceView = lazy(() =>
  import('./components/ApplicationWorkspaceView.js').then((module) => ({
    default: module.ApplicationWorkspaceView,
  })),
);
const ApplicationPackagesListView = lazy(() =>
  import('./components/ApplicationPackagesListView.js').then((module) => ({
    default: module.ApplicationPackagesListView,
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

export default function App() {
  const [currentSection, setCurrentSection] = useState<NavSection>('jobs');
  const [profileTab, setProfileTab] = useState<string | undefined>(undefined);
  const [applicationOrigin, setApplicationOrigin] = useState<NavSection>('applications');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<'basics' | 'advanced'>('basics');
  const [connectionNotice, setConnectionNotice] = useState('');
  const [connectionTab, setConnectionTab] = useState<'email' | 'calendar' | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('connection') === 'calendar') {
      setConnectionNotice(
        url.searchParams.has('connectionError')
          ? 'Calendar was not connected. You can try again from this page.'
          : 'Google Calendar connected successfully.',
      );
      setCurrentSection('settings');
      setConnectionTab('calendar');
      url.searchParams.delete('connected');
      url.searchParams.delete('connection');
      url.searchParams.delete('connectionError');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  }, []);

  const [applicationsSubView, setApplicationsSubView] = useState<'crm' | 'packages'>('crm');
  const [refreshKey, setRefreshKey] = useState<number>(0);
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
        requestAnimationFrame(() => menuRef.current?.focus());
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
    setUnreadNotifsCount(0);
    if (!session?.user.id) return;
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);

    return () => clearInterval(interval);
  }, [session?.user.id]);

  useEffect(() => {
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
  }, []);

  const handleNavigate = (section: string, tabOrId?: string) => {
    if (section === 'applications' && tabOrId)
      setApplicationOrigin(
        ['approvals', 'interviews', 'emails'].includes(currentSection)
          ? currentSection
          : 'applications',
      );
    setCurrentSection(resolveSection(section));
    if (section === 'settings') {
      setSettingsTab('basics');
      setConnectionTab(null);
    }
    if (section === 'profile') {
      setProfileTab(tabOrId);
    } else if (section === 'jobs') {
      setSelectedJobId(tabOrId || null);
    } else if (section === 'applications') {
      setApplicationsSubView('crm');
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
  const destinationLabel = destinations.find((item) => item.id === destination)?.label || 'Explore';
  const profileGroup = destination === 'profile';
  const settingsGroup = currentSection === 'settings' || currentSection === 'activity';
  const role = (session?.user as { role?: string } | undefined)?.role;
  const navigate = (section: string, tabOrId?: string) => {
    handleNavigate(section, tabOrId);
    setIsMobileMenuOpen(false);
    if (isNarrow) requestAnimationFrame(() => document.getElementById('main-content')?.focus());
  };
  const selectDestination = (section: NavSection) => {
    if (section === 'jobs') setSelectedJobId(null);
    if (section === 'applications') {
      setApplicationOrigin('applications');
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
            onClick={() => selectDestination('jobs')}
            aria-label="Jobee Explore"
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
              requestAnimationFrame(() => menuRef.current?.focus());
            }}
          >
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label="Main navigation">
          <ul className="nav-list">
            {destinations.map((item) => (
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
                  <small>
                    {role === 'admin'
                      ? 'Owner / Admin'
                      : role === 'tester'
                        ? 'Tester'
                        : 'Pilot user'}
                  </small>
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
            <span className="breadcrumb">{destinationLabel}</span>
          </div>
          <button
            className="notification-button"
            disabled={!session?.user}
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
          className={`main-content ${profileGroup || settingsGroup || destination === 'applications' ? 'grouped-view' : ''}`}
        >
          {isSessionPending ? (
            <Card role="status">Checking your account…</Card>
          ) : !session?.user ? (
            <Card className="welcome-card">
              <h1 className="page-title">Welcome to Jobee</h1>
              <p className="page-subtitle">
                Find the right jobs. Apply intelligently. Track everything.
              </p>
              <p>
                Sign in to explore opportunities and manage your candidate profile and applications.
              </p>
              <Button className="btn-primary" onClick={() => setIsAuthModalOpen(true)}>
                Sign in to get started
              </Button>
            </Card>
          ) : (
            <div key={session.user.id}>
              {profileGroup && (
                <>
                  <header className="group-heading">
                    <h1 className="page-title">Profile</h1>
                    <p className="page-subtitle">
                      Your verified details, documents, preferences and connected accounts.
                    </p>
                  </header>
                  <Tabs
                    variant="pill"
                    label="Profile sections"
                    value={
                      settingsGroup
                        ? 'settings'
                        : ['documents', 'answers', 'preferences'].includes(currentSection)
                          ? currentSection
                          : 'profile'
                    }
                    items={[
                      { id: 'profile', label: 'Profile' },
                      { id: 'documents', label: 'CV & Documents' },
                      { id: 'answers', label: 'Saved Answers' },
                      { id: 'preferences', label: 'Preferences' },
                      { id: 'settings', label: 'Account & connections' },
                    ]}
                    onChange={navigate}
                  />
                  {(currentSection === 'career-intelligence' ||
                    (currentSection === 'profile' && profileTab !== undefined)) && (
                    <Button className="btn-ghost" onClick={() => navigate('profile')}>
                      ← Back to profile overview
                    </Button>
                  )}
                  {currentSection === 'profile' && profileTab === undefined && (
                    <ProfileOverview onNavigate={navigate} />
                  )}
                </>
              )}
              {settingsGroup && (
                <>
                  {connectionNotice && <Card role="status">{connectionNotice}</Card>}
                  <header className="group-heading">
                    <h2>Account & connections</h2>
                    <p className="page-subtitle">
                      Your appearance, connections and privacy choices.
                    </p>
                  </header>
                  <Tabs
                    variant="pill"
                    label="Settings"
                    value={
                      currentSection === 'activity'
                        ? 'activity'
                        : connectionTab
                          ? 'connections'
                          : settingsTab
                    }
                    items={[
                      { id: 'basics', label: 'Account basics' },
                      { id: 'connections', label: 'Connected accounts' },

                      { id: 'activity', label: 'System activity' },
                    ]}
                    onChange={(id) => {
                      if (id === 'activity') navigate('activity');
                      else {
                        setCurrentSection('settings');
                        setSettingsTab(id === 'advanced' ? 'advanced' : 'basics');
                        setConnectionTab(id === 'connections' ? 'email' : null);
                      }
                    }}
                  />
                </>
              )}
              {destination === 'applications' && (
                <>
                  {!(
                    currentSection === 'applications' &&
                    (selectedApplicationId || selectedPackageId)
                  ) && (
                    <header className="group-heading">
                      <h1 className="page-title">Applications</h1>
                      <p className="page-subtitle">
                        See where each application stands and what to do next.
                      </p>
                    </header>
                  )}
                  {!(
                    currentSection === 'applications' &&
                    (selectedApplicationId || selectedPackageId)
                  ) && (
                    <Tabs
                      variant="pill"
                      label="Application views"
                      value={currentSection}
                      items={applicationViews.slice(0, 2)}
                      onChange={navigate}
                    />
                  )}
                  {!(
                    currentSection === 'applications' &&
                    (selectedApplicationId || selectedPackageId)
                  ) && (
                    <details
                      className="advanced-details"
                      open={['emails', 'interviews'].includes(currentSection)}
                    >
                      <summary>Messages & interviews</summary>
                      <Tabs
                        label="Application tools"
                        value={currentSection}
                        items={applicationViews.slice(2)}
                        onChange={navigate}
                      />
                    </details>
                  )}

                  {currentSection === 'applications' &&
                    !selectedApplicationId &&
                    !selectedPackageId &&
                    applicationsSubView === 'packages' && (
                      <Button className="btn-ghost" onClick={() => setApplicationsSubView('crm')}>
                        ← Back to all applications
                      </Button>
                    )}
                </>
              )}
              <Suspense
                key={session?.user.id ?? 'guest'}
                fallback={
                  <div className="card" role="status">
                    Loading your workspace…
                  </div>
                }
              >
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
                {currentSection === 'jobs' && (
                  <JobInboxView
                    selectedJobId={selectedJobId}
                    refreshKey={refreshKey}
                    onSelectJob={setSelectedJobId}
                    onOpenPackage={(id) => {
                      setApplicationOrigin('jobs');
                      setSelectedPackageId(id);
                      setSelectedApplicationId(null);
                      setCurrentSection('applications');
                    }}
                    detail={
                      selectedJobId ? (
                        <JobDetailView
                          key={selectedJobId}
                          jobId={selectedJobId}
                          onBack={() => setSelectedJobId(null)}
                          onJobUpdated={() => setRefreshKey((k) => k + 1)}
                          onPrepareApplication={(pkgId) => {
                            setApplicationOrigin('applications');
                            setSelectedPackageId(pkgId);
                            setSelectedApplicationId(null);
                            setCurrentSection('applications');
                          }}
                          onViewApplicationInCrm={(appId) => {
                            setApplicationOrigin('applications');
                            setSelectedApplicationId(appId);
                            setSelectedPackageId(null);
                            setCurrentSection('applications');
                          }}
                        />
                      ) : null
                    }
                  />
                )}

                {/* Phase 3: Application CRM & Studio */}
                {currentSection === 'applications' &&
                  (selectedApplicationId || selectedPackageId ? (
                    <ApplicationWorkspaceView
                      key={selectedApplicationId || selectedPackageId}
                      applicationId={selectedApplicationId}
                      initialPanel={
                        applicationOrigin === 'approvals' && selectedPackageId
                          ? 'questions'
                          : undefined
                      }
                      packageId={selectedPackageId}
                      onBack={() => {
                        setSelectedApplicationId(null);
                        setSelectedPackageId(null);
                        setCurrentSection(applicationOrigin);
                      }}
                      onNavigateToJob={(id) => navigate('jobs', id)}
                      onNavigateToProfile={() => navigate('profile')}
                    />
                  ) : applicationsSubView === 'packages' ? (
                    <ApplicationPackagesListView
                      onOpenPackage={(pkgId) => {
                        setApplicationOrigin('applications');
                        setSelectedPackageId(pkgId);
                      }}
                      onNavigateToJobs={() => setCurrentSection('jobs')}
                      onNavigateToCrm={() => setApplicationsSubView('crm')}
                    />
                  ) : (
                    <ApplicationsCrmView
                      onSelectApplication={(id) => {
                        setApplicationOrigin('applications');
                        setSelectedApplicationId(id);
                      }}
                      onOpenStudio={(pkgId) => {
                        setApplicationOrigin('applications');
                        setSelectedPackageId(pkgId);
                      }}
                      onNavigateToStudioList={() => setApplicationsSubView('packages')}
                    />
                  ))}

                {/* Phase 3: Approvals Inbox */}
                {currentSection === 'approvals' && (
                  <div className="student-stack">
                    <ApplicationsCrmView
                      initialNeedsAttention
                      onSelectApplication={(id) => {
                        setApplicationOrigin('approvals');
                        setSelectedApplicationId(id);
                        setSelectedPackageId(null);
                        setCurrentSection('applications');
                      }}
                    />
                    <ApprovalsInboxView
                      onOpenPackage={(pkgId) => {
                        setApplicationOrigin('approvals');
                        setSelectedPackageId(pkgId);
                        setSelectedApplicationId(null);
                        setCurrentSection('applications');
                      }}
                    />
                  </div>
                )}

                {/* Phase 4: Email Intelligence & Status Sync */}
                {currentSection === 'emails' && <EmailIntelligenceView />}

                {currentSection === 'settings' && (
                  <>
                    {connectionTab ? (
                      <>
                        <Tabs
                          variant="pill"
                          label="Connected accounts"
                          value={connectionTab}
                          items={[
                            { id: 'email', label: 'Email' },
                            { id: 'calendar', label: 'Calendar' },
                          ]}
                          onChange={(id) => setConnectionTab(id as 'email' | 'calendar')}
                        />
                        {connectionTab === 'email' ? (
                          <EmailIntelligenceView initialTab="accounts" />
                        ) : (
                          <InterviewWorkspaceView
                            initialTab="accounts"
                            onNavigateToApplication={(id) => navigate('applications', id)}
                          />
                        )}
                      </>
                    ) : settingsTab === 'advanced' ? (
                      <SettingsView />
                    ) : (
                      <div className="student-stack">
                        <AppearanceSettings />
                        <section className="card">
                          <h2 className="card-title">Connected accounts</h2>
                          <div className="action-row">
                            <div>
                              <strong>Email</strong>
                              <p>Connect Gmail when you want to follow recruiter updates here.</p>
                            </div>
                            <Button
                              className="btn-outline"
                              onClick={() => setConnectionTab('email')}
                            >
                              Manage email
                            </Button>
                          </div>
                          <div className="action-row">
                            <div>
                              <strong>Calendar</strong>
                              <p>Connect your calendar when you need interview scheduling.</p>
                            </div>
                            <Button
                              className="btn-outline"
                              onClick={() => setConnectionTab('calendar')}
                            >
                              Manage calendar
                            </Button>
                          </div>
                        </section>
                        <section className="card">
                          <h2 className="card-title">Privacy</h2>
                          <p>Control external AI processing and permission to use saved details.</p>
                          <div className="account-actions">
                            <Button
                              className="btn-outline"
                              onClick={() => navigate('career-intelligence')}
                            >
                              AI permissions
                            </Button>

                            <Button className="btn-outline" onClick={() => navigate('activity')}>
                              System activity
                            </Button>
                          </div>
                        </section>
                      </div>
                    )}
                  </>
                )}

                {currentSection === 'interviews' && (
                  <InterviewWorkspaceView
                    onNavigateToApplication={(appId) => {
                      setApplicationOrigin('interviews');
                      setSelectedApplicationId(appId);
                      setSelectedPackageId(null);
                      setCurrentSection('applications');
                    }}
                  />
                )}
              </Suspense>
            </div>
          )}
        </main>
      </div>
      {/* Phase 5: Notification Center Modal */}
      <NotificationCenterModal
        key={`notifications-${session?.user.id ?? 'guest'}`}
        isOpen={Boolean(session?.user) && isNotifModalOpen}
        onClose={() => {
          setIsNotifModalOpen(false);
          fetchUnread();
        }}
        onNavigate={navigate}
      />

      {/* Better Auth: Sign In & Private Pilot Registration Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Admin: Pilot Invitations Management Modal */}
      <PilotInvitationsModal
        key={`invitations-${session?.user.id ?? 'guest'}`}
        isOpen={role === 'admin' && isPilotModalOpen}
        onClose={() => setIsPilotModalOpen(false)}
      />
    </div>
  );
}
