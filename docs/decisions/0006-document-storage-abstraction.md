# ADR 0006: Local Document Storage Abstraction & Upload Security

## Status

Accepted

## Context

The Candidate Brain must store candidate resumes, role-tailored CV variants, cover letter templates, and credential artifacts. These files must be accessible for application generation and human review, but:

1. They must not require external cloud credentials (AWS S3, GCP Cloud Storage) during local development.
2. They must never be accidentally committed to Git.
3. They must be defended against arbitrary file upload attacks (path traversal, unbounded file sizes, malicious executables).
4. The architecture must allow future replacement with S3 or Cloudflare R2 without rewriting service or database logic.

## Decision

We implemented a pluggable storage provider abstraction with defensive upload controls:

1. **Storage Interface (`@job-agent/shared`)**:
   - `FileStorageProvider` contract defining `save`, `get`, `delete`, and `exists`.
2. **Local Implementation (`apps/api`)**:
   - `LocalStorageProvider` writes files to `./uploads/` relative to project root or configured directory.
   - Target files are stored under subdirectories based on entity IDs with UUID-based storage keys.
3. **Upload Constraints**:
   - Maximum size: 10 MB (`MAX_DOCUMENT_FILE_SIZE_BYTES`).
   - Strict MIME allowlist: PDF, DOCX, TXT (`ALLOWED_DOCUMENT_MIME_TYPES`). Structured code formats (JSON) and markdown are rejected.
   - Path Traversal Defense: Every access normalizes the requested path using `path.resolve` and verifies it resides within the storage root.
   - Integrity Checksum: Automatic SHA-256 calculation stored in `candidate_documents.sha256_checksum`.
4. **Git Hygiene**:
   - `uploads/` is added to `.gitignore`.

## Consequences

### Positive

- **Zero Third-Party Cloud Prerequisites**: Works immediately out of the box with zero external storage setup.
- **Provider Swappability**: Future transition to S3 or Cloudflare R2 requires only implementing `FileStorageProvider` and injecting it into `buildApp({ storage })`.
- **Security**: Strict type allowlists, size limits, and path normalization prevent remote code execution and directory traversal.
- **Auditability**: SHA-256 checksums verify file integrity and prevent unnoticed document corruption.

### Negative / Trade-offs

- Local disk storage is tied to the local filesystem. Horizontal scaling across multiple containers will require shared network storage or S3.
