import test from 'node:test';
import assert from 'node:assert/strict';
import {fakeDOM,walk} from './helpers/dom.mjs';
import {memoryIndexedDB,memoryLocalStorage} from './helpers/memory-indexeddb.mjs';
import {MemoryD1,MemoryR2} from './helpers/sync-server.mjs';
import {openWorkspace,uuidv7} from '../ui/store.js';
import {initializeSync} from '../ui/sync.js';
import {renderSetup} from '../ui/views/setup.js';
import {renderSettings} from '../ui/views/settings.js';
import {handleRequest} from '../server/worker/index.js';
import {createVaultSecrets} from '../core/sync/crypto.js';
import {createTransport} from '../core/sync/transport.js';
import {workspaceExport} from '../core/store/export.js';
const storeOpen=()=>openWorkspace({indexedDB:memoryIndexedDB(),localStorage:memoryLocalStorage(),storage:{}});

test('setup checks the real handler, shows codes once, verifies encrypted round-trip and connects the device',async()=>{
  const dom=fakeDOM('/waypost/app/setup/'),store=await storeOpen(),env={DB:new MemoryD1(),BLOBS:new MemoryR2(),AUTH_PEPPER:'test-only-local-pepper-at-least-32-characters'},originalFetch=globalThis.fetch;let calls=0;
  globalThis.fetch=async(url,options)=>{calls++;return handleRequest(new Request(url,options),env);};const controller=await initializeSync({store,mode:'pwa'});
  try{
    await renderSetup({store,basePath:'/waypost/',view:dom.view,actions:dom.actions,syncController:controller});dom.find('setup-provider')[0].value='cloudflare';dom.find('setup-endpoint')[0].value=location.origin+'/api/sync';await dom.find('setup-check')[0].fire('click');assert.equal(dom.readResult().serverChecks.ready,true);
    dom.find('vault-passphrase')[0].value='my private setup passphrase';dom.find('vault-confirm')[0].value='my private setup passphrase';await dom.find('setup-vault')[0].fire('click');assert.equal(dom.find('recovery-code-1').length,1);assert.equal(dom.find('recovery-continue')[0].disabled,true);const code=dom.find('recovery-code-1')[0].textContent;assert.ok(!JSON.stringify(dom.readResult()).includes(code));
    dom.find('recovery-saved')[0].checked=true;await dom.find('recovery-saved')[0].fire('change');await dom.find('recovery-continue')[0].fire('click');assert.equal(dom.find('recovery-code-1').length,0);await dom.find('setup-roundtrip')[0].fire('click');assert.equal(dom.readResult().roundTrip.passed,true);await dom.find('setup-enable')[0].fire('click');assert.equal(controller.status.state,'synced');assert.equal((await store.setting('preferences')).value.sync.provider,'cloudflare');assert.ok((await store.setting('vault-session')).value.encKey);assert.ok(calls>=8);
    const exported=workspaceExport(Object.fromEntries(await Promise.all(['settings','jobs'].map(async type=>[type,await store.all(type)]))),{exportedAt:new Date().toISOString(),deviceId:store.deviceId});assert.ok(!JSON.stringify(exported).includes(controller.session.authToken));assert.ok(!JSON.stringify(exported).includes(code));assert.equal((await store.all('settings')).some(row=>row.key==='sync-probe'),false);
    await renderSettings({store,basePath:'/waypost/',view:dom.view,actions:dom.actions,syncController:controller});await dom.find('sync-disconnect')[0].fire('click');assert.equal(controller.status.state,'local');assert.equal((await store.setting('vault-session')).value,null);
  }finally{controller.close();store.close();env.DB.close();globalThis.fetch=originalFetch;dom.restore();}
});

test('demo setup and sync controller make no API calls; failed checks cannot create a vault',async()=>{
  const dom=fakeDOM('/waypost/app/setup/'),store=await storeOpen(),previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({protocol:1,ready:false,checks:[{id:'sqlite',label:'PDO SQLite available',passed:false}]});};window.WAYPOST_CONFIG.mode='demo';
  let controller=await initializeSync({store,mode:'demo'});
  try{await renderSetup({store,basePath:'/waypost/',view:dom.view,actions:dom.actions,syncController:controller});assert.equal(dom.find('setup-check').length,0);assert.equal(dom.find('setup-download').length,1);await controller.sync();assert.equal(calls,0);controller.close();window.WAYPOST_CONFIG.mode='pwa';controller=await initializeSync({store,mode:'pwa'});await renderSetup({store,basePath:'/waypost/',view:dom.view,actions:dom.actions,syncController:controller});await dom.find('setup-check')[0].fire('click');assert.equal(dom.readResult().serverChecks.ready,false);assert.equal(walk(dom.body).find(row=>row.tagName==='SECTION'&&row.textContent.includes('2 · Create')).hidden,true);assert.equal(dom.find('setup-enable').length,0);
  }finally{controller.close();store.close();globalThis.fetch=previous;dom.restore();}
});

