import { applicationStatusStyle, browserRunStyle } from '../ui/status.js';
import { useFeedback } from '../ui/Feedback.js';
import { Button, Card, Icon, Input, ModalSurface, Select, Textarea } from '../ui/Primitives.js';
import { useState, useEffect } from 'react';
import { ApplicationCrmClient } from '../api/application-crm-client.js';
import { formatStatusLabel } from './ApplicationsCrmView.js';
import {
  ApplicationLifecycleStatus,
  SubmissionMethod,
  NextActionType,
  AssessmentType,
  InterviewType,
  BrowserRunMode,
  type ApplicationDetailDto,
  type BrowserApplicationRunDto,
} from '@job-agent/shared';
import { BrowserWorkerClient } from '../api/browser-worker-client.js';

interface Props {
  applicationId: string;
  onBack: () => void;
  onOpenStudio?: (packageId: string) => void;
  onNavigateToJob?: (jobId: string) => void;
}

export function ApplicationDetailView({
  applicationId,
  onBack,
  onOpenStudio,
  onNavigateToJob,
}: Props) {
  const { alert, confirm } = useFeedback();
  const [detail, setDetail] = useState<ApplicationDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showMarkAppliedModal, setShowMarkAppliedModal] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<ApplicationLifecycleStatus | null>(null);
  const [transitionNote, setTransitionNote] = useState('');
  const [isCorrection, setIsCorrection] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');

  // Mark applied inputs
  const [markMethod, setMarkMethod] = useState<string>('COMPANY_SITE');
  const [markRef, setMarkRef] = useState('');
  const [markUrl, setMarkUrl] = useState('');
  const [markNotes, setMarkNotes] = useState('');

  // Next action edit state
  const [isEditingNextAction, setIsEditingNextAction] = useState(false);
  const [nextActionText, setNextActionText] = useState('');
  const [nextActionType, setNextActionType] = useState<string>('FOLLOW_UP');
  const [followUpDate, setFollowUpDate] = useState('');

  // Add sub-entity states
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState('');

  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [contactCompany, setContactCompany] = useState('');
  const [contactLinkedin, setContactLinkedin] = useState('');
  const [contactIsPrimary, setContactIsPrimary] = useState(false);

  const [showAddAssessmentModal, setShowAddAssessmentModal] = useState(false);
  const [assessTitle, setAssessTitle] = useState('');
  const [assessType, setAssessType] = useState<string>('CODING_CHALLENGE');
  const [assessProvider, setAssessProvider] = useState('');
  const [assessDue, setAssessDue] = useState('');
  const [assessUrl, setAssessUrl] = useState('');

  const [showAddInterviewModal, setShowAddInterviewModal] = useState(false);
  const [interviewTitle, setInterviewTitle] = useState('');
  const [interviewType, setInterviewType] = useState<string>('TECHNICAL');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewLocation, setInterviewLocation] = useState('');
  const [interviewInterviewer, setInterviewInterviewer] = useState('');

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerBase, setOfferBase] = useState('');
  const [offerTotal, setOfferTotal] = useState('');
  const [offerCurrency, setOfferCurrency] = useState('USD');
  const [offerStatus, setOfferStatus] = useState('PENDING');
  const [offerDeadline, setOfferDeadline] = useState('');
  const [offerNotes, setOfferNotes] = useState('');

  // Browser worker automation state
  const [browserRuns, setBrowserRuns] = useState<BrowserApplicationRunDto[]>([]);
  const [, setLoadingRuns] = useState(false);
  const [startingRun, setStartingRun] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<BrowserApplicationRunDto | null>(null);
  const [showRunModal, setShowRunModal] = useState(false);

  const loadBrowserRuns = async () => {
    try {
      setLoadingRuns(true);
      const runs = await BrowserWorkerClient.listBrowserRuns(applicationId);
      setBrowserRuns(runs);
    } catch {
      // Ignore background fetch error
    } finally {
      setLoadingRuns(false);
    }
  };

  const handleTriggerRun = async (mode: BrowserRunMode) => {
    try {
      setStartingRun(true);
      setRunError(null);

      let submissionToken: string | undefined;
      if (mode === BrowserRunMode.SUBMIT) {
        const ticket = await BrowserWorkerClient.requestSubmissionAuthorization(applicationId);
        submissionToken = ticket.submissionToken;
      }

      const newRun = await BrowserWorkerClient.startBrowserRun(applicationId, {
        mode,
        submissionToken,
      });
      setSelectedRun(newRun);
      setShowRunModal(true);
      await loadBrowserRuns();
    } catch (err: any) {
      setRunError(err.message || 'Failed to trigger browser run');
    } finally {
      setStartingRun(false);
    }
  };

  const loadDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApplicationCrmClient.getApplicationDetail(applicationId);
      setDetail(data);
      setNextActionText(data.application.nextAction || '');
      setNextActionType(data.application.nextActionType || 'FOLLOW_UP');
      setFollowUpDate(data.application.followUpAt ? data.application.followUpAt.slice(0, 16) : '');
      if (data.offer) {
        setOfferBase(data.offer.baseSalary ? String(data.offer.baseSalary) : '');
        setOfferTotal(data.offer.totalComp ? String(data.offer.totalComp) : '');
        setOfferCurrency(data.offer.currency || 'USD');
        setOfferStatus(data.offer.status || 'PENDING');
        setOfferDeadline(data.offer.deadlineAt ? data.offer.deadlineAt.slice(0, 16) : '');
        setOfferNotes(data.offer.notes || '');
      }
      await loadBrowserRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [applicationId]);

  const handleMarkApplied = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApplicationCrmClient.markApplied(applicationId, {
        submissionMethod: markMethod,
        externalReferenceId: markRef || undefined,
        applicationUrl: markUrl || undefined,
        notes: markNotes || undefined,
      });
      setShowMarkAppliedModal(false);
      await loadDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleExecuteTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transitionTarget) return;
    try {
      await ApplicationCrmClient.transitionStatus(applicationId, {
        targetStatus: transitionTarget,
        note: transitionNote || undefined,
        isCorrection,
        correctionReason: isCorrection ? correctionReason : undefined,
      });
      setShowTransitionModal(false);
      setTransitionTarget(null);
      setTransitionNote('');
      setIsCorrection(false);
      setCorrectionReason('');
      await loadDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const openTransition = (target: ApplicationLifecycleStatus, correction = false) => {
    setTransitionTarget(target);
    setIsCorrection(correction);
    setShowTransitionModal(true);
  };

  const handleSaveNextAction = async () => {
    try {
      await ApplicationCrmClient.updateNextAction(applicationId, {
        nextAction: nextActionText || null,
        nextActionType: nextActionType || null,
        followUpAt: followUpDate ? new Date(followUpDate).toISOString() : null,
      });
      setIsEditingNextAction(false);
      await loadDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    try {
      await ApplicationCrmClient.addNote(applicationId, { content: noteContent });
      setNoteContent('');
      setShowAddNoteModal(false);
      await loadDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!(await confirm('Are you sure you want to delete this note?'))) return;
    try {
      await ApplicationCrmClient.deleteNote(applicationId, noteId);
      await loadDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) return;
    try {
      await ApplicationCrmClient.addContact(applicationId, {
        name: contactName,
        email: contactEmail || undefined,
        phone: contactPhone || undefined,
        title: contactTitle || undefined,
        company: contactCompany || undefined,
        linkedinUrl: contactLinkedin || undefined,
        isPrimary: contactIsPrimary,
      });
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setContactTitle('');
      setContactCompany('');
      setContactLinkedin('');
      setContactIsPrimary(false);
      setShowAddContactModal(false);
      await loadDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!(await confirm('Are you sure you want to delete this contact?'))) return;
    try {
      await ApplicationCrmClient.deleteContact(applicationId, contactId);
      await loadDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessTitle.trim()) return;
    try {
      await ApplicationCrmClient.addAssessment(applicationId, {
        title: assessTitle,
        assessmentType: assessType,
        provider: assessProvider || undefined,
        dueAt: assessDue ? new Date(assessDue).toISOString() : undefined,
        url: assessUrl || undefined,
      });
      setAssessTitle('');
      setAssessProvider('');
      setAssessDue('');
      setAssessUrl('');
      setShowAddAssessmentModal(false);
      await loadDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewTitle.trim() || !interviewDate) return;
    try {
      await ApplicationCrmClient.addInterview(applicationId, {
        roundTitle: interviewTitle,
        interviewType,
        scheduledAt: new Date(interviewDate).toISOString(),
        locationOrUrl: interviewLocation || undefined,
        interviewerName: interviewInterviewer || undefined,
      });
      setInterviewTitle('');
      setInterviewDate('');
      setInterviewLocation('');
      setInterviewInterviewer('');
      setShowAddInterviewModal(false);
      await loadDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApplicationCrmClient.updateOffer(applicationId, {
        baseSalary: offerBase ? Number(offerBase) : null,
        totalComp: offerTotal ? Number(offerTotal) : null,
        currency: offerCurrency,
        status: offerStatus,
        deadlineAt: offerDeadline ? new Date(offerDeadline).toISOString() : null,
        notes: offerNotes || null,
      });
      setShowOfferModal(false);
      await loadDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleArchive = async () => {
    if (
      !(await confirm(
        'Archive this application? It will be hidden from the active pipeline board while preserving all history, timeline events, and submission provenance.',
      ))
    )
      return;
    try {
      await ApplicationCrmClient.archiveApplication(applicationId);
      await loadDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleUnarchive = async () => {
    try {
      await ApplicationCrmClient.unarchiveApplication(applicationId);
      await loadDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="spinner" />
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
          Loading application details...
        </p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div>
        <Button
          className="btn btn-secondary btn-sm"
          onClick={onBack}
          style={{ marginBottom: '1rem' }}
        >
          ← Back to Applications
        </Button>
        <div className="banner banner-error">{error || 'Application not found'}</div>
      </div>
    );
  }

  const { application, job, matchAnalysis, submittedPackage, currentPackage, events } = detail;
  const isTerminal = ['REJECTED', 'WITHDRAWN', 'EXPIRED'].includes(application.status);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}
      className="layout-group"
    >
      {/* Top Navigation & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button className="btn btn-secondary btn-sm" onClick={onBack}>
          ← Back to Applications CRM
        </Button>
        <div style={{ display: 'flex', gap: '0.5rem' }} className="layout-group">
          {currentPackage && onOpenStudio && (
            <Button
              className="btn btn-outline btn-sm"
              onClick={() => onOpenStudio(currentPackage.packageId)}
            >
              <Icon name="document" /> Open in Application Studio
            </Button>
          )}
          {onNavigateToJob && (
            <Button className="btn btn-outline btn-sm" onClick={() => onNavigateToJob(job.id)}>
              <Icon name="applications" /> View Job Listing
            </Button>
          )}
        </div>
      </div>

      {/* Main Header Card */}
      <header className="card" style={{ padding: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
          className="layout-group"
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '0.5rem',
              }}
              className="layout-group"
            >
              <h1 style={{ fontSize: '1.6rem', margin: 0 }}>{job.title}</h1>
              <span
                style={{
                  ...applicationStatusStyle(application.status),
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                {formatStatusLabel(application.status)}
              </span>
              {application.isArchived && (
                <span className="badge badge-secondary">
                  <Icon name="folder" size={20} /> Archived
                </span>
              )}
              {application.isFollowUpOverdue && (
                <span className="badge badge-error">
                  <Icon name="warning" /> Follow-up Overdue
                </span>
              )}
              {application.isFollowUpDue && !application.isFollowUpOverdue && (
                <span className="badge badge-warning">
                  <Icon name="schedule" size={20} /> Follow-up Due Today
                </span>
              )}
            </div>

            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', margin: 0 }}>
              <strong>{job.company}</strong>
              {job.location ? ` • ${job.location}` : ''}
              {job.workplaceType ? ` • ${job.workplaceType}` : ''}
            </p>
          </div>

          {/* Quick Metrics Badge */}
          <div
            style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}
            className="layout-group"
          >
            {matchAnalysis && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  AI Match Fit
                </div>
                <div
                  style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}
                >
                  {matchAnalysis.overallScore}% ({matchAnalysis.decision})
                </div>
              </div>
            )}
            {application.appliedAt && (
              <div
                style={{
                  textAlign: 'right',
                  borderLeft: '1px solid var(--border-color)',
                  paddingLeft: '1rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Applied On
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                  {new Date(application.appliedAt).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* State Machine Transition Action Toolbar */}
        <div
          style={{
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
          className="layout-group"
        >
          <span
            style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '0.5rem' }}
          >
            Available Transitions:
          </span>

          {/* Pre-Application Actions */}
          {application.status === 'DISCOVERED' && (
            <>
              <Button
                className="btn btn-outline btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.ANALYZED)}
              >
                <Icon name="search" /> Mark Analyzed
              </Button>
              <Button
                className="btn btn-outline btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.MATCHED)}
              >
                <Icon name="jobs" /> Mark Matched
              </Button>
              <Button
                className="btn btn-primary btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.READY_TO_APPLY)}
              >
                <Icon name="ai" size={20} /> Ready to Apply
              </Button>
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.SKIPPED)}
              >
                ⏭️ Skip
              </Button>
            </>
          )}

          {application.status === 'ANALYZED' && (
            <>
              <Button
                className="btn btn-outline btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.MATCHED)}
              >
                <Icon name="jobs" /> Mark Matched
              </Button>
              <Button
                className="btn btn-primary btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.READY_TO_APPLY)}
              >
                <Icon name="ai" size={20} /> Ready to Apply
              </Button>
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.SKIPPED)}
              >
                ⏭️ Skip
              </Button>
            </>
          )}

          {application.status === 'MATCHED' && (
            <>
              <Button
                className="btn btn-primary btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.READY_TO_APPLY)}
              >
                <Icon name="ai" size={20} /> Ready to Apply
              </Button>
              <Button
                className="btn btn-outline btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.NEEDS_REVIEW)}
              >
                <Icon name="warning" /> Needs Review
              </Button>
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.SKIPPED)}
              >
                ⏭️ Skip
              </Button>
            </>
          )}

          {application.status === 'NEEDS_REVIEW' && (
            <>
              <Button
                className="btn btn-primary btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.READY_TO_APPLY)}
              >
                <Icon name="ai" size={20} /> Ready to Apply
              </Button>
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.SKIPPED)}
              >
                ⏭️ Skip
              </Button>
            </>
          )}

          {application.status === 'READY_TO_APPLY' && (
            <>
              <Button
                className="btn btn-primary btn-sm"
                onClick={() => setShowMarkAppliedModal(true)}
              >
                <Icon name="forward" /> Mark as Applied
              </Button>
              <Button
                className="btn btn-outline btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.APPLYING)}
              >
                <Icon name="schedule" size={20} /> Move to Applying
              </Button>
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.SKIPPED)}
              >
                ⏭️ Skip
              </Button>
            </>
          )}

          {application.status === 'APPLYING' && (
            <>
              <Button
                className="btn btn-primary btn-sm"
                onClick={() => setShowMarkAppliedModal(true)}
              >
                <Icon name="forward" /> Complete Application (Mark Applied)
              </Button>
              <Button
                className="btn btn-outline btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.READY_TO_APPLY)}
              >
                ↩️ Back to Ready
              </Button>
            </>
          )}

          {application.status === 'SKIPPED' && (
            <>
              <Button
                className="btn btn-primary btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.READY_TO_APPLY)}
              >
                <Icon name="ai" size={20} /> Reopen (Ready to Apply)
              </Button>
              <Button
                className="btn btn-outline btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.MATCHED)}
              >
                <Icon name="jobs" /> Move to Matched
              </Button>
            </>
          )}

          {application.status === 'APPLIED' && (
            <>
              <Button
                className="btn btn-outline btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.CONFIRMATION_RECEIVED)}
              >
                <Icon name="messages" size={20} /> Confirmation Received
              </Button>
              <Button
                className="btn btn-outline btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.SCREENING)}
              >
                <Icon name="interviews" size={20} /> Move to Screening
              </Button>
              <Button
                className="btn btn-outline btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.INTERVIEW)}
              >
                <Icon name="interviews" size={20} /> Move to Interview
              </Button>
            </>
          )}

          {(application.status === 'CONFIRMATION_RECEIVED' ||
            application.status === 'SCREENING' ||
            application.status === 'ASSESSMENT') && (
            <>
              <Button
                className="btn btn-outline btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.ASSESSMENT)}
              >
                <Icon name="edit" /> Assessment Received
              </Button>
              <Button
                className="btn btn-outline btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.INTERVIEW)}
              >
                <Icon name="interviews" size={20} /> Move to Interview
              </Button>
              <Button
                className="btn btn-outline btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.OFFER)}
              >
                <Icon name="verified" size={20} /> Offer Received
              </Button>
            </>
          )}

          {(application.status === 'INTERVIEW' || application.status === 'FINAL_INTERVIEW') && (
            <>
              <Button
                className="btn btn-outline btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.FINAL_INTERVIEW)}
              >
                <Icon name="jobs" /> Final Interview
              </Button>
              <Button
                className="btn btn-outline btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.OFFER)}
              >
                <Icon name="verified" size={20} /> Offer Received
              </Button>
            </>
          )}

          {/* Terminal Actions */}
          {!isTerminal && application.status !== 'SKIPPED' && (
            <>
              <Button
                className="btn btn-secondary btn-sm"
                style={{ color: 'var(--status-danger)' }}
                onClick={() => openTransition(ApplicationLifecycleStatus.REJECTED)}
              >
                <Icon name="close" size={20} /> Rejected
              </Button>
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => openTransition(ApplicationLifecycleStatus.WITHDRAWN)}
              >
                Withdraw
              </Button>
            </>
          )}

          {/* Correction Reopen Action for Terminal States */}
          {isTerminal && (
            <Button
              className="btn btn-warning btn-sm"
              onClick={() => openTransition(ApplicationLifecycleStatus.INTERVIEW, true)}
            >
              <Icon name="sync" /> Reopen Process (Correction)
            </Button>
          )}

          {/* Archive / Unarchive Action */}
          <div style={{ marginLeft: 'auto' }}>
            {application.isArchived ? (
              <Button
                className="btn btn-outline btn-sm"
                onClick={handleUnarchive}
                title="Restore application to active pipeline"
              >
                <Icon name="folder" /> Unarchive
              </Button>
            ) : (
              <Button
                className="btn btn-outline btn-sm"
                onClick={handleArchive}
                title="Soft-hide from active pipeline while preserving all history and provenance"
              >
                <Icon name="folder" size={20} /> Archive Application
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Grid: Left Column (Next Action & Materials) | Right Column (Timeline & Notes) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,360px), 1fr))',
          gap: '1.5rem',
        }}
        className="layout-group"
      >
        {/* Left Column */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          className="layout-group"
        >
          {/* Next Action & Follow-up Card */}
          <Card className="card" style={{ padding: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Next Action & Follow-up</h3>
              {!isEditingNextAction ? (
                <Button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsEditingNextAction(true)}
                >
                  Edit
                </Button>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem' }} className="layout-group">
                  <Button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsEditingNextAction(false)}
                  >
                    Cancel
                  </Button>
                  <Button className="btn btn-primary btn-sm" onClick={handleSaveNextAction}>
                    Save
                  </Button>
                </div>
              )}
            </div>

            {!isEditingNextAction ? (
              <div>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 500 }}>
                  {application.nextAction || (
                    <span style={{ color: 'var(--text-secondary)' }}>No next action set</span>
                  )}
                </p>
                {application.followUpAt && (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Target follow-up:{' '}
                    <strong>{new Date(application.followUpAt).toLocaleString()}</strong>
                  </p>
                )}
              </div>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                className="layout-group"
              >
                <Input
                  type="text"
                  className="input"
                  placeholder="e.g. Follow up with recruiter on phone screen"
                  value={nextActionText}
                  onChange={(e) => setNextActionText(e.target.value)}
                />
                <div
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}
                  className="layout-group"
                >
                  <Select
                    className="input"
                    value={nextActionType}
                    onChange={(e) => setNextActionType(e.target.value)}
                  >
                    {Object.values(NextActionType).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="datetime-local"
                    className="input"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Submission Materials & Provenance Card */}
          <Card className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>
              Submission Provenance & Frozen Materials
            </h3>

            {submittedPackage ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  fontSize: '0.85rem',
                }}
                className="layout-group"
              >
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Submitted Package Version:{' '}
                  </span>
                  <strong>Version {submittedPackage.versionNumber}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Submission Method: </span>
                  <strong>{submittedPackage.submissionMethod || 'Direct / External'}</strong>
                </div>
                {submittedPackage.externalReferenceId && (
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>External Ref ID: </span>
                    <code>{submittedPackage.externalReferenceId}</code>
                  </div>
                )}

                {/* Artifact Links */}
                <div
                  style={{
                    marginTop: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                  className="layout-group"
                >
                  {submittedPackage.cvArtifact && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--bg-secondary)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '16px',
                      }}
                    >
                      <span>
                        <Icon name="document" /> <strong>Tailored CV (DOCX)</strong>
                      </span>
                      <a
                        href={submittedPackage.cvArtifact.downloadUrl}
                        download
                        className="btn btn-outline btn-sm"
                      >
                        Download
                      </a>
                    </div>
                  )}

                  {submittedPackage.coverLetterArtifact && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--bg-secondary)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '16px',
                      }}
                    >
                      <span>
                        ✉️ <strong>Cover Letter (DOCX)</strong>
                      </span>
                      <a
                        href={submittedPackage.coverLetterArtifact.downloadUrl}
                        download
                        className="btn btn-outline btn-sm"
                      >
                        Download
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                {application.status === 'READY_TO_APPLY'
                  ? 'Application is ready to submit. Click "Mark as Applied" when sent.'
                  : 'Submitted externally without a frozen studio package.'}
              </p>
            )}
          </Card>

          {/* Browser Application Automation & ATS Worker Card (JOB-P5-T01) */}
          <Card className="card" style={{ padding: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <h3
                style={{
                  fontSize: '1.05rem',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>
                  <Icon name="ai" size={20} />
                </span>{' '}
                Browser Application Worker & ATS Auto-Fill
              </h3>
              {browserRuns.length > 0 && (
                <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                  {browserRuns.length} run{browserRuns.length > 1 ? 's' : ''} recorded
                </span>
              )}
            </div>

            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                marginBottom: '1rem',
                lineHeight: 1.4,
              }}
            >
              Automated headless form inspection and prefilling for Greenhouse, Lever, and Ashby
              boards. Grounded exclusively in verified Candidate Brain facts and Answer Library
              entries with mandatory halt on CAPTCHAs or missing required questions.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-secondary)',
                padding: '0.6rem 0.85rem',
                borderRadius: '16px',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                gap: '0.5rem',
              }}
              className="layout-group"
            >
              <span style={{ color: 'var(--text-secondary)' }}>Target Apply URL:</span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '380px',
                }}
                title={application.applicationUrl || job.sourceUrl || ''}
              >
                {application.applicationUrl || job.sourceUrl || 'No target apply URL set'}
              </span>
            </div>

            {runError && (
              <div
                style={{
                  background: 'var(--status-danger-container)',
                  color: 'var(--status-danger)',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '16px',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                <Icon name="warning" /> {runError}
              </div>
            )}

            <div
              style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}
              className="layout-group"
            >
              <Button
                className="btn btn-primary btn-sm"
                disabled={startingRun || !(application.applicationUrl || job.sourceUrl)}
                onClick={() => handleTriggerRun(BrowserRunMode.DRY_RUN)}
                title="Prefills and validates form fields without submitting"
              >
                {startingRun ? (
                  'Executing Run...'
                ) : (
                  <>
                    <Icon name="settings" size={20} /> Run Safe Dry-Run
                  </>
                )}
              </Button>
              <Button
                className="btn btn-outline btn-sm"
                disabled={startingRun || !(application.applicationUrl || job.sourceUrl)}
                onClick={() => handleTriggerRun(BrowserRunMode.PREFILL_ONLY)}
                title="Fills form and preserves active session for manual review"
              >
                <Icon name="edit" /> Prefill in Browser
              </Button>
              <Button
                className="btn btn-warning btn-sm"
                disabled={startingRun || !(application.applicationUrl || job.sourceUrl)}
                onClick={async () => {
                  if (
                    await confirm(
                      `Human Authorization Required:\n\nAuthorize automated submission to ${job.company || 'employer'}?\n\nThis will populate your verified candidate information, attach your selected CV, and submit the external application form.`,
                    )
                  ) {
                    handleTriggerRun(BrowserRunMode.SUBMIT);
                  }
                }}
                title="Authorizes worker to fill and submit application to the external ATS"
              >
                <Icon name="forward" /> Submit via Browser Worker
              </Button>
              {browserRuns.length > 0 && (
                <Button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSelectedRun(browserRuns[0]);
                    setShowRunModal(true);
                  }}
                >
                  <Icon name="search" /> View Latest Audit Trail
                </Button>
              )}
            </div>

            {/* Recent Runs summary list */}
            {browserRuns.length > 0 && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Execution History
                </div>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
                  className="layout-group"
                >
                  {browserRuns.slice(0, 3).map((run) => (
                    <Button
                      key={run.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--bg-secondary)',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '16px',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setSelectedRun(run);
                        setShowRunModal(true);
                      }}
                      className="btn-ghost"
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        className="layout-group"
                      >
                        <span
                          className={`badge ${
                            run.status === 'SUCCESS'
                              ? 'badge-success'
                              : run.status === 'SUBMISSION_UNCERTAIN'
                                ? 'badge-warning'
                                : run.status.startsWith('STOPPED')
                                  ? 'badge-warning'
                                  : 'badge-error'
                          }`}
                          style={{
                            fontSize: '0.75rem',
                            ...browserRunStyle(run.status),
                          }}
                        >
                          {run.status === 'SUBMISSION_UNCERTAIN' ? (
                            <>
                              <Icon name="warning" size={20} /> UNCERTAIN
                            </>
                          ) : (
                            run.status
                          )}
                        </span>
                        <span style={{ fontWeight: 500 }}>{run.atsProvider}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>• {run.mode}</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          color: 'var(--text-secondary)',
                        }}
                        className="layout-group"
                      >
                        <span>
                          {run.fieldsFilledCount}/{run.fieldsDetectedCount} fields filled
                        </span>
                        <span>
                          {new Date(run.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Offer & Compensation Card */}
          <Card className="card" style={{ padding: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Offer & Compensation</h3>
              <Button className="btn btn-secondary btn-sm" onClick={() => setShowOfferModal(true)}>
                {detail.offer ? 'Edit Offer' : '+ Record Offer'}
              </Button>
            </div>

            {detail.offer ? (
              <div style={{ fontSize: '0.9rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                  <strong>{detail.offer.status}</strong>
                </div>
                {detail.offer.baseSalary && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>Base Salary:</span>
                    <strong>
                      {detail.offer.currency} {detail.offer.baseSalary.toLocaleString()}
                    </strong>
                  </div>
                )}
                {detail.offer.totalComp && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>Total Compensation:</span>
                    <strong>
                      {detail.offer.currency} {detail.offer.totalComp.toLocaleString()}
                    </strong>
                  </div>
                )}
                {detail.offer.deadlineAt && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>Deadline:</span>
                    <span>{new Date(detail.offer.deadlineAt).toLocaleDateString()}</span>
                  </div>
                )}
                {detail.offer.notes && (
                  <p
                    style={{
                      margin: '0.5rem 0 0 0',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {detail.offer.notes}
                  </p>
                )}
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                No offer recorded yet.
              </p>
            )}
          </Card>

          {/* Recruiter Contacts Card */}
          <Card className="card" style={{ padding: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>
                Recruiter & Contacts ({detail.contacts.length})
              </h3>
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddContactModal(true)}
              >
                + Add Contact
              </Button>
            </div>

            {detail.contacts.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                No recruiters or contacts linked.
              </p>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                className="layout-group"
              >
                {detail.contacts.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      background: 'var(--bg-secondary)',
                      padding: '0.75rem',
                      borderRadius: '16px',
                      fontSize: '0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <strong>{c.name}</strong>
                      {c.isPrimary && (
                        <span className="badge badge-primary" style={{ marginLeft: '0.5rem' }}>
                          Primary
                        </span>
                      )}
                      {c.title && <div style={{ color: 'var(--text-secondary)' }}>{c.title}</div>}
                      {c.email && (
                        <div>
                          <a href={`mailto:${c.email}`}>{c.email}</a>
                        </div>
                      )}
                      {c.phone && <div>{c.phone}</div>}
                    </div>
                    <Button
                      className="btn btn-secondary btn-sm"
                      style={{ color: 'var(--status-danger)' }}
                      onClick={() => handleDeleteContact(c.id)}
                      aria-label="Delete record"
                    >
                      <Icon name="close" size={20} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Timeline, Interviews, Assessments & Notes */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          className="layout-group"
        >
          {/* Interviews & Assessments Row */}
          <Card className="card" style={{ padding: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Interviews & Assessments</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }} className="layout-group">
                <Button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAddInterviewModal(true)}
                >
                  + Interview
                </Button>
                <Button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAddAssessmentModal(true)}
                >
                  + Assessment
                </Button>
              </div>
            </div>

            {/* Interviews List */}
            {detail.interviews.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '0.5rem',
                  }}
                >
                  INTERVIEWS
                </div>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                  className="layout-group"
                >
                  {detail.interviews.map((int) => (
                    <div
                      key={int.id}
                      style={{
                        background: 'var(--bg-secondary)',
                        padding: '0.75rem',
                        borderRadius: '16px',
                        fontSize: '0.85rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontWeight: 600,
                        }}
                      >
                        <span>
                          <Icon name="interviews" size={20} /> {int.roundTitle}
                        </span>
                        <span>{new Date(int.scheduledAt).toLocaleString()}</span>
                      </div>
                      {int.interviewerName && (
                        <div style={{ color: 'var(--text-secondary)' }}>
                          Interviewer: {int.interviewerName}
                        </div>
                      )}
                      {int.locationOrUrl && (
                        <div style={{ color: 'var(--text-secondary)' }}>
                          Location: {int.locationOrUrl}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assessments List */}
            {detail.assessments.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '0.5rem',
                  }}
                >
                  ASSESSMENTS & TESTS
                </div>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                  className="layout-group"
                >
                  {detail.assessments.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        background: 'var(--bg-secondary)',
                        padding: '0.75rem',
                        borderRadius: '16px',
                        fontSize: '0.85rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontWeight: 600,
                        }}
                      >
                        <span>
                          <Icon name="edit" /> {a.title}
                        </span>
                        <span className="badge badge-outline">{a.status}</span>
                      </div>
                      {a.dueAt && (
                        <div style={{ color: 'var(--text-secondary)' }}>
                          Due: {new Date(a.dueAt).toLocaleDateString()}
                        </div>
                      )}
                      {a.url && (
                        <div>
                          <a href={a.url} target="_blank" rel="noopener noreferrer">
                            Open Assessment Link ↗
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.interviews.length === 0 && detail.assessments.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                No interview rounds or technical assessments recorded.
              </p>
            )}
          </Card>

          {/* CRM User Notes */}
          <Card className="card" style={{ padding: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>
                Candidate Notes ({detail.notes.length})
              </h3>
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddNoteModal(true)}
              >
                + Add Note
              </Button>
            </div>

            {detail.notes.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                No notes logged for this application yet.
              </p>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                className="layout-group"
              >
                {detail.notes.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      background: 'var(--bg-secondary)',
                      padding: '0.75rem',
                      borderRadius: '16px',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <span>{new Date(n.createdAt).toLocaleString()}</span>
                      <Button
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--status-danger)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                        onClick={() => handleDeleteNote(n.id)}
                      >
                        Delete
                      </Button>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{n.content}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Append-only Lifecycle Event Timeline */}
          <Card className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>
              Audit Timeline ({events.length} events)
            </h3>

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
              className="layout-group"
            >
              {events.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    fontSize: '0.85rem',
                    borderLeft: '2px solid var(--border-color)',
                    paddingLeft: '0.75rem',
                  }}
                  className="layout-group"
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{ev.eventType}</strong>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {new Date(ev.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {ev.previousStatus && ev.newStatus && (
                      <div style={{ color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                        {ev.previousStatus} → <strong>{ev.newStatus}</strong>
                      </div>
                    )}
                    {ev.note && (
                      <div style={{ marginTop: '0.25rem', color: 'var(--text-primary)' }}>
                        {ev.note}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Mark Applied Modal */}
      {showMarkAppliedModal && (
        <ModalSurface className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '500px' }}>
            <header className="modal-header">
              <h2 className="modal-title">Mark Application as Applied</h2>
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowMarkAppliedModal(false)}
                aria-label="Close"
              >
                <Icon name="close" size={20} />
              </Button>
            </header>
            <form
              onSubmit={handleMarkApplied}
              className="modal-body"
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div>
                <label className="label">Submission Method / Platform</label>
                <Select
                  className="input"
                  value={markMethod}
                  onChange={(e) => setMarkMethod(e.target.value)}
                >
                  {Object.values(SubmissionMethod).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="label">External Confirmation / Reference ID</label>
                <Input
                  type="text"
                  className="input"
                  placeholder="e.g. APP-94819"
                  value={markRef}
                  onChange={(e) => setMarkRef(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Application Portal URL</label>
                <Input
                  type="url"
                  className="input"
                  placeholder="https://..."
                  value={markUrl}
                  onChange={(e) => setMarkUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Submission Notes</label>
                <Textarea
                  className="input"
                  rows={2}
                  placeholder="e.g. Submitted through official careers form"
                  value={markNotes}
                  onChange={(e) => setMarkNotes(e.target.value)}
                />
              </div>

              <footer
                className="modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}
              >
                <Button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowMarkAppliedModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="btn btn-primary">
                  Confirm Mark Applied
                </Button>
              </footer>
            </form>
          </div>
        </ModalSurface>
      )}

      {/* Transition Modal */}
      {showTransitionModal && (
        <ModalSurface className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '500px' }}>
            <header className="modal-header">
              <h2 className="modal-title">
                {isCorrection
                  ? 'Reopen Status (Correction Override)'
                  : `Transition Status to ${transitionTarget}`}
              </h2>
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowTransitionModal(false)}
                aria-label="Close"
              >
                <Icon name="close" size={20} />
              </Button>
            </header>
            <form
              onSubmit={handleExecuteTransition}
              className="modal-body"
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              {isCorrection && (
                <div>
                  <label className="label">Correction Reason (Required)</label>
                  <Input
                    type="text"
                    className="input"
                    required
                    placeholder="e.g. Recruiter reopened position"
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="label">Event / Activity Note</label>
                <Textarea
                  className="input"
                  rows={3}
                  placeholder="Optional detail about this transition"
                  value={transitionNote}
                  onChange={(e) => setTransitionNote(e.target.value)}
                />
              </div>

              <footer
                className="modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}
              >
                <Button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowTransitionModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="btn btn-primary">
                  Confirm Transition
                </Button>
              </footer>
            </form>
          </div>
        </ModalSurface>
      )}

      {/* Add Note Modal */}
      {showAddNoteModal && (
        <ModalSurface className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '500px' }}>
            <header className="modal-header">
              <h2 className="modal-title">Add Application Note</h2>
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddNoteModal(false)}
                aria-label="Close"
              >
                <Icon name="close" size={20} />
              </Button>
            </header>
            <form
              onSubmit={handleAddNote}
              className="modal-body"
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div>
                <label className="label">Note Content</label>
                <Textarea
                  className="input"
                  rows={4}
                  required
                  placeholder="e.g. Recruiter confirmed team lead will review CV by Friday"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                />
              </div>
              <footer
                className="modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}
              >
                <Button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddNoteModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="btn btn-primary">
                  Save Note
                </Button>
              </footer>
            </form>
          </div>
        </ModalSurface>
      )}

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <ModalSurface className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '500px' }}>
            <header className="modal-header">
              <h2 className="modal-title">Add Recruiter / Contact</h2>
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddContactModal(false)}
                aria-label="Close"
              >
                <Icon name="close" size={20} />
              </Button>
            </header>
            <form
              onSubmit={handleAddContact}
              className="modal-body"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <div>
                <label className="label">Name (Required)</label>
                <Input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Jane Smith"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Title / Role</label>
                <Input
                  type="text"
                  className="input"
                  placeholder="e.g. Technical Recruiter"
                  value={contactTitle}
                  onChange={(e) => setContactTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Email</label>
                <Input
                  type="email"
                  className="input"
                  placeholder="jane@company.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <Input
                  type="tel"
                  className="input"
                  placeholder="+1 (555) 000-0000"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '0.25rem',
                }}
                className="layout-group"
              >
                <Input
                  type="checkbox"
                  id="isPrimary"
                  checked={contactIsPrimary}
                  onChange={(e) => setContactIsPrimary(e.target.checked)}
                />
                <label htmlFor="isPrimary" style={{ fontSize: '0.85rem' }}>
                  Primary recruiter for this application
                </label>
              </div>
              <footer
                className="modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}
              >
                <Button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddContactModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="btn btn-primary">
                  Save Contact
                </Button>
              </footer>
            </form>
          </div>
        </ModalSurface>
      )}

      {/* Add Assessment Modal */}
      {showAddAssessmentModal && (
        <ModalSurface className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '500px' }}>
            <header className="modal-header">
              <h2 className="modal-title">Track Technical Assessment</h2>
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddAssessmentModal(false)}
                aria-label="Close"
              >
                <Icon name="close" size={20} />
              </Button>
            </header>
            <form
              onSubmit={handleAddAssessment}
              className="modal-body"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <div>
                <label className="label">Assessment Title</label>
                <Input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Frontend Coding Challenge"
                  value={assessTitle}
                  onChange={(e) => setAssessTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Type</label>
                <Select
                  className="input"
                  value={assessType}
                  onChange={(e) => setAssessType(e.target.value)}
                >
                  {Object.values(AssessmentType).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="label">Platform / Provider</label>
                <Input
                  type="text"
                  className="input"
                  placeholder="e.g. HackerRank, CodeSignal"
                  value={assessProvider}
                  onChange={(e) => setAssessProvider(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Due Date</label>
                <Input
                  type="datetime-local"
                  className="input"
                  value={assessDue}
                  onChange={(e) => setAssessDue(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Assessment Link</label>
                <Input
                  type="url"
                  className="input"
                  placeholder="https://..."
                  value={assessUrl}
                  onChange={(e) => setAssessUrl(e.target.value)}
                />
              </div>
              <footer
                className="modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}
              >
                <Button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddAssessmentModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="btn btn-primary">
                  Save Assessment
                </Button>
              </footer>
            </form>
          </div>
        </ModalSurface>
      )}

      {/* Add Interview Modal */}
      {showAddInterviewModal && (
        <ModalSurface className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '500px' }}>
            <header className="modal-header">
              <h2 className="modal-title">Schedule Interview Round</h2>
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddInterviewModal(false)}
                aria-label="Close"
              >
                <Icon name="close" size={20} />
              </Button>
            </header>
            <form
              onSubmit={handleAddInterview}
              className="modal-body"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <div>
                <label className="label">Round Title</label>
                <Input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Technical Architecture Deep-dive"
                  value={interviewTitle}
                  onChange={(e) => setInterviewTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Type</label>
                <Select
                  className="input"
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value)}
                >
                  {Object.values(InterviewType).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="label">Date & Time (Required)</label>
                <Input
                  type="datetime-local"
                  className="input"
                  required
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Interviewer Name</label>
                <Input
                  type="text"
                  className="input"
                  placeholder="e.g. John Doe, VP Engineering"
                  value={interviewInterviewer}
                  onChange={(e) => setInterviewInterviewer(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Location or Video Link</label>
                <Input
                  type="text"
                  className="input"
                  placeholder="Google Meet / Zoom URL"
                  value={interviewLocation}
                  onChange={(e) => setInterviewLocation(e.target.value)}
                />
              </div>
              <footer
                className="modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}
              >
                <Button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddInterviewModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="btn btn-primary">
                  Save Interview
                </Button>
              </footer>
            </form>
          </div>
        </ModalSurface>
      )}

      {/* Edit Offer Modal */}
      {showOfferModal && (
        <ModalSurface className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '500px' }}>
            <header className="modal-header">
              <h2 className="modal-title">Record Offer Details</h2>
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowOfferModal(false)}
                aria-label="Close"
              >
                <Icon name="close" size={20} />
              </Button>
            </header>
            <form
              onSubmit={handleSaveOffer}
              className="modal-body"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <div
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem' }}
                className="layout-group"
              >
                <div>
                  <label className="label">Base Salary</label>
                  <Input
                    type="number"
                    className="input"
                    placeholder="e.g. 175000"
                    value={offerBase}
                    onChange={(e) => setOfferBase(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Currency</label>
                  <Input
                    type="text"
                    className="input"
                    value={offerCurrency}
                    onChange={(e) => setOfferCurrency(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="label">Total Compensation (Annual)</label>
                <Input
                  type="number"
                  className="input"
                  placeholder="e.g. 210000"
                  value={offerTotal}
                  onChange={(e) => setOfferTotal(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Offer Status</label>
                <Select
                  className="input"
                  value={offerStatus}
                  onChange={(e) => setOfferStatus(e.target.value)}
                >
                  <option value="PENDING">PENDING</option>
                  <option value="ACCEPTED">ACCEPTED</option>
                  <option value="DECLINED">DECLINED</option>
                  <option value="NEGOTIATING">NEGOTIATING</option>
                  <option value="RESCINDED">RESCINDED</option>
                </Select>
              </div>
              <div>
                <label className="label">Decision Deadline</label>
                <Input
                  type="datetime-local"
                  className="input"
                  value={offerDeadline}
                  onChange={(e) => setOfferDeadline(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Offer Notes & Terms</label>
                <Textarea
                  className="input"
                  rows={2}
                  placeholder="Sign-on bonus, equity terms, start date..."
                  value={offerNotes}
                  onChange={(e) => setOfferNotes(e.target.value)}
                />
              </div>
              <footer
                className="modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}
              >
                <Button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowOfferModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="btn btn-primary">
                  Save Offer
                </Button>
              </footer>
            </form>
          </div>
        </ModalSurface>
      )}

      {/* Browser Run Audit & Details Modal (JOB-P5-T01) */}
      {showRunModal && selectedRun && (
        <ModalSurface className="modal-backdrop" onClick={() => setShowRunModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: '780px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <h2
                style={{
                  fontSize: '1.25rem',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>
                  <Icon name="ai" size={20} />
                </span>{' '}
                Browser Run Audit Trail
              </h2>
              <span
                className={`badge ${
                  selectedRun.status === 'SUCCESS'
                    ? 'badge-success'
                    : selectedRun.status === 'SUBMISSION_UNCERTAIN'
                      ? 'badge-warning'
                      : selectedRun.status.startsWith('STOPPED')
                        ? 'badge-warning'
                        : 'badge-error'
                }`}
                style={{
                  ...browserRunStyle(selectedRun.status),
                }}
              >
                {selectedRun.status === 'SUBMISSION_UNCERTAIN' ? (
                  <>
                    <Icon name="warning" size={20} /> SUBMISSION UNCERTAIN
                  </>
                ) : (
                  selectedRun.status
                )}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1rem',
                background: 'var(--bg-secondary)',
                padding: '0.75rem',
                borderRadius: '16px',
                fontSize: '0.85rem',
              }}
              className="layout-group"
            >
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Provider:</span>{' '}
                <strong>{selectedRun.atsProvider}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Mode:</span>{' '}
                <strong>{selectedRun.mode}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Fields Matched:</span>{' '}
                <strong>
                  {selectedRun.fieldsFilledCount} / {selectedRun.fieldsDetectedCount}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Started:</span>{' '}
                <span>
                  {selectedRun.startedAt
                    ? new Date(selectedRun.startedAt).toLocaleTimeString()
                    : 'N/A'}
                </span>
              </div>
            </div>

            {selectedRun.confirmationReference && (
              <div
                style={{
                  background: 'var(--m3-surface-container-low)',
                  color: 'var(--status-success)',
                  padding: '0.75rem',
                  borderRadius: '16px',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                <Icon name="verified" size={20} /> <strong>Submission Confirmed:</strong>{' '}
                {selectedRun.confirmationReference}
              </div>
            )}

            {selectedRun.errorMessage && (
              <div
                style={{
                  background: 'var(--status-danger-container)',
                  color: 'var(--status-danger)',
                  padding: '0.75rem',
                  borderRadius: '16px',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                <Icon name="warning" /> <strong>Halt Reason:</strong> {selectedRun.errorMessage}
              </div>
            )}

            {selectedRun.unmatchedRequiredFields &&
              selectedRun.unmatchedRequiredFields.length > 0 && (
                <div
                  style={{
                    background: 'var(--m3-surface)',
                    border: '1px solid var(--status-warning-border)',
                    padding: '0.75rem',
                    borderRadius: '16px',
                    fontSize: '0.85rem',
                    marginBottom: '1rem',
                  }}
                >
                  <strong style={{ color: 'var(--status-warning)' }}>
                    Missing Verified Facts for Required Fields:
                  </strong>
                  <ul style={{ margin: '0.5rem 0 0 1.25rem', padding: 0 }}>
                    {(selectedRun.unmatchedRequiredFields as any[]).map((f, idx) => (
                      <li key={idx}>
                        <strong>{f.label || f.name}</strong> ({f.type})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                Step-by-Step Execution Logs
              </h4>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}
                className="layout-group"
              >
                {selectedRun.stepLogs.map((log, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      background: 'var(--bg-secondary)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '16px',
                      fontSize: '0.8rem',
                      borderLeft: `3px solid ${
                        log.status === 'OK'
                          ? 'var(--status-success-border)'
                          : log.status === 'WARNING'
                            ? 'var(--status-warning-border)'
                            : 'var(--status-danger-border)'
                      }`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 600,
                      }}
                    >
                      <span>
                        [{log.step}] {log.action}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                    {log.details && (
                      <div
                        style={{
                          color: 'var(--text-secondary)',
                          marginTop: '0.2rem',
                          fontFamily: 'monospace',
                        }}
                      >
                        {log.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <footer style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button className="btn btn-secondary" onClick={() => setShowRunModal(false)}>
                Close
              </Button>
            </footer>
          </div>
        </ModalSurface>
      )}
    </div>
  );
}
