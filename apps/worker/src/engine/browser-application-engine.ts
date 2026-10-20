import type { BrowserController, BrowserPage } from '../browser/browser-controller.js';
import { AtsAdapterRegistry } from '../adapters/ats-adapter-registry.js';
import {
  AtsProviderType,
  inferHostedAtsProvider,
  BrowserRunMode,
  type FileStorageProvider,
  type SubmissionObservation,
  BrowserRunStatus,
  AtsFormFieldType,
  type AtsFormField,
  type BrowserRunStepLog,
  type ApplicationSubmissionPayload,
  type BrowserApplicationRunDto,
} from '@job-agent/shared';
import {
  browserApplicationRuns,
  applicationLifecycleEvents,
  applications,
  type Database,
} from '@job-agent/database';
import { eq } from 'drizzle-orm';

export interface ExecuteBrowserRunParams {
  id?: string;
  applicationId: string;
  userId: string;
  packageVersionId?: string | null;
  targetUrl: string;
  mode?: BrowserRunMode;
  payload: ApplicationSubmissionPayload;
  skipDb?: boolean;
  beforeSubmit?: () => Promise<void>;
}

/**
 * Browser Application Engine (JOB-P5-T01)
 *
 * Coordinates ATS identification, bot challenge detection, form schema extraction,
 * deterministic candidate brain fact matching, safe filling, and controlled execution.
 */
export class BrowserApplicationEngine {
  constructor(
    private readonly browserController: BrowserController,
    private readonly adapterRegistry: AtsAdapterRegistry = new AtsAdapterRegistry(),
    private readonly db?: Database,
    private readonly storage?: FileStorageProvider,
  ) {}

