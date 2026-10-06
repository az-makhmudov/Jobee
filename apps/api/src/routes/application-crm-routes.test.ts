import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import { closeDbPool, getDb, jobs, applications, inArray } from '@job-agent/database';
import { ApplicationLifecycleStatus, SubmissionMethod } from '@job-agent/shared';

describe('Application CRM Routes Integration Tests (JOB-P3-T02)', () => {
  const config = getConfig();
  let app: ReturnType<typeof buildApp>;
  const createdJobIds: string[] = [];
  const createdAppIds: string[] = [];
  const runId = Date.now();

  beforeAll(async () => {
    app = buildApp({ config });
    await app.ready();
  });

  afterAll(async () => {
    const db = getDb(config.DATABASE_URL);

    // Clean up created test applications and jobs
    if (createdAppIds.length > 0) {
      await db.delete(applications).where(inArray(applications.id, createdAppIds));
    }
    if (createdJobIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
    }

    await app.close();
    await closeDbPool();
  });

  it('creates an application in READY_TO_APPLY state and behaves idempotently on duplicate create', async () => {
    // 1. Ingest a job
    const jobRes = await app.inject({
      method: 'POST',
      url: '/api/jobs/text',
      payload: {
        text: `Acme Corp is hiring a Staff TypeScript Platform Engineer ${runId}. Location: Remote. Requirements: TypeScript, Node.js, PostgreSQL.`,
      },
    });
    expect(jobRes.statusCode).toBe(201);
    const job = JSON.parse(jobRes.body).data.job;
    createdJobIds.push(job.id);

    // 2. Create application in CRM
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/applications',
      payload: {
        jobId: job.id,
        source: 'DIRECT',
        nextAction: 'Review job posting',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const createBody = JSON.parse(createRes.body);
    expect(createBody.data.isExisting).toBe(false);
    expect(createBody.data.application.status).toBe(ApplicationLifecycleStatus.READY_TO_APPLY);
    expect(createBody.data.application.nextAction).toBe('Review job posting');
    const appId = createBody.data.application.id;
    createdAppIds.push(appId);

    // 3. Repeated create should be idempotent and return existing record with 200
    const duplicateRes = await app.inject({
      method: 'POST',
      url: '/api/applications',
      payload: {
        jobId: job.id,
      },
    });
    expect(duplicateRes.statusCode).toBe(200);
    const duplicateBody = JSON.parse(duplicateRes.body);
    expect(duplicateBody.data.isExisting).toBe(true);
    expect(duplicateBody.data.application.id).toBe(appId);
  });

  it('marks application as APPLIED and freezes submission metadata', async () => {
    const jobRes = await app.inject({
      method: 'POST',
      url: '/api/jobs/text',
      payload: {
        text: `Beta Labs is hiring a Senior Fullstack Engineer ${runId}. Requirements: React, TypeScript, GraphQL.`,
      },
    });
    const job = JSON.parse(jobRes.body).data.job;
    createdJobIds.push(job.id);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/applications',
      payload: { jobId: job.id },
    });
    const appData = JSON.parse(createRes.body).data.application;
    createdAppIds.push(appData.id);

    // Mark applied
    const appliedDate = new Date().toISOString();
    const markRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${appData.id}/mark-applied`,
      payload: {
        appliedAt: appliedDate,
        submissionMethod: SubmissionMethod.COMPANY_SITE,
        externalReferenceId: `REF-${runId}`,
        notes: 'Submitted through career portal form',
      },
    });
    expect(markRes.statusCode).toBe(200);
    const appliedData = JSON.parse(markRes.body).data;
    expect(appliedData.status).toBe(ApplicationLifecycleStatus.APPLIED);
    expect(appliedData.submissionMethod).toBe(SubmissionMethod.COMPANY_SITE);
    expect(appliedData.notes).toBe('Submitted through career portal form');

    // Repeated mark applied is idempotent
    const repeatRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${appData.id}/mark-applied`,
      payload: {
        submissionMethod: SubmissionMethod.COMPANY_SITE,
      },
    });
    expect(repeatRes.statusCode).toBe(200);
  });

  it('validates state transitions and rejects invalid terminal transitions', async () => {
    const jobRes = await app.inject({
      method: 'POST',
      url: '/api/jobs/text',
      payload: {
        text: `Gamma Corp is hiring a DevOps Engineer ${runId}. Requirements: Docker, Kubernetes, AWS.`,
      },
    });
    const job = JSON.parse(jobRes.body).data.job;
    createdJobIds.push(job.id);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/applications',
      payload: {
        jobId: job.id,
        status: ApplicationLifecycleStatus.APPLIED,
      },
    });
    const appData = JSON.parse(createRes.body).data.application;
    createdAppIds.push(appData.id);

    // Transition APPLIED -> SCREENING
    const screenRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${appData.id}/transition`,
      payload: {
        targetStatus: ApplicationLifecycleStatus.SCREENING,
        note: 'Recruiter reached out on LinkedIn',
      },
    });
    expect(screenRes.statusCode).toBe(200);
    expect(JSON.parse(screenRes.body).data.status).toBe(ApplicationLifecycleStatus.SCREENING);

    // Stage skip SCREENING -> INTERVIEW
    const intRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${appData.id}/transition`,
      payload: {
        targetStatus: ApplicationLifecycleStatus.INTERVIEW,
      },
    });
    expect(intRes.statusCode).toBe(200);
    expect(JSON.parse(intRes.body).data.status).toBe(ApplicationLifecycleStatus.INTERVIEW);

    // Terminal transition INTERVIEW -> REJECTED
    const rejRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${appData.id}/transition`,
      payload: {
        targetStatus: ApplicationLifecycleStatus.REJECTED,
        reason: 'Position filled internally',
      },
    });
    expect(rejRes.statusCode).toBe(200);
    const rejData = JSON.parse(rejRes.body).data;
    expect(rejData.status).toBe(ApplicationLifecycleStatus.REJECTED);
    expect(rejData.terminalReason).toBe('Position filled internally');
    expect(rejData.closedAt).toBeTruthy();

    // Invalid transition REJECTED -> SCREENING without correction flag fails with 400
    const invalidRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${appData.id}/transition`,
      payload: {
        targetStatus: ApplicationLifecycleStatus.SCREENING,
      },
    });
    expect(invalidRes.statusCode).toBe(400);

    // Valid correction override
    const correctionRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${appData.id}/transition`,
      payload: {
        targetStatus: ApplicationLifecycleStatus.INTERVIEW,
        isCorrection: true,
        correctionReason: 'Recruiter notified about reopen',
      },
    });
    expect(correctionRes.statusCode).toBe(200);
    expect(JSON.parse(correctionRes.body).data.status).toBe(ApplicationLifecycleStatus.INTERVIEW);
  });

  it('supports CRM notes, recruiter contacts, assessments, interviews, and offer tracking', async () => {
    const jobRes = await app.inject({
      method: 'POST',
      url: '/api/jobs/text',
      payload: {
        text: `Delta Fintech is hiring a Staff Backend Architect ${runId}. Requirements: Golang, Kafka, PostgreSQL.`,
      },
    });
    const job = JSON.parse(jobRes.body).data.job;
    createdJobIds.push(job.id);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/applications',
      payload: { jobId: job.id, status: ApplicationLifecycleStatus.APPLIED },
    });
    const appData = JSON.parse(createRes.body).data.application;
    const appId = appData.id;
    createdAppIds.push(appId);

    // 1. Add Note
    const noteRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${appId}/notes`,
      payload: { content: 'Referred by senior director on the team' },
    });
    expect(noteRes.statusCode).toBe(201);
    expect(JSON.parse(noteRes.body).data.content).toBe('Referred by senior director on the team');

    // 2. Add Contact
    const contactRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${appId}/contacts`,
      payload: {
        name: 'Jane Doe',
        email: 'jane.doe@delta.com',
        title: 'Lead Technical Recruiter',
        isPrimary: true,
      },
    });
    expect(contactRes.statusCode).toBe(201);
    const contact = JSON.parse(contactRes.body).data;
    expect(contact.isPrimary).toBe(true);

    // 3. Add Assessment
    const assessRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${appId}/assessments`,
      payload: {
        title: 'System Architecture Take-home',
        assessmentType: 'TAKE_HOME_PROJECT',
        provider: 'Internal',
      },
    });
    expect(assessRes.statusCode).toBe(201);

    // 4. Add Interview
    const interviewRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${appId}/interviews`,
      payload: {
        roundTitle: 'System Design Round',
        interviewType: 'SYSTEM_DESIGN',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        contactId: contact.id,
      },
    });
    expect(interviewRes.statusCode).toBe(201);

    // 5. Update Offer
    const offerRes = await app.inject({
      method: 'PUT',
      url: `/api/applications/${appId}/offer`,
      payload: {
        baseSalary: 185000,
        totalComp: 225000,
        currency: 'USD',
        status: 'PENDING',
      },
    });
    expect(offerRes.statusCode).toBe(200);
    expect(JSON.parse(offerRes.body).data.baseSalary).toBe(185000);

    // 6. Get Detail
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/applications/${appId}`,
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = JSON.parse(detailRes.body).data;
    expect(detail.notes.length).toBe(1);
    expect(detail.contacts.length).toBe(1);
    expect(detail.assessments.length).toBe(1);
    expect(detail.interviews.length).toBe(1);
    expect(detail.offer?.baseSalary).toBe(185000);
    expect(detail.events.length).toBeGreaterThanOrEqual(1);
  });

  it('returns CRM metrics and analytics correctly', async () => {
    const metricsRes = await app.inject({
      method: 'GET',
      url: '/api/applications/metrics',
    });
    expect(metricsRes.statusCode).toBe(200);
    const metrics = JSON.parse(metricsRes.body).data;
    expect(metrics.totalTracked).toBeGreaterThanOrEqual(createdAppIds.length);

    const analyticsRes = await app.inject({
      method: 'GET',
      url: '/api/applications/analytics',
    });
    expect(analyticsRes.statusCode).toBe(200);
    const analytics = JSON.parse(analyticsRes.body).data;
    expect(analytics.funnel).toBeDefined();
    expect(analytics.timeMetrics).toBeDefined();
    expect(analytics.sourceDistribution).toBeDefined();
  });
});
