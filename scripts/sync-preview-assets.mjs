import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
  const target = resolve(root, 'apps/web/public/assets/pdfjs', folder);
  await mkdir(target, { recursive: true });
  await cp(resolve(root, 'node_modules/pdfjs-dist', folder), target, { recursive: true });
}
