import { readFile } from 'node:fs/promises';
import { root, renderRoutes } from './routes.mjs';
const stale = [];
for (const page of await renderRoutes()) {
  const actual = await readFile(new URL(page.path, root), 'utf8').catch(() => '');
  if (actual.replaceAll('\r\n', '\n') !== page.html.replaceAll('\r\n', '\n')) stale.push(page.path);
}
if (stale.length) throw new Error(`Routes out of sync: ${stale.join(', ')}. Run node scripts/build-routes.mjs.`);
console.log('Route pages match the shell.');
