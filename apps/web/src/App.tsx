import { useState } from 'react';
import { DashboardView } from './components/DashboardView.js';
import { ProfileView } from './components/ProfileView.js';
import { DocumentsView } from './components/DocumentsView.js';
import { AnswerLibraryView } from './components/AnswerLibraryView.js';
import { PreferencesView } from './components/PreferencesView.js';
import { ActivityView } from './components/ActivityView.js';
import { SettingsView } from './components/SettingsView.js';

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
  const [, setRefreshKey] = useState<number>(0);

  const handleNavigate = (section: string, tab?: string) => {
    setCurrentSection(section as NavSection);
    if (tab) {
      setProfileTab(tab);
    }
  };

  const navItems: { id: NavSection; label: string; tag?: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'profile', label: 'Candidate Profile', tag: 'Brain' },
    { id: 'documents', label: 'Document Vault', tag: 'Files' },
    { id: 'answers', label: 'Answer Library', tag: 'Rules' },
    { id: 'preferences', label: 'Preferences & Policy', tag: 'Safety' },
    { id: 'activity', label: 'Audit Log' },
    { id: 'jobs', label: 'Jobs', tag: 'P2' },
    { id: 'applications', label: 'Applications', tag: 'P3' },
    { id: 'approvals', label: 'Approvals', tag: 'P3' },
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

        {currentSection === 'settings' && <SettingsView />}

        {['jobs', 'applications', 'approvals', 'interviews'].includes(currentSection) && (
          <div>
            <header className="page-header">
              <h1 className="page-title">{navItems.find((n) => n.id === currentSection)?.label}</h1>
              <p className="page-subtitle">Module scheduled for future development phases</p>
            </header>
            <div className="card placeholder-view">
              <h3>Phase Roadmap Enforced</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                This section will be activated in upcoming development phases according to the
                official macro-task roadmap (Phases 2–5).
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
