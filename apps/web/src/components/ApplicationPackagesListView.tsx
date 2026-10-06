import { useState, useEffect } from 'react';
import { applicationPackageClient } from '../api/application-package-client.js';
import type { ApplicationPackageDto } from '@job-agent/shared';

interface Props {
  onOpenPackage: (packageId: string) => void;
  onNavigateToJobs: () => void;
  onNavigateToCrm?: () => void;
}

export function ApplicationPackagesListView({
  onOpenPackage,
  onNavigateToJobs,
  onNavigateToCrm,
}: Props) {
  const [packages, setPackages] = useState<ApplicationPackageDto[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPackages = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await applicationPackageClient.listPackages(
        statusFilter === 'ALL' ? undefined : { status: statusFilter },
      );
      setPackages(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application packages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, [statusFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header className="page-header" style={{ marginBottom: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h1 className="page-title">Application Studio Packages</h1>
            <p className="page-subtitle">
              Versioned, grounded application materials, tailored CVs, cover letters, and approval
              states.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {onNavigateToCrm && (
              <button className="btn btn-secondary" onClick={onNavigateToCrm}>
                📋 Switch to Application CRM Board
              </button>
            )}
            <button className="btn btn-primary" onClick={onNavigateToJobs}>
              + Prepare from Job Inbox
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          {['ALL', 'READY', 'NEEDS_REVIEW', 'DRAFT', 'SUBMITTED', 'ARCHIVED'].map((st) => (
            <button
              key={st}
              className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(st)}
            >
              {st}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading application packages...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <h3 style={{ color: 'var(--danger)' }}>Error Loading Packages</h3>
          <p style={{ marginTop: '0.5rem' }}>{error}</p>
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginTop: '1rem' }}
            onClick={loadPackages}
          >
            Retry
          </button>
        </div>
      ) : packages.length === 0 ? (
        <div className="card placeholder-view">
          <h3>No Application Packages Found</h3>
          <p
            style={{
              color: 'var(--text-secondary)',
              marginTop: '0.5rem',
              maxWidth: '480px',
              margin: '0.5rem auto 1.5rem',
            }}
          >
            {statusFilter === 'ALL'
              ? 'You have not prepared any job applications yet. Go to the Job Inbox, choose an analyzed job, and select "Prepare Application".'
              : `No application packages matching status "${statusFilter}".`}
          </p>
          <button className="btn btn-primary" onClick={onNavigateToJobs}>
            Explore Job Inbox →
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {packages.map((pkg) => (
            <div key={pkg.id} className="card" style={{ padding: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      marginBottom: '0.35rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      className={`status-badge ${
                        pkg.status === 'READY'
                          ? 'ok'
                          : pkg.status === 'NEEDS_REVIEW'
                            ? 'degraded'
                            : 'disconnected'
                      }`}
                      style={{ fontSize: '0.75rem' }}
                    >
                      {pkg.status}
                    </span>
                    <span className="nav-tag" style={{ fontSize: '0.75rem' }}>
                      Version {pkg.currentVersionNumber}
                    </span>
                    {pkg.isStale && (
                      <span className="status-badge error" style={{ fontSize: '0.75rem' }}>
                        STALE INPUTS
                      </span>
                    )}
                    {pkg.hasPolicyBlocker && !pkg.blockerOverridden && (
                      <span className="status-badge error" style={{ fontSize: '0.75rem' }}>
                        POLICY BLOCKER
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: '0.2rem 0' }}>
                    {pkg.jobTitle}
                  </h3>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                    <strong>{pkg.jobCompany}</strong>
                    {pkg.matchScore !== null && (
                      <span>
                        {' '}
                        • Match: <strong>{pkg.matchScore}%</strong> ({pkg.matchDecision})
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button className="btn btn-primary" onClick={() => onOpenPackage(pkg.id)}>
                    Open Application Studio ↗
                  </button>
                </div>
              </div>

              <div
                style={{
                  marginTop: '0.85rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--surface-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  Created: {new Date(pkg.createdAt).toLocaleDateString()} • Updated:{' '}
                  {new Date(pkg.updatedAt).toLocaleDateString()}
                </div>
                <div>
                  Package ID: <code>{pkg.id.slice(0, 8)}</code>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
