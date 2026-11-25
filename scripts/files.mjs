import { readdir } from 'node:fs/promises';
export async function files(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(new URL(prefix, directory), { withFileTypes: true })) {
    if (['.git', 'node_modules', '.qa', 'dist'].includes(entry.name)) continue;
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) result.push(...await files(directory, `${path}/`));
    else result.push(path);
  }
  return result;
}
