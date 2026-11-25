import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {handleRequest} from '../server/worker/index.js';
import {SyncRepository} from '../server/worker/repository.js';
import {MemoryD1,MemoryR2} from './helpers/sync-server.mjs';
import {createTransport} from '../core/sync/transport.js';
import {createVaultSecrets,encryptRecord,decryptRecord,deriveVaultKeys,unwrapRecoveryCode,recoveryCodeId} from '../core/sync/crypto.js';
import {createSyncEngine,rotateVaultPassphrase} from '../core/sync/engine.js';
import {splitChanges,base64url} from '../core/sync/protocol.js';
import {openWorkspace,uuidv7} from '../ui/store.js';
import {memoryIndexedDB,memoryLocalStorage} from './helpers/memory-indexeddb.mjs';
const origin='https://waypost.test',endpoint=origin+'/api/sync';
const makeEnv=(extra={})=>({DB:new MemoryD1(),BLOBS:new MemoryR2(),AUTH_PEPPER:'test-only-local-pepper-at-least-32-characters',...extra});
const connect=(env,extra={})=>createTransport({endpoint,provider:'cloudflare',origin,fetch:(url,options)=>handleRequest(new Request(url,options),env),wait:async()=>{},...extra});
const job=(text='Private evidence')=>({id:uuidv7(),deviceId:uuidv7(),createdAt:'2026-11-25T12:00:00.000Z',updatedAt:'2026-11-25T12:00:00.000Z',deleted:false,title:'Private position',text,source:'paste'});
const newStore=()=>openWorkspace({indexedDB:memoryIndexedDB(),localStorage:memoryLocalStorage(),storage:{}});

for(const native of [false,true])test(`Worker API encrypts, merges, pages, rotates and deletes with ${native?'SQLite-backed':'model'} in-memory D1/R2`,async()=>{
  const env=makeEnv({DB:new MemoryD1({native})}),transport=connect(env),session=await createVaultSecrets('a long private passphrase',{vaultId:uuidv7()}),repo=new SyncRepository(env);
  assert.equal((await transport.checks()).ready,true);await transport.create(session);await transport.create(session);
  assert.equal((await transport.metadata(session.vaultId)).salt,session.salt);const server=await repo.getVault(session.vaultId);assert.notEqual(server.auth_hash,session.authToken);assert.ok(!server.wrapped_keys.includes(session.codes[0]));
  const rows=[];for(let i=0;i<53;i++)rows.push(await encryptRecord('jobs',job(i===0?'x'.repeat(70000):`Evidence ${i}`),session));
  for(const batch of splitChanges(rows))await transport.push(batch,session);
  assert.equal(env.BLOBS.objects.size,1);const first=await transport.pull(0,session);assert.equal(first.changes.length,50);assert.equal(first.hasMore,true);const second=await transport.pull(first.cursor,session);assert.equal(second.changes.length,3);assert.equal(second.hasMore,false);
  const original=await decryptRecord(rows[0],session),older={...original,text:'Old',updatedAt:'2026-11-24T12:00:00.000Z'};await transport.push([await encryptRecord('jobs',older,session)],session);assert.equal((await transport.pull(0,session)).changes[0].ciphertext,rows[0].ciphertext);assert.equal(env.BLOBS.objects.size,1);
  const tombstone={...original,deleted:true,updatedAt:'2026-11-26T12:00:00.000Z'};await transport.push([await encryptRecord('jobs',tombstone,session)],session);
  const recovered=await transport.recover(session.vaultId,await recoveryCodeId(session.codes[0])),master=await unwrapRecoveryCode(session.codes[0],recovered.wrappedKey,{vaultId:session.vaultId,keyVersion:recovered.keyVersion}),recoverySession={...await deriveVaultKeys(master,session.vaultId),vaultId:session.vaultId,keyVersion:1};master.fill(0);
  const next=await rotateVaultPassphrase({transport,session:recoverySession,passphrase:'a replacement private passphrase',rotationId:uuidv7()});assert.equal(next.keyVersion,2);
  await assert.rejects(transport.pull(0,session),error=>error.status===401);await assert.rejects(transport.recover(session.vaultId,await recoveryCodeId(session.codes[0])),error=>error.status===404);
  const after=await transport.pull(0,next);assert.equal(after.keyVersion,2);const latest=(await Promise.all(after.changes.map(row=>decryptRecord(row,next)))).find(row=>row.id===original.id);if(latest)assert.equal(latest.deleted,true);
  assert.ok([...env.BLOBS.objects.keys()].every(key=>key.includes('/v2/')));await transport.deleteVault(next);assert.equal(env.BLOBS.objects.size,0);await assert.rejects(transport.metadata(session.vaultId),error=>error.status===404);env.DB.close();
});

