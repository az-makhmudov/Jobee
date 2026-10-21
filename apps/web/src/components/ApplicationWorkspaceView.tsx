import { submissionSummary } from '../ui/student-experience.js';
import { formatStatusLabel } from './ApplicationsCrmView.js';
import { useCallback, useEffect, useState } from 'react';
import type { ApplicationDetailDto, BrowserRunStatus } from '@job-agent/shared';
import { ApplicationCrmClient } from '../api/application-crm-client.js';
import {
  applicationPackageClient,
  type PackageDetailResponse,
} from '../api/application-package-client.js';
import { Button, Card, Tabs } from '../ui/Primitives.js';
import { ApplicationStudioView } from './ApplicationStudioView.js';
import { ApplicationDetailView } from './ApplicationDetailView.js';
import { ApplyWithJobee } from './ApplyWithJobee.js';

export type ApplicationPanel = 'documents' | 'questions' | 'review' | 'progress';
interface Props {
  initialPanel?: ApplicationPanel;
  applicationId: string | null;
  packageId: string | null;
  onBack: () => void;
  onNavigateToJob: (id: string) => void;
  onNavigateToProfile: () => void;
}

/** Keeps the selected record and editors in one workspace; tabs never create or submit records. */
export function ApplicationWorkspaceView({
  applicationId,
  packageId,
  initialPanel,
  onBack,
  onNavigateToJob,
  onNavigateToProfile,
}: Props) {
  const [panel, setPanel] = useState<ApplicationPanel>(
    initialPanel || (packageId ? 'documents' : 'progress'),
  );
  const [recordError, setRecordError] = useState<string | null>(null);
  const [showRecord, setShowRecord] = useState(false);
  const [runStatus, setRunStatus] = useState<BrowserRunStatus>();
  const [runHistoryChecked, setRunHistoryChecked] = useState(false);
  const [runHistoryFailed, setRunHistoryFailed] = useState(false);
  const updateSnapshot = useCallback(
    (
      record: ApplicationDetailDto,
      status: BrowserRunStatus | undefined,
      failed: boolean,
      checking: boolean,
    ) => {
      setDetail(record);
      setRunStatus(status);
      setRunHistoryFailed(failed);
      setRunHistoryChecked(!checking);
    },
    [],
  );
  const [detail, setDetail] = useState<ApplicationDetailDto | null>(null);
  const [materials, setMaterials] = useState<PackageDetailResponse | null>(null);
  const [linkedApplicationId, setLinkedApplicationId] = useState<string | null>(applicationId);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [visitedDetail, setVisitedDetail] = useState(!packageId);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    async function load() {
      try {
        let record = applicationId
          ? await ApplicationCrmClient.getApplicationDetail(applicationId)
          : null;
        // There is one package per user/job. A manually tracked application can predate its package link.
        let selectedPackage = packageId || record?.currentPackage?.packageId;
        if (!selectedPackage && record)
          selectedPackage = (
            await applicationPackageClient.listPackages({ jobId: record.job.id })
          )[0]?.id;
        const pkg = selectedPackage
          ? await applicationPackageClient.getPackage(selectedPackage)
          : null;
        if (!record && pkg) {
          const linked = await ApplicationCrmClient.getApplicationForJob(pkg.package.jobId);
          if (linked) record = await ApplicationCrmClient.getApplicationDetail(linked.id);
        }
        if (active) {
          setDetail(record);
          setMaterials(pkg);
          setLinkedApplicationId(record?.application.id || null);
        }
      } catch (err) {
        if (active)
          setError(err instanceof Error ? err.message : 'Could not load this application');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [applicationId, packageId, attempt]);
  const updateMaterials = useCallback((value: PackageDetailResponse) => setMaterials(value), []);
  const changePanel = (value: string) => {
    setPanel(value as ApplicationPanel);
    if (value === 'progress' || value === 'review') setVisitedDetail(true);
  };
  const openLinkedApplication = (id: string) => {
    setLinkedApplicationId(id);
    changePanel('progress');
  };
  if (loading) return <Card role="status">Loading your application…</Card>;
  if (error)
    return (
      <Card role="alert">
        <h2>Could not load this application</h2>
        <p>{error}</p>
        <Button onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
        <Button className="btn-ghost" onClick={onBack}>
          Back to my applications
        </Button>
      </Card>
    );
  const pkgId = materials?.package.id;
  const jobId = detail?.job.id || materials?.package.jobId;
  const title = detail?.job.title || materials?.package.jobTitle || 'Your application';
  const company = detail?.job.company || materials?.package.jobCompany;
  const ready = materials?.readiness.isReady === true;
  const rawTarget = detail?.application.applicationUrl || detail?.job.sourceUrl;
  const target = rawTarget && /^https?:\/\//i.test(rawTarget) ? rawTarget : undefined;
  const openRecord = (history = false) => {
    setShowRecord(true);
    if (history)
      requestAnimationFrame(() => {
        const node = document.getElementById('application-history');
        node?.scrollIntoView({ block: 'start' });
        node?.focus({ preventScroll: true });
      });
  };
  return (
    <div className="student-stack application-workspace">
      {jobId && (
        <ApplyWithJobee
          key={jobId}
          jobId={jobId}
          existingOnly
          onOpenPackage={() => {
            setPanel('questions');
            setAttempt((value) => value + 1);
          }}
        />
      )}
      <header>
        <Button className="btn-ghost" onClick={onBack}>
          ← Back to my applications
        </Button>
        <h1 className="page-title">
          {title}
          {company ? ` · ${company}` : ''}
        </h1>
        <p className="page-subtitle">
          Track employer activity, review attempts and resolve the next step for this application.
        </p>
      </header>
      <Tabs
        variant="pill"
        label="Application workspace"
        value={panel}
        items={[
          { id: 'documents', label: 'Documents' },
          { id: 'questions', label: 'Questions' },
          { id: 'review', label: 'Final review', disabled: !ready },
          { id: 'progress', label: 'Progress & details' },
        ]}
        onChange={changePanel}
      />
      {!ready && panel !== 'progress' && (
        <p className="page-subtitle">
          Final review becomes available after the current document, answer and policy checks are
          resolved. Each decision needs its own review.
        </p>
      )}
      {pkgId ? (
        <div hidden={panel === 'progress'}>
          <ApplicationStudioView
            packageId={pkgId}
            onBack={onBack}
            onNavigateToJob={onNavigateToJob}
            onNavigateToApplication={openLinkedApplication}
            workspacePanel={panel === 'progress' ? 'documents' : panel}
            onWorkspacePanel={changePanel}
            onPackageChange={updateMaterials}
            onNavigateToProfile={onNavigateToProfile}
          />
        </div>
      ) : (
        panel !== 'progress' && (
          <Card>
            <h2>Your application documents</h2>
            <p>
              No prepared materials are linked to this application yet. Open the job to prepare them
              from your saved details.
            </p>
            {jobId && (
              <Button className="btn-primary" onClick={() => onNavigateToJob(jobId)}>
                View job & prepare documents
              </Button>
            )}
          </Card>
        )
      )}
      {panel === 'review' && (
        <Card>
          <h2 className="card-title">Choose how to apply</h2>
          <p>
            Use the employer website when browser submission is unsupported. Downloads and
            prefilling do not mean an application was sent.
          </p>
          <div className="account-actions">
            {target ? (
              <a
                className="btn btn-primary"
                href={target}
                target="_blank"
                rel="noopener noreferrer"
              >
                Continue on employer website
              </a>
            ) : (
              jobId && (
                <Button className="btn-outline" onClick={() => onNavigateToJob(jobId)}>
                  View employer website in job details
                </Button>
              )
            )}
            {materials?.artifacts.map((artifact) => (
              <a
                className="btn btn-outline"
                key={artifact.id}
                href={applicationPackageClient.getArtifactDownloadUrl(
                  materials.package.id,
                  artifact.id,
                )}
                download={artifact.filename}
              >
                Download{' '}
                {artifact.artifactType === 'TAILORED_CV'
                  ? 'CV'
                  : artifact.artifactType === 'COVER_LETTER'
                    ? 'cover letter'
                    : artifact.filename}
              </a>
            ))}
          </div>
        </Card>
      )}
      {panel === 'progress' && detail && (
        <>
          <Card>
            <h2 className="card-title">
              Employer pipeline: {formatStatusLabel(detail.application.status)}
            </h2>
            {detail.application.execution && (
              <p>
                {detail.application.execution.mode === 'SUBMIT'
                  ? 'Recorded submission attempt'
                  : 'Preview attempt'}
                : {formatStatusLabel(detail.application.execution.status)}
              </p>
            )}
            {detail.application.attention && (
              <p role="status">{detail.application.attention.message}</p>
            )}
            <p className="page-subtitle">
              {runHistoryChecked
                ? submissionSummary(
                    detail.application.status,
                    detail.application.appliedAt,
                    runStatus,
                  )
                : 'Checking recorded submission and browser history…'}
            </p>
            {detail.application.nextAction && (
              <p className="page-subtitle">Next step: {detail.application.nextAction}</p>
            )}
            {recordError && (
              <p role="alert">
                The latest application details could not be refreshed. The recorded status may be
                out of date.{' '}
                <Button className="btn-outline" onClick={() => openRecord()}>
                  Open detailed record to retry
                </Button>
              </p>
            )}
            {runHistoryFailed && (
              <p role="alert">
                Run history could not be checked. Open the detailed record to retry before assuming
                an application was sent.
              </p>
            )}
            {runStatus === 'SUBMISSION_UNCERTAIN' && (
              <p role="alert">
                Submission needs confirmation. Check the run history before retrying.
              </p>
            )}
            <div className="action-row">
              <div>
                <strong>Your application documents</strong>
                <p>
                  {pkgId
                    ? 'Open your current CV and cover letter.'
                    : 'No prepared documents are linked yet.'}
                </p>
              </div>
              <Button className="btn-outline" onClick={() => changePanel('documents')}>
                View documents
              </Button>
            </div>
            <div className="action-row">
              <div>
                <strong>Questions waiting for you</strong>
                <p>Review the answers and decisions for this application.</p>
              </div>
              <Button className="btn-outline" onClick={() => changePanel('questions')}>
                Review questions
              </Button>
            </div>
          </Card>
          <Card>
            <h2 className="card-title">Progress and saved details</h2>
            <p className="page-subtitle">
              Your notes, contacts, assessments, interviews and offers stay with this application.
            </p>
            <div className="account-actions">
              <Button className="btn-outline" onClick={() => openRecord()}>
                {showRecord ? 'Detailed record open below' : 'Open detailed record'}
              </Button>
              <Button className="btn-outline" onClick={() => openRecord(true)}>
                View application history
              </Button>
              {showRecord && (
                <Button className="btn-ghost" onClick={() => setShowRecord(false)}>
                  Close detailed record
                </Button>
              )}
            </div>
          </Card>
        </>
      )}
      {linkedApplicationId && visitedDetail && (
        <div hidden={panel !== 'review' && (panel !== 'progress' || !showRecord)}>
          <ApplicationDetailView
            applicationId={linkedApplicationId}
            onBack={onBack}
            onOpenStudio={() => changePanel('documents')}
            onNavigateToJob={onNavigateToJob}
            onSnapshot={updateSnapshot}
            onLoadError={setRecordError}
            embedded
            workspacePanel={panel === 'review' ? 'review' : 'progress'}
            active={panel === 'progress' || panel === 'review'}
          />
        </div>
      )}
      {!linkedApplicationId && panel === 'progress' && (
        <Card>
          <h2 className="card-title">Not in your tracker yet</h2>
          <p>
            Prepared documents are saved. Add this application to your tracker from Documents when
            you want to track its progress.
          </p>
          <Button className="btn-primary" onClick={() => changePanel('documents')}>
            View documents
          </Button>
        </Card>
      )}
    </div>
  );
}
