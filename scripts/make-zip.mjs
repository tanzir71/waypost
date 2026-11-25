import {mkdir,writeFile} from 'node:fs/promises';
import {buildZip} from './zip.mjs';
await mkdir(new URL('../downloads/',import.meta.url),{recursive:true});
const zip=await buildZip();await writeFile(new URL('../downloads/waypost-self-host.zip',import.meta.url),zip);
console.log(`Built self-hosting ZIP (${(zip.length/1024/1024).toFixed(2)} MB).`);
