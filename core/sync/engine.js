import {stores} from '../store/schema.js';
import {syncRecords} from './records.js';
import {encryptRecord,decryptRecord,createVaultSecrets} from './crypto.js';
import {splitChanges,recordKey,recordVersion,validateEnvelope,keyVersion} from './protocol.js';
export const syncStateKey=vaultId=>`sync-state:${vaultId}`;
const collect=async store=>Object.fromEntries(await Promise.all(stores.filter(type=>type!=='changes').map(async type=>[type,await store.all(type,{deleted:true})])));
export async function readRemote(transport,session,{cursor=0}={}) {
  const rows=[],versions={};let next=cursor,more=true,pages=0;
  while(more){if(++pages>100000)throw new Error('Too many sync pages.');const page=await transport.pull(next,session);
    if(!Array.isArray(page.changes)||!Number.isSafeInteger(page.cursor)||page.cursor<next||page.hasMore&&page.cursor===next)throw new Error('Invalid sync cursor response.');
    if(page.keyVersion!==session.keyVersion)throw new Error('Vault keys changed. Unlock the vault again.');
    for(const envelope of page.changes){validateEnvelope(envelope);rows.push({type:envelope.type,record:await decryptRecord(envelope,session)});versions[recordKey(envelope)]=recordVersion(envelope);}
    next=page.cursor;more=page.hasMore===true;
  }return {rows,cursor:next,versions};
}
export function createSyncEngine({store,session,transport,onStatus=()=>{},now=()=>new Date().toISOString()}){
  let inflight=null;
  async function run(){
    onStatus({state:'syncing'});let state=(await store.setting(syncStateKey(session.vaultId)))?.value??{cursor:0,versions:{}};
    try{
      let pulled;try{pulled=await readRemote(transport,session,{cursor:state.cursor});}catch(error){if(error.code!=='cursor_out_of_range')throw error;state={cursor:0,versions:{}};pulled=await readRemote(transport,session);}
      const mergedVersions={...state.versions,...pulled.versions};await store.applyRemoteSync(pulled.rows,{vaultId:session.vaultId,cursor:pulled.cursor,versions:mergedVersions});
      const current=syncRecords(await collect(store),session),outgoing=current.filter(({type,record})=>mergedVersions[recordKey({type,...record})]!==recordVersion(record)),encrypted=[];
      for(const {type,record}of outgoing)encrypted.push(await encryptRecord(type,record,session));
      for(const batch of splitChanges(encrypted)){await transport.push(batch,session);for(const row of batch)mergedVersions[recordKey(row)]=recordVersion(row);}
      // Pull after push as well: a concurrent device may have won an LWW tie.
      // A POST cursor never advances the read cursor, which would skip changes.
      const final=await readRemote(transport,session,{cursor:pulled.cursor}),versions={...mergedVersions,...final.versions};
      await store.applyRemoteSync(final.rows,{vaultId:session.vaultId,cursor:final.cursor,versions,lastSyncedAt:now()});
      const status={state:'synced',pushed:encrypted.length,pulled:pulled.rows.length+final.rows.length,lastSyncedAt:now()};onStatus(status);return status;
    }catch(error){onStatus({state:error.status===401||error.code==='key_version_changed'?'locked':'error',message:error.message});throw error;}
  }
  return {sync(){if(!inflight)inflight=run().finally(()=>{inflight=null;});return inflight;}};
}
export async function rotateVaultPassphrase({transport,session,passphrase,rotationId,onPrepared=()=>{}}) {
  // A stable complete snapshot is required. Commit rejects any concurrent write;
  // old keys remain usable on failure, and no local record is discarded.
  const snapshot=await readRemote(transport,session),secrets=await createVaultSecrets(passphrase,{vaultId:session.vaultId,keyVersion:keyVersion(session.keyVersion+1)});
  await onPrepared(secrets);
  await transport.request('/vault/rotation',{method:'POST',auth:session,data:{rotationId,baseCursor:snapshot.cursor,vaultId:session.vaultId,salt:secrets.salt,keyVersion:secrets.keyVersion,authHash:secrets.authHash,newAuthToken:secrets.authToken,wrappedKeys:secrets.wrappedKeys}});
  try{
    const encrypted=[];for(const {type,record}of snapshot.rows)encrypted.push(await encryptRecord(type,record,secrets));
    for(const changes of splitChanges(encrypted,5*1024*1024-200))await transport.request('/vault/rotation/changes',{method:'POST',auth:session,data:{rotationId,changes}});
    await transport.request('/vault/rotation/commit',{method:'POST',auth:session,data:{rotationId,count:encrypted.length}});
    return secrets;
  }catch(error){
    // A lost commit response must not strand a successful rotation. Probe with
    // the new keys before treating it as a failure or cancelling the old stage.
    if(error.code==='network'||error.code==='aborted'||error.code==='storage'){try{await transport.pull(0,secrets);return secrets;}catch{/* New authentication did not succeed. */}}
    try{await transport.request('/vault/rotation',{method:'DELETE',auth:session,data:{rotationId}});}catch{/* A committed/expired rotation is safe to leave for cleanup. */}throw error;
  }
}
