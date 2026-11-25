import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { routes, routePath } from '../core/routes.js';
const root = new URL('../', import.meta.url);

test('landing links to the app and current clipper source', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /<title>Waypost — Know where you stand<\/title>/);
  assert.match(html, /href="\.\/app\/"/);
  assert.match(html, /https:\/\/github\.com\/tanzir71\/waypost\/tree\/main\/extension/);
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic|preconnect/);
});

test('every tool has a generated page and JSON result surface', async () => {
  for (const route of routes) {
    const html = await readFile(new URL(`${routePath(route)}index.html`, root), 'utf8');
    assert.ok(html.includes(`<title>${route.label} — Waypost</title>`));
    assert.ok(html.includes(`data-route="${route.id}"`));
    assert.match(html, /id="result-data"/);
    assert.match(html, /ui\/app\.js/);
    assert.doesNotMatch(html, /\{\{\w+\}\}/);
  }
});

test('config detects base paths, demo mode, local mode and explicit settings', async () => {
  const code = await readFile(new URL('config.js', root), 'utf8');
  for (const [hostname, path, expected] of [['tanzir71.github.io','/waypost/','demo'], ['localhost','/','pwa'], ['example.test','/nested/app/','pwa']]) {
    const sandbox = { URL, window: {}, location: { hostname }, document: { currentScript: { src: `https://${hostname}${path}config.js` }, documentElement: { dataset: {} } }, localStorage: { getItem: () => null } };
    runInNewContext(code, sandbox);
    assert.equal(sandbox.window.WAYPOST_CONFIG.basePath, path);
    assert.equal(sandbox.window.WAYPOST_CONFIG.mode, expected);
    assert.equal(sandbox.window.WAYPOST_CONFIG.ai.provider, null);
    sandbox.window.WAYPOST_CONFIG = { mode: 'php', basePath: '/custom/' };
    runInNewContext(code, sandbox);
    assert.equal(sandbox.window.WAYPOST_CONFIG.mode, 'php');
    assert.equal(sandbox.window.WAYPOST_CONFIG.basePath, '/custom/');
  }
});

test('tokens are unchanged and referenced local font assets exist', async () => {
  const tokens = await readFile(new URL('ui/tokens.css', root), 'utf8');
  assert.equal(tokens, await readFile(new URL('handover/tokens.css', root), 'utf8'));
  for (const name of ['Geist-Variable.woff2','GeistMono-Variable.woff2','Newsreader-Regular.woff2']) {
    const bytes = await readFile(new URL(`assets/fonts/${name}`,root));
    assert.equal(bytes.subarray(0,4).toString(),'wOF2');
    assert.ok(bytes.length > 1000);
  }
  assert.ok((await stat(new URL('.nojekyll',root))).isFile());
  assert.equal(Object.keys(JSON.parse(await readFile(new URL('package.json', root),'utf8')).dependencies ?? {}).length, 0);
});
