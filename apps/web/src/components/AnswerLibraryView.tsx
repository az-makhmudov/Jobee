import { useState, useEffect } from 'react';
import { candidateApi } from '../api/candidate-client.js';
import type { AnswerLibraryEntryDto, AutomationLevel } from '@job-agent/shared';

interface Props {
  onUpdate?: () => void;
}

export function AnswerLibraryView({ onUpdate }: Props) {
  const [answers, setAnswers] = useState<AnswerLibraryEntryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [activeItem, setActiveItem] = useState<AnswerLibraryEntryDto | null>(null);

  const showToast = (type: 'ok' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAnswers = async () => {
    setLoading(true);
    try {
      const data = await candidateApi.getAnswers();
      setAnswers(data);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load answers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnswers();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this answer?')) return;
    try {
      await candidateApi.deleteAnswer(id);
      showToast('ok', 'Answer removed');
      loadAnswers();
      onUpdate?.();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const filteredAnswers = answers.filter((a) => {
    if (categoryFilter !== 'ALL' && a.category !== categoryFilter) return false;
    if (levelFilter !== 'ALL' && a.automationLevel !== levelFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchQ = a.question.toLowerCase().includes(query);
      const matchA = a.answer.toLowerCase().includes(query);
      if (!matchQ && !matchA) return false;
    }
    return true;
  });

  const categories = [
    'ALL',
    'GENERAL',
    'WORK_AUTHORIZATION',
    'SALARY',
    'RELOCATION',
    'TECHNICAL',
    'BEHAVIORAL',
    'NOTICE_PERIOD',
    'DIVERSITY',
    'OTHER',
  ];

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Reusable Answer Library</h1>
        <p className="page-subtitle">
          Curated, verified answers for application screening questions with deterministic
          automation rules
        </p>
      </header>

      {toast && (
        <div
          className={`info-banner ${toast.type === 'error' ? 'error' : ''}`}
          style={{
            borderColor: toast.type === 'error' ? 'var(--danger)' : 'var(--success)',
            backgroundColor:
              toast.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          }}
        >
          <span>{toast.message}</span>
        </div>
      )}

      {/* Filter and Action Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search questions or answers..."
              style={{ width: '240px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <select
              className="form-input"
              style={{ width: '180px' }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'All Categories' : c.replace('_', ' ')}
                </option>
              ))}
            </select>

            <select
              className="form-input"
              style={{ width: '160px' }}
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
            >
              <option value="ALL">All Automation</option>
              <option value="AUTO">AUTO (Pre-authorized)</option>
              <option value="REVIEW">REVIEW (Pre-fill & Verify)</option>
              <option value="MANUAL">MANUAL (Candidate Prompt)</option>
            </select>
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setActiveItem(null);
              setModalMode('create');
            }}
          >
            + Add Answer
          </button>
        </div>
      </div>

      {loading && answers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          Loading answers...
        </div>
      ) : filteredAnswers.length === 0 ? (
        <div className="card placeholder-view">
          <h3>No Matching Answers Found</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {answers.length === 0
              ? 'Start building your library with standard screening questions like work authorization or salary expectations.'
              : 'Try clearing your search filters to see all stored answers.'}
          </p>
          {answers.length === 0 && (
            <button
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
              onClick={() => {
                setActiveItem(null);
                setModalMode('create');
              }}
            >
              Add First Answer
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredAnswers.map((ans) => {
            const levelBadge =
              ans.automationLevel === 'AUTO'
                ? { label: 'AUTO', cls: 'ok' }
                : ans.automationLevel === 'REVIEW'
                  ? { label: 'REVIEW', cls: 'degraded' }
                  : { label: 'MANUAL', cls: 'unconfigured' };

            return (
              <div key={ans.id} className="card" style={{ marginBottom: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ flex: 1, marginRight: '1rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.4rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span className="nav-tag">{ans.category}</span>
                      <span
                        className={`status-badge ${levelBadge.cls}`}
                        style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem' }}
                      >
                        {levelBadge.label}
                      </span>
                      {ans.isSensitive && (
                        <span
                          className="status-badge error"
                          style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem' }}
                        >
                          ⚠ Sensitive
                        </span>
                      )}
                    </div>
                    <h3
                      style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}
                    >
                      {ans.question}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setActiveItem(ans);
                        setModalMode('edit');
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(ans.id)}>
                      Delete
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    padding: '0.85rem 1rem',
                    borderRadius: '4px',
                    border: '1px solid var(--surface-border)',
                    marginTop: '0.75rem',
                    fontSize: '0.9rem',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {ans.answer}
                </div>

                {ans.notes && (
                  <p
                    style={{
                      marginTop: '0.5rem',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <em>Notes: {ans.notes}</em>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalMode && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                {modalMode === 'create' ? 'Add Reusable Answer' : 'Edit Reusable Answer'}
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setModalMode(null);
                  setActiveItem(null);
                }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const data: any = {
                  question: form.get('question') as string,
                  category: form.get('category') as string,
                  answer: form.get('answer') as string,
                  notes: (form.get('notes') as string) || null,
                  automationLevel: form.get('automationLevel') as AutomationLevel,
                  isSensitive: form.get('isSensitive') === 'on',
                };

                try {
                  if (modalMode === 'create') {
                    await candidateApi.createAnswer(data);
                  } else if (activeItem) {
                    await candidateApi.updateAnswer(activeItem.id, data);
                  }
                  showToast('ok', 'Answer saved successfully');
                  setModalMode(null);
                  setActiveItem(null);
                  loadAnswers();
                  onUpdate?.();
                } catch (err) {
                  showToast('error', err instanceof Error ? err.message : 'Save failed');
                }
              }}
            >
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Question / Application Prompt</label>
                  <input
                    name="question"
                    defaultValue={activeItem?.question || ''}
                    placeholder="e.g. Are you legally authorized to work in the United States?"
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    name="category"
                    defaultValue={activeItem?.category || 'GENERAL'}
                    className="form-input"
                  >
                    <option value="GENERAL">GENERAL</option>
                    <option value="WORK_AUTHORIZATION">WORK_AUTHORIZATION</option>
                    <option value="SALARY">SALARY</option>
                    <option value="RELOCATION">RELOCATION</option>
                    <option value="TECHNICAL">TECHNICAL</option>
                    <option value="BEHAVIORAL">BEHAVIORAL</option>
                    <option value="NOTICE_PERIOD">NOTICE_PERIOD</option>
                    <option value="DIVERSITY">DIVERSITY</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Automation Level</label>
                  <select
                    name="automationLevel"
                    defaultValue={activeItem?.automationLevel || 'REVIEW'}
                    className="form-input"
                  >
                    <option value="REVIEW">REVIEW (Pre-fill, human confirms)</option>
                    <option value="AUTO">AUTO (Safe for automatic submit)</option>
                    <option value="MANUAL">MANUAL (Prompt candidate each time)</option>
                  </select>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Approved Answer Text</label>
                  <textarea
                    name="answer"
                    defaultValue={activeItem?.answer || ''}
                    placeholder="Exact response to submit..."
                    required
                    rows={4}
                    className="form-textarea"
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
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
                      name="isSensitive"
                      defaultChecked={activeItem?.isSensitive || false}
                    />
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                      Contains Sensitive Personal Information (Salary, Legal, Health, Diversity)
                    </span>
                  </label>
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      marginTop: '0.2rem',
                    }}
                  >
                    Sensitive answers require manual verification and cannot be auto-submitted
                    blindly.
                  </p>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Internal Notes / Context</label>
                  <input
                    name="notes"
                    defaultValue={activeItem?.notes || ''}
                    placeholder="Optional notes regarding when to use this answer..."
                    className="form-input"
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: '1.5rem',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.5rem',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setModalMode(null);
                    setActiveItem(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Answer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
