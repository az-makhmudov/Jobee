import type {
  ApplicationPackageDto,
  ApplicationPackageVersionDto,
  ApplicationArtifactDto,
  ApplicationQuestionDto,
  ApprovalRequestDto,
  ApplicationStudioMetricsDto,
  PackageReadinessResult,
  QuestionCategory,
  QuestionType,
} from '@job-agent/shared';

const API_BASE = '/api';

export interface PackageDetailResponse {
  package: ApplicationPackageDto;
  currentVersion: ApplicationPackageVersionDto | null;
  artifacts: ApplicationArtifactDto[];
  questions: ApplicationQuestionDto[];
  approvals: ApprovalRequestDto[];
  readiness: PackageReadinessResult;
}

export const applicationPackageClient = {
  async createPackage(
    jobId: string,
    manualBaseDocumentId?: string | null,
  ): Promise<{ package: ApplicationPackageDto; version: ApplicationPackageVersionDto }> {
    const res = await fetch(`${API_BASE}/jobs/${jobId}/application-package`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manualBaseDocumentId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error?.message || `Failed to create application package (${res.status})`,
      );
    }
    const data = await res.json();
    return data.data;
  },

  async getPackage(id: string): Promise<PackageDetailResponse> {
    const res = await fetch(`${API_BASE}/application-packages/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to fetch package ${id}`);
    }
    const data = await res.json();
    return data.data;
  },

  async listPackages(params?: {
    status?: string;
    jobId?: string;
  }): Promise<ApplicationPackageDto[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.jobId) query.set('jobId', params.jobId);

    const res = await fetch(`${API_BASE}/application-packages?${query.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to list application packages (${res.status})`);
    }
    const data = await res.json();
    return data.data;
  },

  async listVersions(packageId: string): Promise<ApplicationPackageVersionDto[]> {
    const res = await fetch(`${API_BASE}/application-packages/${packageId}/versions`);
    if (!res.ok) {
      throw new Error(`Failed to list versions for package ${packageId}`);
    }
    const data = await res.json();
    return data.data;
  },

  async regeneratePackage(
    packageId: string,
    manualBaseDocumentId?: string | null,
  ): Promise<{ package: ApplicationPackageDto; version: ApplicationPackageVersionDto }> {
    const res = await fetch(`${API_BASE}/application-packages/${packageId}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manualBaseDocumentId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Failed to regenerate package');
    }
    const data = await res.json();
    return data.data;
  },

  async updateCv(packageId: string, summary: string): Promise<ApplicationPackageVersionDto> {
    const res = await fetch(`${API_BASE}/application-packages/${packageId}/cv`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Failed to update CV');
    }
    const data = await res.json();
    return data.data;
  },

  async updateCoverLetter(
    packageId: string,
    content: string,
  ): Promise<ApplicationPackageVersionDto> {
    const res = await fetch(`${API_BASE}/application-packages/${packageId}/cover-letter`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Failed to update cover letter');
    }
    const data = await res.json();
    return data.data;
  },

  async addQuestion(
    packageId: string,
    questionData: {
      questionText: string;
      category: QuestionCategory;
      questionType: QuestionType;
      options?: string[];
      isRequired?: boolean;
      sensitivity?: 'STANDARD' | 'SENSITIVE';
    },
  ): Promise<ApplicationQuestionDto> {
    const res = await fetch(`${API_BASE}/application-packages/${packageId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questionData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Failed to add question');
    }
    const data = await res.json();
    return data.data;
  },

  async answerQuestion(
    packageId: string,
    questionId: string,
    answerText: string,
  ): Promise<ApplicationQuestionDto> {
    const res = await fetch(
      `${API_BASE}/application-packages/${packageId}/questions/${questionId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerText }),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Failed to answer question');
    }
    const data = await res.json();
    return data.data;
  },

  async overrideBlocker(packageId: string, reason: string): Promise<ApplicationPackageDto> {
    const res = await fetch(`${API_BASE}/application-packages/${packageId}/override-blocker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Failed to override blocker');
    }
    const data = await res.json();
    return data.data;
  },

  getArtifactDownloadUrl(packageId: string, artifactId: string): string {
    return `${API_BASE}/application-packages/${packageId}/artifacts/${artifactId}/download`;
  },

  async getMetrics(): Promise<ApplicationStudioMetricsDto> {
    const res = await fetch(`${API_BASE}/application-packages/metrics`);
    if (!res.ok) {
      throw new Error('Failed to fetch Application Studio metrics');
    }
    const data = await res.json();
    return data.data;
  },

  async listApprovals(status = 'PENDING'): Promise<ApprovalRequestDto[]> {
    const res = await fetch(`${API_BASE}/approvals?status=${status}`);
    if (!res.ok) {
      throw new Error('Failed to fetch approvals');
    }
    const data = await res.json();
    return data.data;
  },

  async approveRequest(approvalId: string, userEditedValue?: string): Promise<ApprovalRequestDto> {
    const res = await fetch(`${API_BASE}/approvals/${approvalId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEditedValue }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Failed to approve request');
    }
    const data = await res.json();
    return data.data;
  },

  async rejectRequest(approvalId: string): Promise<ApprovalRequestDto> {
    const res = await fetch(`${API_BASE}/approvals/${approvalId}/reject`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Failed to reject request');
    }
    const data = await res.json();
    return data.data;
  },
};
