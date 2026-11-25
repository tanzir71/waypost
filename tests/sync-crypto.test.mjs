import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveMaster,deriveVaultKeys,encryptRecord,decryptRecord,createRecoveryCodes,unwrapRecoveryCode,recoveryCodeId,PBKDF2_ITERATIONS} from '../core/sync/crypto.js';
import {base64url,validateVault,splitChanges} from '../core/sync/protocol.js';
import {syncRecords,chooseRemote} from '../core/sync/records.js';
import {mergeRecords} from '../core/store/merge.js';
import {openWorkspace,uuidv7} from '../ui/store.js';
import {memoryIndexedDB,memoryLocalStorage} from './helpers/memory-indexeddb.mjs';
const vaultId=uuidv7(),deviceId=uuidv7(),now='2026-11-25T12:00:00.000Z',salt=base64url(new Uint8Array(16).fill(7));
test('WebCrypto uses 600k PBKDF2, distinct nonextractable AES/HKDF keys and metadata-authenticated records',async()=>{
  assert.equal(PBKDF2_ITERATIONS,600000);const master=await deriveMaster('a long private passphrase',salt),keys={...await deriveVaultKeys(master,vaultId),vaultId,keyVersion:1};
  assert.equal(keys.encKey.extractable,false);await assert.rejects(crypto.subtle.exportKey('raw',keys.encKey));
  const record={id:uuidv7(),deviceId,createdAt:now,updatedAt:now,deleted:false,title:'Private role',text:'Secret resume evidence',source:'paste'};
  const envelope=await encryptRecord('jobs',record,keys);assert.ok(!JSON.stringify(envelope).includes('Secret'));assert.deepEqual(await decryptRecord(envelope,keys),record);
  assert.notEqual((await encryptRecord('jobs',record,keys)).iv,envelope.iv);
  for(const change of [{deviceId:uuidv7()},{id:uuidv7()},{type:'contacts'},{updatedAt:'2026-11-26T12:00:00.000Z'},{ciphertext:envelope.ciphertext.slice(0,-2)+'AA'}])await assert.rejects(decryptRecord({...envelope,...change},keys));
  await assert.rejects(decryptRecord(envelope,{...keys,keyVersion:2}));await assert.rejects(deriveMaster('short',salt));
  const other=await deriveVaultKeys(master,uuidv7());assert.notEqual(keys.authToken,other.authToken);master.fill(0);
});
test('eight high-entropy recovery codes unwrap the same master and reject wrong code/vault/version',async()=>{
  const master=crypto.getRandomValues(new Uint8Array(32)),recovery=await createRecoveryCodes(master,{vaultId,keyVersion:1});
  assert.equal(recovery.codes.length,8);assert.equal(new Set(recovery.codes).size,8);
  for(let i=0;i<8;i++){assert.match(recovery.codes[i],/^[0-9A-HJKMNP-TV-Z]{8}(?:-[0-9A-HJKMNP-TV-Z]{8}){3}$/);assert.equal(await recoveryCodeId(recovery.codes[i]),recovery.wrappedKeys[i].codeId);assert.deepEqual(await unwrapRecoveryCode(recovery.codes[i],recovery.wrappedKeys[i],{vaultId,keyVersion:1}),master);}
  validateVault({vaultId,salt,keyVersion:1,authHash:base64url(new Uint8Array(32)),wrappedKeys:recovery.wrappedKeys});
  await assert.rejects(unwrapRecoveryCode(recovery.codes[1],recovery.wrappedKeys[0],{vaultId}));await assert.rejects(unwrapRecoveryCode(recovery.codes[0],recovery.wrappedKeys[0],{vaultId,keyVersion:2}));await assert.rejects(unwrapRecoveryCode(recovery.codes[0],recovery.wrappedKeys[0],{vaultId:uuidv7()}));
  assert.throws(()=>validateVault({vaultId,salt,authHash:base64url(new Uint8Array(32)),wrappedKeys:recovery.wrappedKeys.slice(1)}));
});
test('last-writer-wins uses actual timestamps and deterministic device ties, including tombstones',()=>{
  const id=uuidv7(),a={id,updatedAt:'2026-11-25T12:00:00.000Z',deviceId:'a',deleted:false},b={...a,deviceId:'b',deleted:true};
  assert.deepEqual(mergeRecords([a],[b]),[b]);assert.deepEqual(mergeRecords([b],[a]),[b]);assert.equal(mergeRecords([a],[{...a,updatedAt:'2026-11-25T13:00:00+02:00'}])[0],a);
  const preferences={...a,key:'preferences',value:{sync:{provider:'php'},ai:{provider:'byok'}}},remote={...b,key:'preferences',value:{theme:'dark',ai:{provider:'byok',apiKey:'NEVER'},sync:{provider:'cloudflare',authKey:'NEVER'}}};
  const chosen=chooseRemote(preferences,remote,'settings');assert.equal(chosen.value.sync.provider,'php');assert.equal(chosen.value.ai.provider,'byok');assert.ok(!JSON.stringify(chosen).includes('NEVER'));
});
test('sync projection excludes keys and original files; IDB merge is atomic and never journals remote writes',async()=>{
  const store=await openWorkspace({indexedDB:memoryIndexedDB(),localStorage:memoryLocalStorage(),storage:{}}),job=await store.save('jobs',{title:'Local',text:'Local evidence',source:'paste'}),before=(await store.all('changes')).length;
  await store.setSetting('vault-session',{authToken:'NEVER'});const projected=syncRecords({jobs:[job],settings:await store.all('settings')},{vaultId});assert.ok(!JSON.stringify(projected).includes('NEVER'));assert.equal(projected.find(row=>row.type==='settings').record.id,vaultId);
  const remote={...job,title:'Remote',updatedAt:'2099-01-01T00:00:00.000Z',deviceId};await store.applyRemoteSync([{type:'jobs',record:remote}],{vaultId,cursor:5,versions:{}});assert.equal((await store.get('jobs',job.id)).title,'Remote');assert.equal((await store.all('changes')).length,before);
  const edited=store.record(remote);assert.ok(edited.updatedAt>remote.updatedAt);assert.notEqual(store.record(edited).updatedAt,edited.updatedAt);
  await assert.rejects(store.applyRemoteSync([{type:'jobs',record:{...remote,title:3}}],{vaultId,cursor:6,versions:{}}));assert.equal((await store.setting(`sync-state:${vaultId}`)).value.cursor,5);store.close();
});
