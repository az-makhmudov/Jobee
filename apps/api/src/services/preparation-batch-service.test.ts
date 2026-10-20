import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDb,
  users,
  jobs,
  candidateProfiles,
  preparationItems,
  applicationPackages,
  applicationPolicy,
  applications,
  applicationPackageVersions,
  applicationArtifacts,
  applicationQuestions,
  eq,
  evaluateTestDatabaseSafety,
  BrowserWorkerService,
  SubmissionAuthorizationService,
  browserApplicationRuns,
  computePreparationFingerprint,
} from '@job-agent/database';
import { PreparationBatchService } from './preparation-batch-service.js';
import { ApplicationPackageService } from './application-package-service.js';
import { JobSearchSettingsService } from './job-search-settings-service.js';
import { LocalStorageProvider } from '../storage/local-storage.js';
import { BrowserRunMode, DEFAULT_SEARCH_SETTINGS } from '@job-agent/shared';
import fs from 'node:fs/promises';
const db = getDb(process.env.DATABASE_URL);
let userId: string, otherId: string;
let ids: string[];
let service: PreparationBatchService;
let packageService: ApplicationPackageService;
let directory: string;
beforeEach(async () => {
  if (!evaluateTestDatabaseSafety(process.env.DATABASE_URL).safe)
    throw new Error('Isolated test database required');
  directory = await fs.mkdtemp('/private/tmp/jobee-batch-');
  const [user, other] = await db
    .insert(users)
    .values([
      { name: 'Batch fixture', email: `batch-${crypto.randomUUID()}@example.test` },
      { name: 'Other fixture', email: `other-${crypto.randomUUID()}@example.test` },
    ])
    .returning();
  userId = user!.id;
  otherId = other!.id;
  await db.insert(candidateProfiles).values({
    userId,
    fullName: 'Alex Morgan',
    email: 'alex@example.test',
    headline: 'Project Manager',
  });
  const created = await db
    .insert(jobs)
    .values(
      Array.from({ length: 5 }, (_, i) => ({
        userId,
        title: `Project Coordinator ${i}`,
        company: 'Fixture Company',
        description: 'Coordinate projects and stakeholders. Support project delivery.',
        contentHash: crypto.randomUUID(),
        applicationUrl: `https://boards.greenhouse.io/fixture/jobs/${i}`,
      })),
    )
    .returning();
  ids = created.map((j) => j.id);
  packageService = new ApplicationPackageService(
    db,
    new LocalStorageProvider({ baseDir: directory }),
  );
  service = new PreparationBatchService(db, packageService);
});
afterEach(async () => {
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(users).where(eq(users.id, otherId));
  await fs.rm(directory, { recursive: true, force: true });
});
describe('Durable selected preparation', () => {
  it('returns one persistent batch on duplicate clicks, isolates other tenants, and survives service replacement', async () => {
    const [a, b] = await Promise.all([service.create(userId, ids), service.create(userId, ids)]);
    expect(a.id).toBe(b.id);
    expect(a.items).toHaveLength(5);
    await expect(service.get(otherId, a.id)).rejects.toThrow('not found');
    await expect(service.create(otherId, ids)).rejects.toThrow('unavailable');
    const restarted = new PreparationBatchService(db, packageService);
    expect((await restarted.list(userId))[0]?.id).toBe(a.id);
    await service.cancel(userId, a.id);
    expect((await service.get(userId, a.id)).items.every((i) => i.status === 'CANCELLED')).toBe(
      true,
    );
  });
  it('keeps partial results and retries only failed jobs', async () => {
    const batch = await service.create(userId, ids.slice(0, 3));
    const generate = vi.spyOn(packageService, 'createPackage');
    generate.mockRejectedValueOnce(new Error('Fixture generation failure'));
    await service.processOne();
    await service.processOne();
    await service.processOne();
    const result = await service.get(userId, batch.id);
    expect(result.items.filter((i) => i.status === 'FAILED')).toHaveLength(1);
    expect(result.items.filter((i) => i.packageId)).toHaveLength(2);
    const retry = await service.retry(userId, batch.id);
    expect(retry.items).toHaveLength(1);
    await service.processOne();
    expect((await service.get(userId, retry.id)).items[0]?.packageId).toBeTruthy();
  });
  it('reuses unchanged completed inputs and refuses stale queued inputs', async () => {
    const first = await service.create(userId, [ids[0]!]);
    await service.processOne();
    const completed = await service.get(userId, first.id);
    const packageId = completed.items[0]?.packageId;
    expect(packageId).toBeTruthy();
    const repeat = await service.create(userId, [ids[0]!]);
    expect(repeat.items[0]?.packageId).toBe(packageId);
    const next = await service.create(userId, [ids[1]!]);
    await db
      .update(candidateProfiles)
      .set({ headline: 'Operations Coordinator' })
      .where(eq(candidateProfiles.userId, userId));
    await service.processOne();
    expect((await service.get(userId, next.id)).items[0]?.status).toBe('FAILED');
  });
  it('enforces daily preparation budgets before enqueueing', async () => {
    await new JobSearchSettingsService(db).save(userId, {
      ...DEFAULT_SEARCH_SETTINGS,
      dailyLimit: 2,
    });
    await expect(service.create(userId, ids)).rejects.toThrow('budget');
    expect(
      await db.select().from(preparationItems).where(eq(preparationItems.userId, userId)),
    ).toHaveLength(0);
  });
  it('requires current authorization, prevents duplicate dispatch, and blocks uncertain retries', async () => {
    const [pkg] = await db
      .insert(applicationPackages)
      .values({ userId, jobId: ids[0]!, status: 'READY', currentVersionNumber: 1 })
      .returning();
    const [version] = await db
      .insert(applicationPackageVersions)
      .values({
        packageId: pkg!.id,
        versionNumber: 1,
        status: 'READY',
        inputFingerprint: await computePreparationFingerprint(db, userId, ids[0]!, null),
        coverLetterEnabled: false,
      })
      .returning();
    await db.insert(applicationArtifacts).values({
      packageId: pkg!.id,
      versionId: version!.id,
      artifactType: 'TAILORED_CV',
      filename: 'fixture.docx',
      storageKey: 'fixture.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 1,
      sha256Checksum: 'fixture',
    });
    const [app] = await db
      .insert(applications)
      .values({ userId, jobId: ids[0]!, currentPackageId: pkg!.id, status: 'READY_TO_APPLY' })
      .returning();
    const ticket = await SubmissionAuthorizationService.createSubmissionAuthorizationTicket(
      userId,
      app!.id,
      db,
    );
    const input = { mode: BrowserRunMode.SUBMIT, submissionToken: ticket.submissionToken };
    await db.insert(applicationPolicy).values({ userId, autoApplyEnabled: true });
    await db
      .update(applicationArtifacts)
      .set({ sha256Checksum: 'edited-after-review' })
      .where(eq(applicationArtifacts.versionId, version!.id));
    await expect(BrowserWorkerService.createBrowserRun(userId, app!.id, input)).rejects.toThrow(
      'manifest mismatch',
    );
    await db
      .update(applicationArtifacts)
      .set({ sha256Checksum: 'fixture' })
      .where(eq(applicationArtifacts.versionId, version!.id));

    const runs = await Promise.allSettled([
      BrowserWorkerService.createBrowserRun(userId, app!.id, input),
      BrowserWorkerService.createBrowserRun(userId, app!.id, input),
    ]);
    expect(runs.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    await db
      .update(browserApplicationRuns)
      .set({ status: 'SUBMISSION_UNCERTAIN' })
      .where(eq(browserApplicationRuns.applicationId, app!.id));
    await expect(BrowserWorkerService.createBrowserRun(userId, app!.id, input)).rejects.toThrow(
      'attempt already exists',
    );
    await db
      .update(candidateProfiles)
      .set({ headline: 'Updated profile' })
      .where(eq(candidateProfiles.userId, userId));
    await expect(
      SubmissionAuthorizationService.verifySubmissionAuthorization(
        userId,
        app!.id,
        ticket.submissionToken,
        db,
      ),
    ).rejects.toThrow('inputs changed');
    await db
      .update(applicationPackages)
      .set({ status: 'READY', isStale: false })
      .where(eq(applicationPackages.id, pkg!.id));
    await db
      .update(applicationPackageVersions)
      .set({ inputFingerprint: await computePreparationFingerprint(db, userId, ids[0]!, null) })
      .where(eq(applicationPackageVersions.id, version!.id));
    await db.insert(applicationQuestions).values({
      packageId: pkg!.id,
      versionId: version!.id,
      questionText: 'Visa sponsorship?',
      questionType: 'TEXT',
      sensitivity: 'SENSITIVE',
      approvalState: 'PENDING',
    });
    await expect(
      SubmissionAuthorizationService.createSubmissionAuthorizationTicket(userId, app!.id, db),
    ).rejects.toThrow('questions');
  });
});
