import { AutopilotService } from './services/autopilot-service.js';
import { createAutopilotRoutes } from './routes/autopilot-routes.js';
import { pruneBrowserEvidence } from './services/browser-evidence-retention.js';
import { PreparationBatchService } from './services/preparation-batch-service.js';
import { ApplicationIntentService } from './services/application-intent-service.js';
import { createApplicationIntentRoutes } from './routes/application-intent-routes.js';
import { JobSearchSettingsService } from './services/job-search-settings-service.js';
import { DailySearchService } from './services/daily-search-service.js';
import { createPreparationBatchRoutes } from './routes/preparation-batch-routes.js';
import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import {
  AppError,
  ErrorCodes,
  createLogger,
  Logger,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  type FileStorageProvider,
} from '@job-agent/shared';
import type { AppConfig } from '@job-agent/config';
import { getDb, type Database } from '@job-agent/database';
import { healthRoutes } from './routes/health.js';
import { createReadyRoutes } from './routes/ready.js';
import { createCandidateRoutes } from './routes/candidate.js';
import { CandidateService } from './services/candidate-service.js';
import { createJobRoutes } from './routes/job-routes.js';
import { JobService } from './services/job-service.js';
import { MatchService } from './services/match-service.js';
import { createApplicationPackageRoutes } from './routes/application-package-routes.js';
import { createApplicationCrmRoutes } from './routes/application-crm-routes.js';
import { createBrowserWorkerRoutes } from './routes/browser-worker-routes.js';
import { ApplicationPackageService } from './services/application-package-service.js';
import { createAiProvider, type AiProvider } from './ai/index.js';
import { createStorageProvider } from './storage/index.js';
import { createEmailRoutes } from './routes/email-routes.js';
import { EmailSyncService } from './services/email/email-sync-service.js';
import { EmailReviewService } from './services/email/email-review-service.js';
import { OAuthStateService } from './services/email/oauth-state-service.js';
import { TokenCryptoService } from './services/email/token-crypto-service.js';
import { FixtureEmailProvider } from './services/email/fixture-email-provider.js';
import { createCalendarRoutes } from './routes/calendar-routes.js';
import { CalendarService } from './services/calendar/calendar-service.js';
import { InterviewPreparationService } from './services/calendar/interview-preparation-service.js';
import { GoogleCalendarProvider } from './services/calendar/google-calendar-provider.js';
import { FixtureCalendarProvider } from './services/calendar/fixture-calendar-provider.js';
import { notificationRoutes } from './routes/notification-routes.js';
import { orchestratorRoutes } from './routes/orchestrator-routes.js';
import { authPlugin } from './plugins/auth-plugin.js';
import { createBetterAuthInstance, type BetterAuthInstance } from './auth/better-auth-instance.js';
import { pilotInvitationRoutes } from './routes/pilot-invitation-routes.js';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { PilotInvitationService } from './services/auth/pilot-invitation-service.js';
import { TransactionalEmailService } from './services/email/transactional-email-service.js';
import { JobDiscoveryService } from './services/job-discovery-service.js';
import { createSettingsRoutes } from './routes/settings-routes.js';
import { SmartProfileImportService } from './services/import/smart-profile-import-service.js';
import { createCandidateImportRoutes } from './routes/candidate-import-routes.js';
import { createCareerIntelligenceRoutes } from './routes/career-intelligence-routes.js';
import { CareerIntelligenceEnrichmentService } from './services/career-intelligence/career-intelligence-enrichment-service.js';
import { CandidateJobFeedbackService } from './services/career-intelligence/candidate-job-feedback-service.js';

export interface AppOptions {
  config: AppConfig;
  logger?: Logger;
  db?: Database;
  storage?: FileStorageProvider;
  candidateService?: CandidateService;
  jobService?: JobService;
  matchService?: MatchService;
  discoveryService?: JobDiscoveryService;
  packageService?: ApplicationPackageService;
  aiProvider?: AiProvider;
  emailSyncService?: EmailSyncService;
  emailReviewService?: EmailReviewService;
  fixtureEmailProvider?: FixtureEmailProvider;
  calendarService?: CalendarService;
  interviewPreparationService?: InterviewPreparationService;
  fixtureCalendarProvider?: FixtureCalendarProvider;
  auth?: BetterAuthInstance;
  pilotInvitationService?: PilotInvitationService;
  transactionalEmailService?: TransactionalEmailService;
  smartImportService?: SmartProfileImportService;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const { config } = options;
  const logger =
    options.logger ??
    createLogger({
      service: 'api',
      level: config.LOG_LEVEL,
      environment: config.NODE_ENV,
    });

  const app = fastify({
    logger: false, // We use our structured logger integration
    trustProxy: true, // Required for Railway and cloud reverse proxies to correctly detect HTTPS and host
  });

