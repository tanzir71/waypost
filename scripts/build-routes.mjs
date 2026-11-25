import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { root, renderRoutes } from './routes.mjs';
for (const page of await renderRoutes()) {
  const url = new URL(page.path, root);
  await mkdir(dirname(fileURLToPath(url)), { recursive: true });
  await writeFile(url, page.html);
}
console.log('Generated 17 route pages.');
