import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { root, renderRoutes } from './routes.mjs';
const pages=await renderRoutes();
for (const page of pages) {
  const url = new URL(page.path, root);
  await mkdir(dirname(fileURLToPath(url)), { recursive: true });
  await writeFile(url, page.html);
}
console.log(`Generated ${pages.length} route pages.`);
