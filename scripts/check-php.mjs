import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {files} from './files.mjs';
const found=spawnSync('php',['--version'],{encoding:'utf8',windowsHide:true});
if(found.error?.code==='ENOENT')console.log('PHP not on PATH; PHP lint skipped.');
else{if(found.status!==0)throw new Error(found.stderr||'PHP is unavailable.');let count=0;for(const path of (await files(new URL('../',import.meta.url))).filter(path=>path.endsWith('.php'))){const checked=spawnSync('php',['-l',fileURLToPath(new URL('../'+path,import.meta.url))],{encoding:'utf8',windowsHide:true});if(checked.status!==0)throw new Error(checked.stdout+checked.stderr);count++;}console.log(`${count} PHP files pass php -l.`);}
