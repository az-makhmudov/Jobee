import { useEffect, useState } from 'react';
import type {
  ApplicationSummaryDto,
  CandidateOverviewDto,
  JobDashboardMetricsDto,
  ApplicationStudioMetricsDto,
} from '@job-agent/shared';
import { ApplicationCrmClient } from '../api/application-crm-client.js';
import { Button, Card } from '../ui/Primitives.js';

export function HomeOverview({
  overview,
  jobs,
  materials,
  onNavigate,
  onImport,
  onProgress,
}: {
  overview: CandidateOverviewDto;
  jobs: JobDashboardMetricsDto | null;
  materials: ApplicationStudioMetricsDto | null;
  onNavigate: (section: string, id?: string) => void;
  onImport: () => void;
  onProgress: () => void;
}) {
  const [applications, setApplications] = useState<ApplicationSummaryDto[]>([]),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    ApplicationCrmClient.listApplications({ limit: 3, isArchived: false })
      .then((data) => {
        if (active) setApplications(data.items);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const firstName = overview.profile?.fullName?.trim().split(/\s+/)[0];
  return (
    <section aria-label="Home overview">
      <header className="section-toolbar">
        <div>
          <h1 className="page-title">
            {firstName ? 'Welcome back, ' + firstName : 'Welcome to your workspace'}
          </h1>
          <p className="page-subtitle">
            Your next steps, applications and opportunities — in one place.
          </p>
        </div>
        <Button className="btn-outline" onClick={onProgress}>
          Progress & activity
        </Button>
      </header>
      <div className="home-grid">
        <Card>
          <h2 className="card-title">Needs your attention</h2>
          <div className="action-row">
            <div>
              <strong>
                {materials
                  ? materials.pendingApprovals + ' approvals are waiting'
                  : 'Review application approvals'}
              </strong>
              <p>Review proposed answers before your materials can become ready.</p>
            </div>
            <Button className="btn-primary" onClick={() => onNavigate('approvals')}>
              Review approvals
            </Button>
          </div>
          <div className="action-row">
            <div>
              <strong>Prepare for your next interview</strong>
              <p>Find your upcoming conversations and preparation briefs.</p>
            </div>
            <Button className="btn-outline" onClick={() => onNavigate('interviews')}>
              Prepare
            </Button>
          </div>
          <div className="action-row">
            <div>
              <strong>Review your profile details</strong>
              <p>Confirm saved information and choose whether AI may use it.</p>
            </div>
            <Button className="btn-outline" onClick={() => onNavigate('career-intelligence')}>
              Review details
            </Button>
          </div>
        </Card>
        <Card>
          <h2 className="card-title">Your profile</h2>
          <div style={{ fontSize: 32, lineHeight: '40px', marginBottom: 16 }}>
            {overview.completeness.score}%{' '}
            <small style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Profile complete</small>
          </div>
          <label htmlFor="home-profile-progress">
            Profile completion · {overview.completeness.score}%
          </label>
          <progress
            id="home-profile-progress"
            value={overview.completeness.score}
            max={100}
            style={{ width: '100%', height: 12, accentColor: 'var(--m3-primary)' }}
          />
          <p className="page-subtitle">
            Education, projects and skills help explain what you can do. You can add experience
            whenever it is useful.
          </p>
          <div className="account-actions">
            <Button onClick={() => onNavigate('profile')}>Continue setup</Button>
            <Button className="btn-outline" onClick={onImport}>
              Import CV
            </Button>
          </div>
        </Card>
      </div>
      <Card style={{ marginTop: 24 }}>
        <div className="section-toolbar">
          <h2 className="card-title">Jobs to explore</h2>
          <Button className="btn-ghost" onClick={() => onNavigate('jobs')}>
            All jobs{jobs ? ' · ' + jobs.totalJobs : ''}
          </Button>
        </div>
        {jobs?.recentJobs?.length ? (
          jobs.recentJobs.slice(0, 3).map((job) => (
            <div className="action-row" key={job.id}>
              <div>
                <strong>{job.title}</strong>
                <p>
                  {job.company} · {job.locationText || 'Location not specified'}
                  {job.matchSummary ? ' · ' + job.matchSummary.overallScore + '% match' : ''}
                </p>
              </div>
              <Button className="btn-ghost" onClick={() => onNavigate('jobs', job.id)}>
                View job
              </Button>
            </div>
          ))
        ) : (
          <p className="page-subtitle">Find opportunities in Jobs to start exploring your fit.</p>
        )}
      </Card>
      <Card>
        <div className="section-toolbar">
          <h2 className="card-title">Your applications</h2>
          <Button className="btn-ghost" onClick={() => onNavigate('applications')}>
            All applications
          </Button>
        </div>
        {failed ? (
          <p className="page-subtitle">
            Applications could not be loaded. Open the tracker to retry.
          </p>
        ) : applications.length ? (
          applications.map((app) => (
            <div className="action-row" key={app.id}>
              <div>
                <strong>
                  {app.jobTitle} · {app.company}
                </strong>
                <p>
                  {app.status.replaceAll('_', ' ')}
                  {app.nextAction ? ' · Next: ' + app.nextAction : ''}
                </p>
              </div>
              <Button className="btn-ghost" onClick={() => onNavigate('applications', app.id)}>
                Open
              </Button>
            </div>
          ))
        ) : (
          <p className="page-subtitle">Your tracked applications will appear here.</p>
        )}
      </Card>
      <div className="account-actions">
        {[
          { section: 'emails', label: 'Messages' },
          { section: 'interviews', label: 'Interviews' },
          { section: 'documents', label: 'CV & Documents' },
          { section: 'preferences', label: 'Job preferences' },
        ].map((item) => (
          <Button key={item.section} className="btn-ghost" onClick={() => onNavigate(item.section)}>
            {item.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
