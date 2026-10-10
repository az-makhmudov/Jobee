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
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().optional(),
    API_HOST: z.string().default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    WEB_ORIGIN: z.string().default('http://localhost:5173'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
    AI_PROVIDER: z.enum(['disabled', 'gemini', 'openai']).default('disabled'),
    AI_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().optional(),
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
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
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
