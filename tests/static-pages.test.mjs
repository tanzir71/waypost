import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('landing page links to scorer and extension install source', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /<title>ATS Resume Toolkit — Local Resume Scoring & Job Collector<\/title>/);
  assert.match(html, /href="\.\/app\/"/);
  assert.match(html, /https:\/\/github\.com\/tanzir71\/ats-scoring\/tree\/main\/extension/);
});

test('scoring app page keeps SEO title and browser-local import affordance', async () => {
  const html = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');

  assert.match(html, /<title>ATS Resume Scorer — Local Job Match Analyzer<\/title>/);
  assert.match(html, /Bulk import/);
  assert.match(html, /src="..\/src\/app\.js"/);
});
