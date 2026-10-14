import { defineRailway, project, service } from 'railway/iac';

/**
 * Jobee — Railway Infrastructure as Code (IaC) Configuration
 *
 * Defines the multi-service topology for Jobee on Railway:
 * 1. `jobee-api`: Fastify REST API, Better Auth engine, and static React 19 SPA serving.
 * 2. `jobee-worker`: Autonomous Orchestrator daemon running continuous background discovery,
 *    matching intelligence, and Playwright Chromium automation.
 */
export default defineRailway(() => {
  const api = service('jobee-api', {
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
    },
  });

  const worker = service('jobee-worker', {
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
    },
  });

  return project('jobee', {
    resources: [api, worker],
  });
});
