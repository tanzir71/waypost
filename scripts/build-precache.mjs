import {writeFile} from 'node:fs/promises';
import {root,precacheSource} from './precache.mjs';
await writeFile(new URL('precache.js',root),await precacheSource());
console.log('Generated the versioned offline asset list.');
