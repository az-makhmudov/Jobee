import { useEffect, useState } from 'react';
import { Button, Card, Input, Select, Textarea, ModalSurface } from '../ui/Primitives.js';
import {
  DEFAULT_SEARCH_SETTINGS,
  type CandidateDocumentDto,
  type JobSearchSettings,
  type PreparationBatchDto,
} from '@job-agent/shared';
import { candidateApi } from '../api/candidate-client.js';
import { jobSearchApi, type BatchTicket, type QuestionGroup } from '../api/job-search-client.js';
const label = (status: string) =>
  ({
    QUEUED: 'Waiting to prepare',
    PREPARING: 'Preparing documents',
    READY: 'Ready to review',
    NEEDS_REVIEW: 'Needs your review',
    FAILED: 'Needs another try',
    CANCELLED: 'Cancelled',
    PENDING: 'Waiting to apply',
    RUNNING: 'Applying',
    SUCCESS: 'Employer confirmation observed',
    SUBMISSION_UNCERTAIN: 'Confirmation needed',
    STOPPED_CAPTCHA: 'Complete employer verification',
    STOPPED_MANUAL_REVIEW: 'Employer form needs you',
    VALIDATION_FAILED: 'Employer form rejected this attempt',
  })[status] ?? status.replaceAll('_', ' ').toLowerCase();
