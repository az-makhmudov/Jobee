import { useEffect, useState } from 'react';
import { careerIntelligenceApi } from '../api/career-intelligence-client.js';
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
  const [suggestions, setSuggestions] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    setSuggestions(null);
    careerIntelligenceApi
      .listSuggestions('PENDING')
      .then((result) => {
        if (active) setSuggestions(result.suggestions.length);
      })
      .catch(() => {
        if (active) setSuggestions(null);
      });
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
    <div className="student-stack">
      <Card>
        <h2 className="card-title">
          {suggestions === null
            ? 'Profile suggestions'
            : suggestions > 0
              ? `${suggestions} suggestion${suggestions === 1 ? '' : 's'} to review`
              : 'Your saved details'}
        </h2>
        <p className="page-subtitle">
          {suggestions === null ? 'Open suggestions to check the latest updates. ' : ''}Check
          suggestions before adding them. Confirming accuracy and allowing AI use remain separate
          choices.
        </p>
        <div className="account-actions">
          <Button className="btn-primary" onClick={() => onNavigate('career-intelligence')}>
            Review suggestions
          </Button>
          <Button className="btn-outline" onClick={() => onNavigate('career-intelligence')}>
            Manage saved details & AI permissions
          </Button>
        </div>
      </Card>
      <Card>
        <h2 className="card-title">About you</h2>
        <div className="action-row">
          <div>
            <strong>{data.profile?.fullName || 'Your personal details'}</strong>
            <p>{data.profile?.headline || 'Add your contact details and a short introduction.'}</p>
          </div>
          <Button className="btn-outline" onClick={() => onNavigate('profile', 'personal')}>
            Edit profile
          </Button>
        </div>
        <div className="action-row">
          <div>
            <strong>Studies & projects</strong>
            <p>Education, coursework and projects help explain your strengths.</p>
          </div>
          <Button className="btn-outline" onClick={() => onNavigate('profile', 'education')}>
            Edit details
          </Button>
        </div>
        <div className="action-row">
          <div>
            <strong>CV & Documents</strong>
            <p>
              {data.hasActiveMasterCv
                ? 'Your CV is saved. Preview or download your original files.'
                : 'Add your CV, or start with your details without one.'}
            </p>
          </div>
          <Button className="btn-outline" onClick={() => onNavigate('documents')}>
            View documents
          </Button>
        </div>
        <div className="action-row">
          <div>
            <strong>Job preferences</strong>
            <p>
              {preferences?.targetTitles?.join(' · ') ||
                'Choose your roles, locations and work arrangements.'}
            </p>
          </div>
          <Button className="btn-outline" onClick={() => onNavigate('preferences')}>
            Edit preferences
          </Button>
        </div>
      </Card>
      <Card>
        <h2 className="card-title">More profile tools</h2>
        <p className="page-subtitle">
          Saved answers, skills, languages, certifications and optional work experience remain
          available.
        </p>
        <div className="account-actions">
          <Button className="btn-outline" onClick={() => onNavigate('answers')}>
            Saved answers
          </Button>
          <Button className="btn-outline" onClick={() => onNavigate('profile', 'skills')}>
            More profile details
          </Button>
        </div>
        <details className="advanced-details">
          <summary>Your strengths</summary>
          <p>
            {skills.length
              ? skills.map((skill) => skill.name).join(' · ')
              : 'Add skills to describe what you can do.'}
          </p>
          <Button className="btn-ghost" onClick={() => onNavigate('profile', 'experience')}>
            Work experience (optional)
          </Button>
          <Button className="btn-ghost" onClick={() => onNavigate('profile', 'facts')}>
            Work authorization & other facts
          </Button>
        </details>
      </Card>
    </div>
  );
}
