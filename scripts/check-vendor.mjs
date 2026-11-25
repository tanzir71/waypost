import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {files} from './files.mjs';
const root=new URL('../vendor/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('INTEGRITY.json',root),'utf8'));
const actual=(await files(root)).filter(path=>/^(pdfjs|mammoth)\//.test(path)).sort();
if(JSON.stringify(actual)!==JSON.stringify(Object.keys(manifest).sort())) throw new Error('Vendored file list differs from the integrity manifest.');
for(const [path,expected] of Object.entries(manifest)) {
  const hash=createHash('sha256').update(await readFile(new URL(path,root))).digest('hex');
  if(hash!==expected) throw new Error(`Vendored parser changed: ${path}`);
}
console.log('Pinned parser files match the SHA-256 manifest.');