test('Worker rejects foreign origins, HTTP, malformed/oversize batches, quota and wrong credentials without partial writes',async()=>{
  const env=makeEnv({MAX_VAULT_BYTES:2000}),transport=connect(env),session=await createVaultSecrets('another private passphrase',{vaultId:uuidv7()});await transport.create(session);
  for(const [url,headers,status]of [[endpoint+'/checks',{Origin:'https://other.test'},403],[endpoint.replace('https:','http:')+'/checks',{},426]])assert.equal((await handleRequest(new Request(url,{headers}),env)).status,status);
  await assert.rejects(transport.pull(0,{...session,authToken:base64url(new Uint8Array(32))}),error=>error.status===401);
  const rows=await Promise.all(Array.from({length:3},()=>encryptRecord('jobs',job('x'.repeat(500)),session)));
  await assert.rejects(transport.push(rows,session),error=>error.code==='vault_limit');assert.equal((await transport.pull(0,session)).changes.length,0);
  await assert.rejects(transport.push(Array(11).fill(rows[0]),session),error=>error.code==='batch_limit');await assert.rejects(transport.push([{...rows[0],text:'plaintext'}],session),error=>error.status===400);
  await assert.rejects(transport.request('/changes',{method:'POST',auth:session,data:{changes:[],padding:'x'.repeat(5*1024*1024)}}),error=>error.code==='request_limit');
  for(let i=0;i<31;i++)await handleRequest(new Request(endpoint+'/vault?vaultId='+uuidv7()),env);const limited=await handleRequest(new Request(endpoint+'/vault?vaultId='+uuidv7()),env);assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');env.DB.close();
});

test('concurrent recovery fails atomically, and a lost successful commit response is resolved with the new keys',async()=>{
  const env=makeEnv(),transport=connect(env),session=await createVaultSecrets('private passphrase before recovery',{vaultId:uuidv7()}),record=job();await transport.create(session);await transport.push([await encryptRecord('jobs',record,session)],session);
  let intercept=true;const competing={...transport,async request(path,options){if(path.endsWith('/commit')&&intercept){intercept=false;await transport.push([await encryptRecord('jobs',{...record,updatedAt:'2026-11-27T00:00:00.000Z',text:'Concurrent change'},session)],session);}return transport.request(path,options);}};
  await assert.rejects(rotateVaultPassphrase({transport:competing,session,passphrase:'replacement private passphrase',rotationId:uuidv7()}),error=>error.code==='concurrent_change');assert.equal((await transport.pull(0,session)).keyVersion,1);assert.equal((await transport.request('/vault/rotation',{auth:session})).pending,null);
  const uncertain={...transport,async request(path,options){const response=await transport.request(path,options);if(path.endsWith('/commit'))throw Object.assign(new Error('Lost response'),{code:'network'});return response;}};
  const next=await rotateVaultPassphrase({transport:uncertain,session,passphrase:'replacement private passphrase',rotationId:uuidv7()});assert.equal((await transport.pull(0,next)).keyVersion,2);env.DB.close();
});

test('two actual workspace stores converge, including offline deletion; cursor never skips a concurrent POST',async()=>{
  const env=makeEnv(),transport=connect(env),session=await createVaultSecrets('sync private passphrase',{vaultId:uuidv7()}),a=await newStore(),b=await newStore(),saved=await a.save('jobs',{title:'Role',text:'Evidence',source:'paste'});
  await transport.create(session);
  await a.setSetting('vault-session',{...session,codes:undefined,wrappedKeys:undefined});
  const ea=createSyncEngine({store:a,transport,session}),eb=createSyncEngine({store:b,transport,session});await ea.sync();await eb.sync();assert.equal((await b.get('jobs',saved.id)).title,'Role');await b.remove('jobs',saved.id);await eb.sync();await ea.sync();assert.equal((await a.get('jobs',saved.id)).deleted,true);
  let once=true;const concurrent={...transport,async push(rows,auth){const result=await transport.push(rows,auth);if(once){once=false;await transport.push([await encryptRecord('jobs',job('Another device'),session)],session);}return result;}};
  await a.save('jobs',{title:'Second',text:'New',source:'paste'});await createSyncEngine({store:a,transport:concurrent,session}).sync();assert.ok((await a.all('jobs')).some(row=>row.text==='Another device'));assert.equal((await a.setting(`sync-state:${session.vaultId}`)).value.cursor,(await transport.pull(0,session)).cursor);a.close();b.close();env.DB.close();
});

test('stale cancellation/deletion cannot erase blobs installed by a concurrently committed recovery',async()=>{
  const env=makeEnv(),transport=connect(env),repo=new SyncRepository(env),session=await createVaultSecrets('old private passphrase',{vaultId:uuidv7()}),next=await createVaultSecrets('new private passphrase',{vaultId:session.vaultId,keyVersion:2}),record=job('x'.repeat(70000)),rotationId=uuidv7();await transport.create(session);await transport.push([await encryptRecord('jobs',record,session)],session);const vault=await repo.getVault(session.vaultId);
  await repo.startRotation(vault,{...next,newAuthToken:next.authToken,rotationId,baseCursor:vault.cursor});await repo.write(vault,[await encryptRecord('jobs',record,next)],rotationId);
  const batch=env.DB.batch.bind(env.DB);let concurrent=true;env.DB.batch=async statements=>{if(concurrent&&statements[0].sql.includes('rotation:abort-stage')){concurrent=false;await repo.commitRotation(vault,rotationId,1);}return batch(statements);};
  await assert.rejects(repo.cancelRotation(vault,rotationId),error=>error.code==='key_version_changed');await assert.rejects(repo.remove(vault),error=>error.code==='key_version_changed');assert.equal(env.BLOBS.objects.size,1);assert.deepEqual(await decryptRecord((await transport.pull(0,next)).changes[0],next),record);env.DB.close();
});

