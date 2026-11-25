import {readFile} from 'node:fs/promises';
import {root,precacheSource} from './precache.mjs';
if(await readFile(new URL('precache.js',root),'utf8')!==await precacheSource())throw new Error('Offline files changed. Run node scripts/build-precache.mjs and commit precache.js.');
console.log('The offline asset list and content version are current.');
