import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {root,extensionFiles} from './extension-bundle.mjs';
const files=await extensionFiles();
for(const file of files){const target=new URL(file.path,root);await mkdir(dirname(fileURLToPath(target)),{recursive:true});await writeFile(target,file.data);}
console.log(`Generated ${files.length} extension bundle files from the shared sources.`);