export function PreparationBatchPanel({
  selectedJobIds,
  onPrepared,
  onOpenPackage,
}: {
  selectedJobIds: string[];
  onPrepared: () => void;
  onOpenPackage: (id: string) => void;
}) {
  const [settings, setSettings] = useState<JobSearchSettings>(DEFAULT_SEARCH_SETTINGS);
  const [availableSources, setAvailableSources] = useState(DEFAULT_SEARCH_SETTINGS.sources);
  const [documents, setDocuments] = useState<CandidateDocumentDto[]>([]);
  const [batches, setBatches] = useState<PreparationBatchDto[]>([]);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [boards, setBoards] = useState('');
  const [readySelection, setReadySelection] = useState<string[]>([]);
  const [review, setReview] = useState<{ batchId: string; tickets: BatchTicket[] } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [questions, setQuestions] = useState<QuestionGroup[] | null>(null);
  const load = async () => {
    const data = await jobSearchApi.batches();
    setBatches(data);
  };
  useEffect(() => {
    let active = true;
    Promise.all([jobSearchApi.settings(), candidateApi.getDocuments(), jobSearchApi.batches()])
      .then(([saved, docs, data]) => {
        if (active) {
          setSettings(saved);
          setAvailableSources(saved.availableSources ?? DEFAULT_SEARCH_SETTINGS.sources);
          setDocuments(docs);
          setBatches(data);
          setBoards(saved.boards.map((b) => `${b.source.toLowerCase()}:${b.slug}`).join('\n'));
          setLoaded(true);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const running = batches.some((b) =>
    b.items.some(
      (i) =>
        ['QUEUED', 'PREPARING'].includes(i.status) ||
        ['PENDING', 'RUNNING'].includes(i.runStatus ?? ''),
    ),
  );
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      void load().catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [running]);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const prepare = () =>
    act(async () => {
      const result = await jobSearchApi.create(selectedJobIds, settings.selectedCvId);
      await load();
      onPrepared();
      setNotice(
        `${result.items.length} roles accepted for preparation. You can leave this page and return later.`,
      );
    });
  const save = () =>
    act(async () => {
      const parsed = boards
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((line) => {
          const [source, slug, ...extra] = line.split(':');
          if (
            extra.length ||
            !slug ||
            !['greenhouse', 'lever', 'ashby', 'smartrecruiters'].includes(source ?? '')
          )
            throw new Error('Use one company board per line, for example lever:company-name.');
          return {
            source: source!.toUpperCase() as 'GREENHOUSE' | 'LEVER' | 'ASHBY' | 'SMARTRECRUITERS',
            slug,
          };
        });
      const saved = await jobSearchApi.saveSettings({ ...settings, boards: parsed });
      setSettings(saved);
      setNotice('Search settings saved. Future preparations use these defaults.');
    });
  return (
    <section aria-label="Prepare and review applications" style={{ marginBottom: 24 }}>
      <Card>
        <div className="action-row">
          <div>
            <h2>Prepare selected applications</h2>
            <p>
              Select up to 10 jobs. Jobee prepares a CV, a letter and the remaining questions for
              each role.
            </p>
          </div>
          <Button
            className="btn-primary"
            disabled={!loaded || busy || !selectedJobIds.length || selectedJobIds.length > 10}
            onClick={prepare}
          >
            Prepare selected{selectedJobIds.length ? ` (${selectedJobIds.length})` : ''}
          </Button>
        </div>
        <label className="form-label">
          CV for this preparation
          <Select
            value={settings.selectedCvId ?? ''}
            onChange={(e) => setSettings({ ...settings, selectedCvId: e.target.value || null })}
          >
            <option value="">Choose automatically from my active CVs</option>
            {documents
              .filter((d) => d.isActive && ['MASTER_CV', 'ROLE_CV'].includes(d.documentType))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName}
                </option>
              ))}
          </Select>
        </label>
        <p className="form-hint">
          Materials use the profile facts you have allowed. Preparation does not send an
          application. Daily preparation limit: {settings.dailyLimit}.
        </p>
        <details className="advanced-details">
          <summary>Search sources, defaults & daily assistance</summary>
          <p>
            Company board names come from the employer’s careers URL. Each source lists that
            company’s public jobs.
          </p>
          <label className="form-label">
            Company boards, one per line
            <Textarea
              rows={5}
              value={boards}
              onChange={(e) => setBoards(e.target.value)}
              placeholder={'greenhouse:revolut\nlever:company-name\nashby:company-name'}
            />
          </label>
          <div className="account-actions">
            {availableSources.map((source) => (
              <label key={source}>
                <Input
                  type="checkbox"
                  checked={settings.sources.includes(source)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      sources: e.target.checked
                        ? [...settings.sources, source]
                        : settings.sources.filter((s) => s !== source),
                    })
                  }
                />{' '}
                {source === 'ARBEITNOW'
                  ? 'Arbeitnow public feed'
                  : source === 'GOOGLE_JOBS'
                    ? 'Google Jobs'
                    : source.toLowerCase()}
              </label>
            ))}
          </div>
          <label className="form-label">
            Maximum new preparations per day
            <Input
              type="number"
              min={1}
              max={20}
              value={settings.dailyLimit}
              onChange={(e) => setSettings({ ...settings, dailyLimit: Number(e.target.value) })}
            />
          </label>
          <div className="account-actions">
            <label>
              <Input
                type="checkbox"
                checked={settings.dailyDiscovery}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    dailyDiscovery: e.target.checked,
                    dailyPreparation: e.target.checked ? settings.dailyPreparation : false,
                  })
                }
              />{' '}
              Find jobs daily
            </label>
            <label>
              <Input
                type="checkbox"
                disabled={!settings.dailyDiscovery}
                checked={settings.dailyPreparation}
                onChange={(e) => setSettings({ ...settings, dailyPreparation: e.target.checked })}
              />{' '}
              Prepare matching new jobs daily
            </label>
            <label>
              <Input
                type="checkbox"
                checked={settings.dailyDigest}
                onChange={(e) => setSettings({ ...settings, dailyDigest: e.target.checked })}
              />{' '}
              Show a daily update in my notifications
            </label>
          </div>
          <p>
            Daily assistance prepares materials for review. Review and submission remain separate
            actions.
          </p>
          <Button disabled={busy || !loaded} onClick={save}>
            Save search settings
          </Button>
        </details>
      </Card>
      {error && (
        <p role="alert" style={{ color: 'var(--status-danger)' }}>
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {batches.map((batch, index) => (
        <details
          key={batch.id}
          open={index === 0}
          className="student-tools"
          style={{ marginTop: 16 }}
        >
          <summary>
            Prepared selection · {new Date(batch.createdAt).toLocaleString()} · {batch.items.length}{' '}
            roles
          </summary>
          <div className="account-actions">
            <Button
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await load();
                })
              }
            >
              Refresh progress
            </Button>
            {batch.items.some((i) => i.status === 'FAILED') && (
              <Button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await jobSearchApi.retry(batch.id);
                    await load();
                  })
                }
              >
                Retry failed preparations
              </Button>
            )}
            {batch.items.some(
              (i) => ['QUEUED', 'PREPARING'].includes(i.status) || i.runStatus === 'PENDING',
            ) && (
              <Button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await jobSearchApi.cancel(batch.id);
                    await load();
                  })
                }
              >
                Cancel waiting work
              </Button>
            )}
            <Button
              disabled={busy}
              onClick={() =>
                act(async () => {
                  setQuestions(await jobSearchApi.questions(batch.id));
                })
              }
            >
              Review remaining questions
            </Button>
          </div>
          <ul className="batch-items">
            {batch.items.map((item) => {
              const canSelect =
                item.status === 'READY' &&
                item.method === 'AUTOMATIC_FORM' &&
                (!item.runStatus ||
                  [
                    'FAILED',
                    'VALIDATION_FAILED',
                    'STOPPED_MANUAL_REVIEW',
                    'STOPPED_CAPTCHA',
                  ].includes(item.runStatus));
              return (
                <li key={item.id} className="batch-item">
                  <div>
                    <label>
                      <Input
                        type="checkbox"
                        aria-label={`Select ${item.title} at ${item.company} for final review`}
                        disabled={!canSelect || busy}
                        checked={readySelection.includes(item.id)}
                        onChange={(e) =>
                          setReadySelection(
                            e.target.checked
                              ? [...readySelection, item.id]
                              : readySelection.filter((id) => id !== item.id),
                          )
                        }
                      />{' '}
                      <strong>{item.title}</strong> · {item.company}
                    </label>
                    <p>
                      {label(item.runStatus ?? item.status)}
                      {item.versionNumber ? ` · Document version ${item.versionNumber}` : ''}
                      {item.outstandingQuestions ? ` · ${item.outstandingQuestions} questions` : ''}
                    </p>
                    <p className="form-hint">{item.methodNote}</p>
                    {item.error && <p role="status">{item.error}</p>}
                  </div>
                  {item.packageId && (
                    <Button onClick={() => onOpenPackage(item.packageId!)}>
                      Review documents & answers
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          <Button
            className="btn-primary"
            disabled={busy || !batch.items.some((i) => readySelection.includes(i.id))}
            onClick={() =>
              act(async () => {
                const tickets = await jobSearchApi.review(
                  batch.id,
                  batch.items.filter((i) => readySelection.includes(i.id)).map((i) => i.id),
                );
                setReview({ batchId: batch.id, tickets });
                setConfirmed(false);
              })
            }
          >
            Apply reviewed selections
          </Button>
        </details>
      ))}
      {questions && (
        <ModalSurface className="modal-backdrop" onClick={() => setQuestions(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Remaining questions</h2>
            <p>
              Repeated questions are shown together. Each application keeps its own answer and
              approval.
            </p>
            {!questions.length && (
              <p>
                No unresolved required questions in this selection. Review the documents and any
                other approvals before applying.
              </p>
            )}
            {questions.map((group, index) => (
              <section key={index}>
                <h3>{group.question}</h3>
                {group.items.map((item) => (
                  <Button
                    key={item.questionId}
                    onClick={() => {
                      setQuestions(null);
                      onOpenPackage(item.packageId);
                    }}
                  >
                    {item.title} · {item.company}
                  </Button>
                ))}
              </section>
            ))}
            <Button onClick={() => setQuestions(null)}>Close</Button>
          </div>
        </ModalSurface>
      )}
      {review && (
        <ModalSurface
          className="modal-backdrop"
          onClick={() => {
            if (!busy) setReview(null);
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Authorize these applications</h2>
            <p>
              Jobee will attempt to send only the documents and approved answers listed below.
              Employer forms may require further action.
            </p>
            <ul>
              {review.tickets.map((ticket) => {
                const item = batches
                  .find((b) => b.id === review.batchId)
                  ?.items.find((i) => i.id === ticket.itemId);
                return (
                  <li key={ticket.itemId}>
                    <strong>
                      {ticket.jobTitle} · {ticket.company}
                    </strong>
                    <p>
                      Version {item?.versionNumber} · {ticket.answersCount} reviewed answers
                    </p>
                    {item?.packageId && (
                      <div className="account-actions">
                        {ticket.artifacts.cvArtifactId && (
                          <a
                            href={`/api/application-packages/${item.packageId}/artifacts/${ticket.artifacts.cvArtifactId}/download`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View CV
                          </a>
                        )}
                        {ticket.artifacts.coverLetterArtifactId && (
                          <a
                            href={`/api/application-packages/${item.packageId}/artifacts/${ticket.artifacts.coverLetterArtifactId}/download`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View letter
                          </a>
                        )}
                        <Button
                          disabled={busy}
                          onClick={() => {
                            setReview(null);
                            onOpenPackage(item.packageId!);
                          }}
                        >
                          Review answers
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <label>
              <Input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />{' '}
              I reviewed these materials and authorize sending these applications.
            </label>
            <div className="account-actions">
              <Button disabled={busy} onClick={() => setReview(null)}>
                Back
              </Button>
              <Button
                className="btn-primary"
                disabled={!confirmed || busy}
                onClick={() =>
                  act(async () => {
                    const results = await jobSearchApi.submit(
                      review.batchId,
                      review.tickets.map((t) => ({
                        itemId: t.itemId,
                        submissionToken: t.submissionToken,
                      })),
                    );
                    setReview(null);
                    setReadySelection([]);
                    await load();
                    setNotice(
                      `${results.filter((r) => r.runId).length} applications queued. ${results
                        .filter((r) => r.error)
                        .map((r) => r.error)
                        .join(' ')}`,
                    );
                  })
                }
              >
                {busy ? 'Queueing…' : `Authorize & apply to ${review.tickets.length} roles`}
              </Button>
            </div>
          </div>
        </ModalSurface>
      )}
    </section>
  );
}
