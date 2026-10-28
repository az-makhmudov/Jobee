import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { AppError, ErrorCodes } from '@job-agent/shared';

// Attempt to load .env from process.cwd() or parent directories
function findAndLoadDotenv(): void {
  let currentDir = process.cwd();
  for (let i = 0; i < 4; i++) {
    const envPath = path.join(currentDir, '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      return;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
}

findAndLoadDotenv();

export const envSchema = z
  .preprocess(
    (raw: unknown) => {
      if (typeof raw === 'object' && raw !== null) {
        const r = { ...(raw as Record<string, unknown>) };
        const port = r.API_PORT ?? r.PORT;
        if (port !== undefined && port !== '') {
          r.API_PORT = port;
        }

        // Auto-detect Railway public domain or HTTPS BETTER_AUTH_URL for Better Auth, CORS, and OAuth redirects
        const railwayDomain = (r.RAILWAY_PUBLIC_DOMAIN || r.RAILWAY_STATIC_URL) as
          string | undefined;
        let publicUrl: string | undefined = undefined;
        if (railwayDomain && typeof railwayDomain === 'string' && railwayDomain.trim() !== '') {
          publicUrl = railwayDomain.startsWith('http')
            ? railwayDomain.trim()
            : `https://${railwayDomain.trim()}`;
          if (!r.BETTER_AUTH_URL || r.BETTER_AUTH_URL === 'http://127.0.0.1:3000') {
            r.BETTER_AUTH_URL = publicUrl;
          }
          if (!r.WEB_ORIGIN || r.WEB_ORIGIN === 'http://localhost:5173') {
            r.WEB_ORIGIN = publicUrl;
          }
          if (
            !r.BETTER_AUTH_TRUSTED_ORIGINS ||
            r.BETTER_AUTH_TRUSTED_ORIGINS === 'http://localhost:5173,http://127.0.0.1:5173'
          ) {
            r.BETTER_AUTH_TRUSTED_ORIGINS = publicUrl;
          }
        } else if (
          typeof r.BETTER_AUTH_URL === 'string' &&
          r.BETTER_AUTH_URL.startsWith('https://')
        ) {
          publicUrl = r.BETTER_AUTH_URL.trim();
        }

        // Reuse existing Google OAuth credentials for Gmail and Calendar if not explicitly configured
        const googleClientId = (r.GOOGLE_CLIENT_ID ||
          r.GMAIL_CLIENT_ID ||
          r.GOOGLE_CALENDAR_CLIENT_ID) as string | undefined;
        const googleClientSecret = (r.GOOGLE_CLIENT_SECRET ||
          r.GMAIL_CLIENT_SECRET ||
          r.GOOGLE_CALENDAR_CLIENT_SECRET) as string | undefined;

        if (googleClientId && typeof googleClientId === 'string' && googleClientId.trim() !== '') {
          const cid = googleClientId.trim();
          if (!r.GMAIL_CLIENT_ID || r.GMAIL_CLIENT_ID === '') {
            r.GMAIL_CLIENT_ID = cid;
          }
          if (!r.GOOGLE_CALENDAR_CLIENT_ID || r.GOOGLE_CALENDAR_CLIENT_ID === '') {
            r.GOOGLE_CALENDAR_CLIENT_ID = cid;
          }
        }

        if (
          googleClientSecret &&
          typeof googleClientSecret === 'string' &&
          googleClientSecret.trim() !== ''
        ) {
          const csec = googleClientSecret.trim();
          if (!r.GMAIL_CLIENT_SECRET || r.GMAIL_CLIENT_SECRET === '') {
            r.GMAIL_CLIENT_SECRET = csec;
          }
          if (!r.GOOGLE_CALENDAR_CLIENT_SECRET || r.GOOGLE_CALENDAR_CLIENT_SECRET === '') {
            r.GOOGLE_CALENDAR_CLIENT_SECRET = csec;
          }
        }

        // Auto-configure production OAuth redirect URIs when publicUrl is present
        if (publicUrl) {
          if (
            !r.GMAIL_REDIRECT_URI ||
            r.GMAIL_REDIRECT_URI === 'http://127.0.0.1:3000/api/email/accounts/gmail/callback' ||
            (typeof r.GMAIL_REDIRECT_URI === 'string' &&
              (r.GMAIL_REDIRECT_URI.includes('127.0.0.1') ||
                r.GMAIL_REDIRECT_URI.includes('localhost')))
          ) {
            r.GMAIL_REDIRECT_URI = `${publicUrl}/api/email/accounts/gmail/callback`;
          }
          if (
            !r.GOOGLE_CALENDAR_REDIRECT_URI ||
            r.GOOGLE_CALENDAR_REDIRECT_URI ===
              'http://127.0.0.1:3000/api/calendar/google/callback' ||
            (typeof r.GOOGLE_CALENDAR_REDIRECT_URI === 'string' &&
              (r.GOOGLE_CALENDAR_REDIRECT_URI.includes('127.0.0.1') ||
                r.GOOGLE_CALENDAR_REDIRECT_URI.includes('localhost')))
          ) {
            r.GOOGLE_CALENDAR_REDIRECT_URI = `${publicUrl}/api/calendar/google/callback`;
          }
        }

        // Sanitize and trim S3 / R2 credentials and configuration
        if (typeof r.S3_ACCESS_KEY_ID === 'string') {
          r.S3_ACCESS_KEY_ID = r.S3_ACCESS_KEY_ID.trim();
        }
        if (typeof r.S3_SECRET_ACCESS_KEY === 'string') {
          r.S3_SECRET_ACCESS_KEY = r.S3_SECRET_ACCESS_KEY.trim();
        }
        if (typeof r.S3_ENDPOINT === 'string') {
          r.S3_ENDPOINT = r.S3_ENDPOINT.trim();
        }
        if (typeof r.S3_BUCKET === 'string') {
          r.S3_BUCKET = r.S3_BUCKET.trim();
        }
        if (typeof r.S3_REGION === 'string') {
          r.S3_REGION = r.S3_REGION.trim();
        }

        // Auto-detect STORAGE_BACKEND if Cloudflare R2 / S3 credentials are provided
        if (!r.STORAGE_BACKEND || r.STORAGE_BACKEND === 'local') {
          if (r.S3_BUCKET && r.S3_ACCESS_KEY_ID && r.S3_SECRET_ACCESS_KEY) {
            r.STORAGE_BACKEND = 's3';
          }
        }

        // Auto-detect AI_PROVIDER if GEMINI_API_KEY is provided
        if (!r.AI_PROVIDER) {
          if (
            (r.GEMINI_API_KEY &&
              typeof r.GEMINI_API_KEY === 'string' &&
              r.GEMINI_API_KEY.trim() !== '') ||
            (r.AI_API_KEY && typeof r.AI_API_KEY === 'string' && r.AI_API_KEY.trim() !== '')
          ) {
            r.AI_PROVIDER = 'gemini';
          }
        }

        // Canonicalize and normalize AI_MODEL
        if (typeof r.AI_MODEL === 'string') {
          const m = r.AI_MODEL.trim();
          if (
            m === 'gemini-2.5-flash' ||
            m === 'gemini-2.5-pro' ||
            m.startsWith('gemini-1.5') ||
            m.startsWith('gemini-2.0')
          ) {
            r.AI_MODEL = 'gemini-3.8-flash';
          } else {
            r.AI_MODEL = m;
          }
        } else if (r.AI_PROVIDER === 'gemini') {
          r.AI_MODEL = 'gemini-3.8-flash';
        }

        // Canonicalize EMAIL_FROM and SMTP_FROM
        const rawEmailFrom = (r.EMAIL_FROM || r.SMTP_FROM) as string | undefined;
        if (rawEmailFrom && typeof rawEmailFrom === 'string' && rawEmailFrom.trim() !== '') {
          r.EMAIL_FROM = rawEmailFrom.trim();
          r.SMTP_FROM = rawEmailFrom.trim();
        } else if (
          r.RESEND_API_KEY &&
          (!r.SMTP_FROM || (typeof r.SMTP_FROM === 'string' && r.SMTP_FROM.includes('.local')))
        ) {
          // If Resend is configured without a verified domain sender, fallback to Resend's verified domain
          r.SMTP_FROM = 'Jobee <onboarding@resend.dev>';
          r.EMAIL_FROM = 'Jobee <onboarding@resend.dev>';
        }

        // In test mode or when running under Vitest, redirect to isolated test database to protect primary candidate brain
        if (r.NODE_ENV === 'test' || process.env.VITEST) {
          if (
            r.TEST_DATABASE_URL &&
            typeof r.TEST_DATABASE_URL === 'string' &&
            r.TEST_DATABASE_URL.trim() !== ''
          ) {
            r.DATABASE_URL = r.TEST_DATABASE_URL.trim();
          } else if (
            typeof r.DATABASE_URL === 'string' &&
            (r.DATABASE_URL.includes('/ai_job_agent_dev') || r.DATABASE_URL.endsWith('/postgres'))
          ) {
            r.DATABASE_URL = r.DATABASE_URL.replace(
              /\/(ai_job_agent_dev|postgres)(\?.*)?$/,
              '/jobee_test_isolated$2',
            );
          }
        }

        // In production, default API_HOST to 0.0.0.0 for container accessibility
        if (r.NODE_ENV === 'production' && (!r.API_HOST || r.API_HOST === '127.0.0.1')) {
          r.API_HOST = '0.0.0.0';
        }

        return r;
      }
      return raw;
    },
    z.object({
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
      DATABASE_URL: z.string().optional(),
      TEST_DATABASE_URL: z.string().optional(),
      DATABASE_SSL: z
        .preprocess((val) => {
          if (typeof val === 'string') {
            return val.toLowerCase() === 'true' || val === '1';
          }
          return val ?? false;
        }, z.boolean())
        .default(false),
      API_HOST: z.string().default('127.0.0.1'),
      API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
      WEB_ORIGIN: z.string().default('http://localhost:5173'),
      LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
      WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
      AI_PROVIDER: z.enum(['disabled', 'gemini']).default('gemini'),
      AI_API_KEY: z.string().optional(),
      GEMINI_API_KEY: z.string().optional(),
      OPENAI_API_KEY: z.string().optional(),
      AI_MODEL: z.string().default('gemini-3.8-flash'),
      EMAIL_TOKEN_ENCRYPTION_KEY: z
        .string()
        .min(32, 'EMAIL_TOKEN_ENCRYPTION_KEY must be at least 32 characters')
        .refine(
          (val) => {
            const uniqueChars = new Set(val);
            return uniqueChars.size >= 8;
          },
          {
            message:
              'EMAIL_TOKEN_ENCRYPTION_KEY has insufficient entropy (must contain at least 8 distinct characters)',
          },
        )
        .default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
      SERPAPI_ENABLED: z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
      SERPAPI_API_KEY: z.string().trim().optional(),
      SERPAPI_MAX_REQUESTS_PER_DISCOVERY: z.coerce.number().int().min(1).max(3).default(1),
      GMAIL_CLIENT_ID: z.string().optional(),
      GMAIL_CLIENT_SECRET: z.string().optional(),
      GMAIL_REDIRECT_URI: z
        .string()
        .default('http://127.0.0.1:3000/api/email/accounts/gmail/callback'),
      GOOGLE_CALENDAR_CLIENT_ID: z.string().optional(),
      GOOGLE_CALENDAR_CLIENT_SECRET: z.string().optional(),
      GOOGLE_CALENDAR_REDIRECT_URI: z
        .string()
        .default('http://127.0.0.1:3000/api/calendar/google/callback'),
      BATCH_PREPARATION_ENABLED: z
        .preprocess((v) => (v === undefined ? true : v === 'true' || v === true), z.boolean())
        .default(true),
      AUTOPILOT_ENABLED: z
        .enum(['true', 'false'])
        .default('false')
        .transform((v) => v === 'true'),
      SELECTED_SUBMISSIONS_ENABLED: z
        .preprocess((v) => (v === undefined ? true : v === 'true' || v === true), z.boolean())
        .default(true),
      ORCHESTRATOR_ENABLED: z
        .preprocess((val) => {
          if (typeof val === 'string') {
            return val.toLowerCase() === 'true' || val === '1';
          }
          return val ?? true;
        }, z.boolean())
        .default(true),
      ORCHESTRATOR_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
      DISCOVERY_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
      EMAIL_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(15),
      REMINDERS_INTERVAL_MINUTES: z.coerce.number().int().positive().default(30),
      RATE_LIMIT_DAILY_APPLICATIONS_DEFAULT: z.coerce.number().int().positive().default(10),
      BETTER_AUTH_SECRET: z
        .string()
        .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters')
        .default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
      BETTER_AUTH_URL: z.string().default('http://127.0.0.1:3000'),
      BETTER_AUTH_TRUSTED_ORIGINS: z
        .string()
        .default('http://localhost:5173,http://127.0.0.1:5173'),
      GOOGLE_CLIENT_ID: z.string().optional(),
      GOOGLE_CLIENT_SECRET: z.string().optional(),
      RESEND_API_KEY: z.string().optional(),
      EMAIL_FROM: z.string().optional(),
      SMTP_HOST: z.string().optional(),
      SMTP_PORT: z.coerce.number().int().positive().optional(),
      SMTP_USER: z.string().optional(),
      SMTP_PASS: z.string().optional(),
      SMTP_FROM: z.string().default('Jobee <notifications@jobee.local>'),
      OWNER_EMAIL: z.string().email().default('owner@example.test'),
      INVITE_ONLY_REGISTRATION: z
        .preprocess((val) => {
          if (typeof val === 'string') {
            return val.toLowerCase() === 'true' || val === '1';
          }
          return val ?? true;
        }, z.boolean())
        .default(true),
      STORAGE_BACKEND: z.enum(['local', 's3']).default('local'),
      S3_BUCKET: z.string().optional(),
      S3_REGION: z.string().default('auto'),
      S3_ENDPOINT: z.string().optional(),
      S3_ACCESS_KEY_ID: z.string().optional(),
      S3_SECRET_ACCESS_KEY: z.string().optional(),
    }),
  )
  .superRefine((data, ctx) => {
    if (data.SERPAPI_ENABLED && !data.SERPAPI_API_KEY)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SERPAPI_API_KEY'],
        message: 'SERPAPI_API_KEY is required when SERPAPI_ENABLED=true',
      });
    if (data.NODE_ENV === 'production') {
      if (data.OWNER_EMAIL === 'owner@example.test')
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['OWNER_EMAIL'],
          message: 'Set an explicit operator OWNER_EMAIL in production',
        });
      if (!data.DATABASE_URL || data.DATABASE_URL.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'DATABASE_URL is required in production environment',
          path: ['DATABASE_URL'],
        });
      }
      if (
        !data.EMAIL_TOKEN_ENCRYPTION_KEY ||
        data.EMAIL_TOKEN_ENCRYPTION_KEY ===
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'A secure non-default EMAIL_TOKEN_ENCRYPTION_KEY is required in production environment',
          path: ['EMAIL_TOKEN_ENCRYPTION_KEY'],
        });
      }
      if (
        !data.BETTER_AUTH_SECRET ||
        data.BETTER_AUTH_SECRET ===
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A secure non-default BETTER_AUTH_SECRET is required in production environment',
          path: ['BETTER_AUTH_SECRET'],
        });
      }
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

let cachedConfig: AppConfig | null = null;

export function validateEnv(rawEnv: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const formattedErrors = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    throw new AppError({
      code: ErrorCodes.CONFIGURATION_ERROR,
      message: `Invalid environment configuration:\n${formattedErrors}`,
      statusCode: 500,
      details: result.error.format(),
      isOperational: false,
    });
  }

  return result.data;
}

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = validateEnv(process.env);
  }
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}
