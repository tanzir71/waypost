import { readFile } from 'node:fs/promises';
import { files } from './files.mjs';
const root = new URL('../', import.meta.url);
const violations = [];
for (const path of await files(root)) {
  if (!/\.(?:html|css|js|mjs)$/.test(path) || /^(tests|scripts|vendor)\//.test(path)) continue;
  const content = await readFile(new URL(path, root), 'utf8');
  // Links to documentation are navigation, not runtime requests.
  const code = content.replace(/<a\b[^>]*href="https?:\/\/[^\"]*"/g, '<a').replace(/\/\/[^\n]*https?:\/\/[^\n]*/g, '');
  for (const match of code.matchAll(/https?:\/\/[^\s"'`<>)}]+/g)) {
    if (!/^https?:\/\/(?:schema\.org(?:\/|$)|github\.com\/tanzir71\/waypost(?:\/|$)|tanziro\.com(?:\/|$)|www\.w3\.org\/2000\/svg$)/.test(match[0])) violations.push(`${path}: ${match[0]}`);
  }
}
if (violations.length) throw new Error(`External runtime URLs found:\n${violations.join('\n')}`);
console.log('No external runtime URLs.');
