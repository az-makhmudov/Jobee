import React, { useState, useEffect } from 'react';
import type { CandidateIntelligenceSuggestionDto, LearnedPreferencesDto } from '@job-agent/shared';
import {
  careerIntelligenceApi,
  type CareerIntelligenceOverviewDto,
  type CandidateRecordsResponseDto,
  type CandidateRecordItemDto,
} from '../api/career-intelligence-client.js';

export const CareerIntelligenceView: React.FC = () => {
  const [data, setData] = useState<CareerIntelligenceOverviewDto | null>(null);
  const [suggestions, setSuggestions] = useState<CandidateIntelligenceSuggestionDto[]>([]);
  const [learnedPrefs, setLearnedPrefs] = useState<LearnedPreferencesDto | null>(null);
  const [recordsData, setRecordsData] = useState<CandidateRecordsResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Suggestion filter tab
  const [suggestionTab, setSuggestionTab] = useState<'PENDING' | 'APPROVED' | 'DISMISSED' | 'ALL'>(
    'PENDING',
  );

  // Candidate Records filter tab & selection
  const [recordTab, setRecordTab] = useState<
    | 'all'
    | 'experiences'
    | 'education'
    | 'skills'
    | 'certifications'
    | 'languages'
    | 'projects'
    | 'facts'
  >('all');
  const [selectedRecordKeys, setSelectedRecordKeys] = useState<Set<string>>(new Set());
  const [recordSubmittingId, setRecordSubmittingId] = useState<string | null>(null);

  // Interactive clarification state
  const [clarificationSubmitting, setClarificationSubmitting] = useState<string | null>(null);
  const [salaryInput, setSalaryInput] = useState<string>('');
  const [countryInput, setCountryInput] = useState<string>('');

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, suggestionsRes, learnedRes, recordsRes] = await Promise.all([
        careerIntelligenceApi.getIntelligenceOverview(),
        careerIntelligenceApi.listSuggestions(),
        careerIntelligenceApi.getLearnedPreferences(),
        careerIntelligenceApi.getRecords(),
      ]);

      setData(overviewRes);
      setSuggestions(suggestionsRes.suggestions || []);
      setLearnedPrefs(learnedRes.learnedPreferences || null);
      setRecordsData(recordsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Career Intelligence');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRecordAuth = async (
    entityType: string,
    id: string,
    updates: { verificationStatus?: string; allowAiUse?: boolean },
  ) => {
    setRecordSubmittingId(`${entityType}:${id}`);
    setError(null);
    try {
      await careerIntelligenceApi.updateRecordAuthorization(entityType, id, updates);
      setSuccessMessage('Record authorization updated successfully.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update record authorization');
    } finally {
      setRecordSubmittingId(null);
    }
  };

  const handleBatchVerifySelected = async () => {
    if (selectedRecordKeys.size === 0) return;
    const items = Array.from(selectedRecordKeys).map((key) => {
      const [entityType, id] = key.split(':');
      return { entityType, id, verificationStatus: 'VERIFIED' };
    });

    try {
      const res = await careerIntelligenceApi.batchAuthorizeRecords(items);
      setSuccessMessage(`Verified ${res.updatedCount} records successfully.`);
      setSelectedRecordKeys(new Set());
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to batch verify records');
    }
  };

  const handleBatchAuthorizeAiSelected = async () => {
    if (selectedRecordKeys.size === 0) return;
    const items = Array.from(selectedRecordKeys).map((key) => {
      const [entityType, id] = key.split(':');
      return { entityType, id, allowAiUse: true };
    });

    try {
      const res = await careerIntelligenceApi.batchAuthorizeRecords(items);
      setSuccessMessage(`Authorized AI use for ${res.updatedCount} verified records.`);
      setSelectedRecordKeys(new Set());
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to batch authorize AI use');
    }
  };

  const handleBatchRevokeAiSelected = async () => {
    if (selectedRecordKeys.size === 0) return;
    const items = Array.from(selectedRecordKeys).map((key) => {
      const [entityType, id] = key.split(':');
      return { entityType, id, allowAiUse: false };
    });

    try {
      const res = await careerIntelligenceApi.batchAuthorizeRecords(items);
      setSuccessMessage(`Revoked AI use for ${res.updatedCount} records.`);
      setSelectedRecordKeys(new Set());
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to batch revoke AI use');
    }
  };

  const handleToggleSelectRecord = (key: string) => {
    setSelectedRecordKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleRunEnrichment = async () => {
    setEnriching(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await careerIntelligenceApi.runEnrichment();
      setSuccessMessage(
        `AI Enrichment complete! Created ${res.suggestionsCreated} suggestions for human review.`,
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI Enrichment failed');
    } finally {
      setEnriching(false);
    }
  };

  const handleApplySuggestion = async (id: string) => {
    try {
      await careerIntelligenceApi.applySuggestion(id);
      setSuccessMessage('Suggestion approved and applied to your Candidate Brain!');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply suggestion');
    }
  };

  const handleDismissSuggestion = async (id: string) => {
    try {
      await careerIntelligenceApi.dismissSuggestion(id);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss suggestion');
    }
  };

  const handleAnswerClarification = async (field: string, value: unknown) => {
    setClarificationSubmitting(field);
    setError(null);
    try {
      await careerIntelligenceApi.submitClarification(field, value);
      setSuccessMessage('Clarification saved successfully.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save clarification');
    } finally {
      setClarificationSubmitting(null);
    }
  };

  const handleResetLearnedPreferences = async () => {
    if (
      !window.confirm(
        'Reset learned preferences? This clears downvoted industries, locations, and companies learned from your feedback.',
      )
    ) {
      return;
    }

    try {
      const res = await careerIntelligenceApi.resetLearnedPreferences();
      setLearnedPrefs(res.learnedPreferences);
      setSuccessMessage('Learned preferences have been reset.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset learned preferences');
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading Career Intelligence...
      </div>
    );
  }

  const summary = data?.summary;
  const filteredSuggestions = suggestions.filter((s) => {
    if (suggestionTab === 'ALL') return true;
    return s.status === suggestionTab;
  });

  return (
    <div>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.25rem',
            }}
          >
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Career Intelligence 2.0</h1>
            <span
              className="status-badge ok"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
            >
              Auditable & Verified
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is
            auditable.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadAll}
            disabled={loading}
          >
            🔄 Refresh
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleRunEnrichment}
            disabled={enriching}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              border: 'none',
              fontWeight: 600,
            }}
          >
            {enriching ? '✨ Analyzing Vault...' : '✨ Run AI Enrichment'}
          </button>
        </div>
      </div>

      {/* State & Context Integrity Banner */}
      <div
        className="card"
        style={{
          backgroundColor: 'rgba(30, 41, 59, 0.7)',
          border: '1px solid var(--surface-border)',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
              }}
            >
              Candidate State Hash
            </div>
            <code
              style={{
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                color: '#93c5fd',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                padding: '0.2rem 0.5rem',
                borderRadius: '0.25rem',
              }}
              title={data?.candidateStateHash}
            >
              {data?.candidateStateHash ? `${data.candidateStateHash.substring(0, 16)}...` : '—'}
            </code>
          </div>
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
              }}
            >
              Context Version
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>v{data?.contextVersion ?? 1}</div>
          </div>
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
              }}
            >
              Verified Claims
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#34d399' }}>
              {summary?.verifiedCount ?? 0} verified
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
              }}
            >
              AI Suggestions
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#fbbf24' }}>
              {summary?.aiSuggestedCount ?? 0} pending review
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          🔒 Privacy Minimized • AI context strictly gated on verified & authorized records
        </div>
      </div>

      {error && (
        <div
          className="card"
          style={{ borderColor: 'var(--danger)', color: '#f87171', marginBottom: '1.5rem' }}
        >
          ⚠️ {error}
        </div>
      )}

      {successMessage && (
        <div
          className="card"
          style={{ borderColor: 'var(--success)', color: '#34d399', marginBottom: '1.5rem' }}
        >
          ✓ {successMessage}
        </div>
      )}

      {/* Grid Layout: What Jobee Knows vs High-Impact Clarifications */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
          gap: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Section 1: What Jobee Knows */}
        <div className="card">
          <div className="card-title">
            <span>🧠 What Jobee Knows</span>
            <span
              className="status-badge ok"
              style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}
            >
              Ground Truth
            </span>
          </div>
          <p
            style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}
          >
            Verified candidate facts, authorized credentials, and confirmed preferences.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Transferable Capabilities */}
            <div>
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#a78bfa',
                  textTransform: 'uppercase',
                  marginBottom: '0.4rem',
                }}
              >
                Transferable Capabilities
              </div>
              {summary?.whatJobeeKnows?.transferableCapabilities &&
              summary.whatJobeeKnows.transferableCapabilities.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {summary.whatJobeeKnows.transferableCapabilities.map(
                    (cap: string, idx: number) => (
                      <span
                        key={idx}
                        style={{
                          backgroundColor: 'rgba(139, 92, 246, 0.15)',
                          border: '1px solid rgba(139, 92, 246, 0.35)',
                          color: '#c4b5fd',
                          borderRadius: '0.35rem',
                          padding: '0.2rem 0.6rem',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                        }}
                      >
                        ⇄ {cap}
                      </span>
                    ),
                  )}
                </div>
              ) : (
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  No transferable capabilities extracted yet. Run AI enrichment or add them in your
                  profile.
                </span>
              )}
            </div>

            {/* Verified Skills */}
            <div>
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  marginBottom: '0.4rem',
                }}
              >
                Verified Skills
              </div>
              {summary?.whatJobeeKnows?.verifiedSkills &&
              summary.whatJobeeKnows.verifiedSkills.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {summary.whatJobeeKnows.verifiedSkills.map((skill: string, idx: number) => (
                    <span
                      key={idx}
                      className="nav-tag"
                      style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        color: '#6ee7b7',
                        padding: '0.2rem 0.5rem',
                      }}
                    >
                      ✓ {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  No verified skills yet.
                </span>
              )}
            </div>

            {/* Career Direction & Target Roles */}
            <div>
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  marginBottom: '0.4rem',
                }}
              >
                Target Roles & Adjacent Career Paths
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {summary?.suitableCareerPaths?.primaryRoles?.map((title: string, idx: number) => (
                  <span
                    key={idx}
                    className="nav-tag"
                    style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: '#93c5fd',
                    }}
                  >
                    🎯 {title}
                  </span>
                ))}
                {summary?.suitableCareerPaths?.adjacentRoles?.map((adj: string, idx: number) => (
                  <span
                    key={`adj-${idx}`}
                    className="nav-tag"
                    style={{
                      backgroundColor: 'rgba(148, 163, 184, 0.12)',
                      border: '1px solid rgba(148, 163, 184, 0.25)',
                      color: '#cbd5e1',
                    }}
                  >
                    Adjacent: {adj}
                  </span>
                ))}
              </div>
            </div>

            {/* Work Authorization & Constraints */}
            <div>
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  marginBottom: '0.4rem',
                }}
              >
                Work Authorization & Constraints
              </div>
              <div
                style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.82rem' }}
              >
                <span
                  className="nav-tag"
                  style={{
                    backgroundColor: summary?.whatJobeeKnows?.workAuthorization?.length
                      ? 'rgba(16, 185, 129, 0.12)'
                      : 'rgba(239, 68, 68, 0.12)',
                    color: summary?.whatJobeeKnows?.workAuthorization?.length
                      ? '#34d399'
                      : '#f87171',
                  }}
                >
                  Countries:{' '}
                  {summary?.whatJobeeKnows?.workAuthorization?.join(', ') || 'Unconfigured'}
                </span>
                <span className="nav-tag">
                  Sponsorship Required:{' '}
                  {summary?.matchingConstraints?.sponsorshipNeeded === true
                    ? 'Yes'
                    : summary?.matchingConstraints?.sponsorshipNeeded === false
                      ? 'No'
                      : 'Unknown'}
                </span>
                {summary?.matchingConstraints?.minSalary && (
                  <span className="nav-tag" style={{ color: '#34d399' }}>
                    Min Salary: ${summary.matchingConstraints.minSalary.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: What Jobee Needs to Clarify */}
        <div className="card">
          <div className="card-title">
            <span>❓ What Jobee Needs to Clarify</span>
            {summary?.whatNeedsClarification && summary.whatNeedsClarification.length > 0 && (
              <span
                className="status-badge degraded"
                style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}
              >
                {summary.whatNeedsClarification.length} Questions
              </span>
            )}
          </div>
          <p
            style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}
          >
            Answering high-impact questions unlocks accurate matching and prevents false rejections.
          </p>

          {!summary?.whatNeedsClarification || summary.whatNeedsClarification.length === 0 ? (
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '0.35rem',
                padding: '1.25rem',
                textAlign: 'center',
                color: '#34d399',
                fontSize: '0.9rem',
              }}
            >
              ✓ All critical matching policies and preferences are configured!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {summary.whatNeedsClarification.map((item, idx: number) => {
                const isSubmitting = clarificationSubmitting === item.field;

                return (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '0.375rem',
                      padding: '0.9rem 1.1rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                      {item.question}
                    </div>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '0.65rem',
                      }}
                    >
                      Impact: {item.impact}
                    </div>

                    {/* Interactive Answer Widgets */}
                    {item.field === 'needsSponsorship' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={isSubmitting}
                          onClick={() => handleAnswerClarification('needsSponsorship', false)}
                        >
                          No (Authorized to work)
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={isSubmitting}
                          onClick={() => handleAnswerClarification('needsSponsorship', true)}
                        >
                          Yes (Require Visa Sponsorship)
                        </button>
                      </div>
                    )}

                    {item.field === 'minSalary' && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="number"
                          placeholder="e.g. 90000"
                          value={salaryInput}
                          onChange={(e) => setSalaryInput(e.target.value)}
                          style={{
                            backgroundColor: 'var(--surface-color)',
                            border: '1px solid var(--surface-border)',
                            borderRadius: '0.25rem',
                            color: 'var(--text-primary)',
                            padding: '0.3rem 0.6rem',
                            fontSize: '0.85rem',
                            width: '130px',
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={isSubmitting || !salaryInput}
                          onClick={() =>
                            handleAnswerClarification('minSalary', Number(salaryInput))
                          }
                        >
                          Save
                        </button>
                      </div>
                    )}

                    {item.field === 'workAuthorizationCountries' && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="e.g. Germany, EU, US"
                          value={countryInput}
                          onChange={(e) => setCountryInput(e.target.value)}
                          style={{
                            backgroundColor: 'var(--surface-color)',
                            border: '1px solid var(--surface-border)',
                            borderRadius: '0.25rem',
                            color: 'var(--text-primary)',
                            padding: '0.3rem 0.6rem',
                            fontSize: '0.85rem',
                            flex: 1,
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={isSubmitting || !countryInput.trim()}
                          onClick={() =>
                            handleAnswerClarification(
                              'workAuthorizationCountries',
                              countryInput
                                .split(',')
                                .map((c) => c.trim())
                                .filter(Boolean),
                            )
                          }
                        >
                          Save
                        </button>
                      </div>
                    )}

                    {item.field === 'availability' && (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {['IMMEDIATE', '2_WEEKS', '1_MONTH', '3_MONTHS'].map((av) => (
                          <button
                            key={av}
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={isSubmitting}
                            onClick={() => handleAnswerClarification('availability', av)}
                          >
                            {av.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    )}

                    {item.field.startsWith('fact:') && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={isSubmitting}
                          onClick={() => handleAnswerClarification(item.field, 'VERIFIED')}
                        >
                          ✓ Confirm Verified
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={isSubmitting}
                          onClick={() => handleAnswerClarification(item.field, 'REJECTED')}
                        >
                          ✕ Reject / Incorrect
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Candidate Records Verification & AI-Use Authorization */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.25rem',
              }}
            >
              <h3 className="card-title" style={{ margin: 0 }}>
                🛡️ Candidate Records: Verification & AI Authorization
              </h3>
              <span
                className="status-badge ok"
                style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}
              >
                Human Decides
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              Individually review, verify, and authorize AI use for each professional credential.
              Verification and AI-use permission are separate, explicit human decisions.
            </p>
          </div>

          {/* Counts pill banner */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span
              className="nav-tag"
              style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd' }}
            >
              Total: {recordsData?.counts.total ?? 0}
            </span>
            <span
              className="nav-tag"
              style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7' }}
            >
              ✓ Verified: {recordsData?.counts.verified ?? 0}
            </span>
            <span
              className="nav-tag"
              style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd' }}
            >
              🤖 In AI Prompt: {recordsData?.counts.aiAuthorized ?? 0}
            </span>
            <span
              className="nav-tag"
              style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d' }}
            >
              🔒 AI-Gated: {recordsData?.counts.unverified ?? 0}
            </span>
          </div>
        </div>

        {/* Category Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.35rem',
            overflowX: 'auto',
            paddingBottom: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          {[
            { key: 'all', label: `All (${recordsData?.counts.total ?? 0})` },
            {
              key: 'experiences',
              label: `Experiences (${recordsData?.records.experiences.length ?? 0})`,
            },
            {
              key: 'education',
              label: `Education (${recordsData?.records.education.length ?? 0})`,
            },
            { key: 'skills', label: `Skills (${recordsData?.records.skills.length ?? 0})` },
            {
              key: 'certifications',
              label: `Certifications (${recordsData?.records.certifications.length ?? 0})`,
            },
            {
              key: 'languages',
              label: `Languages (${recordsData?.records.languages.length ?? 0})`,
            },
            { key: 'projects', label: `Projects (${recordsData?.records.projects.length ?? 0})` },
            { key: 'facts', label: `Facts (${recordsData?.records.facts.length ?? 0})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`btn btn-sm ${recordTab === tab.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ whiteSpace: 'nowrap' }}
              onClick={() => setRecordTab(tab.key as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Multi-Record Batch Action Bar */}
        {selectedRecordKeys.size > 0 && (
          <div
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              borderRadius: '0.375rem',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#93c5fd' }}>
                Selected: {selectedRecordKeys.size} record{selectedRecordKeys.size > 1 ? 's' : ''}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                onClick={() => setSelectedRecordKeys(new Set())}
              >
                Clear Selection
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleBatchVerifySelected}
                title="Mark selected records as VERIFIED without silently granting AI access"
              >
                ✓ Verify Selected
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{
                  backgroundColor: 'rgba(139, 92, 246, 0.25)',
                  borderColor: '#8b5cf6',
                  color: '#c4b5fd',
                }}
                onClick={handleBatchAuthorizeAiSelected}
                title="Explicitly permit AI use for selected records that are verified"
              >
                🤖 Authorize AI Use (Verified Only)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleBatchRevokeAiSelected}
                title="Revoke AI prompt use from selected records"
              >
                🔒 Revoke AI Use
              </button>
            </div>
          </div>
        )}

        {/* Records Table / List */}
        {(() => {
          let list: CandidateRecordItemDto[] = [];
          if (!recordsData) list = [];
          else if (recordTab === 'all') {
            list = [
              ...recordsData.records.experiences,
              ...recordsData.records.education,
              ...recordsData.records.skills,
              ...recordsData.records.certifications,
              ...recordsData.records.languages,
              ...recordsData.records.projects,
              ...recordsData.records.facts,
            ];
          } else {
            list = recordsData.records[recordTab] || [];
          }

          if (list.length === 0) {
            return (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No records in this category.
              </div>
            );
          }

          const allSelectedInTab = list.every((item) =>
            selectedRecordKeys.has(`${item.entityType}:${item.id}`),
          );

          return (
            <div>
              {/* Select all header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  borderBottom: '1px solid var(--surface-border)',
                  marginBottom: '0.5rem',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={list.length > 0 && allSelectedInTab}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRecordKeys((prev) => {
                          const next = new Set(prev);
                          list.forEach((i) => next.add(`${i.entityType}:${i.id}`));
                          return next;
                        });
                      } else {
                        setSelectedRecordKeys((prev) => {
                          const next = new Set(prev);
                          list.forEach((i) => next.delete(`${i.entityType}:${i.id}`));
                          return next;
                        });
                      }
                    }}
                  />
                  <span>Select All ({list.length})</span>
                </label>
                <span>Verification & AI-Use Controls</span>
              </div>

              {/* Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {list.map((item) => {
                  const key = `${item.entityType}:${item.id}`;
                  const isSelected = selectedRecordKeys.has(key);
                  const isUpdating = recordSubmittingId === key;
                  const isVerified = item.verificationStatus === 'VERIFIED';
                  const isRejected = item.verificationStatus === 'REJECTED';

                  return (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.85rem 1rem',
                        backgroundColor: isSelected
                          ? 'rgba(59, 130, 246, 0.08)'
                          : 'rgba(15, 23, 42, 0.6)',
                        border: `1px solid ${isSelected ? 'rgba(59, 130, 246, 0.4)' : 'var(--surface-border)'}`,
                        borderRadius: '0.375rem',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                      }}
                    >
                      {/* Left: Checkbox + Information */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.75rem',
                          flex: 1,
                          minWidth: '260px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRecord(key)}
                          style={{ marginTop: '0.25rem' }}
                        />
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              flexWrap: 'wrap',
                            }}
                          >
                            <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                              {item.title}
                            </span>
                            <span
                              className={`status-badge ${isVerified ? 'ok' : isRejected ? 'danger' : 'degraded'}`}
                              style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}
                            >
                              {item.verificationStatus}
                            </span>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '0.25rem',
                                backgroundColor: item.allowAiUse
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : 'rgba(100, 116, 139, 0.2)',
                                color: item.allowAiUse ? '#34d399' : '#94a3b8',
                                border: `1px solid ${item.allowAiUse ? 'rgba(16, 185, 129, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`,
                                fontWeight: 500,
                              }}
                            >
                              {item.allowAiUse ? '🤖 In AI Context' : '🔒 Excluded from AI'}
                            </span>
                          </div>

                          <div
                            style={{
                              fontSize: '0.82rem',
                              color: 'var(--text-secondary)',
                              marginTop: '0.25rem',
                            }}
                          >
                            {item.subtitle}
                          </div>

                          {item.sourceReference && (
                            <div
                              style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}
                            >
                              Source: {item.sourceReference}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Separate Explicit Verification & AI Controls */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        {/* Control 1: Verification status */}
                        {!isVerified && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={isUpdating}
                            onClick={() =>
                              handleUpdateRecordAuth(item.entityType, item.id, {
                                verificationStatus: 'VERIFIED',
                              })
                            }
                            title="Verify this factual record without granting AI access"
                          >
                            ✓ Verify
                          </button>
                        )}

                        {isVerified && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={isUpdating}
                            onClick={() =>
                              handleUpdateRecordAuth(item.entityType, item.id, {
                                verificationStatus: 'UNVERIFIED',
                                allowAiUse: false,
                              })
                            }
                            title="Reset record to UNVERIFIED and revoke AI use"
                          >
                            Unverify
                          </button>
                        )}

                        {/* Control 2: AI-Use Authorization (Separate Decision) */}
                        {item.allowAiUse ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={isUpdating}
                            style={{ borderColor: '#f87171', color: '#f87171' }}
                            onClick={() =>
                              handleUpdateRecordAuth(item.entityType, item.id, {
                                allowAiUse: false,
                              })
                            }
                            title="Revoke AI prompt use while keeping record verified"
                          >
                            🔒 Revoke AI
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={isUpdating}
                            style={{
                              backgroundColor: isVerified ? 'rgba(139, 92, 246, 0.2)' : undefined,
                              borderColor: isVerified ? '#8b5cf6' : undefined,
                              color: isVerified ? '#c4b5fd' : undefined,
                            }}
                            onClick={() => {
                              if (!isVerified) {
                                // Explicitly verify AND authorize AI use
                                handleUpdateRecordAuth(item.entityType, item.id, {
                                  verificationStatus: 'VERIFIED',
                                  allowAiUse: true,
                                });
                              } else {
                                handleUpdateRecordAuth(item.entityType, item.id, {
                                  allowAiUse: true,
                                });
                              }
                            }}
                            title={
                              isVerified
                                ? 'Authorize this verified credential in generative AI prompt'
                                : 'Verify and authorize for AI in one step'
                            }
                          >
                            🤖 {isVerified ? 'Allow AI' : 'Verify & Allow AI'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Section 4: Verified vs. AI-Suggested (Human-in-the-Loop Approval Gating) */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <h3 className="card-title" style={{ marginBottom: '0.25rem' }}>
              ✨ AI Profile Suggestions & Discovered Capabilities
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              AI analyzes uploaded CVs and documents to propose transferable capabilities, career
              paths, and missing details. Suggestions require explicit approval before entering your
              Candidate Brain.
            </p>
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {(['PENDING', 'APPROVED', 'DISMISSED', 'ALL'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`btn btn-sm ${suggestionTab === tab ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSuggestionTab(tab)}
              >
                {tab === 'PENDING'
                  ? `Pending (${suggestions.filter((s) => s.status === 'PENDING').length})`
                  : tab === 'APPROVED'
                    ? 'Approved'
                    : tab}
              </button>
            ))}
          </div>
        </div>

        {filteredSuggestions.length === 0 ? (
          <div
            style={{
              padding: '2.5rem',
              textAlign: 'center',
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              borderRadius: '0.375rem',
            }}
          >
            <div style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>
              No {suggestionTab.toLowerCase()} suggestions
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Click <strong>✨ Run AI Enrichment</strong> above to analyze your documents and
              discover transferable capabilities.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1rem',
            }}
          >
            {filteredSuggestions.map((sug) => {
              const isPending = sug.status === 'PENDING';
              const isApproved = sug.status === 'APPROVED';

              return (
                <div
                  key={sug.id}
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.7)',
                    border: `1px solid ${isApproved ? 'rgba(16, 185, 129, 0.3)' : 'var(--surface-border)'}`,
                    borderRadius: '0.375rem',
                    padding: '1.1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <span
                        className="nav-tag"
                        style={{
                          backgroundColor:
                            sug.suggestionType === 'TRANSFERABLE_SKILL'
                              ? 'rgba(139, 92, 246, 0.2)'
                              : sug.suggestionType === 'CAREER_PATH'
                                ? 'rgba(59, 130, 246, 0.2)'
                                : 'rgba(245, 158, 11, 0.2)',
                          color:
                            sug.suggestionType === 'TRANSFERABLE_SKILL'
                              ? '#c4b5fd'
                              : sug.suggestionType === 'CAREER_PATH'
                                ? '#93c5fd'
                                : '#fcd34d',
                        }}
                      >
                        {sug.suggestionType.replace('_', ' ')}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Confidence: {sug.confidence}%
                      </span>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                      {sug.title}
                    </div>
                    <p
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem',
                        marginBottom: '0.85rem',
                      }}
                    >
                      {sug.description}
                    </p>

                    {sug.evidence && (
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#94a3b8',
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          padding: '0.3rem 0.5rem',
                          borderRadius: '0.25rem',
                          marginBottom: '0.85rem',
                        }}
                      >
                        Evidence: {sug.evidence}
                      </div>
                    )}
                  </div>

                  {isPending && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => handleApplySuggestion(sug.id)}
                      >
                        ✓ Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDismissSuggestion(sug.id)}
                      >
                        ✕ Dismiss
                      </button>
                    </div>
                  )}

                  {isApproved && (
                    <div
                      style={{
                        color: '#34d399',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        marginTop: '0.5rem',
                      }}
                    >
                      ✓ Approved & Applied to Brain
                    </div>
                  )}

                  {sug.status === 'DISMISSED' && (
                    <div
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        marginTop: '0.5rem',
                      }}
                    >
                      Dismissed by user
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 4: Learned Career Preferences (Transparent & Reset-able) */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <h3 className="card-title" style={{ marginBottom: '0.25rem' }}>
              📊 Learned Career Preferences from Feedback
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Jobee dynamically learns ranking adjustments from your job feedback (e.g. Too Senior,
              Wrong Location, Wrong Industry).
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleResetLearnedPreferences}
          >
            ↺ Reset Learned Preferences
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--surface-border)',
              borderRadius: '0.375rem',
              padding: '0.9rem',
            }}
          >
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
              }}
            >
              Downvoted Industries
            </div>
            {learnedPrefs?.downvotedIndustries && learnedPrefs.downvotedIndustries.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {learnedPrefs.downvotedIndustries.map((ind, idx) => (
                  <span key={idx} className="nav-tag" style={{ color: '#f87171' }}>
                    ✕ {ind}
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                None downvoted
              </span>
            )}
          </div>

          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--surface-border)',
              borderRadius: '0.375rem',
              padding: '0.9rem',
            }}
          >
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
              }}
            >
              Downvoted Locations
            </div>
            {learnedPrefs?.downvotedLocations && learnedPrefs.downvotedLocations.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {learnedPrefs.downvotedLocations.map((loc, idx) => (
                  <span key={idx} className="nav-tag" style={{ color: '#f87171' }}>
                    ✕ {loc}
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                None downvoted
              </span>
            )}
          </div>

          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--surface-border)',
              borderRadius: '0.375rem',
              padding: '0.9rem',
            }}
          >
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
              }}
            >
              Downvoted Companies
            </div>
            {learnedPrefs?.downvotedCompanies && learnedPrefs.downvotedCompanies.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {learnedPrefs.downvotedCompanies.map((comp, idx) => (
                  <span key={idx} className="nav-tag" style={{ color: '#f87171' }}>
                    ✕ {comp}
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                None downvoted
              </span>
            )}
          </div>

          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--surface-border)',
              borderRadius: '0.375rem',
              padding: '0.9rem',
            }}
          >
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
              }}
            >
              Feedback Counts
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                fontSize: '0.8rem',
              }}
            >
              <div>Too Senior: {learnedPrefs?.tooSeniorCount ?? 0} times</div>
              <div>Too Junior: {learnedPrefs?.tooJuniorCount ?? 0} times</div>
              {learnedPrefs?.feedbackCounts &&
                Object.entries(learnedPrefs.feedbackCounts).map(([type, cnt]) => (
                  <div key={type} style={{ color: 'var(--text-secondary)' }}>
                    {type.replace('_', ' ')}: {cnt}
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: '1rem',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
          }}
        >
          Note: Inferred preferences alter match ranking weights dynamically. They never override
          explicit candidate settings or hard policy checks.
        </div>
      </div>
    </div>
  );
};
