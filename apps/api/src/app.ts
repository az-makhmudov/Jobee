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
import { LocalStorageProvider } from './storage/local-storage.js';
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

export interface AppOptions {
  config: AppConfig;
  logger?: Logger;
  db?: Database;
  storage?: FileStorageProvider;
  candidateService?: CandidateService;
  jobService?: JobService;
  matchService?: MatchService;
  packageService?: ApplicationPackageService;
  aiProvider?: AiProvider;
  emailSyncService?: EmailSyncService;
  emailReviewService?: EmailReviewService;
  fixtureEmailProvider?: FixtureEmailProvider;
  calendarService?: CalendarService;
  interviewPreparationService?: InterviewPreparationService;
  fixtureCalendarProvider?: FixtureCalendarProvider;
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
  });

  // Enable CORS
  app.register(cors, {
    origin: [config.WEB_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
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

  // Register baseline routes
  app.register(healthRoutes);
  app.register(healthRoutes, { prefix: '/api' });
  app.register(createReadyRoutes(config));
  app.register(createReadyRoutes(config), { prefix: '/api' });

  // Initialize and register Candidate Brain routes
  let candidateService = options.candidateService;
  if (!candidateService) {
    const db = options.db ?? (config.DATABASE_URL ? getDb(config.DATABASE_URL) : null);
    if (db) {
      const storage = options.storage ?? new LocalStorageProvider();
      candidateService = new CandidateService(db, storage);
    }
  }

  if (candidateService) {
    app.register(createCandidateRoutes(candidateService), { prefix: '/api' });
    // Also register at root /candidate/* for direct calls
    app.register(createCandidateRoutes(candidateService));
  }

  // Initialize and register Job Ingestion & Match Intelligence routes
  let jobService = options.jobService;
  let matchService = options.matchService;
  const db = options.db ?? (config.DATABASE_URL ? getDb(config.DATABASE_URL) : null);

  if (!jobService && db) {
    jobService = new JobService(db);
  }

  if (!matchService && db) {
    const aiProvider = options.aiProvider ?? createAiProvider(config);
    matchService = new MatchService(db, aiProvider);
  }

  if (jobService) {
    app.register(createJobRoutes(jobService, matchService), { prefix: '/api' });
    app.register(createJobRoutes(jobService, matchService));
  }

  // Initialize and register Application Studio & Human Approval routes
  let packageService = options.packageService;
  if (!packageService && db) {
    const storage = options.storage ?? new LocalStorageProvider();
    packageService = new ApplicationPackageService(db, storage);
  }

  if (packageService && candidateService) {
    app.register(createApplicationPackageRoutes(packageService, candidateService), {
      prefix: '/api',
    });
    app.register(createApplicationPackageRoutes(packageService, candidateService));
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
        oauthStateService,
      }),
      { prefix: '/api' },
    );
    app.register(
      createCalendarRoutes({
        candidateService,
        calendarService,
        prepService,
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

  // Custom 404 Not Found handler
  app.setNotFoundHandler(async (req, reply) => {
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
