import type {
  ProfileImportSessionDto,
  ProfileImportItemDto,
  ProfileImportReviewStatus,
  CommitImportSessionOptions,
  CommitImportSessionResult,
} from '@job-agent/shared';

const API_BASE = '/api';

export const candidateImportApi = {
  /**
   * Upload CV or LinkedIn export document
   */
  async upload(formData: FormData): Promise<ProfileImportSessionDto> {
    const res = await fetch(`${API_BASE}/candidate/import/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || 'Failed to upload document for import');
    }
    const data = await res.json();
    return data.data;
  },

  /**
   * Trigger text extraction and Candidate Brain comparison
   */
  async extractAndCompare(sessionId: string, aiConsent: boolean): Promise<ProfileImportSessionDto> {
    const res = await fetch(`${API_BASE}/candidate/import/${sessionId}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiConsent }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.error?.message || err.message || 'Failed to extract document information',
      );
    }
    const data = await res.json();
    return data.data;
  },

  /**
   * Get session details and items
   */
  async getSession(sessionId: string): Promise<ProfileImportSessionDto> {
    const res = await fetch(`${API_BASE}/candidate/import/${sessionId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || 'Failed to load import session');
    }
    const data = await res.json();
    return data.data;
  },

  /**
   * List recent sessions
   */
  async listSessions(): Promise<ProfileImportSessionDto[]> {
    const res = await fetch(`${API_BASE}/candidate/import`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || 'Failed to list import sessions');
    }
    const data = await res.json();
    return data.data;
  },

  /**
   * Update an individual item's review status or edited payload
   */
  async updateItem(
    sessionId: string,
    itemId: string,
    action: ProfileImportReviewStatus,
    userEditedPayload?: Record<string, unknown>,
  ): Promise<ProfileImportItemDto> {
    const res = await fetch(`${API_BASE}/candidate/import/${sessionId}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userEditedPayload }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || 'Failed to update review item');
    }
    const data = await res.json();
    return data.data;
  },

  /**
   * Bulk update items (e.g. approve all new)
   */
  async bulkUpdateItems(
    sessionId: string,
    action: 'APPROVE_ALL_NEW' | 'APPROVE_ALL' | 'REJECT_ALL',
  ): Promise<{ updatedCount: number }> {
    const res = await fetch(`${API_BASE}/candidate/import/${sessionId}/items/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || 'Failed to bulk update items');
    }
    const data = await res.json();
    return data.data;
  },

  /**
   * Commit approved items into Candidate Brain
   */
  async commitSession(
    sessionId: string,
    options: CommitImportSessionOptions = {},
  ): Promise<CommitImportSessionResult> {
    const res = await fetch(`${API_BASE}/candidate/import/${sessionId}/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.error?.message || err.message || 'Failed to commit import to Candidate Brain',
      );
    }
    const data = await res.json();
    return data.data;
  },

  /**
   * Discard import session
   */
  async discardSession(sessionId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/candidate/import/${sessionId}/discard`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || 'Failed to discard import session');
    }
  },

  /**
   * Get official LinkedIn integration status & instructions
   */
  async getLinkedInStatus(): Promise<{
    configured: boolean;
    oauthAvailable: boolean;
    recommendedMethod: string;
    instructions: string;
    howToExport: string[];
  }> {
    const res = await fetch(`${API_BASE}/candidate/linkedin/status`);
    if (!res.ok) {
      return {
        configured: false,
        oauthAvailable: false,
        recommendedMethod: 'PDF_EXPORT',
        instructions: 'Export your profile to PDF from LinkedIn web browser.',
        howToExport: [
          '1. Go to LinkedIn profile',
          '2. Click "More"',
          '3. Click "Save to PDF"',
          '4. Upload PDF to Jobee',
        ],
      };
    }
    const data = await res.json();
    return data.data;
  },
};
