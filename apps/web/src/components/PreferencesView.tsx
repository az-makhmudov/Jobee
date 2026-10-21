import { AutopilotSettings } from './AutopilotSettings.js';
import { Button, Card, Icon, Input, Select } from '../ui/Primitives.js';
import { useState, useEffect } from 'react';
import { candidateApi } from '../api/candidate-client.js';
import type { JobPreferencesDto, ApplicationPolicyDto } from '@job-agent/shared';

interface Props {
  onUpdate?: () => void;
}

export function PreferencesView({ onUpdate }: Props) {
  const [preferences, setPreferences] = useState<JobPreferencesDto | null>(null);
  const [policy, setPolicy] = useState<ApplicationPolicyDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);

  // Policy local form state
  const [autoApply, setAutoApply] = useState(false);
  const [reviewScore, setReviewScore] = useState(70);
  const [autoScore, setAutoScore] = useState(85);
  const [maxPerDay, setMaxPerDay] = useState(10);
  const [blockReview, setBlockReview] = useState(true);
  const [blockManual, setBlockManual] = useState(true);
  const [blockSensitive, setBlockSensitive] = useState(true);

  // Preference form state
  const [targetTitles, setTargetTitles] = useState('');
  const [locations, setLocations] = useState('');
  const [workModes, setWorkModes] = useState<string[]>([]);
  const [minSalary, setMinSalary] = useState<string>('');
  const [maxSalary, setMaxSalary] = useState<string>('');
  const [currency, setCurrency] = useState('USD');
  const [salaryPayPeriod, setSalaryPayPeriod] =
    useState<JobPreferencesDto['salaryPayPeriod']>(null);
  const [sponsorship, setSponsorship] = useState<string>('unspecified');
  const [relocate, setRelocate] = useState<string>('unspecified');
  const [excludedCompanies, setExcludedCompanies] = useState('');
  const [excludedKeywords, setExcludedKeywords] = useState('');
  const [employmentTypes, setEmploymentTypes] = useState<string[]>([]);
  const [seniorityLevels, setSeniorityLevels] = useState<string[]>([]);
  const [authorizationCountries, setAuthorizationCountries] = useState('');
  const [internshipEligible, setInternshipEligible] = useState('unspecified');
  const [availability, setAvailability] = useState('');
  const [preferredLanguages, setPreferredLanguages] = useState('');
  const [acceptUnpaid, setAcceptUnpaid] = useState(false);

  const showToast = (type: 'ok' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [prefsRes, policyRes] = await Promise.all([
        candidateApi.getPreferences(),
        candidateApi.getPolicy(),
      ]);

      if (prefsRes) {
        setPreferences(prefsRes);
        setTargetTitles(prefsRes.targetTitles?.join(', ') || '');
        setLocations(prefsRes.preferredLocations?.join(', ') || '');
        setWorkModes(prefsRes.workModes || []);
        setEmploymentTypes(prefsRes.employmentTypes || []);
        setSeniorityLevels(prefsRes.seniorityLevels || []);
        setAuthorizationCountries(prefsRes.workAuthorizationCountries?.join(', ') || '');
        setInternshipEligible(
          prefsRes.internshipEligible === true
            ? 'yes'
            : prefsRes.internshipEligible === false
              ? 'no'
              : 'unspecified',
        );
        setAvailability(prefsRes.availability || '');
        setPreferredLanguages(prefsRes.preferredLanguages?.join(', ') || '');
        setAcceptUnpaid(prefsRes.acceptUnpaid);
        setMinSalary(prefsRes.minSalary !== null ? String(prefsRes.minSalary) : '');
        setMaxSalary(prefsRes.maxSalary !== null ? String(prefsRes.maxSalary) : '');
        setCurrency(prefsRes.currency || 'USD');
        setSalaryPayPeriod(prefsRes.salaryPayPeriod ?? null);
        setSponsorship(
          prefsRes.needsSponsorship === true
            ? 'yes'
            : prefsRes.needsSponsorship === false
              ? 'no'
              : 'unspecified',
        );
        setRelocate(
          prefsRes.willingToRelocate === true
            ? 'yes'
            : prefsRes.willingToRelocate === false
              ? 'no'
              : 'unspecified',
        );
        setExcludedCompanies(prefsRes.excludedCompanies?.join(', ') || '');
        setExcludedKeywords(prefsRes.excludedKeywords?.join(', ') || '');
      }

      if (policyRes) {
        setPolicy(policyRes);
        setAutoApply(policyRes.autoApplyEnabled);
        setReviewScore(policyRes.minScoreForReview);
        setAutoScore(policyRes.autoApplyMinScore);
        setMaxPerDay(policyRes.maxApplicationsPerDay);
        setBlockReview(policyRes.blockOnUnresolvedReview);
        setBlockManual(policyRes.blockOnManual);
        setBlockSensitive(policyRes.blockOnUnknownSensitive);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePreferencesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPreferences || loading || loadError) return;
    setSavingPreferences(true);
    try {
      const data: Partial<JobPreferencesDto> = {
        targetTitles: targetTitles
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        preferredLocations: locations
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        workModes,
        employmentTypes: employmentTypes.filter(Boolean),
        seniorityLevels: seniorityLevels.filter(Boolean),
        workAuthorizationCountries: authorizationCountries
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        internshipEligible:
          internshipEligible === 'yes' ? true : internshipEligible === 'no' ? false : null,
        availability: availability.trim() || null,
        preferredLanguages: preferredLanguages
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        acceptUnpaid,
        minSalary: minSalary ? Number(minSalary) : null,
        maxSalary: maxSalary ? Number(maxSalary) : null,
        currency,
        salaryPayPeriod,
        needsSponsorship: sponsorship === 'yes' ? true : sponsorship === 'no' ? false : null,
        willingToRelocate: relocate === 'yes' ? true : relocate === 'no' ? false : null,
        excludedCompanies: excludedCompanies
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        excludedKeywords: excludedKeywords
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const updated = await candidateApi.updatePreferences(data);
      setPreferences(updated);
      showToast('ok', 'Job search preferences saved');
      onUpdate?.();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSavingPreferences(false);
    }
  };

  const handlePolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPolicy || loading || loadError) return;
    setSavingPolicy(true);
    try {
      const data: Partial<ApplicationPolicyDto> = {
        autoApplyEnabled: autoApply,
        minScoreForReview: reviewScore,
        autoApplyMinScore: autoScore,
        maxApplicationsPerDay: maxPerDay,
        blockOnUnresolvedReview: blockReview,
        blockOnManual: blockManual,
        blockOnUnknownSensitive: blockSensitive,
      };

      const updated = await candidateApi.updatePolicy(data);
      setPolicy(updated);
      showToast('ok', 'Application safety policy saved');
      onUpdate?.();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save policy');
    } finally {
      setSavingPolicy(false);
    }
  };

  const toggleWorkMode = (mode: string) => {
    if (workModes.includes(mode)) {
      setWorkModes(workModes.filter((m) => m !== mode));
    } else {
      setWorkModes([...workModes, mode]);
    }
  };

  if (loading) return <Card role="status">Loading your preferences…</Card>;
  if (loadError)
    return (
      <Card role="alert">
        <h2>Could not load your preferences</h2>
        <p>{loadError}</p>
        <Button onClick={loadData}>Retry preferences</Button>
      </Card>
    );

  return (
    <div>
      <header className="page-header">
        <h2 className="page-title">Preferences</h2>
        <p className="page-subtitle">Choose the jobs you want and confirm what Jobee may use.</p>
      </header>

      {toast && (
        <div
          className={`info-banner ${toast.type === 'error' ? 'error' : ''}`}
          style={{
            borderColor: toast.type === 'error' ? 'var(--danger)' : 'var(--success)',
            backgroundColor:
              toast.type === 'error'
                ? 'var(--status-danger-container)'
                : 'var(--status-success-container)',
          }}
        >
          <span>{toast.message}</span>
        </div>
      )}

      {loading && !policy ? (
        <Card className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          Loading preferences...
        </Card>
      ) : null}

      {/* SECTION 2: JOB SEARCH PREFERENCES */}
      <Card className="card">
        <div className="card-title">Job preferences</div>
        <p
          style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}
        >
          Choose your roles and working arrangements, and add eligibility information you know.
        </p>

        <form aria-label="Job preferences" onSubmit={handlePreferencesSubmit}>
          <div className="form-grid candidate-preferences-grid">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Target Job Titles (comma-separated)</label>
              <Input
                type="text"
                className="form-input"
                placeholder="Senior Full Stack Engineer, Staff Software Engineer, Platform Architect"
                value={targetTitles}
                onChange={(e) => setTargetTitles(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Preferred Locations (comma-separated)</label>
              <Input
                type="text"
                className="form-input"
                placeholder="Berlin, London, Remote EU, Remote Worldwide"
                value={locations}
                onChange={(e) => setLocations(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Work Modes</label>
              <div
                style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.4rem' }}
                className="layout-group"
              >
                {['REMOTE', 'HYBRID', 'ONSITE'].map((mode) => (
                  <label
                    key={mode}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Input
                      type="checkbox"
                      checked={workModes.includes(mode)}
                      onChange={() => toggleWorkMode(mode)}
                    />
                    <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {mode === 'REMOTE' ? 'Remote' : mode === 'HYBRID' ? 'Hybrid' : 'On-site'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Minimum Base Salary</label>
              <Input
                type="number"
                className="form-input"
                placeholder="e.g. 120000"
                value={minSalary}
                onChange={(e) => setMinSalary(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Salary period</label>
              <Select
                value={salaryPayPeriod ?? ''}
                onChange={(e) =>
                  setSalaryPayPeriod(
                    (e.target.value || null) as JobPreferencesDto['salaryPayPeriod'],
                  )
                }
              >
                <option value="">Not specified</option>
                <option value="YEAR">Per year</option>
                <option value="MONTH">Per month</option>
                <option value="WEEK">Per week</option>
                <option value="DAY">Per day</option>
                <option value="HOUR">Per hour</option>
              </Select>
              <p className="field-help">
                Salary comparisons require a matching currency and pay period.
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <Select
                className="form-input"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CHF">CHF (CHF)</option>
                <option value="CAD">CAD ($)</option>
                <option value="PLN">PLN (zł)</option>
                {!['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'PLN'].includes(currency) && (
                  <option value={currency}>{currency}</option>
                )}
              </Select>
            </div>

            <div className="form-group">
              <label className="form-label">Maximum Base Salary (optional)</label>
              <Input
                type="number"
                min="1"
                className="form-input"
                value={maxSalary}
                onChange={(e) => setMaxSalary(e.target.value)}
              />
            </div>
            <fieldset
              className="form-group"
              style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            >
              <legend className="form-label">Employment types</legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {[
                  ['FULL_TIME', 'Full-time'],
                  ['PART_TIME', 'Part-time'],
                  ['CONTRACT', 'Contract'],
                  ['INTERNSHIP', 'Internship'],
                  ['TEMPORARY', 'Temporary'],
                  ['APPRENTICESHIP', 'Apprenticeship'],
                  ['VOLUNTEER', 'Volunteer'],
                  ['OTHER', 'Other'],
                ].map(([value, label]) => (
                  <label key={value}>
                    <Input
                      type="checkbox"
                      checked={employmentTypes.includes(value!)}
                      onChange={(e) =>
                        setEmploymentTypes(
                          e.target.checked
                            ? [...employmentTypes, value!]
                            : employmentTypes.filter((item) => item !== value),
                        )
                      }
                    />{' '}
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset
              className="form-group"
              style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            >
              <legend className="form-label">Seniority levels</legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {[
                  ['INTERNSHIP', 'Intern'],
                  ['ENTRY', 'Entry level'],
                  ['JUNIOR', 'Junior'],
                  ['MID', 'Mid-level'],
                  ['SENIOR', 'Senior'],
                  ['LEAD', 'Lead'],
                  ['MANAGER', 'Manager'],
                  ['DIRECTOR', 'Director'],
                  ['EXECUTIVE', 'Executive'],
                ].map(([value, label]) => (
                  <label key={value}>
                    <Input
                      type="checkbox"
                      checked={seniorityLevels.includes(value!)}
                      onChange={(e) =>
                        setSeniorityLevels(
                          e.target.checked
                            ? [...seniorityLevels, value!]
                            : seniorityLevels.filter((item) => item !== value),
                        )
                      }
                    />{' '}
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="form-group">
              <label className="form-label">Countries Where You Are Authorized to Work</label>
              <Input
                className="form-input"
                value={authorizationCountries}
                onChange={(e) => setAuthorizationCountries(e.target.value)}
                placeholder="Enter confirmed countries, separated by commas"
              />
              <span className="text-muted">
                Leave blank if unknown. Your location and citizenship are not inferred. Legal
                declarations still require appropriate approval.
              </span>
            </div>
            <div className="form-group">
              <label className="form-label">Internship Eligibility</label>
              <Select
                className="form-input"
                value={internshipEligible}
                onChange={(e) => setInternshipEligible(e.target.value)}
              >
                <option value="unspecified">Not specified</option>
                <option value="yes">Eligible</option>
                <option value="no">Not eligible</option>
              </Select>
            </div>
            <div className="form-group">
              <label className="form-label">Availability or Notice Period</label>
              <Input
                className="form-input"
                maxLength={200}
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                placeholder="Your confirmed availability, or leave blank"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Preferred Languages (comma-separated)</label>
              <Input
                className="form-input"
                value={preferredLanguages}
                onChange={(e) => setPreferredLanguages(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>
                <Input
                  type="checkbox"
                  checked={acceptUnpaid}
                  onChange={(e) => setAcceptUnpaid(e.target.checked)}
                />{' '}
                Consider unpaid positions
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">Requires Visa Sponsorship</label>
              <Select
                className="form-input"
                value={sponsorship}
                onChange={(e) => setSponsorship(e.target.value)}
              >
                <option value="unspecified">Not Specified</option>
                <option value="yes">Yes (Requires Sponsorship)</option>
                <option value="no">No sponsorship needed</option>
              </Select>
            </div>

            <div className="form-group">
              <label className="form-label">Willing to Relocate</label>
              <Select
                className="form-input"
                value={relocate}
                onChange={(e) => setRelocate(e.target.value)}
              >
                <option value="unspecified">Not Specified</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Select>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Excluded Companies (Blacklist - comma-separated)</label>
              <Input
                type="text"
                className="form-input"
                placeholder="Company A, Agency B"
                value={excludedCompanies}
                onChange={(e) => setExcludedCompanies(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">
                Excluded Keywords (Ignore jobs containing - comma-separated)
              </label>
              <Input
                type="text"
                className="form-input"
                placeholder="gambling, clearance required, unpaid"
                value={excludedKeywords}
                onChange={(e) => setExcludedKeywords(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" className="btn btn-primary" disabled={savingPreferences}>
              {savingPreferences ? 'Saving preferences…' : 'Save Job Preferences'}
            </Button>
          </div>
        </form>
      </Card>
      <details className="advanced-details">
        <summary>Application permissions & safety settings</summary>
        <p>
          Saving search preferences does not enable automatic submission. Change submission
          permissions separately below.
        </p>
        <AutopilotSettings key={(policy?.updatedAt || '') + (preferences?.updatedAt || '')} />
        {/* SECTION 1: APPLICATION SAFETY & POLICY */}
        <Card className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <div className="card-title">Application Safety & Policy Guardrails</div>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
            }}
          >
            <strong>Core Principle:</strong> Rules authorize. Humans handle uncertainty.
            Auto-applying is strictly restricted.
          </p>

          {autoApply && (
            <div
              style={{
                backgroundColor: 'var(--status-danger-container)',
                border: '1px solid var(--status-danger-border)',
                padding: '1rem',
                borderRadius: '16px',
                marginBottom: '1.5rem',
              }}
            >
              <div
                style={{
                  color: 'var(--danger)',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  marginBottom: '0.25rem',
                }}
              >
                <Icon name="warning" /> Legacy automation flag is enabled
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--status-danger)' }}>
                This compatibility flag does not authorize submission. Use the explicit Autopilot
                policy above. Changing these limits can invalidate an accepted policy.
              </p>
            </div>
          )}

          <form aria-label="Application safety policy" onSubmit={handlePolicySubmit}>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  <Input
                    type="checkbox"
                    checked={autoApply}
                    onChange={(e) => setAutoApply(e.target.checked)}
                    style={{ width: '1.1rem', height: '1.1rem' }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '1rem' }}>
                      Legacy automation compatibility flag
                    </span>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Disabled by default. This flag alone grants no submission permission.
                    </div>
                  </div>
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Min Match Score for Human Review ({reviewScore}%)
                </label>
                <Input
                  type="range"
                  min="0"
                  max="100"
                  value={reviewScore}
                  onChange={(e) => setReviewScore(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Jobs scoring at or above {reviewScore}% are queued for review.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Min Match Score to Auto-Apply ({autoScore}%)</label>
                <Input
                  type="range"
                  min="0"
                  max="100"
                  value={autoScore}
                  onChange={(e) => setAutoScore(Number(e.target.value))}
                  disabled={!autoApply}
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Only jobs scoring at or above {autoScore}% may be auto-applied.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Max Applications Per Day</label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  className="form-input"
                  value={maxPerDay}
                  onChange={(e) => setMaxPerDay(Number(e.target.value))}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Safety rate-limit to prevent spamming application portals.
                </span>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Deterministic Safety Interlocks
                </div>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                  className="layout-group"
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Input
                      type="checkbox"
                      checked={blockReview}
                      onChange={(e) => setBlockReview(e.target.checked)}
                    />
                    <span style={{ fontSize: '0.85rem' }}>
                      Block submission if any question has unresolved review state
                    </span>
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Input
                      type="checkbox"
                      checked={blockManual}
                      onChange={(e) => setBlockManual(e.target.checked)}
                    />
                    <span style={{ fontSize: '0.85rem' }}>
                      Block submission if any field requires MANUAL answer entry
                    </span>
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Input
                      type="checkbox"
                      checked={blockSensitive}
                      onChange={(e) => setBlockSensitive(e.target.checked)}
                    />
                    <span style={{ fontSize: '0.85rem' }}>
                      Block submission if sensitive candidate facts are missing or uncertain
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" className="btn btn-primary" disabled={savingPolicy}>
                {savingPolicy ? 'Saving policy…' : 'Save Safety Policy'}
              </Button>
            </div>
          </form>
        </Card>
      </details>
    </div>
  );
}
