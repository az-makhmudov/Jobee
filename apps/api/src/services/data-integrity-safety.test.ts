import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import { closeDbPool } from '@job-agent/database';
import { PackageReadinessEngine } from './package-readiness-engine.js';
import { ApplicationQuestionEngine } from './application-question-engine.js';
import type {
  ApplicationPackage,
  ApplicationPackageVersion,
  ApplicationArtifact,
  ApprovalRequest,
  CandidateFact,
} from '@job-agent/database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../../');

describe('Data Integrity, Safety Invariants, and Authorization Gates', () => {
  const config = getConfig();
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp({ config });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await closeDbPool();
  });

  describe('1. Backup Exclusion & Security Boundaries', () => {
    it('.gitignore explicitly ignores backups/ and .sql files', () => {
      const gitignorePath = path.join(rootDir, '.gitignore');
      expect(fs.existsSync(gitignorePath)).toBe(true);
      const content = fs.readFileSync(gitignorePath, 'utf8');

      expect(content).toMatch(/backups\//);
      expect(content).toMatch(/\*\.sql/);
      expect(content).toMatch(/\*\.dump/);
    });

    it('Data scripts contain safety guards protecting primary candidate', () => {
      const cleanScript = fs.readFileSync(
        path.join(rootDir, 'scripts/clean-and-enrich-user-data.ts'),
        'utf8',
      );
      expect(cleanScript).toContain('--force-candidate-override');
      expect(cleanScript).toContain('00000000-0000-0000-0000-000000000001');

      const workflowScript = fs.readFileSync(
        path.join(rootDir, 'scripts/execute-first-real-workflow.ts'),
        'utf8',
      );
      expect(workflowScript).toContain('--force-candidate-override');
      expect(workflowScript).toContain('00000000-0000-0000-0000-000000000001');
    });
  });

  describe('2. Fact Quarantine & Invariant Enforcement', () => {
    it('ApplicationQuestionEngine ignores candidate facts with allowAiUse=false', () => {
      const quarantinedFact: CandidateFact = {
        id: '11111111-1111-1111-1111-111111111111',
        userId: '00000000-0000-0000-0000-000000000001',
        category: 'WORK_AUTHORIZATION',
        factKey: 'work_authorization',
        statement: 'Legally authorized to work in Poland and the European Union.',
        structuredValue: null,
        sourceType: 'MANUAL',
        sourceEntityId: null,
        verificationStatus: 'VERIFIED',
        allowAiUse: false, // Quarantined from AI
        confidence: null,
        lastConfirmedAt: null,
        hasContradiction: false,
        contradictionDetails: null,
        sources: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const question = {
        questionText:
          'Are you legally authorized to work in the country where this job is located?',
        category: 'WORK_AUTHORIZATION' as const,
        questionType: 'SINGLE_SELECT' as const,
        options: ['Yes', 'No'],
        sensitivity: 'SENSITIVE' as const,
        isRequired: true,
      };

      const result = ApplicationQuestionEngine.resolveQuestion(question, {
        candidate: {
          profile: null as any,
          experiences: [],
          education: [],
          skills: [],
          languages: [],
          certifications: [],
          projects: [],
          links: [],
        },
        answerLibrary: [],
        candidateFacts: [quarantinedFact],
        preferences: null,
        policy: null,
      });

      // The fact is quarantined, so resolution must NOT use this fact as proposed answer
      expect(result.sourceEntityId).not.toBe(quarantinedFact.id);
      expect(result.answerSource).not.toBe('CANDIDATE_FACT');
    });

    it('Candidate fact API prevents setting allowAiUse=true on unverified facts', async () => {
      // Test creating unverified fact with allowAiUse: true
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/candidate/facts',
        payload: {
          category: 'EXPERIENCE',
          factKey: 'test_safety_fact',
          statement: 'Unverified test fact statement',
          verificationStatus: 'UNVERIFIED',
          allowAiUse: true, // Should be forced to false
        },
      });

      expect(createRes.statusCode).toBe(201);
      const created = JSON.parse(createRes.body).data;
      expect(created.verificationStatus).toBe('UNVERIFIED');
      expect(created.allowAiUse).toBe(false);

      // Clean up created fact
      await app.inject({
        method: 'DELETE',
        url: `/api/candidate/facts/${created.id}`,
      });
    });
  });

  describe('3. Human Authorization & Package Readiness Invariants', () => {
    const mockPkg: ApplicationPackage = {
      id: '22222222-2222-2222-2222-222222222222',
      jobId: '33333333-3333-3333-3333-333333333333',
      userId: '00000000-0000-0000-0000-000000000001',
      matchAnalysisId: null,
      status: 'NEEDS_REVIEW',
      currentVersionNumber: 1,
      hasPolicyBlocker: false,
      blockerOverridden: false,
      blockerOverrideReason: null,
      blockerOverriddenAt: null,
      isStale: false,
      readinessReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockVer: ApplicationPackageVersion = {
      id: '44444444-4444-4444-4444-444444444444',
      packageId: mockPkg.id,
      versionNumber: 1,
      inputFingerprint: 'dummy',
      baseDocumentId: null,
      baseSelectionReason: null,
      tailoredCvContent: null,
      coverLetterContent: 'Dear Hiring Team...',
      coverLetterEnabled: true,
      coverLetterApproved: false,
      changeSummary: [],
      generationMode: 'HYBRID',
      aiModel: null,
      status: 'FINAL',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockCvArtifact: ApplicationArtifact = {
      id: '55555555-5555-5555-5555-555555555555',
      packageId: mockPkg.id,
      versionId: mockVer.id,
      artifactType: 'TAILORED_CV',
      storageKey: 'test/cv.docx',
      filename: 'cv.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 1000,
      sha256Checksum: 'dummy',
      metadata: {},
      createdAt: new Date(),
    };

    it('blocks readiness when an approval has status NEEDS_USER_RECONFIRMATION', () => {
      const reconfirmationApproval: ApprovalRequest = {
        id: '66666666-6666-6666-6666-666666666666',
        packageId: mockPkg.id,
        versionId: mockVer.id,
        userId: mockPkg.userId,
        questionId: null,
        approvalType: 'SENSITIVE_ANSWER',
        status: 'NEEDS_USER_RECONFIRMATION',
        subject: 'Proposed Answer',
        proposedValue: 'Yes',
        userEditedValue: null,
        reason: 'Sensitive answer requires confirmation',
        riskLevel: 'HIGH',
        evidenceReferences: [],
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = PackageReadinessEngine.evaluateReadiness({
        pkg: mockPkg,
        version: mockVer,
        artifacts: [mockCvArtifact],
        questions: [],
        approvals: [reconfirmationApproval],
      });

      expect(result.isReady).toBe(false);
      expect(result.status).toBe('NEEDS_REVIEW');
      expect(result.blockingIssues.some((issue) => issue.includes('reconfirmation'))).toBe(true);
      expect(result.pendingApprovalsCount).toBe(1);
    });

    it('blocks readiness when an approval was resolved by automation (resolvedBy != USER)', () => {
      const untrustedApproval: ApprovalRequest = {
        id: '77777777-7777-7777-7777-777777777777',
        packageId: mockPkg.id,
        versionId: mockVer.id,
        userId: mockPkg.userId,
        questionId: null,
        approvalType: 'SENSITIVE_ANSWER',
        status: 'APPROVED',
        subject: 'Proposed Answer',
        proposedValue: 'Yes',
        userEditedValue: null,
        reason: 'Sensitive answer',
        riskLevel: 'HIGH',
        evidenceReferences: [],
        resolvedAt: new Date(),
        resolvedBy: 'AGENT', // Automation agent resolved, not human user!
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = PackageReadinessEngine.evaluateReadiness({
        pkg: mockPkg,
        version: mockVer,
        artifacts: [mockCvArtifact],
        questions: [],
        approvals: [untrustedApproval],
      });

      expect(result.isReady).toBe(false);
      expect(result.status).toBe('NEEDS_REVIEW');
      expect(
        result.blockingIssues.some((issue) => issue.includes('automation rather than human user')),
      ).toBe(true);
    });

    it('POST /api/approvals/:id/approve rejects automated agent caller without explicit human confirmation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/approvals/930254f4-0d0f-4d88-a8b1-086fc81aab14/approve',
        headers: {
          'x-automation-agent': 'true',
        },
        payload: {},
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('error');
      expect(body.error.message).toContain(
        'Consequential approval requests cannot be approved by automated agents',
      );
    });
  });
});
