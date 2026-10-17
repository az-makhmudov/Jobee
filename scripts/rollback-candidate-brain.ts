import fs from 'node:fs';
import path from 'node:path';
import { closeDbPool } from '@job-agent/database';
import { runRollback } from '../apps/api/src/services/import/candidate-brain-remediation-service.js';

export { runRollback };

async function main() {
  const args = process.argv.slice(2);
  const backupDir = path.resolve(process.cwd(), 'backups');

  let targetBackupFile = args[0];
  if (!targetBackupFile) {
    if (!fs.existsSync(backupDir)) {
      console.error('No backups directory found.');
      process.exit(1);
    }
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('candidate-brain-manifest-') && f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length === 0 || !files[0]) {
      console.error('No candidate brain manifest files found in backups directory.');
      process.exit(1);
    }
    targetBackupFile = path.join(backupDir, files[0]);
  }

  console.log('===============================================================');
  console.log('JOBEE — TARGETED TRANSACTIONAL ROLLBACK UTILITY');
  console.log(`Manifest File: ${targetBackupFile}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('===============================================================\n');

  await runRollback(targetBackupFile);
  await closeDbPool();
}

if (process.argv[1]?.includes('rollback-candidate-brain.ts')) {
  main().catch((err) => {
    console.error('Rollback failed:', err);
    process.exit(1);
  });
}
