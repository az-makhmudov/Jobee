import { useEffect, useState } from 'react';
import { candidateApi } from '../api/candidate-client.js';
import type { CandidateOverviewDto, CandidateSkillDto, JobPreferencesDto } from '@job-agent/shared';
import { Button, Card } from '../ui/Primitives.js';

export function ProfileOverview({
  onNavigate,
}: {
  onNavigate: (section: string, tab?: string) => void;
}) {
  const [data, setData] = useState<CandidateOverviewDto | null>(null);
  const [skills, setSkills] = useState<CandidateSkillDto[]>([]);
  const [preferences, setPreferences] = useState<JobPreferencesDto | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    Promise.all([
      candidateApi.getOverview(),
      candidateApi.getSkills(),
      candidateApi.getPreferences(),
    ])
      .then(([overview, list, prefs]) => {
        if (active) {
          setData(overview);
          setSkills(list);
          setPreferences(prefs);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load your profile');
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  if (error)
    return (
      <Card role="alert">
        <h2>Could not load your profile</h2>
        <p>{error}</p>
        <Button onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
      </Card>
    );
  if (!data) return <Card role="status">Loading your profile…</Card>;
  return (
    <div>
      <div className="section-toolbar">
        <div>
          <h2>{data.profile?.fullName || 'Your profile'}</h2>
          <p className="page-subtitle">
            {data.profile?.headline || 'Add your studies, skills and experience to get started.'}
          </p>
        </div>
        <Button className="btn-outline" onClick={() => onNavigate('profile', 'personal')}>
          Edit profile
        </Button>
      </div>
      <Card>
        <h3>Next steps</h3>
        <p className="page-subtitle">A few details will help Jobee understand you better.</p>
        <div className="action-row">
          <div>
            <strong>Check your saved details</strong>
            <p>Confirm accuracy, then choose what AI may use.</p>
          </div>
          <Button className="btn-primary" onClick={() => onNavigate('career-intelligence')}>
            Review details
          </Button>
        </div>
        <div className="action-row">
          <div>
            <strong>Where can you work?</strong>
            <p>Confirm your work authorization and sponsorship needs.</p>
          </div>
          <Button className="btn-outline" onClick={() => onNavigate('profile', 'facts')}>
            Answer
          </Button>
        </div>
        <div className="action-row">
          <div>
            <strong>Review profile suggestions</strong>
            <p>See what was found before adding it to your profile.</p>
          </div>
          <Button className="btn-outline" onClick={() => onNavigate('career-intelligence')}>
            View suggestions
          </Button>
        </div>
      </Card>
      <div className="home-grid">
        <Card>
          <h3>Your strengths</h3>
          <p className="page-subtitle">
            {skills.length
              ? skills
                  .slice(0, 6)
                  .map((s) => s.name)
                  .join(' · ')
              : 'Your skills will appear here after you add them.'}
          </p>
          <Button className="btn-ghost" onClick={() => onNavigate('profile', 'skills')}>
            View skills
          </Button>
        </Card>
        <Card>
          <h3>Roles you are looking for</h3>
          <p className="page-subtitle">
            {preferences?.targetTitles?.join(' · ') ||
              'Set your preferred roles to personalize your search.'}
          </p>
          <Button className="btn-ghost" onClick={() => onNavigate('preferences')}>
            Edit preferences
          </Button>
        </Card>
      </div>
      <div className="account-actions" style={{ marginTop: 24 }}>
        <Button className="btn-outline" onClick={() => onNavigate('documents')}>
          CV & Documents
        </Button>
        <Button className="btn-ghost" onClick={() => onNavigate('profile', 'education')}>
          Education
        </Button>
        <Button className="btn-ghost" onClick={() => onNavigate('profile', 'experience')}>
          Experience
        </Button>
      </div>
    </div>
  );
}
