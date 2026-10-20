import { useEffect, useState, useRef } from 'react';
import type { ApplicationIntentDto } from '@job-agent/shared';
import { jobSearchApi } from '../api/job-search-client.js';
import { Button, Card } from '../ui/Primitives.js';

const labels: Record<ApplicationIntentDto['status'], string> = {
  QUEUED: 'Application queued',
  PREPARING: 'Preparing your application',
  NEEDS_USER_ACTION: 'Your application needs you',
  RUNNING: 'Completing the employer form',
  SUCCEEDED: 'Application submitted',
  FAILED: 'Application stopped',
  CANCELLED: 'Application cancelled',
  UNKNOWN_RESULT: 'Submission confirmation needed',
};
export function ApplyWithJobee({
  jobId,
  onOpenPackage,
  onOpenApplication,
  existingOnly = false,
  employerUrl,
}: {
  jobId: string;
  onOpenPackage?: (id: string) => void;
  onOpenApplication?: (id: string) => void;
  existingOnly?: boolean;
  employerUrl?: string | null;
}) {
  const [intent, setIntent] = useState<ApplicationIntentDto | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionRevision = useRef(0);
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setIntent(null);
    setError('');
    jobSearchApi
      .intentForJob(jobId)
      .then((value) => {
        if (active) {
          setIntent(value);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [jobId]);
  const running = intent && ['QUEUED', 'PREPARING', 'RUNNING'].includes(intent.status);
  useEffect(() => {
    if (!running || !intent) return;
    let active = true;
    const timer = setInterval(() => {
      const revision = actionRevision.current;
      void jobSearchApi
        .intent(intent.id)
        .then((value) => {
          if (active && revision === actionRevision.current) {
            setIntent(value);
            setError('');
          }
        })
        .catch((e) => {
          if (active && revision === actionRevision.current) setError(e.message);
        });
    }, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [running, intent?.id]);
  const act = async (operation: () => Promise<ApplicationIntentDto | null>) => {
    if (busy) return;
    actionRevision.current++;
    setBusy(true);
    setError('');
    try {
      setIntent(await operation());
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };
  if (existingOnly && !intent && !error) return null;
  return (
    <Card className="student-stack">
      {!intent ? (
        <>
          <Button
            className="btn-primary"
            disabled={!loaded || busy}
            onClick={() => void act(() => jobSearchApi.apply(jobId))}
          >
            Apply with Jobee
          </Button>
          <p>
            By choosing Apply with Jobee, you authorize one application to this job using your
            verified information for up to one hour. Jobee prepares and submits supported forms in
            the background, and pauses for missing information or required consent.
          </p>
        </>
      ) : (
        <>
          <h3>{labels[intent.status]}</h3>
          <p role="status" aria-live="polite">
            {intent.message}
          </p>
          <div className="account-actions">
            {intent.packageId && intent.status === 'NEEDS_USER_ACTION' && onOpenPackage && (
              <Button className="btn-primary" onClick={() => onOpenPackage(intent.packageId!)}>
                Resolve application questions
              </Button>
            )}
            {intent.canResume && (
              <Button
                className="btn-outline"
                disabled={busy}
                onClick={() => void act(() => jobSearchApi.resumeIntent(intent.id))}
              >
                Authorize and resume
              </Button>
            )}
            {intent.canCancel && (
              <Button
                className="btn-outline"
                disabled={busy}
                onClick={() => void act(() => jobSearchApi.cancelIntent(intent.id))}
              >
                Cancel application
              </Button>
            )}
            {onOpenApplication && (
              <Button className="btn-ghost" onClick={() => onOpenApplication(intent.applicationId)}>
                View application
              </Button>
            )}
            {['NEEDS_USER_ACTION', 'UNKNOWN_RESULT'].includes(intent.status) &&
              employerUrl &&
              /^https?:\/\//i.test(employerUrl) && (
                <a href={employerUrl} target="_blank" rel="noopener noreferrer">
                  Open employer website
                </a>
              )}
          </div>
          {intent.canResume && (
            <p>
              Resuming authorizes another attempt with your current verified information for one
              hour. Resolve missing facts or consent first.
            </p>
          )}
        </>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <Button
            className="btn-outline"
            disabled={busy}
            onClick={() => void act(() => jobSearchApi.intentForJob(jobId))}
          >
            Refresh application status
          </Button>
        </div>
      )}
    </Card>
  );
}
