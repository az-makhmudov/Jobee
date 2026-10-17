import { closeDbPool } from '@job-agent/database';
import {
  runRemediation,
  type TargetedRemediationManifest,
} from '../apps/api/src/services/import/candidate-brain-remediation-service.js';

export { runRemediation, type TargetedRemediationManifest };

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const hasOwnerApproval = args.includes('--confirm-owner-approval');
  const primaryUserId = '00000000-0000-0000-0000-000000000001';

  console.log('===============================================================');
  console.log('JOBEE — REVISED TRANSACTIONAL CANDIDATE BRAIN REMEDIATION');
  console.log(
    `Execution Mode: ${isExecute ? 'LIVE TRANSACTIONAL (--execute)' : 'DRY RUN (Plan only)'}`,
  );
  console.log(`Primary User ID: ${primaryUserId}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('===============================================================\n');

  // Proposed profile restore fields (subject to owner approval)
  const proposedProfileRestore = {
    headline: 'Project Manager',
    summary:
      'Project Management student with banking operations experience. Proficient in Agile/Scrum and process optimization, focused on delivering data-driven results',
    email: 'asadbek.mzw@gmail.com',
    phone: '+48884665207',
  };

  const manifest = await runRemediation(primaryUserId, {
    isExecute,
    hasOwnerApproval,
    restoreProfileFields: proposedProfileRestore,
  });

  console.log('--- REMEDIATION MANIFEST SUMMARY ---');
  console.log(`• Total Proposed Removals: ${manifest.totalChanges}`);
  console.log(`• AI Permissions to Revoke: ${manifest.aiRevocations}`);
  console.log(`• Environment:              ${manifest.environment}`);

  console.log('\n--- TARGETED ENTITY REMOVAL BREAKDOWN ---');
  const byType: Record<string, number> = {};
  for (const item of manifest.items) {
    byType[item.entityType] = (byType[item.entityType] || 0) + 1;
  }
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  • ${type.padEnd(14)}: ${count} confirmed synthetic records`);
  }

  if (manifest.dryRun) {
    console.log('\n===============================================================');
    console.log('DRY RUN COMPLETE: Zero database changes applied.');
    console.log('All authentic candidate data remains 100% untouched.');
    console.log('To execute after explicit owner authorization:');
    console.log(
      '  npx tsx scripts/remediate-candidate-brain.ts --execute --confirm-owner-approval',
    );
    console.log('===============================================================');
  } else {
    console.log('\n===============================================================');
    console.log('TRANSACTIONAL REMEDIATION COMPLETED SUCCESSFULLY');
    console.log('===============================================================');
  }

  await closeDbPool();
}

if (process.argv[1]?.includes('remediate-candidate-brain.ts')) {
  main().catch((err) => {
    console.error('Remediation error:', err);
    process.exit(1);
  });
}
