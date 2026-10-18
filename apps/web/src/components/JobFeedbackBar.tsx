import type { IconName } from '../ui/icons.js';
import { Button, Icon, Input } from '../ui/Primitives.js';
import React, { useState, useEffect } from 'react';
import type { CandidateJobFeedbackDto, CandidateJobFeedbackType } from '@job-agent/shared';
import { careerIntelligenceApi } from '../api/career-intelligence-client.js';

interface JobFeedbackBarProps {
  jobId: string;
  initialFeedback?: CandidateJobFeedbackDto | null;
  onFeedbackSaved?: (feedback: CandidateJobFeedbackDto) => void;
  size?: 'sm' | 'md';
}

const FEEDBACK_OPTIONS: {
  type: CandidateJobFeedbackType;
  label: string;
  icon: IconName;
  tooltip: string;
}[] = [
  {
    type: 'INTERESTED',
    label: 'Interested',
    icon: 'check',
    tooltip: 'Prioritize similar opportunities',
  },
  {
    type: 'NOT_INTERESTED',
    label: 'Not Interested',
    icon: 'cancel',
    tooltip: 'Downweight this company',
  },
  { type: 'IRRELEVANT', label: 'Irrelevant', icon: 'error', tooltip: 'Irrelevant to my profile' },
  {
    type: 'ALREADY_APPLIED',
    label: 'Applied',
    icon: 'applications',
    tooltip: 'I already applied outside Jobee',
  },
  {
    type: 'TOO_SENIOR',
    label: 'Too Senior',
    icon: 'chevron-up',
    tooltip: 'Learn: downweight senior/lead roles',
  },
  {
    type: 'WRONG_LOCATION',
    label: 'Wrong Loc',
    icon: 'location',
    tooltip: 'Learn: downweight this city/country',
  },
  {
    type: 'WRONG_INDUSTRY',
    label: 'Wrong Field',
    icon: 'error',
    tooltip: 'Learn: downweight this industry',
  },
];

export const JobFeedbackBar: React.FC<JobFeedbackBarProps> = ({
  jobId,
  initialFeedback = null,
  onFeedbackSaved,
  size = 'md',
}) => {
  const [currentFeedback, setCurrentFeedback] = useState<CandidateJobFeedbackDto | null>(
    initialFeedback,
  );
  const [loadingType, setLoadingType] = useState<CandidateJobFeedbackType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [pendingType, setPendingType] = useState<CandidateJobFeedbackType | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    let isMounted = true;
    if (!initialFeedback) {
      careerIntelligenceApi
        .getJobFeedback(jobId)
        .then((res) => {
          if (isMounted && res.feedback) {
            setCurrentFeedback(res.feedback);
          }
        })
        .catch(() => {
          // ignore
        });
    } else {
      setCurrentFeedback(initialFeedback);
    }
    return () => {
      isMounted = false;
    };
  }, [jobId, initialFeedback]);

  const handleSelectType = async (type: CandidateJobFeedbackType) => {
    // If user clicked the already-selected type, offer to edit/add note
    if (currentFeedback?.feedbackType === type) {
      setPendingType(type);
      setNoteText(currentFeedback.notes || '');
      setShowNoteInput(true);
      return;
    }

    // Direct submit
    setLoadingType(type);
    setError(null);
    try {
      const res = await careerIntelligenceApi.recordJobFeedback(jobId, type);
      setCurrentFeedback(res.feedback);
      onFeedbackSaved?.(res.feedback);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record feedback');
    } finally {
      setLoadingType(null);
    }
  };

  const handleSaveWithNote = async () => {
    if (!pendingType) return;
    setLoadingType(pendingType);
    setError(null);
    try {
      const res = await careerIntelligenceApi.recordJobFeedback(jobId, pendingType, noteText);
      setCurrentFeedback(res.feedback);
      onFeedbackSaved?.(res.feedback);
      setShowNoteInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setLoadingType(null);
    }
  };

  const isSmall = size === 'sm';
  const padding = isSmall ? '0.2rem 0.45rem' : '0.35rem 0.65rem';
  const fontSize = isSmall ? '0.75rem' : '0.82rem';

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
      className="layout-group"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          flexWrap: 'wrap',
        }}
        className="layout-group"
      >
        <span
          style={{
            fontSize: isSmall ? '0.72rem' : '0.78rem',
            color: 'var(--text-secondary)',
            fontWeight: 500,
            marginRight: '0.2rem',
          }}
        >
          Feedback:
        </span>
        {FEEDBACK_OPTIONS.map((opt) => {
          const isSelected = currentFeedback?.feedbackType === opt.type;
          const isLoading = loadingType === opt.type;

          return (
            <Button
              key={opt.type}
              type="button"
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                handleSelectType(opt.type);
              }}
              title={opt.tooltip}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding,
                fontSize,
                fontWeight: isSelected ? 700 : 500,
                borderRadius: '0.35rem',
                border: isSelected ? '1px solid var(--accent)' : '1px solid var(--surface-border)',
                backgroundColor: isSelected ? 'var(--m3-secondary-container)' : 'var(--m3-surface)',
                color: isSelected ? 'var(--m3-on-surface)' : 'var(--text-secondary)',
                cursor: isLoading ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>
                <Icon name={opt.icon} size={18} />
              </span>
              <span>{opt.label}</span>
              {isSelected && (
                <span style={{ fontSize: '0.7rem' }}>
                  <Icon name="check" size={20} />
                </span>
              )}
            </Button>
          );
        })}

        {currentFeedback && (
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPendingType(currentFeedback.feedbackType);
              setNoteText(currentFeedback.notes || '');
              setShowNoteInput(!showNoteInput);
            }}
            title="Add or edit feedback note"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              marginLeft: '0.2rem',
            }}
          >
            <Icon name="messages" size={20} /> {currentFeedback.notes ? 'Edit note' : '+ note'}
          </Button>
        )}
      </div>

      {showNoteInput && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'var(--m3-surface-container-low)',
            padding: '0.5rem',
            borderRadius: '0.35rem',
            border: '1px solid var(--surface-border)',
          }}
          className="layout-group"
        >
          <Input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add context for this feedback (e.g., relocation not possible)..."
            style={{
              flex: 1,
              backgroundColor: 'var(--surface-color)',
              border: '1px solid var(--surface-border)',
              borderRadius: '0.25rem',
              color: 'var(--text-primary)',
              padding: '0.3rem 0.5rem',
              fontSize: '0.8rem',
            }}
          />
          <Button
            type="button"
            onClick={handleSaveWithNote}
            className="btn btn-primary btn-sm"
            style={{ padding: '0.25rem 0.6rem' }}
          >
            Save
          </Button>
          <Button
            type="button"
            onClick={() => setShowNoteInput(false)}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.25rem 0.6rem' }}
          >
            Cancel
          </Button>
        </div>
      )}

      {error && (
        <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>
          <Icon name="warning" /> {error}
        </span>
      )}
    </div>
  );
};
