import { defineConfig } from 'vitest/config';

process.env.NODE_ENV = 'test';
if (!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL) {
  process.env.TEST_DATABASE_URL = process.env.DATABASE_URL.replace(
    /\/(ai_job_agent_dev|postgres)(\?.*)?$/,
    '/jobee_test_isolated$2',
  );
}
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.drizzle/**'],
    testTimeout: 20000,
  },
});
