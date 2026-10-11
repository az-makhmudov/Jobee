import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import {
  closeDbPool,
  getDb,
  getOrCreatePrimaryUser,
  jobs,
  candidateSkills,
  candidateExperiences,
  candidateEducation,
  applicationPackages,
  eq,
  inArray,
} from '@job-agent/database';

describe('Application Package Routes Integration Tests (JOB-P3-T01)', () => {
  const config = getConfig();
  let app: ReturnType<typeof buildApp>;
  const createdJobIds: string[] = [];
  const createdPackageIds: string[] = [];
  let testSkillId: string | null = null;
  let testExpId: string | null = null;
  let testEduId: string | null = null;
  const runId = Date.now();

  beforeAll(async () => {
    app = buildApp({ config });
    await app.ready();

    const db = getDb(config.DATABASE_URL);
    const user = await getOrCreatePrimaryUser(db);
    const userId = user.id;

    // Ensure candidate profile exists
    const profRes = await app.inject({ method: 'GET', url: '/api/candidate/profile' });
    if (profRes.statusCode !== 200 || !JSON.parse(profRes.body).data) {
      await app.inject({
        method: 'PUT',
        url: '/api/candidate/profile',
        payload: {
          fullName: 'Package Test Candidate',
          preferredName: 'PackageTester',
          headline: 'Full Stack Engineer',
          email: 'package.candidate@example.com',
          summary: 'Integration test profile for package routes',
          city: 'Berlin',
          country: 'Germany',
          availability: 'Immediately',
        },
      });
    }

    // Seed test candidate evidence
    const [skill] = await db
      .insert(candidateSkills)
      .values({
        userId,
        name: `PackageTestSkill_${runId}`,
        category: 'Language',
        proficiency: 'ADVANCED',
        verificationStatus: 'VERIFIED',
      })
      .returning();
    testSkillId = skill!.id;

    const [exp] = await db
      .insert(candidateExperiences)
      .values({
        userId,
        organization: `PackageTestOrg_${runId}`,
        position: 'Staff Platform Engineer',
        startDate: '2020-01',
        endDate: '2023-01',
        isCurrent: false,
        employmentType: 'FULL_TIME',
        description: 'Engineered high-scale microservices',
        achievements: ['Scaled distributed messaging infrastructure to 50000 msgs/sec'],
        verificationStatus: 'VERIFIED',
      })
      .returning();
    testExpId = exp!.id;

    const [edu] = await db
      .insert(candidateEducation)
      .values({
        userId,
        institution: 'Technical Institute',
        degree: 'Master of Science',
        fieldOfStudy: 'Distributed Systems',
        startDate: '2015-09',
        endDate: '2019-06',
        isCurrent: false,
        verificationStatus: 'VERIFIED',
      })
      .returning();
    testEduId = edu!.id;
  });

  afterAll(async () => {
    const db = getDb(config.DATABASE_URL);
    if (createdPackageIds.length > 0) {
      await db
        .delete(applicationPackages)
        .where(inArray(applicationPackages.id, createdPackageIds));
    }
    if (createdJobIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
    }
    if (testSkillId) await db.delete(candidateSkills).where(eq(candidateSkills.id, testSkillId));
    if (testExpId)
      await db.delete(candidateExperiences).where(eq(candidateExperiences.id, testExpId));
    if (testEduId) await db.delete(candidateEducation).where(eq(candidateEducation.id, testEduId));

    await app.close();
    await closeDbPool();
  });

  it('POST /api/jobs/:jobId/application-package creates package, generates v1, and returns artifacts', async () => {
    // 1. Ingest a job
    const jobRes = await app.inject({
      method: 'POST',
      url: '/api/jobs/text',
      payload: {
        text: `Lead Engineer at Apex Cloud Systems in Berlin.
Requirements:
- Strong experience with PackageTestSkill_${runId}.
- Experience with distributed architectures.
Workplace Type: REMOTE. Full-time position.`,
        title: 'Lead Cloud Engineer',
        company: 'Apex Cloud Systems',
        locationText: 'Berlin, Germany',
      },
    });
    const job = JSON.parse(jobRes.body).data.job;
    createdJobIds.push(job.id);

    // 2. Analyze job
    await app.inject({
      method: 'POST',
      url: `/api/jobs/${job.id}/analyze`,
    });

    // 3. Create Application Package
    const pkgRes = await app.inject({
      method: 'POST',
      url: `/api/jobs/${job.id}/application-package`,
      payload: {},
    });

    expect(pkgRes.statusCode).toBe(201);
    const body = JSON.parse(pkgRes.body);
    expect(body.status).toBe('ok');
    expect(body.data.package).toBeDefined();
    expect(body.data.package.jobId).toBe(job.id);
    expect(body.data.version).toBeDefined();
    expect(body.data.version.versionNumber).toBe(1);
    expect(body.data.version.tailoredCvContent).toBeDefined();

    const packageId = body.data.package.id;
    createdPackageIds.push(packageId);

    // Verify detailed package fetch
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/application-packages/${packageId}`,
    });
    expect(detailRes.statusCode).toBe(200);
    const detailBody = JSON.parse(detailRes.body).data;

    expect(detailBody.artifacts.length).toBeGreaterThanOrEqual(1);
    const cvArtifact = detailBody.artifacts.find((a: any) => a.artifactType === 'TAILORED_CV');
    expect(cvArtifact).toBeDefined();
    expect(cvArtifact.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  });

  it('GET /api/application-packages lists packages and GET /metrics returns studio metrics', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/application-packages',
    });
    expect(listRes.statusCode).toBe(200);
    const listData = JSON.parse(listRes.body).data;
    expect(Array.isArray(listData)).toBe(true);
    expect(listData.length).toBeGreaterThanOrEqual(1);

    const metricsRes = await app.inject({
      method: 'GET',
      url: '/api/application-packages/metrics',
    });
    expect(metricsRes.statusCode).toBe(200);
    const metricsData = JSON.parse(metricsRes.body).data;
    expect(metricsData.packagesInPreparation).toBeDefined();
    expect(metricsData.packagesReady).toBeDefined();
  });

  it('PUT /api/application-packages/:id/cv updates CV summary and regenerates DOCX', async () => {
    const packageId = createdPackageIds[0]!;
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/application-packages/${packageId}/cv`,
      payload: {
        summary: 'Updated tailored summary highlighting distributed systems expertise.',
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updatedVer = JSON.parse(updateRes.body).data;
    expect(updatedVer.tailoredCvContent.summary).toBe(
      'Updated tailored summary highlighting distributed systems expertise.',
    );
  });

  it('POST /api/application-packages/:id/questions adds question and PUT answers it', async () => {
    const packageId = createdPackageIds[0]!;

    const addQRes = await app.inject({
      method: 'POST',
      url: `/api/application-packages/${packageId}/questions`,
      payload: {
        questionText: 'Are you available to start immediately?',
        category: 'AVAILABILITY',
        questionType: 'SINGLE_SELECT',
        options: ['Yes', 'No'],
        isRequired: true,
      },
    });

    expect(addQRes.statusCode).toBe(201);
    const qData = JSON.parse(addQRes.body).data;
    expect(qData.questionText).toBe('Are you available to start immediately?');

    // Answer the question
    const answerRes = await app.inject({
      method: 'PUT',
      url: `/api/application-packages/${packageId}/questions/${qData.id}`,
      payload: {
        answerText: 'Yes',
      },
    });

    expect(answerRes.statusCode).toBe(200);
    const answeredQ = JSON.parse(answerRes.body).data;
    expect(answeredQ.finalAnswer).toBe('Yes');
    expect(answeredQ.approvalState).toBe('APPROVED');
  });

  it('GET /api/approvals and POST /api/approvals/:id/approve resolves approvals', async () => {
    const approvalsRes = await app.inject({
      method: 'GET',
      url: '/api/approvals',
    });

    expect(approvalsRes.statusCode).toBe(200);
    const approvals = JSON.parse(approvalsRes.body).data;

    if (approvals.length > 0) {
      const apprId = approvals[0].id;
      const approveRes = await app.inject({
        method: 'POST',
        url: `/api/approvals/${apprId}/approve`,
        payload: {
          userEditedValue: 'Approved by candidate',
        },
      });

      expect(approveRes.statusCode).toBe(200);
      const approved = JSON.parse(approveRes.body).data;
      expect(approved.status).toBe('APPROVED');
      expect(approved.userEditedValue).toBe('Approved by candidate');
    }
  });

  it('POST /api/application-packages/:id/regenerate creates version 2 and GET /versions lists history', async () => {
    const packageId = createdPackageIds[0]!;

    const regenRes = await app.inject({
      method: 'POST',
      url: `/api/application-packages/${packageId}/regenerate`,
      payload: {},
    });

    expect(regenRes.statusCode).toBe(200);
    const regenData = JSON.parse(regenRes.body).data;
    expect(regenData.version.versionNumber).toBe(2);
    expect(regenData.package.currentVersionNumber).toBe(2);

    const versionsRes = await app.inject({
      method: 'GET',
      url: `/api/application-packages/${packageId}/versions`,
    });

    expect(versionsRes.statusCode).toBe(200);
    const versions = JSON.parse(versionsRes.body).data;
    expect(versions.length).toBeGreaterThanOrEqual(2);
    expect(versions.some((v: any) => v.versionNumber === 1)).toBe(true);
    expect(versions.some((v: any) => v.versionNumber === 2)).toBe(true);
  });

  it('GET /api/application-packages/:id/artifacts/:artifactId/download downloads generated DOCX', async () => {
    const packageId = createdPackageIds[0]!;
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/application-packages/${packageId}`,
    });
    const detail = JSON.parse(detailRes.body).data;
    const artifact = detail.artifacts[0];

    const downloadRes = await app.inject({
      method: 'GET',
      url: `/api/application-packages/${packageId}/artifacts/${artifact.id}/download`,
    });

    expect(downloadRes.statusCode).toBe(200);
    expect(downloadRes.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(downloadRes.rawPayload.length).toBeGreaterThan(100);
  });
});