test('sync pauses offline, resumes online, keeps local data on server deletion and requires an explicit connection after import',async()=>{
  const dom=fakeDOM(),store=await storeOpen(),env={DB:new MemoryD1(),BLOBS:new MemoryR2(),AUTH_PEPPER:'test-only-local-pepper-at-least-32-characters'},endpoint=location.origin+'/api/sync',fetcher=(url,options)=>handleRequest(new Request(url,options),env),transport=createTransport({endpoint,origin:location.origin,provider:'cloudflare',fetch:fetcher}),session=await createVaultSecrets('a private device passphrase',{vaultId:uuidv7()});let online=true;
  await transport.create(session);const controller=await initializeSync({store,mode:'pwa',fetch:fetcher,online:()=>online});
  try{await store.save('jobs',{title:'Kept role',text:'Evidence',source:'paste'});await controller.connect(session,{endpoint,provider:'cloudflare'});online=false;assert.equal((await controller.sync()).state,'offline');online=true;assert.equal((await controller.sync()).state,'synced');
    await renderSettings({store,basePath:'/waypost/',view:dom.view,actions:dom.actions,syncController:controller});await dom.find('sync-delete')[0].fire('click');assert.equal(dom.find('sync-delete-confirm')[0].disabled,true);dom.find('delete-vault-ack')[0].checked=true;await dom.find('delete-vault-ack')[0].fire('change');await dom.find('sync-delete-confirm')[0].fire('click');assert.equal((await store.all('jobs')).length,1);await assert.rejects(transport.metadata(session.vaultId),error=>error.status===404);assert.equal(controller.status.state,'local');
    await transport.create(session);await controller.connect(session,{endpoint,provider:'cloudflare'});const prefs=(await store.setting('preferences')).value;await store.setSetting('preferences',{...prefs,sync:{provider:'none',endpoint:null,vaultId:null}});assert.equal((await controller.sync()).state,'local');assert.equal(controller.session,null);
  }finally{controller.close();store.close();env.DB.close();dom.restore();}
});

test('recovery screen can cancel before mutation, then replaces passphrase only after saving fresh codes',async()=>{
  const dom=fakeDOM('/waypost/app/setup/'),store=await storeOpen(),env={DB:new MemoryD1(),BLOBS:new MemoryR2(),AUTH_PEPPER:'test-only-local-pepper-at-least-32-characters'},previous=globalThis.fetch;globalThis.fetch=(url,options)=>handleRequest(new Request(url,options),env);const endpoint=location.origin+'/api/sync',transport=createTransport({endpoint,provider:'cloudflare',origin:location.origin}),session=await createVaultSecrets('a previous private passphrase',{vaultId:uuidv7()});await transport.create(session);const controller=await initializeSync({store,mode:'pwa'});
  const untilCodes=async()=>{for(let i=0;i<10000;i++){if(dom.find('recovery-cancel').length)return;await new Promise(resolve=>setImmediate(resolve));}throw new Error('Recovery codes did not appear.');};
  try{await renderSetup({store,basePath:'/waypost/',view:dom.view,actions:dom.actions,syncController:controller});dom.find('setup-provider')[0].value='cloudflare';dom.find('setup-endpoint')[0].value=endpoint;await dom.find('setup-check')[0].fire('click');dom.find('vault-action')[0].value='recover';await dom.find('vault-action')[0].fire('change');dom.find('vault-id')[0].value=session.vaultId;
    const fill=()=>{dom.find('vault-recovery-code')[0].value=session.codes[0];dom.find('vault-passphrase')[0].value='a replacement private passphrase';dom.find('vault-confirm')[0].value='a replacement private passphrase';};fill();const cancelled=dom.find('setup-vault')[0].fire('click');await untilCodes();assert.equal(dom.find('vault-action')[0].disabled,true);await dom.find('recovery-cancel')[0].fire('click');await cancelled;assert.equal((await transport.pull(0,session)).keyVersion,1);
    fill();const recovery=dom.find('setup-vault')[0].fire('click');await untilCodes();assert.notEqual(dom.find('recovery-code-1')[0].textContent,session.codes[0]);dom.find('recovery-saved')[0].checked=true;await dom.find('recovery-saved')[0].fire('change');await dom.find('recovery-continue')[0].fire('click');await recovery;await assert.rejects(transport.pull(0,session),error=>error.status===401);assert.equal(dom.find('recovery-code-1').length,0);await dom.find('setup-roundtrip')[0].fire('click');assert.equal(dom.readResult().roundTrip.passed,true);assert.equal(dom.readResult().sync.vaultId,session.vaultId);
  }finally{controller.close();store.close();env.DB.close();globalThis.fetch=previous;dom.restore();}
});
