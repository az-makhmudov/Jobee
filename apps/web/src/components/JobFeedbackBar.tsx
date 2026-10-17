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
  icon: string;
  tooltip: string;
}[] = [
  { type: 'INTERESTED', label: 'Interested', icon: '👍', tooltip: 'Prioritize similar opportunities' },
  { type: 'NOT_INTERESTED', label: 'Not Interested', icon: '👎', tooltip: 'Downweight this company' },
  { type: 'IRRELEVANT', label: 'Irrelevant', icon: '🚫', tooltip: 'Irrelevant to my profile' },
  { type: 'ALREADY_APPLIED', label: 'Applied', icon: '📨', tooltip: 'I already applied outside Jobee' },
  { type: 'TOO_SENIOR', label: 'Too Senior', icon: '⬆️', tooltip: 'Learn: downweight senior/lead roles' },
  { type: 'WRONG_LOCATION', label: 'Wrong Loc', icon: '📍', tooltip: 'Learn: downweight this city/country' },
  { type: 'WRONG_INDUSTRY', label: 'Wrong Field', icon: '🏢', tooltip: 'Learn: downweight this industry' },
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          flexWrap: 'wrap',
        }}
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
            <button
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
                backgroundColor: isSelected
                  ? 'rgba(59, 130, 246, 0.25)'
                  : 'rgba(255, 255, 255, 0.04)',
                color: isSelected ? '#93c5fd' : 'var(--text-secondary)',
                cursor: isLoading ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
              {isSelected && <span style={{ fontSize: '0.7rem' }}>✓</span>}
            </button>
          );
        })}

        {currentFeedback && (
          <button
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
            💬 {currentFeedback.notes ? 'Edit note' : '+ note'}
          </button>
        )}
      </div>

      {showNoteInput && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            padding: '0.5rem',
            borderRadius: '0.35rem',
            border: '1px solid var(--surface-border)',
          }}
        >
          <input
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
          <button
            type="button"
            onClick={handleSaveWithNote}
            className="btn btn-primary btn-sm"
            style={{ padding: '0.25rem 0.6rem' }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setShowNoteInput(false)}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.25rem 0.6rem' }}
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>⚠️ {error}</span>
      )}
    </div>
  );
};