test('transport restricts same-origin HTTPS, retries bounded rate limits and supports cancellation',async()=>{
  assert.throws(()=>createTransport({endpoint:'https://elsewhere.test/api',origin}));assert.throws(()=>createTransport({endpoint:'http://waypost.test/api',origin}));let calls=0,waited=0;
  const transport=createTransport({endpoint,provider:'cloudflare',origin,wait:async ms=>{waited+=ms;},fetch:async()=>++calls<3?new Response(JSON.stringify({error:'Wait',code:'rate_limit'}),{status:429,headers:{'Retry-After':'60'}}):Response.json({ready:true})});assert.equal((await transport.checks()).ready,true);assert.equal(calls,3);assert.equal(waited,120000);
  const controller=new AbortController();controller.abort();const cancelled=createTransport({endpoint,origin,signal:controller.signal,fetch:async(url,{signal})=>{signal.throwIfAborted();}});await assert.rejects(cancelled.checks(),error=>error.code==='aborted');
});

test('PHP adapter runs the same encrypted API and recovery against real SQLite when a driver is available',async t=>{
  const binary=spawnSync('php',['-r','echo PHP_BINARY;'],{encoding:'utf8',windowsHide:true});if(binary.status!==0){t.skip('PHP is not on PATH.');return;}
  const extensions=join(dirname(binary.stdout),'ext'),options=['-d',`extension_dir=${extensions}`,'-d','extension=pdo_sqlite'];
  let phpArgs=[];const drivers=spawnSync('php',['-r',"echo implode(',',PDO::getAvailableDrivers());"],{encoding:'utf8',windowsHide:true});if(!drivers.stdout.includes('sqlite'))phpArgs=options;
  const available=spawnSync('php',[...phpArgs,'-r',"echo implode(',',PDO::getAvailableDrivers());"],{encoding:'utf8',windowsHide:true});if(!available.stdout.includes('sqlite')){t.skip('PHP SQLite driver unavailable; PHP lint remains required.');return;}
  const directory=await mkdtemp(join(tmpdir(),'waypost-sync-')),root=process.cwd(),config=join(directory,'config.php'),database=join(directory,'vault.sqlite');
  await writeFile(config,`<?php return ['database'=>__DIR__.'/vault.sqlite'];`);
  const harness=`require $argv[1];$data=json_decode(stream_get_contents(STDIN),true);$server=new \\Waypost\\Server(\\Waypost\\deployment($argv[2],$argv[3]));echo \\Waypost\\json($server->handle($data['method'],$data['path'],$data['input'],$data['headers'],$data['query'],$data['origin'],true,'127.0.0.1'));`;
  const request=async(url,options={})=>{const target=new URL(url),headers=Object.fromEntries(Object.entries(options.headers??{}).map(([key,value])=>[key.toLowerCase(),value])),data={method:options.method??'GET',path:target.pathname.replace('/api/sync',''),input:options.body?JSON.parse(options.body):[],headers,query:Object.fromEntries(target.searchParams),origin};const output=spawnSync('php',[...phpArgs,'-r',harness,join(root,'server/php/library.php'),root,config],{input:JSON.stringify(data),encoding:'utf8',windowsHide:true});assert.equal(output.status,0,output.stderr);const [status,body]=JSON.parse(output.stdout);return Response.json(body,{status});};
  const transport=createTransport({endpoint,provider:'cloudflare',origin,fetch:request});
  try{assert.equal((await transport.checks()).ready,true);const session=await createVaultSecrets('PHP private passphrase',{vaultId:uuidv7()});await transport.create(session);const record=job();await transport.push([await encryptRecord('jobs',record,session)],session);assert.deepEqual(await decryptRecord((await transport.pull(0,session)).changes[0],session),record);
    const recovered=await transport.recover(session.vaultId,await recoveryCodeId(session.codes[0]));assert.ok(recovered.wrappedKey);const next=await rotateVaultPassphrase({transport,session,passphrase:'PHP replacement private passphrase',rotationId:uuidv7()});await assert.rejects(transport.pull(0,session),error=>error.status===401);assert.deepEqual(await decryptRecord((await transport.pull(0,next)).changes[0],next),record);
    const raw=await readFile(database);assert.ok(!raw.includes(Buffer.from('Private evidence')));assert.ok(!raw.includes(Buffer.from(next.authToken)));await transport.deleteVault(next);await assert.rejects(transport.metadata(next.vaultId),error=>error.status===404);
  }finally{await rm(directory,{recursive:true,force:true});}
});
