import {
  type Database,
  browserApplicationRuns,
  candidateProfiles,
  candidateLinks,
  candidateDocuments,
  answerLibrary,
  applicationPackageVersions,
  eq,
} from '@job-agent/database';
import {
  BrowserRunMode,
  type ApplicationSubmissionPayload,
  type BrowserApplicationRunDto,
} from '@job-agent/shared';
import type { BrowserController } from '../browser/browser-controller.js';
import { FixtureBrowserController } from '../browser/fixture-browser-controller.js';
import { PlaywrightBrowserController } from '../browser/playwright-browser-controller.js';
import { BrowserApplicationEngine } from '../engine/browser-application-engine.js';
import { AtsAdapterRegistry } from '../adapters/ats-adapter-registry.js';

export interface RunExecutionOptions {
  controller?: BrowserController;
  useFixture?: boolean;
}

/**
 * Executes a pending browser run by compiling Candidate Brain evidence and delegating
 * to the BrowserApplicationEngine.
 */
export async function executePendingBrowserRun(
  db: Database,
  runId: string,
  options: RunExecutionOptions = {},
): Promise<BrowserApplicationRunDto> {
  const [run] = await db
    .select()
    .from(browserApplicationRuns)
    .where(eq(browserApplicationRuns.id, runId));

  if (!run) {
    throw new Error(`Browser run not found: ${runId}`);
  }

  // 1. Compile Candidate Profile Facts
  const [profile] = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, run.userId));

  const names = (profile?.fullName ?? '').trim().split(/\s+/);
  const firstName = names[0] || profile?.preferredName || 'Candidate';
  const lastName = names.slice(1).join(' ') || '';

  // 2. Compile Links
  const links = await db.select().from(candidateLinks).where(eq(candidateLinks.userId, run.userId));

  const urls: Record<string, string> = {};
  for (const link of links) {
    urls[link.label.toLowerCase()] = link.url;
    urls[link.label] = link.url;
  }

  // 3. Compile Vault Documents
  const docs = await db
    .select()
    .from(candidateDocuments)
    .where(eq(candidateDocuments.userId, run.userId));

  const resumeDoc =
    docs.find(
      (d: (typeof docs)[number]) =>
        d.documentType === 'MASTER_CV' ||
        d.documentType === 'ROLE_CV' ||
        (d.documentType as string) === 'RESUME' ||
        (d.documentType as string) === 'DEFAULT_RESUME',
    ) ?? docs[0];

  // 4. Compile Answer Library
  const answersList = await db
    .select()
    .from(answerLibrary)
    .where(eq(answerLibrary.userId, run.userId));

  const answers: Record<
    string,
    { answerText: string; isSensitive?: boolean; verificationStatus?: string }
  > = {};
  for (const ans of answersList) {
    answers[ans.question] = {
      answerText: ans.answer,
      isSensitive: ans.isSensitive,
      verificationStatus: ans.verificationStatus,
    };
    answers[ans.category.toLowerCase()] = {
      answerText: ans.answer,
      isSensitive: ans.isSensitive,
      verificationStatus: ans.verificationStatus,
    };
  }

  // 5. Tailored Package Version if available
  let coverLetterText: string | undefined;
  if (run.packageVersionId) {
    const [pkgVer] = await db
      .select()
      .from(applicationPackageVersions)
      .where(eq(applicationPackageVersions.id, run.packageVersionId));
    if (pkgVer?.coverLetterContent) {
      coverLetterText = pkgVer.coverLetterContent;
    }
  }

  const payload: ApplicationSubmissionPayload = {
    firstName,
    lastName,
    fullName: profile?.fullName ?? `${firstName} ${lastName}`.trim(),
    email: profile?.email ?? 'candidate@example.com',
    phone: profile?.phone ?? undefined,
    location: profile?.city ? `${profile.city}, ${profile.region ?? ''}`.trim() : undefined,
    urls,
    resumeFileName: resumeDoc?.originalFilename ?? 'resume.pdf',
    coverLetterText,
    answers,
  };

  // 6. Select Browser Controller
  let controller: BrowserController;
  if (options.controller) {
    controller = options.controller;
  } else if (
    options.useFixture ||
    process.env.USE_FIXTURE_BROWSER === 'true' ||
    process.env.NODE_ENV === 'test'
  ) {
    controller = new FixtureBrowserController();
  } else {
    try {
      controller = new PlaywrightBrowserController({ headless: true });
    } catch {
      // Graceful fallback to fixture controller if Playwright browsers are uninstalled
      controller = new FixtureBrowserController();
    }
  }

  const engine = new BrowserApplicationEngine(controller, new AtsAdapterRegistry(), db);

  return await engine.executeRun({
    id: run.id,
    applicationId: run.applicationId,
    userId: run.userId,
    packageVersionId: run.packageVersionId,
    targetUrl: run.targetUrl,
    mode: run.mode as BrowserRunMode,
    payload,
    skipDb: false,
  });
}
