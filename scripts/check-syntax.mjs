import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {files} from './files.mjs';
const root=new URL('../',import.meta.url);
for(const path of (await files(root)).filter(path=>/\.(js|mjs)$/.test(path)&&!path.startsWith('vendor/'))) {
  const checked=spawnSync(process.execPath,['--check',fileURLToPath(new URL(path,root))],{encoding:'utf8',windowsHide:true});
  if(checked.status!==0) throw new Error(`${path}: ${checked.stderr||checked.error}`);
}
console.log('First-party JavaScript syntax is valid.');
