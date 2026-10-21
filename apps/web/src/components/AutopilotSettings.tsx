import { useEffect, useState } from 'react';
import { AUTOPILOT_TERMS, type AutopilotStateDto } from '@job-agent/shared';
import { Button, Card, Input } from '../ui/Primitives.js';
async function request(path = '', body?: unknown): Promise<AutopilotStateDto> {
  const response = await fetch(
    `/api/autopilot${path}`,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Could not update Autopilot');
  return result.data;
}
export function AutopilotSettings() {
  const [state, setState] = useState<AutopilotStateDto | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [hours, setHours] = useState(24);
  const [limit, setLimit] = useState(5);
  const [score, setScore] = useState(90);
  const load = async () => {
    setAccepted(false);
    setBusy(true);
    setError('');
    try {
      setState(await request());
      setAccepted(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Autopilot');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const mutate = async (path: string) => {
    setBusy(true);
    setError('');
    try {
      if (path === '/run') {
        await request(path, {});
        setState(await request());
      } else
        setState(
          await request(
            path,
            path === '/authorize'
              ? {
                  termsVersion: AUTOPILOT_TERMS,
                  expectedCandidateFingerprint: state?.candidateFingerprint,
                  intervalHours: hours,
                  maxPerDay: limit,
                  minScore: score,
                  reviewMode: 'PAUSE',
                }
              : {},
          ),
        );
      setAccepted(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update Autopilot');
    } finally {
      setBusy(false);
    }
  };
  const p = state?.preview;
  return (
    <Card>
      <h2 className="card-title">Autopilot</h2>
      <p>{state?.message || 'Loading Autopilot policy…'}</p>
      {error && <p role="alert">{error}</p>}
      <Button className="btn-outline" disabled={busy} onClick={() => void load()}>
        Reload policy preview
      </Button>
      {state && (
        <>
          <p role="status">
            {state.current
              ? `Active policy version ${state.grant?.version}`
              : 'No effective submission policy'}
            {state.nextRunAt && state.current
              ? ` · Next check ${new Date(state.nextRunAt).toLocaleString()}`
              : ''}
          </p>
          {p && (
            <>
              <h3>Saved scope for a new policy</h3>
              <p>
                Roles: {p.targetTitles.join(', ') || 'None — save a role first'}. Locations:{' '}
                {p.preferredLocations.join(', ') || 'Any location'}. Work modes:{' '}
                {p.workModes.join(', ') || 'Any mode'}. Employment:{' '}
                {p.employmentTypes.join(', ') || 'Any type'}.
              </p>
              <p>
                Salary floor:{' '}
                {p.minSalary == null
                  ? 'Not configured'
                  : `${p.minSalary} ${p.currency} per ${p.salaryPayPeriod || 'unknown period'}`}
                . Excluded employers: {p.excludedCompanies.join(', ') || 'None'}. Excluded keywords:{' '}
                {p.excludedKeywords.join(', ') || 'None'}.
              </p>
              <p>
                Authorization countries: {p.workAuthorizationCountries?.join(', ') || 'Unknown'}.
                Sponsorship needed:{' '}
                {p.needsSponsorship == null ? 'Unknown' : p.needsSponsorship ? 'Yes' : 'No'}.
                Internship eligibility:{' '}
                {p.internshipEligible == null ? 'Unknown' : p.internshipEligible ? 'Yes' : 'No'}.
                Unpaid roles: {p.acceptUnpaid ? 'Allowed' : 'Excluded'}.
              </p>
            </>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void mutate('/authorize');
            }}
          >
            <div className="form-grid">
              <label>
                Check every (hours)
                <Input
                  type="number"
                  min={1}
                  max={168}
                  required
                  value={hours}
                  onChange={(e) => {
                    setHours(Number(e.target.value));
                    setAccepted(false);
                  }}
                />
              </label>
              <label>
                Daily submission attempt limit
                <Input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setAccepted(false);
                  }}
                />
              </label>
              <label>
                Minimum fit score
                <Input
                  type="number"
                  min={90}
                  max={100}
                  required
                  value={score}
                  onChange={(e) => {
                    setScore(Number(e.target.value));
                    setAccepted(false);
                  }}
                />
              </label>
            </div>
            <p>
              Each queued submission reserves a daily slot in UTC, including failed attempts.
              Preparation and previews use no submission slots. Unknown eligibility, sensitive
              answers, legal consent and stopped attempts require review. Changing your profile or
              preferences stops pending permission. Pausing cannot recall a submission already
              dispatched.
            </p>
            <label>
              <Input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />{' '}
              I authorize Jobee to prepare and submit applications within the saved scope and limits
              above, under {AUTOPILOT_TERMS}.
            </label>
            <div className="account-actions">
              <Button
                type="submit"
                className="btn-primary"
                disabled={
                  busy || !!error || !accepted || !state.available || !p?.targetTitles.length
                }
              >
                Authorize new policy
              </Button>
              <Button
                type="button"
                className="btn-outline"
                disabled={busy || !state.enabled}
                onClick={() => void mutate('/pause')}
              >
                Pause Autopilot
              </Button>
              <Button
                type="button"
                className="btn-outline"
                disabled={busy || !!error || !state.current}
                onClick={() => void mutate('/run')}
              >
                Check eligible jobs now
              </Button>
            </div>
            {!state.available && <p>Autopilot rollout is disabled in this environment.</p>}
          </form>
        </>
      )}
    </Card>
  );
}
