import { execFileSync } from 'node:child_process';
export default function setup() {
  execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/seed-ui-preview.ts'], {
    env: { ...process.env, JOBEE_UI_PREVIEW_FIXTURES: 'local-only' },
    stdio: 'inherit',
  });
}
