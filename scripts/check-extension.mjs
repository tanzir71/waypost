import {readFile} from 'node:fs/promises';
import {root,extensionFiles} from './extension-bundle.mjs';
for(const file of await extensionFiles()) {
  const actual=await readFile(new URL(file.path,root)).catch(()=>null);
  const text=/\.(js|css|json|md|txt)$/.test(file.path);
  const equal=actual&&(text?actual.toString().replaceAll('\r\n','\n')===file.data.toString().replaceAll('\r\n','\n'):actual.equals(file.data));
  if(!equal)throw new Error(`${file.path} is out of date. Run node scripts/build-extension.mjs.`);
}
console.log('The extension bundle matches the canonical sources.');
