import { useState, useEffect } from 'react';
import { candidateApi } from '../api/candidate-client.js';
import { SmartProfileImportModal } from './SmartProfileImportModal.js';
import type { CandidateDocumentDto, DocumentType } from '@job-agent/shared';

interface Props {
  onUpdate?: () => void;
}

export function DocumentsView({ onUpdate }: Props) {
  const [documents, setDocuments] = useState<CandidateDocumentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isSmartImportOpen, setIsSmartImportOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>('MASTER_CV');
  const [displayName, setDisplayName] = useState('');
  const [roleFocus, setRoleFocus] = useState('');
  const [version, setVersion] = useState('1.0');
  const [isMaster, setIsMaster] = useState(true);

  const showToast = (type: 'ok' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await candidateApi.getDocuments();
      setDocuments(docs);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('error', 'Please select a file to upload');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('documentType', docType);
      if (displayName) formData.append('displayName', displayName);
      if (roleFocus) formData.append('roleFocus', roleFocus);
      formData.append('version', version);
      formData.append('isMaster', String(isMaster || docType === 'MASTER_CV'));

      await candidateApi.uploadDocument(formData);
      showToast('ok', 'Document uploaded successfully');
      setShowUploadModal(false);
      setSelectedFile(null);
      setDisplayName('');
      setRoleFocus('');
      loadDocuments();
      onUpdate?.();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await candidateApi.deleteDocument(id);
      showToast('ok', 'Document deleted');
      loadDocuments();
      onUpdate?.();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Candidate Document Vault</h1>
        <p className="page-subtitle">
          Manage your Master CV, tailored role variants, cover letter templates, and credentials
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

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {documents.length} document{documents.length === 1 ? '' : 's'} stored securely
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setIsSmartImportOpen(true)}>
            ✨ Smart Import & Extract
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowUploadModal(true)}>
            + Upload Document
          </button>
        </div>
      </div>

      {loading && documents.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <div className="card placeholder-view">
          <h3>No Documents Uploaded</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Upload your Master CV to establish the baseline for tailored application generation.
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: '1rem' }}
            onClick={() => setShowUploadModal(true)}
          >
            Upload Master CV
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '0.9rem',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  borderBottom: '1px solid var(--surface-border)',
                }}
              >
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Document Name</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Role Focus</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Version</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Size</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Uploaded</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.4)' }}>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div
                      style={{
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      {doc.displayName || doc.originalFilename}
                      {doc.isMaster && (
                        <span
                          className="status-badge ok"
                          style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}
                        >
                          ★ Master CV
                        </span>
                      )}
                    </div>
                    {doc.displayName && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {doc.originalFilename}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span className="nav-tag">{doc.documentType}</span>
                  </td>
                  <td
                    style={{
                      padding: '0.85rem 1rem',
                      color: doc.roleFocus ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {doc.roleFocus || '—'}
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>v{doc.version}</td>
                  <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                    {formatFileSize(doc.sizeBytes)}
                  </td>
                  <td
                    style={{
                      padding: '0.85rem 1rem',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                    }}
                  >
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                      <a
                        href={candidateApi.getDocumentDownloadUrl(doc.id)}
                        className="btn btn-secondary btn-sm"
                        download
                        style={{ textDecoration: 'none' }}
                      >
                        Download
                      </a>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() =>
                          handleDelete(doc.id, doc.displayName || doc.originalFilename)
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
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
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Upload Candidate Document</h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowUploadModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpload}>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Select File (PDF, DOCX, TXT - max 10MB)</label>
                  <input
                    type="file"
                    required
                    className="form-input"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                        if (!displayName) {
                          setDisplayName(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                        }
                      }
                    }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Document Type</label>
                  <select
                    className="form-input"
                    value={docType}
                    onChange={(e) => {
                      const val = e.target.value as DocumentType;
                      setDocType(val);
                      if (val === 'MASTER_CV') setIsMaster(true);
                    }}
                  >
                    <option value="MASTER_CV">MASTER_CV (Baseline CV)</option>
                    <option value="ROLE_CV">ROLE_CV (Role-specific variant)</option>
                    <option value="COVER_LETTER_TEMPLATE">COVER_LETTER_TEMPLATE</option>
                    <option value="CERTIFICATE">CERTIFICATE</option>
                    <option value="PORTFOLIO">PORTFOLIO</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Display Name / Title</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Master Engineering CV 2026"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role Focus (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Staff Full-Stack Engineer"
                    value={roleFocus}
                    onChange={(e) => setRoleFocus(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Version</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="1.0"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
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
                      checked={isMaster}
                      onChange={(e) => setIsMaster(e.target.checked)}
                      disabled={docType === 'MASTER_CV'}
                    />
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Set as Master CV</span>
                  </label>
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      marginTop: '0.2rem',
                    }}
                  >
                    Setting as Master CV marks this document as the canonical reference for
                    applications.
                  </p>
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
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={uploading || !selectedFile}
                >
                  {uploading ? 'Uploading...' : 'Upload Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isSmartImportOpen && (
        <SmartProfileImportModal
          isOpen={isSmartImportOpen}
          onClose={() => setIsSmartImportOpen(false)}
          onSuccess={() => {
            loadDocuments();
            onUpdate?.();
          }}
        />
      )}
    </div>
  );
}