  async executeRun(params: ExecuteBrowserRunParams): Promise<BrowserApplicationRunDto> {
    const runId = params.id ?? crypto.randomUUID();
    const mode = params.mode ?? BrowserRunMode.DRY_RUN;
    const now = new Date();
    const stepLogs: BrowserRunStepLog[] = [];
    const screenshotPaths: string[] = [];

    const logStep = (
      step: string,
      action: string,
      status: 'OK' | 'WARNING' | 'ERROR' = 'OK',
      details?: string,
      selector?: string,
    ) => {
      stepLogs.push({
        step,
        action,
        timestamp: new Date().toISOString(),
        status,
        details,
        selector,
      });
    };

    let atsProvider: AtsProviderType = AtsProviderType.UNKNOWN;
    let fieldsDetectedCount = 0;
    let fieldsFilledCount = 0;
    const unmatchedRequiredFields: AtsFormField[] = [];
    let runStatus: BrowserRunStatus = BrowserRunStatus.RUNNING;
    let confirmationReference: string | undefined;
    let submissionObservation: SubmissionObservation | undefined;
    const capture = async (label: string) => {
      if (!page || !this.storage?.putFile) return;
      try {
        const buffer = await page.screenshot({ fullPage: false });
        const key = `browser-${runId}-${label}.png`;
        await this.storage.putFile(key, buffer, 'image/png');
        if (await this.storage.exists(key)) screenshotPaths.push(key);
      } catch {
        logStep('EVIDENCE', 'Screenshot could not be retained.', 'WARNING');
      }
    };
    let errorMessage: string | undefined;
    let submissionDispatched = false;

    // 1. Initial DB Persistence (if db available)
    if (this.db && !params.skipDb) {
      try {
        await this.db
          .insert(browserApplicationRuns)
          .values({
            id: runId,
            applicationId: params.applicationId,
            userId: params.userId,
            packageVersionId: params.packageVersionId ?? null,
            atsProvider: atsProvider,
            targetUrl: params.targetUrl,
            mode: mode,
            status: BrowserRunStatus.RUNNING,
            fieldsDetectedCount: 0,
            fieldsFilledCount: 0,
            unmatchedRequiredFields: [],
            stepLogs: [],
            screenshotPaths: [],
            startedAt: now,
          })
          .onConflictDoUpdate({
            target: browserApplicationRuns.id,
            set: {
              status: BrowserRunStatus.RUNNING,
              startedAt: now,
              atsProvider: atsProvider,
              mode: mode,
              updatedAt: now,
            },
          });
      } catch (err: any) {
        logStep('INIT', `Warning: Could not create or claim DB record: ${err.message}`, 'WARNING');
      }
    }

    let page: BrowserPage | null = null;

    try {
      logStep('INITIALIZATION', `Starting browser run in ${mode} mode for ${params.targetUrl}`);
      page = await this.browserController.newPage();

      // 2. Navigation
      logStep('NAVIGATION', `Navigating to target URL: ${params.targetUrl}`);
      await page.goto(params.targetUrl, { waitUntil: 'domcontentloaded' });
      logStep('NAVIGATION', 'Page loaded successfully');

      // 3. Adapter Resolution
      const pageContent = await page.content();
      const adapter = this.adapterRegistry.resolveAdapter(params.targetUrl, pageContent);
      atsProvider = adapter.provider;
      logStep('ADAPTER_RESOLUTION', `Resolved ATS provider: ${atsProvider}`);

      if (
        mode === BrowserRunMode.SUBMIT &&
        (inferHostedAtsProvider(page.url()) !== atsProvider ||
          inferHostedAtsProvider(params.targetUrl) !== atsProvider)
      )
        throw new Error(
          'This application requires the employer website. The form or destination is unsupported.',
        );

      // 4. Challenge Detection (Prime Invariant: Stop on Bot Challenges)
      const challenge = await adapter.detectChallenge(page);
      if (challenge.detected) {
        logStep(
          'CHALLENGE_DETECTION',
          `Automated execution halted: ${challenge.type} detected`,
          'WARNING',
          challenge.message,
          challenge.selector,
        );
        runStatus = BrowserRunStatus.STOPPED_CAPTCHA;
        errorMessage = challenge.message ?? `Halted due to ${challenge.type}`;

        await capture('challenge');

        return await this.finalizeRun({
          runId,
          params,
          atsProvider,
          mode,
          runStatus,
          fieldsDetectedCount,
          fieldsFilledCount,
          unmatchedRequiredFields,
          stepLogs,
          screenshotPaths,
          startedAt: now,
          confirmationReference,
          submissionObservation,
          errorMessage,
        });
      }

      // 5. Form Schema Extraction
      logStep('FORM_EXTRACTION', 'Extracting form schema and interactive fields...');
      const schema = await adapter.extractForm(page);
      fieldsDetectedCount = schema.fields.length;
      if (!fieldsDetectedCount)
        throw new Error('No supported application form was found. The listing may have closed.');
      logStep(
        'FORM_EXTRACTION',
        `Discovered ${fieldsDetectedCount} fields across form`,
        'OK',
        `Job Title: ${schema.jobTitle ?? 'N/A'}, Company: ${schema.company ?? 'N/A'}`,
      );

      // 6. Field Value Matching & Zero-Hallucination Invariant Check
      logStep('FIELD_MATCHING', 'Matching candidate verified facts to extracted fields...');
      const fieldValuesToFill: Array<{ field: AtsFormField; value: string }> = [];

      for (const field of schema.fields) {
        if (
          field.type === AtsFormFieldType.FILE_RESUME ||
          field.type === AtsFormFieldType.FILE_COVER_LETTER
        ) {
          const isLetter = field.type === AtsFormFieldType.FILE_COVER_LETTER;
          const filePath = isLetter
            ? params.payload.coverLetterFilePath
            : params.payload.resumeFilePath;
          const buffer = isLetter ? params.payload.coverLetterBuffer : params.payload.resumeBuffer;
          const filename = isLetter
            ? params.payload.coverLetterFileName
            : params.payload.resumeFileName;
          if (filePath || buffer)
            fieldValuesToFill.push({
              field,
              value: filePath || filename || 'application-document.docx',
            });
          else if (field.required) unmatchedRequiredFields.push(field);
          continue;
        }

        const resolvedValue = adapter.resolveFieldValue(field, params.payload);
        if (resolvedValue !== undefined && resolvedValue !== '') {
          fieldValuesToFill.push({ field, value: resolvedValue });
        } else if (field.required) {
          unmatchedRequiredFields.push(field);
        }
      }

      // 7. Human Review Invariant: Never guess missing required candidate fields
      if (unmatchedRequiredFields.length > 0) {
        const missingLabels = unmatchedRequiredFields.map((f) => f.label).join(', ');
        logStep(
          'INVARIANT_CHECK',
          `Halted: Found ${unmatchedRequiredFields.length} required field(s) without verified candidate facts: [${missingLabels}]`,
          'ERROR',
          'Prime Invariant: AI must never invent candidate qualifications or answers.',
        );
        runStatus = BrowserRunStatus.STOPPED_MANUAL_REVIEW;
        errorMessage = `Missing verified answers for required fields: ${missingLabels}`;

        await capture('missing-fields');

        return await this.finalizeRun({
          runId,
          params,
          atsProvider,
          mode,
          runStatus,
          fieldsDetectedCount,
          fieldsFilledCount,
          unmatchedRequiredFields,
          stepLogs,
          screenshotPaths,
          startedAt: now,
          confirmationReference,
          submissionObservation,
          errorMessage,
        });
      }

      logStep(
        'INVARIANT_CHECK',
        `All ${fieldValuesToFill.length} applicable fields successfully matched with verified candidate facts.`,
      );

      // 8. Field Filling Execution
      for (const item of fieldValuesToFill) {
        const { field, value } = item;
        try {
          const loc = page.locator(field.selector).first();
          if ((await loc.count()) === 0) {
            logStep(
              'FIELD_FILL',
              `Skipping field '${field.label}' (${field.selector}): selector not found in DOM`,
              'WARNING',
            );
            if (field.required) unmatchedRequiredFields.push(field);
            continue;
          }

          if (
            field.type === AtsFormFieldType.FILE_RESUME ||
            field.type === AtsFormFieldType.FILE_COVER_LETTER
          ) {
            const isLetter = field.type === AtsFormFieldType.FILE_COVER_LETTER;
            const buffer = isLetter
              ? params.payload.coverLetterBuffer
              : params.payload.resumeBuffer;
            if (buffer)
              await loc.setInputFiles({
                name:
                  (isLetter ? params.payload.coverLetterFileName : params.payload.resumeFileName) ||
                  'application-document.docx',
                mimeType:
                  (isLetter ? params.payload.coverLetterMimeType : params.payload.resumeMimeType) ||
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                buffer: Buffer.from(buffer, 'base64'),
              });
            else await loc.setInputFiles(value);
            logStep(
              'FIELD_FILL',
              `Uploaded reviewed document to '${field.label}'`,
              'OK',
              undefined,
              field.selector,
            );
          } else if (field.type === AtsFormFieldType.SELECT) {
            await adapter.selectDropdownOption(loc, value, field.options);
            logStep(
              'FIELD_FILL',
              `Selected option '${value}' for '${field.label}'`,
              'OK',
              undefined,
              field.selector,
            );
          } else if (field.type === AtsFormFieldType.CHECKBOX) {
            if (value.toLowerCase() === 'true' || value.toLowerCase() === 'yes') {
              await loc.check();
              logStep(
                'FIELD_FILL',
                `Checked box '${field.label}'`,
                'OK',
                undefined,
                field.selector,
              );
            }
          } else {
            await loc.fill(value);
            logStep('FIELD_FILL', `Filled field '${field.label}'`, 'OK', undefined, field.selector);
          }
          fieldsFilledCount++;
        } catch (fillErr: any) {
          if (field.required) unmatchedRequiredFields.push(field);
          logStep(
            'FIELD_FILL',
            `Error filling field '${field.label}' (${field.selector}): ${fillErr.message}`,
            'WARNING',
          );
        }
      }

      logStep(
        'FILLING_COMPLETE',
        `Filled ${fieldsFilledCount} of ${fieldsDetectedCount} detected fields.`,
      );

      if (unmatchedRequiredFields.length)
        throw new Error(
          'Required fields could not be filled. Review the employer form before applying.',
        );

      // 9. Mode Execution
      if (mode === BrowserRunMode.DRY_RUN) {
        logStep(
          'DRY_RUN',
          'DRY_RUN mode active: Form filled and validated without submission.',
          'OK',
        );
        await capture('dry-run');
        runStatus = BrowserRunStatus.SUCCESS;
      } else if (mode === BrowserRunMode.PREFILL_ONLY) {
        logStep(
          'PREFILL_ONLY',
          'PREFILL_ONLY mode active: Form prefilled and left active for candidate review.',
          'OK',
        );
        await capture('prefilled');
        runStatus = BrowserRunStatus.SUCCESS;
      } else if (mode === BrowserRunMode.SUBMIT) {
        if (atsProvider === AtsProviderType.OTHER || atsProvider === AtsProviderType.UNKNOWN)
          throw new Error('This form supports inspection only. Apply on the employer website.');
        const originalHtml = await page.content();
        logStep('SUBMISSION', 'SUBMIT mode active: Locating submit control...');
        const submitButton = page
          .locator(
            'button[type="submit"], input[type="submit"], #submit_app, .template-btn-submit, #ashby-submit-btn',
          )
          .first();

        if ((await submitButton.count()) > 0) {
          await params.beforeSubmit?.();
          logStep(
            'SUBMISSION_DISPATCHING',
            'Dispatching submission action to external provider...',
            'OK',
          );

          // Persist step logs before clicking submit so that an immediate process kill/crash
          // retains durable evidence that the submission action was in-flight
          if (this.db && !params.skipDb) {
            try {
              await this.db
                .update(browserApplicationRuns)
                .set({ stepLogs, updatedAt: new Date() })
                .where(eq(browserApplicationRuns.id, runId));
            } catch {
              throw new Error('Could not persist the submission attempt. No application was sent.');
            }
          }

          try {
            await capture('before-submit');
            submissionDispatched = true;
            await submitButton.click();
            submissionObservation = await adapter.observeSubmission(page, originalHtml);
            logStep(
              'EMPLOYER_OBSERVATION',
              submissionObservation.signal,
              submissionObservation.outcome === 'ACCEPTED' ? 'OK' : 'WARNING',
              JSON.stringify(submissionObservation),
            );
            if (submissionObservation.outcome !== 'ACCEPTED')
              throw new Error(submissionObservation.signal);
          } catch (clickErr: any) {
            logStep(
              'SUBMISSION_UNCERTAIN',
              `Submission action was dispatched but encountered error/timeout: ${clickErr.message}. Marked SUBMISSION_UNCERTAIN to prevent duplicate external submission.`,
              'ERROR',
            );
            runStatus =
              submissionObservation?.outcome === 'REJECTED'
                ? BrowserRunStatus.VALIDATION_FAILED
                : BrowserRunStatus.SUBMISSION_UNCERTAIN;
            errorMessage =
              submissionObservation?.outcome === 'REJECTED'
                ? 'The employer form rejected the application. Correct the highlighted fields.'
                : `Confirmation needed: ${clickErr.message}`;
            await capture('confirmation-needed');

            if (this.db && !params.skipDb) {
              try {
                await this.db
                  .update(applications)
                  .set({
                    status: 'NEEDS_REVIEW',
                    updatedAt: new Date(),
                  })
                  .where(eq(applications.id, params.applicationId));

                await this.db.insert(applicationLifecycleEvents).values({
                  id: crypto.randomUUID(),
                  applicationId: params.applicationId,
                  userId: params.userId,
                  eventType: 'SUBMISSION_UNCERTAIN',
                  previousStatus: 'READY_TO_APPLY',
                  newStatus: 'NEEDS_REVIEW',
                  actor: 'WORKER',
                  note: `Submission action was dispatched but encountered an error. Status set to NEEDS_REVIEW to prevent automatic duplicate retries. (${clickErr.message})`,
                  safeMetadata: {
                    runId,
                    atsProvider,
                    mode,
                    error: clickErr.message,
                  },
                });
              } catch (crmErr: any) {
                logStep(
                  'LIFECYCLE',
                  `Warning: Failed to update CRM application/event: ${crmErr.message}`,
                  'WARNING',
                );
              }
            }

            return await this.finalizeRun({
              runId,
              params,
              atsProvider,
              mode,
              runStatus,
              fieldsDetectedCount,
              fieldsFilledCount,
              unmatchedRequiredFields,
              stepLogs,
              screenshotPaths,
              startedAt: now,
              confirmationReference,
              submissionObservation,
              errorMessage,
            });
          }

          confirmationReference = submissionObservation?.employerReference;
          logStep(
            'SUBMISSION',
            `Employer confirmation observed. Internal attempt ID: ${runId}`,
            'OK',
          );

          // Update CRM application to APPLIED and record immutable lifecycle event
          if (this.db && !params.skipDb) {
            try {
              await this.db
                .update(applications)
                .set({
                  status: 'APPLIED',
                  appliedAt: new Date(),
                  submittedPackageVersionId: params.packageVersionId ?? null,
                  submissionMethod: atsProvider,
                  externalReferenceId: confirmationReference,
                  updatedAt: new Date(),
                })
                .where(eq(applications.id, params.applicationId));

              await this.db.insert(applicationLifecycleEvents).values({
                id: crypto.randomUUID(),
                applicationId: params.applicationId,
                userId: params.userId,
                eventType: 'SUBMITTED',
                previousStatus: 'READY_TO_APPLY',
                newStatus: 'APPLIED',
                actor: 'WORKER',
                note: `Automated browser application submission (${atsProvider})`,
                safeMetadata: {
                  runId,
                  confirmationReference,
                  submissionObservation,
                  atsProvider,
                  mode,
                },
              });
            } catch (eventErr: any) {
              logStep(
                'LIFECYCLE',
                `Warning: Failed to log lifecycle event: ${eventErr.message}`,
                'WARNING',
              );
            }
          }

          await capture('submitted');
          runStatus = BrowserRunStatus.SUCCESS;
        } else {
          logStep('SUBMISSION', 'Submit button not located in DOM', 'ERROR');
          runStatus = BrowserRunStatus.VALIDATION_FAILED;
          errorMessage = 'Submit button not located in DOM';
        }
      }
    } catch (error: any) {
      logStep(
        'ERROR',
        `Unexpected runtime error during browser execution: ${error.message}`,
        'ERROR',
      );
      if (submissionDispatched) {
        runStatus = BrowserRunStatus.SUBMISSION_UNCERTAIN;
        errorMessage = `Submission uncertain: Runtime error after submission was dispatched: ${error.message}`;
        if (this.db && !params.skipDb) {
          try {
            await this.db
              .update(applications)
              .set({ status: 'NEEDS_REVIEW', updatedAt: new Date() })
              .where(eq(applications.id, params.applicationId));
          } catch {
            // ignore
          }
        }
      } else {
        runStatus = BrowserRunStatus.FAILED;
        errorMessage = error.message;
      }
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {
          // ignore page close errors
        }
      }
    }

