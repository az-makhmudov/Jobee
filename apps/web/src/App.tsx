import { useState } from 'react';
import { DashboardView } from './components/DashboardView.js';
import { ProfileView } from './components/ProfileView.js';
import { DocumentsView } from './components/DocumentsView.js';
import { AnswerLibraryView } from './components/AnswerLibraryView.js';
import { PreferencesView } from './components/PreferencesView.js';
import { ActivityView } from './components/ActivityView.js';
import { SettingsView } from './components/SettingsView.js';
import { JobInboxView } from './components/JobInboxView.js';
import { JobDetailView } from './components/JobDetailView.js';
import { ApplicationPackagesListView } from './components/ApplicationPackagesListView.js';
import { ApplicationStudioView } from './components/ApplicationStudioView.js';
import { ApprovalsInboxView } from './components/ApprovalsInboxView.js';

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
  | 'interviews'
  | 'settings';

export default function App() {
  const [currentSection, setCurrentSection] = useState<NavSection>('dashboard');
  const [profileTab, setProfileTab] = useState<string | undefined>(undefined);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [, setRefreshKey] = useState<number>(0);

  const handleNavigate = (section: string, tabOrId?: string) => {
    setCurrentSection(section as NavSection);
    if (section === 'profile' && tabOrId) {
      setProfileTab(tabOrId);
    } else if (section === 'jobs') {
      setSelectedJobId(tabOrId || null);
    } else if (section === 'applications') {
      setSelectedPackageId(tabOrId || null);
    }
  };

  const navItems: { id: NavSection; label: string; tag?: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'profile', label: 'Candidate Profile', tag: 'Brain' },
    { id: 'documents', label: 'Document Vault', tag: 'Files' },
    { id: 'answers', label: 'Answer Library', tag: 'Rules' },
    { id: 'preferences', label: 'Preferences & Policy', tag: 'Safety' },
    { id: 'jobs', label: 'Job Inbox', tag: 'Active' },
    { id: 'applications', label: 'Applications', tag: 'Studio' },
    { id: 'approvals', label: 'Approvals', tag: 'Review' },
    { id: 'activity', label: 'Audit Log' },
    { id: 'interviews', label: 'Interviews', tag: 'P4' },
    { id: 'settings', label: 'Platform Settings' },
  ];

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">
            <span>AI Job Agent</span>
            <span className="sidebar-badge">v0.1</span>
          </div>
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
                  if (item.id === 'applications') setSelectedPackageId(null);
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
                setCurrentSection('applications');
              }}
            />
          ) : (
            <JobInboxView onSelectJob={(id) => setSelectedJobId(id)} />
          ))}

        {/* Phase 3: Application Studio */}
        {currentSection === 'applications' &&
          (selectedPackageId ? (
            <ApplicationStudioView
              packageId={selectedPackageId}
              onBack={() => setSelectedPackageId(null)}
              onNavigateToJob={(jId) => {
                setSelectedJobId(jId);
                setCurrentSection('jobs');
              }}
            />
          ) : (
            <ApplicationPackagesListView
              onOpenPackage={(pkgId) => setSelectedPackageId(pkgId)}
              onNavigateToJobs={() => setCurrentSection('jobs')}
            />
          ))}

        {/* Phase 3: Approvals Inbox */}
        {currentSection === 'approvals' && (
          <ApprovalsInboxView
            onOpenPackage={(pkgId) => {
              setSelectedPackageId(pkgId);
              setCurrentSection('applications');
            }}
          />
        )}

        {currentSection === 'settings' && <SettingsView />}

        {currentSection === 'interviews' && (
          <div>
            <header className="page-header">
              <h1 className="page-title">Interviews & Follow-ups</h1>
              <p className="page-subtitle">Module scheduled for future development phases</p>
            </header>
            <div className="card placeholder-view">
              <h3>Phase Roadmap Enforced</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                This section will be activated in upcoming development phases according to the
                official macro-task roadmap (Phase 4).
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
