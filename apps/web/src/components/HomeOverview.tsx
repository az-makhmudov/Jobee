import { useEffect, useState } from 'react';
import type {
  ApplicationSummaryDto,
  CandidateOverviewDto,
  JobDashboardMetricsDto,
  ApplicationStudioMetricsDto,
  InterviewDashboardMetrics,
} from '@job-agent/shared';
import { ApplicationCrmClient } from '../api/application-crm-client.js';
import { careerIntelligenceApi } from '../api/career-intelligence-client.js';
import { Button, Card } from '../ui/Primitives.js';

export function HomeOverview({
  overview,
  jobs,
  materials,
  interviews,
  onNavigate,
  onImport,
  onProgress,
}: {
  overview: CandidateOverviewDto;
  jobs: JobDashboardMetricsDto | null;
  materials: ApplicationStudioMetricsDto | null;
  interviews: InterviewDashboardMetrics | null;
  onNavigate: (section: string, id?: string) => void;
  onImport: () => void;
  onProgress: () => void;
}) {
  const [applications, setApplications] = useState<ApplicationSummaryDto[]>([]),
    [failed, setFailed] = useState(false);
  const [suggestionsCount, setSuggestionsCount] = useState<number | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    setSuggestionsLoading(true);
    ApplicationCrmClient.listApplications({ limit: 3, isArchived: false })
      .then((data) => {
        if (active) setApplications(data.items);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    careerIntelligenceApi
      .listSuggestions('PENDING')
      .then((data) => {
        if (active) setSuggestionsCount(data.suggestions.length);
      })
      .catch(() => {
        if (active) setSuggestionsCount(null);
      })
      .finally(() => {
        if (active) setSuggestionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const firstName = overview.profile?.fullName?.trim().split(/\s+/)[0];
  const setupItems = overview.completeness.categories.filter(
    (item) => !item.completed && ['profile', 'preferences'].includes(item.category),
  );
  const tasks: { title: string; description: string; action: string; section: string }[] = [];
  if (materials && materials.pendingApprovals > 0)
    tasks.push({
      title: `${materials.pendingApprovals} application item${materials.pendingApprovals === 1 ? '' : 's'} to review`,
      description: 'Check the documents, answers or decisions waiting for your review.',
      action: 'Review approvals',
      section: 'approvals',
    });
  if (interviews && interviews.preparationNeeded > 0)
    tasks.push({
      title: `Prepare for ${interviews.preparationNeeded === 1 ? 'your interview' : `${interviews.preparationNeeded} interviews`}`,
      description: 'Open your upcoming conversations and preparation notes.',
      action: 'Prepare',
      section: 'interviews',
    });
  else if (
    interviews &&
    (interviews.schedulingConflicts > 0 || interviews.pendingConfirmations > 0)
  )
    tasks.push({
      title: 'Check your interview schedule',
      description: 'An interview has a conflict or needs confirmation.',
      action: 'View interviews',
      section: 'interviews',
    });
  if (suggestionsCount && suggestionsCount > 0)
    tasks.push({
      title: `${suggestionsCount} profile suggestion${suggestionsCount === 1 ? '' : 's'} to review`,
      description:
        'Choose what to add. Suggestions do not change your profile until you accept them.',
      action: 'Review suggestions',
      section: 'career-intelligence',
    });
  if (overview.factCount > overview.verifiedFactCount)
    tasks.push({
      title: 'Confirm your saved details',
      description:
        'Some facts still need your accuracy check. AI-use permission is a separate choice.',
      action: 'Review details',
      section: 'career-intelligence',
    });
  const incompleteChecks =
    !materials || !interviews || (!suggestionsLoading && suggestionsCount === null);
  return (
    <section className="student-stack" aria-label="Home overview">
      <header className="section-toolbar">
        <div>
          <h1 className="page-title">
            {firstName ? 'Welcome back, ' + firstName : 'Welcome to your workspace'}
          </h1>
          <p className="page-subtitle">A clear next step for your job search.</p>
        </div>
        <Button className="btn-outline" onClick={onProgress}>
          Progress & activity
        </Button>
      </header>
      <div className="student-stack">
        <Card>
          <h2 className="card-title">Your next steps</h2>
          <p className="page-subtitle">Only work that needs your attention appears here.</p>
          {tasks.slice(0, 3).map((task, index) => (
            <div className="action-row" key={task.title}>
              <div>
                <strong>{task.title}</strong>
                <p>{task.description}</p>
              </div>
              <Button
                className={index === 0 ? 'btn-primary' : 'btn-outline'}
                onClick={() => onNavigate(task.section)}
              >
                {task.action}
              </Button>
            </div>
          ))}
          {tasks.length === 0 && (
            <>
              <p>
                {suggestionsLoading
                  ? 'Checking your next steps…'
                  : incompleteChecks
                    ? 'Some next steps could not be checked.'
                    : 'No pending application reviews, profile suggestions or interview preparation found.'}
              </p>
              <Button className="btn-primary" onClick={() => onNavigate('jobs')}>
                Find jobs
              </Button>
            </>
          )}
          {incompleteChecks && (
            <p className="page-subtitle">
              Some next steps could not be confirmed. Open the relevant workspace to check.
              {!suggestionsLoading && suggestionsCount === null && (
                <Button className="btn-ghost" onClick={() => setAttempt((value) => value + 1)}>
                  Retry profile suggestions
                </Button>
              )}
            </p>
          )}
        </Card>
        <Card>
          <div className="section-toolbar">
            <h2 className="card-title">Jobs to explore</h2>
            <Button className="btn-ghost" onClick={() => onNavigate('jobs')}>
              All jobs{jobs ? ' · ' + jobs.totalJobs : ''}
            </Button>
          </div>
          {jobs?.recentJobs?.length ? (
            jobs.recentJobs.slice(0, 2).map((job) => (
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
          <h2 className="card-title">Your profile</h2>
          <p>
            {setupItems.length
              ? 'Add a few details to personalize your search.'
              : overview.hasActiveMasterCv
                ? 'Your basic details, CV and job preferences are saved.'
                : 'Your basic details and job preferences are saved. Adding a CV is optional.'}
          </p>
          {setupItems.length > 0 && (
            <ul>
              {setupItems.map((item) => (
                <li key={item.category}>{item.label}</li>
              ))}
            </ul>
          )}
          <p className="page-subtitle">
            Your studies, projects and skills help explain what you can do. Work experience is
            optional. Each application may need additional details and your explicit review.
          </p>
          <div className="account-actions">
            <Button onClick={() => onNavigate('profile')}>
              {setupItems.length ? 'Continue setup' : 'View profile'}
            </Button>
            {overview.hasActiveMasterCv ? (
              <Button className="btn-outline" onClick={() => onNavigate('documents')}>
                View CV
              </Button>
            ) : (
              <Button className="btn-outline" onClick={onImport}>
                Add CV
              </Button>
            )}
          </div>
          <details>
            <summary>Profile completeness details</summary>
            <p>
              {overview.completeness.score}% of profile details added. This is not an accuracy
              check, permission for AI use or approval to submit.
            </p>
          </details>
        </Card>
      </div>
      <details className="advanced-details">
        <summary>Applications & activity</summary>
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
            <Button
              key={item.section}
              className="btn-ghost"
              onClick={() => onNavigate(item.section)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </details>
    </section>
  );
}
