import { readFile } from 'node:fs/promises';
import { files } from './files.mjs';
const root = new URL('../', import.meta.url);
const violations = [];
for (const path of await files(root)) {
  if (!/\.(?:html|css|js|mjs)$/.test(path) || /^(tests|scripts|vendor)\//.test(path)) continue;
  const content = await readFile(new URL(path, root), 'utf8');
  if(path.startsWith('extension/bundled/')&&path.endsWith('.json.js')) {
    const literal=content.match(/^\/\/ Generated from [^\n]+\nexport default ([\s\S]+);\s*$/);
    if(!literal)throw new Error(`Unexpected generated data module: ${path}`);
    JSON.parse(literal[1]);continue; // inert JSON metadata, never executable request code
  }
  // Links to documentation are navigation, not runtime requests.
  const code = content.replace(/<a\b[^>]*href="https?:\/\/[^\"]*"/g, '<a').replace(/\/\/[^\n]*https?:\/\/[^\n]*/g, '');
  for (const match of code.matchAll(/https?:\/\/[^\s"'`<>)}]+/g)) {
    if(path==='extension/defaults.js'&&match[0]==='https://tanzir71.github.io/waypost/')continue; // explicit user-initiated handoff destination
    if (!/^https?:\/\/(?:schema\.org(?:\/|$)|github\.com\/tanzir71\/waypost(?:\/|$)|tanziro\.com(?:\/|$)|www\.w3\.org\/2000\/svg$)/.test(match[0])) violations.push(`${path}: ${match[0]}`);
  }
}
if (violations.length) throw new Error(`External runtime URLs found:\n${violations.join('\n')}`);
console.log('No external runtime URLs.');