    return await this.finalizeRun({
      runId,
      params,
      atsProvider,
      mode,
      runStatus,
      fieldsDetectedCount,
      fieldsFilledCount,
      unmatchedRequiredFields,
      stepLogs,
      screenshotPaths,
      startedAt: now,
      confirmationReference,
      submissionObservation,
      errorMessage,
    });
  }

  private async finalizeRun(data: {
    runId: string;
    params: ExecuteBrowserRunParams;
    atsProvider: AtsProviderType;
    mode: BrowserRunMode;
    runStatus: BrowserRunStatus;
    fieldsDetectedCount: number;
    fieldsFilledCount: number;
    unmatchedRequiredFields: AtsFormField[];
    stepLogs: BrowserRunStepLog[];
    screenshotPaths: string[];
    startedAt: Date;
    confirmationReference?: string;
    submissionObservation?: SubmissionObservation;
    errorMessage?: string;
  }): Promise<BrowserApplicationRunDto> {
    const completedAt = new Date();

    if (this.db && !data.params.skipDb) {
      try {
        await this.db
          .update(browserApplicationRuns)
          .set({
            atsProvider: data.atsProvider,
            mode: data.mode,
            status: data.runStatus,
            fieldsDetectedCount: data.fieldsDetectedCount,
            fieldsFilledCount: data.fieldsFilledCount,
            unmatchedRequiredFields: data.unmatchedRequiredFields,
            stepLogs: data.stepLogs,
            screenshotPaths: data.screenshotPaths,
            confirmationReference: data.confirmationReference ?? null,
            submissionObservation: data.submissionObservation ?? null,
            errorMessage: data.errorMessage ?? null,
            completedAt,
          })
          .where(eq(browserApplicationRuns.id, data.runId));
      } catch (err: any) {
        data.stepLogs.push({
          step: 'DB_FINALIZE',
          action: `Warning: Failed to update DB record: ${err.message}`,
          timestamp: new Date().toISOString(),
          status: 'WARNING',
        });
      }
    }

    return {
      id: data.runId,
      applicationId: data.params.applicationId,
      userId: data.params.userId,
      packageVersionId: data.params.packageVersionId ?? null,
      atsProvider: data.atsProvider,
      targetUrl: data.params.targetUrl,
      mode: data.mode,
      status: data.runStatus,
      fieldsDetectedCount: data.fieldsDetectedCount,
      fieldsFilledCount: data.fieldsFilledCount,
      unmatchedRequiredFields: data.unmatchedRequiredFields,
      stepLogs: data.stepLogs,
      screenshotPaths: data.screenshotPaths,
      confirmationReference: data.confirmationReference ?? null,
      submissionObservation: data.submissionObservation ?? null,
      errorMessage: data.errorMessage ?? null,
      startedAt: data.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      createdAt: data.startedAt.toISOString(),
      updatedAt: completedAt.toISOString(),
    };
  }
}
