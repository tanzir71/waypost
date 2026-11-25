import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readZip,unsafePath,deploymentFiles} from '../scripts/zip.mjs';
test('self-hosting ZIP contains both real backends, config samples and base-path runtime, without secrets or databases',async()=>{
 const archive=readZip(await readFile(new URL('../downloads/waypost-self-host.zip',import.meta.url)));assert.deepEqual([...archive.keys()],await deploymentFiles());
 for(const path of ['.htaccess','.nojekyll','config.js','server/README.md','server/php/config.sample.php','server/php/sync.php','server/worker/schema.sql','server/worker/wrangler.toml.sample','app/setup/index.html','core/sync/crypto.js','ui/sync.js','sw.js','precache.js','vendor/INTEGRITY.json'])assert.ok(archive.has(path),path);
 for(const path of ['server/php/ics.php','server/php/calendar-library.php','server/worker/calendar.js','server/worker/migrations/002-calendar.sql','core/calendar/ics.js','ui/views/deadlines.js'])assert.ok(archive.has(path),path);
 for(const path of archive.keys())assert.equal(unsafePath(path),false,path);
 for(const path of ['server/php/config.php','.dev.vars','server/worker/wrangler.toml','data/vault.sqlite','vault.sqlite-wal','config.php'])assert.equal(unsafePath(path),true,path);
 assert.ok(![...archive.keys()].some(path=>/^(?:tests|scripts|\.git|handover)\//.test(path)));assert.match(archive.get('server/php/config.sample.php').toString(),/__DIR__/);
});
