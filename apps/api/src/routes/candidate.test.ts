import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import { closeDbPool } from '@job-agent/database';

describe('Candidate Brain API Routes', () => {
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

  it('GET /api/candidate/overview returns completeness and counts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/candidate/overview',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.data.completeness).toBeDefined();
    expect(body.data.completeness.score).toBeTypeOf('number');
    expect(body.data.experienceCount).toBeTypeOf('number');
  });

  it('PUT /api/candidate/profile updates profile and returns formatted DTO', async () => {
    const payload = {
      fullName: 'Bek Test User',
      preferredName: 'Bek',
      headline: 'Lead Project Coordinator',
      email: 'bek.test@example.com',
      summary: 'Experienced project coordinator managing complex software teams.',
      city: 'Berlin',
      country: 'Germany',
      availability: '2 weeks notice',
    };

    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/candidate/profile',
      payload,
    });

    expect(putRes.statusCode).toBe(200);
    const putBody = JSON.parse(putRes.body);
    expect(putBody.status).toBe('ok');
    expect(putBody.data.fullName).toBe('Bek Test User');
    expect(putBody.data.headline).toBe('Lead Project Coordinator');

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/candidate/profile',
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    expect(getBody.data.fullName).toBe('Bek Test User');
  });

  it('POST & DELETE /api/candidate/experiences manages experience records', async () => {
    const payload = {
      organization: 'Acme Global Solutions',
      position: 'Senior Project Lead',
      location: 'Berlin, Germany',
      employmentType: 'full-time',
      startDate: '2023-01',
      endDate: '2024-06',
      isCurrent: false,
      description: 'Led cross-functional teams delivering cloud migrations.',
      achievements: ['Delivered 12 projects on schedule', 'Reduced cycle time by 25%'],
    };

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/candidate/experiences',
      payload,
    });

    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body).data;
    expect(created.id).toBeDefined();
    expect(created.organization).toBe('Acme Global Solutions');
    expect(created.achievements).toHaveLength(2);

    // Clean up
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/candidate/experiences/${created.id}`,
    });
    expect(delRes.statusCode).toBe(200);
  });

  it('rejects invalid experience payloads with 400 validation error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/candidate/experiences',
      payload: {
        organization: '', // Empty organization is invalid
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('error');
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('manages Answer Library with AUTO / REVIEW / MANUAL levels and sensitivity', async () => {
    const payload = {
      question: 'What is your current notice period?',
      category: 'NOTICE_PERIOD',
      answer: 'My notice period is one calendar month.',
      automationLevel: 'AUTO',
      isSensitive: false,
    };

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/candidate/answers',
      payload,
    });

    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body).data;
    expect(created.automationLevel).toBe('AUTO');
    expect(created.isSensitive).toBe(false);

    // Clean up
    await app.inject({
      method: 'DELETE',
      url: `/api/candidate/answers/${created.id}`,
    });
  });

  it('manages Job Preferences and Application Policy with conservative defaults', async () => {
    const policyRes = await app.inject({
      method: 'GET',
      url: '/api/candidate/policy',
    });
    expect(policyRes.statusCode).toBe(200);
    const policy = JSON.parse(policyRes.body).data;
    expect(policy.autoApplyEnabled).toBe(false);
    expect(policy.blockOnUnresolvedReview).toBe(true);

    const prefPayload = {
      targetTitles: ['Project Manager', 'Operations Lead'],
      preferredLocations: ['Berlin', 'Remote EU'],
      workModes: ['remote', 'hybrid'],
      minSalary: 80000,
      currency: 'EUR',
      acceptUnpaid: false,
    };

    const prefRes = await app.inject({
      method: 'PUT',
      url: '/api/candidate/preferences',
      payload: prefPayload,
    });
    expect(prefRes.statusCode).toBe(200);
    const prefs = JSON.parse(prefRes.body).data;
    expect(prefs.targetTitles).toEqual(['Project Manager', 'Operations Lead']);
    expect(prefs.minSalary).toBe(80000);
  });

  it('rejects sensitive unverified answers configured for AUTO mode', async () => {
    const sensitiveUnverified = {
      question: 'Are you legally authorized to work in the United States?',
      category: 'WORK_AUTHORIZATION',
      answer: 'Yes, authorized for any employer.',
      automationLevel: 'AUTO',
      isSensitive: true,
      verificationStatus: 'UNVERIFIED',
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/candidate/answers',
      payload: sensitiveUnverified,
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('error');
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('Sensitive answers cannot have AUTO automation level');
  });

  it('accepts sensitive answers configured for AUTO mode only when VERIFIED', async () => {
    const sensitiveVerified = {
      question: 'Do you require visa sponsorship?',
      category: 'SPONSORSHIP',
      answer: 'No sponsorship required.',
      automationLevel: 'AUTO',
      isSensitive: true,
      verificationStatus: 'VERIFIED',
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/candidate/answers',
      payload: sensitiveVerified,
    });

    expect(res.statusCode).toBe(201);
    const created = JSON.parse(res.body).data;
    expect(created.automationLevel).toBe('AUTO');
    expect(created.isSensitive).toBe(true);
    expect(created.verificationStatus).toBe('VERIFIED');

    // Clean up
    await app.inject({
      method: 'DELETE',
      url: `/api/candidate/answers/${created.id}`,
    });
  });

  it('verifies Candidate Audit Events follow privacy-minimized model (no PII snapshots)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/candidate/audit-events',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    for (const event of body.data) {
      expect(event.id).toBeTypeOf('string');
      expect(event.entityType).toBeTypeOf('string');
      expect(event.action).toBeTypeOf('string');
      expect(Array.isArray(event.changedFields)).toBe(true);
      // Ensure legacy snapshot fields do not exist
      expect(event.beforeState).toBeUndefined();
      expect(event.afterState).toBeUndefined();
      expect(event.details).toBeUndefined();
    }
  });

  it('supports filtering Candidate Facts by verificationStatus and allowAiUseOnly', async () => {
    // Create an unverified fact not allowed for AI
    const fact1Res = await app.inject({
      method: 'POST',
      url: '/api/candidate/facts',
      payload: {
        category: 'EXPERIENCE',
        factKey: 'years_experience_cloud',
        statement: 'Has 5+ years experience in cloud architecture.',
        verificationStatus: 'UNVERIFIED',
        allowAiUse: false,
      },
    });
    expect(fact1Res.statusCode).toBe(201);
    const fact1 = JSON.parse(fact1Res.body).data;

    // Create a verified fact allowed for AI
    const fact2Res = await app.inject({
      method: 'POST',
      url: '/api/candidate/facts',
      payload: {
        category: 'EDUCATION',
        factKey: 'degree_verified_bs',
        statement: 'Holds BSc in Computer Science from TU Berlin.',
        verificationStatus: 'VERIFIED',
        allowAiUse: true,
      },
    });
    expect(fact2Res.statusCode).toBe(201);
    const fact2 = JSON.parse(fact2Res.body).data;

    // Query with allowAiUseOnly=true
    const aiFactsRes = await app.inject({
      method: 'GET',
      url: '/api/candidate/facts?allowAiUseOnly=true',
    });
    expect(aiFactsRes.statusCode).toBe(200);
    const aiFacts = JSON.parse(aiFactsRes.body).data;
    const aiFactIds = aiFacts.map((f: { id: string }) => f.id);
    expect(aiFactIds).toContain(fact2.id);
    expect(aiFactIds).not.toContain(fact1.id);

    // Query with verificationStatus=VERIFIED
    const verifiedFactsRes = await app.inject({
      method: 'GET',
      url: '/api/candidate/facts?verificationStatus=VERIFIED',
    });
    expect(verifiedFactsRes.statusCode).toBe(200);
    const verifiedFacts = JSON.parse(verifiedFactsRes.body).data;
    const verifiedIds = verifiedFacts.map((f: { id: string }) => f.id);
    expect(verifiedIds).toContain(fact2.id);
    expect(verifiedIds).not.toContain(fact1.id);

    // Clean up
    await app.inject({ method: 'DELETE', url: `/api/candidate/facts/${fact1.id}` });
    await app.inject({ method: 'DELETE', url: `/api/candidate/facts/${fact2.id}` });
  });

  it('rejects document upload with disallowed MIME type via API', async () => {
    const boundary = '----WebKitFormBoundaryTest12345';
    const payload =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="test.json"\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `{"key": "value"}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="documentType"\r\n\r\n` +
      `OTHER\r\n` +
      `--${boundary}--\r\n`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/candidate/documents',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('error');
    expect(body.error.message).toContain('Unsupported document format');
  });
});
