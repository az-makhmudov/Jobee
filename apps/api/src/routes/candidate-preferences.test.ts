import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getConfig } from '@job-agent/config';
import { getDb, users, eq, evaluateTestDatabaseSafety } from '@job-agent/database';
import { buildApp } from '../app.js';

const config = getConfig();
const db = getDb(config.DATABASE_URL);
const app = buildApp({ config });
let userId: string;
let otherId: string;
beforeAll(async () => {
  if (!evaluateTestDatabaseSafety(config.DATABASE_URL).safe)
    throw new Error('Explicit isolated test database required');
  const created = await db
    .insert(users)
    .values([
      { name: 'Preferences fixture', email: `prefs-${crypto.randomUUID()}@example.test` },
      {
        name: 'Other preferences fixture',
        email: `prefs-other-${crypto.randomUUID()}@example.test`,
      },
    ])
    .returning();
  userId = created[0]!.id;
  otherId = created[1]!.id;
  await app.ready();
});
afterAll(async () => {
  await app.close();
  if (userId) await db.delete(users).where(eq(users.id, userId));
  if (otherId) await db.delete(users).where(eq(users.id, otherId));
});
const get = (id: string) =>
  app.inject({
    method: 'GET',
    url: '/api/candidate/preferences',
    headers: { 'x-test-user-id': id },
  });
const put = (id: string, payload: Record<string, unknown>) =>
  app.inject({
    method: 'PUT',
    url: '/api/candidate/preferences',
    headers: { 'x-test-user-id': id },
    payload,
  });

describe('Candidate preference context (JOB-P1-T02)', () => {
  it('persists explicit country eligibility and availability on first creation, scoped to the owner', async () => {
    const response = await put(userId, {
      targetTitles: ['Project Coordinator'],
      workAuthorizationCountries: ['Poland', 'Germany'],
      internshipEligible: false,
      availability: 'Four weeks notice',
      needsSponsorship: null,
      employmentTypes: ['FULL_TIME', 'CONTRACT'],
      seniorityLevels: ['ENTRY'],
      preferredLanguages: ['English'],
    });
    expect(response.statusCode).toBe(200);
    const saved = response.json().data;
    expect(saved.workAuthorizationCountries).toEqual(['Poland', 'Germany']);
    expect(saved.internshipEligible).toBe(false);
    expect(saved.availability).toBe('Four weeks notice');
    expect(saved.needsSponsorship).toBeNull();
    expect((await get(userId)).json().data).toMatchObject(saved);
    expect((await get(otherId)).json().data).toBeNull();
  });
  it('preserves eligibility when an unrelated preference changes and records the submitted fields', async () => {
    const response = await put(userId, { preferredLocations: ['Remote'] });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      workAuthorizationCountries: ['Poland', 'Germany'],
      internshipEligible: false,
      availability: 'Four weeks notice',
    });
    const audit = await app.inject({
      method: 'GET',
      url: '/api/candidate/audit-events',
      headers: { 'x-test-user-id': userId },
    });
    expect(audit.statusCode).toBe(200);
    expect(
      audit
        .json()
        .data.some((event: { changedFields: string[] }) =>
          event.changedFields.includes('workAuthorizationCountries'),
        ),
    ).toBe(true);
  });
  it('retains unknowns for a new candidate and supports explicitly clearing eligibility', async () => {
    const created = await put(otherId, { targetTitles: ['Designer'] });
    expect(created.json().data).toMatchObject({
      workAuthorizationCountries: [],
      internshipEligible: null,
      availability: null,
      needsSponsorship: null,
    });
    const cleared = await put(userId, {
      workAuthorizationCountries: [],
      internshipEligible: null,
      availability: null,
    });
    expect(cleared.json().data).toMatchObject({
      workAuthorizationCountries: [],
      internshipEligible: null,
      availability: null,
      targetTitles: ['Project Coordinator'],
    });
  });
  it.each([
    { workAuthorizationCountries: [''] },
    { workAuthorizationCountries: [42] },
    { internshipEligible: 'yes' },
    { availability: 'x'.repeat(201) },
  ])('rejects invalid context without changing persisted candidate facts: %o', async (payload) => {
    const response = await put(userId, payload);
    expect(response.statusCode).toBe(400);
    expect((await get(userId)).json().data.workAuthorizationCountries).toEqual([]);
  });
});

describe('Verified answer context (JOB-P1-T02)', () => {
  it('clears verification after material edits unless the user explicitly reconfirms, without crossing tenants', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/candidate/answers',
      headers: { 'x-test-user-id': userId },
      payload: {
        question: 'Are you open to remote work?',
        answer: 'Yes',
        automationLevel: 'AUTO',
        verificationStatus: 'VERIFIED',
      },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().data.id;
    const changed = await app.inject({
      method: 'PUT',
      url: `/api/candidate/answers/${id}`,
      headers: { 'x-test-user-id': userId },
      payload: { answer: 'No' },
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().data.verificationStatus).toBe('UNVERIFIED');
    const audit = await app.inject({
      method: 'GET',
      url: '/api/candidate/audit-events',
      headers: { 'x-test-user-id': userId },
    });
    const editEvent = audit
      .json()
      .data.find(
        (event: { entityId: string; action: string }) =>
          event.entityId === id && event.action === 'UPDATE',
      );
    expect(editEvent.changedFields).toContain('verificationStatus');
    expect(editEvent.metadata.verificationStatus).toBe('UNVERIFIED');
    const confirmed = await app.inject({
      method: 'PUT',
      url: `/api/candidate/answers/${id}`,
      headers: { 'x-test-user-id': userId },
      payload: { verificationStatus: 'VERIFIED' },
    });
    expect(confirmed.json().data.verificationStatus).toBe('VERIFIED');
    const denied = await app.inject({
      method: 'PUT',
      url: `/api/candidate/answers/${id}`,
      headers: { 'x-test-user-id': otherId },
      payload: { answer: 'Different user' },
    });
    expect(denied.statusCode).toBe(404);
  });
});
