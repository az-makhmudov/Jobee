import { defineConfig } from '@playwright/test';
const webPort = process.env.UI_TEST_WEB_PORT || '5179';
const webOrigin = `http://127.0.0.1:${webPort}`;
const database =
  process.env.UI_TEST_DATABASE_URL ||
  'postgresql://jobee_ui@127.0.0.1:55439/jobee_ui_test_isolated';
const target = new URL(database);
if (
  !['127.0.0.1', 'localhost'].includes(target.hostname) ||
  !/(isolated|ci_test)$/.test(target.pathname)
)
  throw new Error('UI tests require an explicitly isolated loopback database.');
const env = {
  NODE_ENV: 'development',
  DATABASE_URL: database,
  API_HOST: '127.0.0.1',
  API_PORT: '3000',
  WEB_ORIGIN: webOrigin,
  BETTER_AUTH_URL: 'http://127.0.0.1:3000',
  BETTER_AUTH_TRUSTED_ORIGINS: `${webOrigin},http://127.0.0.1:5179,http://127.0.0.1:3000`,
  BETTER_AUTH_SECRET: 'jobee-ui-local-test-secret-0000000000000000',
  EMAIL_TOKEN_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  OWNER_EMAIL: 'alex.morgan@example.test',
  INVITE_ONLY_REGISTRATION: 'false',
  AI_PROVIDER: 'disabled',
  ORCHESTRATOR_ENABLED: 'false',
  STORAGE_BACKEND: 'local',
  LOG_LEVEL: 'error',
};
export default defineConfig({
  testDir: './apps/web/e2e',
  snapshotPathTemplate: '{testDir}/snapshots/{platform}/{arg}{ext}',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  globalSetup: './apps/web/e2e/setup.ts',
  use: {
    baseURL: webOrigin,
    viewport: { width: 1440, height: 1080 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  outputDir: 'output/playwright/results',
  reporter: [['list'], ['html', { outputFolder: 'output/playwright/report', open: 'never' }]],
  webServer: [
    {
      command: 'npm run dev:api',
      url: 'http://127.0.0.1:3000/api/health',
      env,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command: `npm run --workspace=@job-agent/web dev -- --host 127.0.0.1 --port ${webPort}`,
      url: webOrigin,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
