import { useState, useEffect } from 'react';
import { DashboardView } from './components/DashboardView.js';
import { ProfileView } from './components/ProfileView.js';
import { DocumentsView } from './components/DocumentsView.js';
import { AnswerLibraryView } from './components/AnswerLibraryView.js';
import { PreferencesView } from './components/PreferencesView.js';
import { ActivityView } from './components/ActivityView.js';
import { SettingsView } from './components/SettingsView.js';
import { JobInboxView } from './components/JobInboxView.js';
import { JobDetailView } from './components/JobDetailView.js';
import { ApplicationsCrmView } from './components/ApplicationsCrmView.js';
import { ApplicationDetailView } from './components/ApplicationDetailView.js';
import { ApplicationPackagesListView } from './components/ApplicationPackagesListView.js';
import { ApplicationStudioView } from './components/ApplicationStudioView.js';
import { ApprovalsInboxView } from './components/ApprovalsInboxView.js';
import { EmailIntelligenceView } from './components/EmailIntelligenceView.js';
import { InterviewWorkspaceView } from './components/InterviewWorkspaceView.js';
import { NotificationCenterModal } from './components/NotificationCenterModal.js';
import { NotificationClient } from './api/notification-client.js';

export type NavSection =
  | 'dashboard'
  | 'profile'
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
    return () => clearInterval(interval);
  }, []);

  const handleNavigate = (section: string, tabOrId?: string) => {
    setCurrentSection(section as NavSection);
    if (section === 'profile' && tabOrId) {
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

  const navItems: { id: NavSection; label: string; tag?: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'profile', label: 'Candidate Profile', tag: 'Brain' },
    { id: 'documents', label: 'Document Vault', tag: 'Files' },
    { id: 'answers', label: 'Answer Library', tag: 'Rules' },
    { id: 'preferences', label: 'Preferences & Policy', tag: 'Safety' },
    { id: 'jobs', label: 'Job Inbox', tag: 'Active' },
    { id: 'applications', label: 'Applications', tag: 'CRM' },
    { id: 'approvals', label: 'Approvals', tag: 'Review' },
    { id: 'emails', label: 'Email Intelligence', tag: 'P4' },
    { id: 'activity', label: 'Activity & Ops', tag: 'P5' },
    { id: 'interviews', label: 'Interviews', tag: 'P4' },
    { id: 'settings', label: 'Platform Settings' },
  ];

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div
          className="sidebar-header"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div className="sidebar-title">
            <span>Jobee</span>
            <span className="sidebar-badge">v0.1</span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem', position: 'relative' }}
            onClick={() => setIsNotifModalOpen(true)}
            title="Notification Center & Alerts"
          >
            🔔
            {unreadNotifsCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '0.1rem 0.35rem',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {unreadNotifsCount}
              </span>
            )}
          </button>
        </div>
        <ul className="nav-list">
          {navItems.map((item) => (
            <li key={item.id} className="nav-item">
              <button
                className={`nav-button ${currentSection === item.id ? 'active' : ''}`}
                onClick={() => {
                  setCurrentSection(item.id);
                  if (item.id === 'profile') setProfileTab(undefined);
                  if (item.id === 'jobs') setSelectedJobId(null);
                  if (item.id === 'applications') {
                    setSelectedPackageId(null);
                    setSelectedApplicationId(null);
                  }
                }}
              >
                <span>{item.label}</span>
                {item.tag && <span className="nav-tag">{item.tag}</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {currentSection === 'dashboard' && <DashboardView onNavigate={handleNavigate} />}

        {currentSection === 'profile' && (
          <ProfileView initialTab={profileTab} onUpdate={() => setRefreshKey((k) => k + 1)} />
        )}

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

        {currentSection === 'settings' && <SettingsView />}

        {currentSection === 'interviews' && (
          <InterviewWorkspaceView
            onNavigateToApplication={(appId) => {
              setSelectedApplicationId(appId);
              setSelectedPackageId(null);
              setCurrentSection('applications');
            }}
          />
        )}
      </main>

      {/* Phase 5: Notification Center Modal */}
      <NotificationCenterModal
        isOpen={isNotifModalOpen}
        onClose={() => {
          setIsNotifModalOpen(false);
          fetchUnread();
        }}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
