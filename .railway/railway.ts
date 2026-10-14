import { defineRailway, project, service, github } from 'railway/iac';

/**
 * Jobee — Railway Infrastructure as Code (IaC) Configuration
 *
 * Defines the multi-service topology for Jobee on Railway:
 * 1. `jobee-api`: Fastify REST API, Better Auth engine, and static React 19 SPA serving.
 * 2. `jobee-worker`: Autonomous Orchestrator daemon running continuous background discovery,
 *    matching intelligence, and Playwright Chromium automation.
 */
export default defineRailway(({ shared }) => {
  const api = service('jobee-api', {
    source: github('az-makhmudov/Jobee'),
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: 'Dockerfile',
    },
    start: 'node apps/api/dist/index.js',
    healthcheck: '/api/health',
    deploy: {
      restartPolicyType: 'ON_FAILURE',
      restartPolicyMaxRetries: 5,
      healthcheckPath: '/api/health',
      healthcheckTimeout: 10,
    },
    env: {
      NODE_ENV: 'production',
      PORT: '3000',
      DATABASE_URL: shared.DATABASE_URL,
      BETTER_AUTH_SECRET: shared.BETTER_AUTH_SECRET,
      EMAIL_TOKEN_ENCRYPTION_KEY: shared.EMAIL_TOKEN_ENCRYPTION_KEY,
      STORAGE_BACKEND: shared.STORAGE_BACKEND,
      S3_BUCKET: shared.S3_BUCKET,
      S3_ENDPOINT: shared.S3_ENDPOINT,
      S3_REGION: shared.S3_REGION,
      S3_ACCESS_KEY_ID: shared.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: shared.S3_SECRET_ACCESS_KEY,
      RESEND_API_KEY: shared.RESEND_API_KEY,
      EMAIL_FROM: shared.EMAIL_FROM,
      GEMINI_API_KEY: shared.GEMINI_API_KEY,
      GOOGLE_CLIENT_ID: shared.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: shared.GOOGLE_CLIENT_SECRET,
      OWNER_EMAIL: shared.OWNER_EMAIL,
    },
  });

  const worker = service('jobee-worker', {
    source: github('az-makhmudov/Jobee'),
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: 'Dockerfile',
    },
    start: 'node apps/worker/dist/index.js',
    deploy: {
      restartPolicyType: 'ALWAYS',
    },
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: shared.DATABASE_URL,
      EMAIL_TOKEN_ENCRYPTION_KEY: shared.EMAIL_TOKEN_ENCRYPTION_KEY,
      STORAGE_BACKEND: shared.STORAGE_BACKEND,
      S3_BUCKET: shared.S3_BUCKET,
      S3_ENDPOINT: shared.S3_ENDPOINT,
      S3_REGION: shared.S3_REGION,
      S3_ACCESS_KEY_ID: shared.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: shared.S3_SECRET_ACCESS_KEY,
      GEMINI_API_KEY: shared.GEMINI_API_KEY,
    },
  });

  return project('jobee', {
    resources: [api, worker],
  });
});
