import { defineConfig } from 'drizzle-kit';
import { getConfig } from '@job-agent/config';

const config = getConfig();

export default defineConfig({
  schema: './dist/schema/index.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: config.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/job_agent',
  },
  verbose: true,
  strict: true,
});
