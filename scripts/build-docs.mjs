import { readFile,writeFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const parts=await Promise.all(['llms.txt','README.md','HANDOVER.md'].map(async path=>`\n\n--- ${path} ---\n\n${await readFile(new URL(path,root),'utf8')}`));
await writeFile(new URL('llms-full.txt',root),'# Waypost full agent documentation\n'+parts.join(''));
console.log('Generated full agent docs.');
