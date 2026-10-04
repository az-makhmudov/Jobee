import { checkDatabaseHealth } from '../health.js';
import { closeDbPool } from '../client.js';
import { getConfig } from '@job-agent/config';

async function runCheck() {
  const config = getConfig();
  process.stdout.write('Checking database connectivity...\n');
  const health = await checkDatabaseHealth(config.DATABASE_URL);
  process.stdout.write(`Database status: ${health.status}\n`);
  if (health.latencyMs !== undefined) {
    process.stdout.write(`Latency: ${health.latencyMs}ms\n`);
  }
  if (health.message) {
    process.stdout.write(`Details: ${health.message}\n`);
  }
  await closeDbPool();
  if (health.status === 'disconnected') {
    process.exit(1);
  }
}

runCheck();