  // Enable CORS
  const corsOrigins = [config.WEB_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'];
  if (config.BETTER_AUTH_URL && !corsOrigins.includes(config.BETTER_AUTH_URL)) {
    corsOrigins.push(config.BETTER_AUTH_URL);
  }

  app.register(cors, {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Enable Multipart file uploads
  app.register(multipart, {
    limits: {
      fileSize: MAX_DOCUMENT_FILE_SIZE_BYTES,
    },
  });

  // Request logging hook
  app.addHook('onRequest', async (req) => {
    logger.debug(`Incoming request: ${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
      ip: req.ip,
    });
  });

  // AI Provider setup
  const aiProvider = options.aiProvider ?? createAiProvider(config);

  // Database resolution
  const db = options.db ?? (config.DATABASE_URL ? getDb(config.DATABASE_URL) : null);

  // Initialize Better Auth & Pilot Invitations
  let authInstance = options.auth;
  let invitationService = options.pilotInvitationService;

  if (db) {
    if (!invitationService) {
      invitationService = new PilotInvitationService(db);
    }
    const emailService = options.transactionalEmailService ?? new TransactionalEmailService(config);
    if (!authInstance) {
      authInstance = createBetterAuthInstance(db, config, emailService, invitationService);
    }
    app.register(authPlugin, { auth: authInstance, config, db });
    app.register(pilotInvitationRoutes, {
      prefix: '/api/pilot',
      db,
      invitationService,
      emailService,
      config,
    });
    app.register(pilotInvitationRoutes, {
      prefix: '/pilot',
      db,
      invitationService,
      emailService,
      config,
    });
  }

  // Register baseline routes
  app.register(healthRoutes);
  app.register(healthRoutes, { prefix: '/api' });
  app.register(createReadyRoutes(config, aiProvider));
  app.register(createReadyRoutes(config, aiProvider), { prefix: '/api' });
  app.register(createSettingsRoutes({ config, aiProvider, db: db ?? undefined }));

  // Initialize and register Candidate Brain routes
  let candidateService = options.candidateService;
  if (!candidateService && db) {
    const storage = options.storage ?? createStorageProvider(config);
    candidateService = new CandidateService(db, storage);
  }

  if (candidateService) {
    app.register(createCandidateRoutes(candidateService), { prefix: '/api' });
    // Also register at root /candidate/* for direct calls
    app.register(createCandidateRoutes(candidateService));

    // Initialize and register Smart Candidate Profile Import routes (JOB-SMART-PROFILE-IMPORT)
    let smartImportService = options.smartImportService;
    if (!smartImportService && db) {
      const storage = options.storage ?? createStorageProvider(config);
      const geminiApiKey = config.GEMINI_API_KEY || config.AI_API_KEY;
      smartImportService = new SmartProfileImportService(
        db,
        storage,
        candidateService,
        geminiApiKey,
        config.AI_MODEL,
      );
    }

    if (smartImportService) {
      const linkedInConfig = {
        clientId: (config as any).LINKEDIN_CLIENT_ID,
        configured: Boolean((config as any).LINKEDIN_CLIENT_ID),
      };
      app.register(createCandidateImportRoutes(smartImportService, linkedInConfig), {
        prefix: '/api',
      });
      app.register(createCandidateImportRoutes(smartImportService, linkedInConfig));
    }

    if (db) {
      const storage = options.storage ?? createStorageProvider(config);
      const careerEnrichmentService = new CareerIntelligenceEnrichmentService(
        db,
        aiProvider,
        storage,
      );
      const careerFeedbackService = new CandidateJobFeedbackService(db);
      app.register(
        createCareerIntelligenceRoutes(db, careerEnrichmentService, careerFeedbackService),
        { prefix: '/api' },
      );
      app.register(
        createCareerIntelligenceRoutes(db, careerEnrichmentService, careerFeedbackService),
      );
    }
  }

  // Initialize and register Job Ingestion & Match Intelligence routes
  let jobService = options.jobService;
  let matchService = options.matchService;
  let discoveryService = options.discoveryService;

  if (!jobService && db) {
    jobService = new JobService(db);
  }

  if (!matchService && db) {
    matchService = new MatchService(db, aiProvider);
  }

  if (!discoveryService && db && jobService) {
    discoveryService = new JobDiscoveryService(db, jobService, { logger });
  }

  if (jobService) {
    app.register(createJobRoutes(jobService, matchService, discoveryService), { prefix: '/api' });
    app.register(createJobRoutes(jobService, matchService, discoveryService));
  }

  // Initialize and register Application Studio & Human Approval routes
  let packageService = options.packageService;
  if (!packageService && db) {
    const storage = options.storage ?? createStorageProvider(config);
    packageService = new ApplicationPackageService(db, storage);
  }

  if (packageService && candidateService) {
    app.register(createApplicationPackageRoutes(packageService, candidateService), {
      prefix: '/api',
    });
    app.register(createApplicationPackageRoutes(packageService, candidateService));
  }

  if (db && config.NODE_ENV !== 'test') {
    let retentionTimer: ReturnType<typeof setInterval> | undefined;
    let retentionWork: Promise<unknown> | undefined;
    app.addHook('onReady', async () => {
      const prune = () => {
        if (retentionWork) return;
        retentionWork = pruneBrowserEvidence(db, options.storage ?? createStorageProvider(config))
          .catch(() => logger.error('Evidence retention failed'))
          .finally(() => {
            retentionWork = undefined;
          });
      };
      retentionTimer = setInterval(prune, 60 * 60_000);
      retentionTimer.unref();
      prune();
    });
    app.addHook('onClose', async () => {
      if (retentionTimer) clearInterval(retentionTimer);
      await retentionWork;
    });
  }
  if (db && packageService) {
    const batches = new PreparationBatchService(db, packageService);
    const intents = matchService
      ? new ApplicationIntentService(db, batches, packageService, matchService)
      : null;
    if (intents)
      app.register(
        createApplicationIntentRoutes(
          intents,
          config.SELECTED_SUBMISSIONS_ENABLED && config.BATCH_PREPARATION_ENABLED,
        ),
        { prefix: '/api' },
      );
    const autopilot =
      intents && matchService
        ? new AutopilotService(
            db,
            intents,
            matchService,
            config.AUTOPILOT_ENABLED &&
              config.SELECTED_SUBMISSIONS_ENABLED &&
              config.BATCH_PREPARATION_ENABLED,
          )
        : null;
    if (autopilot) app.register(createAutopilotRoutes(autopilot), { prefix: '/api' });
    const searchSettings = new JobSearchSettingsService(db);
    if (config.BATCH_PREPARATION_ENABLED)
      app.register(
        createPreparationBatchRoutes(batches, searchSettings, config.SELECTED_SUBMISSIONS_ENABLED),
        { prefix: '/api' },
      );
    if (config.NODE_ENV !== 'test' && config.BATCH_PREPARATION_ENABLED) {
      let active: Promise<void> | undefined;
      let timer: ReturnType<typeof setInterval> | undefined;
      let lastDaily = 0;
      app.addHook('onReady', async () => {
        const tick = () => {
          if (active) return;
          active = (async () => {
            await batches.processOrchestrationRequests();
            await batches.processOne();
            if (config.SELECTED_SUBMISSIONS_ENABLED && config.BATCH_PREPARATION_ENABLED)
              await intents?.processPending();
            if (discoveryService && matchService && Date.now() - lastDaily > 60_000) {
              lastDaily = Date.now();
              await autopilot?.runDue();
              await new DailySearchService(db, discoveryService, batches, matchService).runDue();
            }
          })()
            .catch((error) => logger.error('Background preparation failed', undefined, error))
            .finally(() => {
              active = undefined;
            });
        };
        timer = setInterval(tick, 5000);
        timer.unref();
        tick();
      });
      app.addHook('onClose', async () => {
        if (timer) clearInterval(timer);
        await active;
      });
    }
  }

  // Initialize and register Application CRM routes
  if (candidateService) {
    app.register(createApplicationCrmRoutes(candidateService), { prefix: '/api' });
    app.register(createApplicationCrmRoutes(candidateService));

    // Initialize and register Browser Application Worker routes
    app.register(createBrowserWorkerRoutes(candidateService), { prefix: '/api' });
    app.register(createBrowserWorkerRoutes(candidateService));
  }

  // Initialize and register Email Intelligence routes
  let emailSyncService = options.emailSyncService;
  let emailReviewService = options.emailReviewService;
  if (!emailSyncService && db && candidateService) {
    emailSyncService = new EmailSyncService(config, {
      db,
      fixtureProvider: options.fixtureEmailProvider,
    });
  }
  if (!emailReviewService && db) {
    emailReviewService = new EmailReviewService(db);
  }

  if (emailSyncService && emailReviewService && candidateService) {
    const oauthStateService = new OAuthStateService(
      config.EMAIL_TOKEN_ENCRYPTION_KEY,
      db ?? undefined,
    );
    const tokenCryptoService = new TokenCryptoService(config.EMAIL_TOKEN_ENCRYPTION_KEY);

    app.register(
      createEmailRoutes({
        candidateService,
        emailSyncService,
        emailReviewService,
        oauthStateService,
        tokenCryptoService,
      }),
      { prefix: '/api' },
    );
    app.register(
      createEmailRoutes({
        candidateService,
        emailSyncService,
        emailReviewService,
        oauthStateService,
        tokenCryptoService,
      }),
    );
  }

  // Initialize and register Calendar & Interview Preparation routes
  if (candidateService && db) {
    let calendarService = options.calendarService;
    let prepService = options.interviewPreparationService;

    if (!calendarService) {
      const tokenCryptoService = new TokenCryptoService(config.EMAIL_TOKEN_ENCRYPTION_KEY);
      const fixtureProvider = options.fixtureCalendarProvider ?? new FixtureCalendarProvider();
      const googleProvider = new GoogleCalendarProvider({
        clientId: config.GOOGLE_CALENDAR_CLIENT_ID,
        clientSecret: config.GOOGLE_CALENDAR_CLIENT_SECRET,
        redirectUri: config.GOOGLE_CALENDAR_REDIRECT_URI,
      });

      calendarService = new CalendarService({
        db,
        cryptoService: tokenCryptoService,
        googleProvider,
        fixtureProvider,
        logger,
      });
    }

    if (!prepService) {
      prepService = new InterviewPreparationService({ db, logger });
    }

    const oauthStateService = new OAuthStateService(
      config.EMAIL_TOKEN_ENCRYPTION_KEY,
      db ?? undefined,
    );

    app.register(
      createCalendarRoutes({
        candidateService,
        calendarService,
        prepService,
        webOrigin: config.WEB_ORIGIN,
        oauthStateService,
      }),
      { prefix: '/api' },
    );
    app.register(
      createCalendarRoutes({
        candidateService,
        calendarService,
        prepService,
        webOrigin: config.WEB_ORIGIN,
        oauthStateService,
      }),
    );
  }

  // Initialize and register System Notifications & Autonomous Orchestrator routes (JOB-P5-T02)
  if (db) {
    app.register(notificationRoutes, { prefix: '/api/notifications', db });
    app.register(notificationRoutes, { prefix: '/notifications', db });

    app.register(orchestratorRoutes, { prefix: '/api/orchestrator', db, config });
    app.register(orchestratorRoutes, { prefix: '/orchestrator', db, config });
  }

  // Production static web assets & SPA fallback
  let webDistPath = path.resolve(process.cwd(), 'apps/web/dist');
  if (!fs.existsSync(webDistPath)) {
    webDistPath = path.resolve(process.cwd(), '../web/dist');
  }
  if (!fs.existsSync(webDistPath)) {
    webDistPath = path.resolve(process.cwd(), '../../apps/web/dist');
  }
  const serveWeb =
    (config.NODE_ENV === 'production' || process.env.SERVE_STATIC === 'true') &&
    fs.existsSync(webDistPath);

  if (serveWeb) {
    app.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
      wildcard: false,
    });
  }

  // Custom 404 Not Found handler
  app.setNotFoundHandler(async (req, reply) => {
    if (
      serveWeb &&
      req.method === 'GET' &&
      !req.url.startsWith('/api') &&
      !req.url.startsWith('/auth') &&
      !req.url.startsWith('/health')
    ) {
      return reply.sendFile('index.html');
    }

    logger.warn(`Route not found: ${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
    });

    reply.status(404).send({
      status: 'error',
      error: {
        code: ErrorCodes.NOT_FOUND,
        message: `Route ${req.method} ${req.url} not found`,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Centralized error handler
  app.setErrorHandler(async (error: unknown, req, reply) => {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        logger.error(
          `Application error: ${error.message}`,
          { code: error.code, url: req.url },
          error,
        );
      } else {
        logger.warn(`Client operational error: ${error.message}`, {
          code: error.code,
          url: req.url,
        });
      }

      reply.status(error.statusCode).send({
        status: 'error',
        error: error.toJSON(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (error instanceof z.ZodError) {
      logger.warn(`Validation error on ${req.method} ${req.url}`, {
        issues: error.issues,
      });
      reply.status(400).send({
        status: 'error',
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
          details: error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const errObj = error instanceof Error ? error : new Error(String(error));
    const isObject = typeof error === 'object' && error !== null;
    const hasValidation = isObject && 'validation' in error;

    // Fastify schema validation errors
    if (hasValidation) {
      const validationDetails = (error as { validation: unknown }).validation;
      logger.warn(`Validation error on ${req.method} ${req.url}`, {
        validation: validationDetails,
      });
      reply.status(400).send({
        status: 'error',
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: errObj.message,
          details: validationDetails,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Unexpected internal errors: hide stack and internal details from client
    logger.error(
      `Unhandled internal error on ${req.method} ${req.url}: ${errObj.message}`,
      { url: req.url },
      errObj,
    );

    reply.status(500).send({
      status: 'error',
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message:
          config.NODE_ENV === 'production'
            ? 'An unexpected internal error occurred'
            : errObj.message,
      },
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
