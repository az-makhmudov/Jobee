import { useFeedback } from '../ui/Feedback.js';
import { DocumentPreview } from './DocumentPreview.js';
import { Button, Card, Icon, Input, ModalSurface, Select } from '../ui/Primitives.js';
import { useState, useEffect } from 'react';
import { candidateApi } from '../api/candidate-client.js';
import { SmartProfileImportModal } from './SmartProfileImportModal.js';
import type { CandidateDocumentDto, DocumentType } from '@job-agent/shared';

interface Props {
  onUpdate?: () => void;
}

export function DocumentsView({ onUpdate }: Props) {
  const { confirm } = useFeedback();
  const [previewId, setPreviewId] = useState<string | null>(null);
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
    if (!(await confirm(`Are you sure you want to delete "${name}"?`))) return;
    try {
      await candidateApi.deleteDocument(id);
      showToast('ok', 'Document deleted');
      if (previewId === id) setPreviewId(null);
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
        <h2 className="page-title">CV & Documents</h2>
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
              toast.type === 'error'
                ? 'var(--status-danger-container)'
                : 'var(--status-success-container)',
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
        <div style={{ display: 'flex', gap: '0.5rem' }} className="layout-group">
          <Button className="btn btn-secondary btn-sm" onClick={() => setIsSmartImportOpen(true)}>
            <Icon name="ai" /> Smart Import & Extract
          </Button>
          <Button className="btn btn-primary btn-sm" onClick={() => setShowUploadModal(true)}>
            + Upload Document
          </Button>
        </div>
      </div>

      {loading && documents.length === 0 ? (
        <Card className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          Loading documents...
        </Card>
      ) : documents.length === 0 ? (
        <Card className="card placeholder-view">
          <h3>No Documents Uploaded</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Upload your Master CV to establish the baseline for tailored application generation.
          </p>
          <Button
            className="btn btn-primary"
            style={{ marginTop: '1rem' }}
            onClick={() => setShowUploadModal(true)}
          >
            Upload Master CV
          </Button>
        </Card>
      ) : (
        <div className="document-workspace">
          <div className="document-list" aria-label="Uploaded documents">
            <h2 className="card-title">Uploaded Documents</h2>
            <p className="page-subtitle">{documents.length} files · Select a file to preview</p>
            {documents.map((doc) => (
              <Card key={doc.id} className={previewId === doc.id ? 'document-selected' : ''}>
                <Button
                  className="btn-ghost document-select"
                  aria-pressed={previewId === doc.id}
                  onClick={() => setPreviewId(doc.id)}
                >
                  <Icon
                    name={doc.documentType === 'COVER_LETTER_TEMPLATE' ? 'letter' : 'document'}
                  />
                  <strong>{doc.displayName || doc.originalFilename}</strong>
                </Button>
                <p className="page-subtitle">{doc.originalFilename}</p>
                <span className="nav-tag">
                  {doc.isMaster ? 'Master CV' : doc.documentType.replaceAll('_', ' ')}
                </span>
                <p className="page-subtitle">
                  {doc.roleFocus || 'All roles'} · v{doc.version}
                  <br />
                  {formatFileSize(doc.sizeBytes)} · Uploaded{' '}
                  {new Date(doc.createdAt).toLocaleDateString()}
                </p>
                <div className="account-actions">
                  <a
                    className="btn btn-ghost btn-sm"
                    href={candidateApi.getDocumentDownloadUrl(doc.id)}
                    download
                  >
                    Download
                  </a>
                  <Button
                    className="btn-danger btn-sm"
                    onClick={() => handleDelete(doc.id, doc.displayName || doc.originalFilename)}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          {previewId && documents.find((doc) => doc.id === previewId) ? (
            <DocumentPreview
              key={previewId}
              document={documents.find((doc) => doc.id === previewId)!}
              onClose={() => setPreviewId(null)}
            />
          ) : (
            <Card className="document-placeholder">
              <Icon name="document" size={40} />
              <h3>View your uploaded documents</h3>
              <p className="page-subtitle">
                Select a document to read it here. Your original files stay unchanged.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <ModalSurface className="modal-backdrop">
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
              <Button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowUploadModal(false)}
                aria-label="Close"
              >
                <Icon name="close" size={20} />
              </Button>
            </div>

            <form onSubmit={handleUpload}>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Select File (PDF, DOCX, TXT - max 10MB)</label>
                  <Input
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
                  <Select
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
                  </Select>
                </div>

                <div className="form-group">
                  <label className="form-label">Display Name / Title</label>
                  <Input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Master Engineering CV 2026"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role Focus (Optional)</label>
                  <Input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Staff Full-Stack Engineer"
                    value={roleFocus}
                    onChange={(e) => setRoleFocus(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Version</label>
                  <Input
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
                    <Input
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
                className="layout-group"
              >
                <Button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="btn btn-primary"
                  disabled={uploading || !selectedFile}
                >
                  {uploading ? 'Uploading...' : 'Upload Document'}
                </Button>
              </div>
            </form>
          </div>
        </ModalSurface>
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
