import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { files } from '../scripts/files.mjs';
const root = new URL('../', import.meta.url);
const attr = (tag,name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];
const text = html => html.replace(/<[^>]*>/g,'').replace(/&[\w#]+;/g,' ').trim();

test('all pages and shell have landmarks, one heading and native accessible controls', async () => {
  const paths = (await files(root)).filter(path => path.endsWith('.html'));
  for (const path of paths) {
    const html = await readFile(new URL(path,root),'utf8');
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${path}: one h1`);
    assert.match(html, /<html\b[^>]*lang=/, `${path}: language`);
    assert.match(html, /<main\b/, `${path}: main landmark`);
    assert.match(html, /<header\b/, `${path}: header landmark`);
    for (const match of html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
      const opening = match[2];
      assert.ok(attr(opening,'aria-label') || text(match[3]) || /<img\b[^>]*alt="[^\"]+"/.test(match[3]), `${path}: unnamed ${match[1]}`);
      if (!path.startsWith('extension/')) assert.ok(attr(opening,'data-testid'), `${path}: ${text(match[3])} needs a test hook`);
    }
    for (const match of html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
      const tag = match[2];
      if (attr(tag,'type') === 'hidden') continue;
      const id = attr(tag,'id');
      const labelled = id && html.includes(`for="${id}"`);
      assert.ok(labelled || attr(tag,'aria-label') || attr(tag,'aria-labelledby'), `${path}: unlabelled ${match[1]}`);
    }
    if (path.startsWith('app/')) assert.match(html,/id="result-data"/);
  }
});

test('documented stable hooks exist in authored HTML or UI code', async () => {
  const docs = await readFile(new URL('llms.txt',root),'utf8');
  const hooks = docs.match(/data-testid values:([\s\S]*?)\./)?.[1].match(/`([^`]+)`/g)?.map(s=>s.slice(1,-1)) ?? [];
  const sources = (await files(root)).filter(path => /\.(html|js)$/.test(path) && !path.startsWith('vendor/'));
  const code = (await Promise.all(sources.map(path=>readFile(new URL(path,root),'utf8')))).join('\n');
  for (const hook of hooks) assert.ok(code.includes(`data-testid="${hook}"`) || new RegExp(`\\.dataset\\.testid\\s*=\\s*['"]${hook}['"]`).test(code), `Missing hook: ${hook}`);
});
