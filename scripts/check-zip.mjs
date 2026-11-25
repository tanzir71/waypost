import {readFile} from 'node:fs/promises';
import {buildZip} from './zip.mjs';
const zip=await readFile(new URL('../downloads/waypost-self-host.zip',import.meta.url));
if(!zip.equals(await buildZip()))throw new Error('Self-hosting ZIP is stale. Run node scripts/make-zip.mjs.');
console.log('Self-hosting ZIP matches the deployed runtime.');
