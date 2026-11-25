import {createTransport} from '../core/sync/transport.js';
import {createSyncEngine} from '../core/sync/engine.js';
import {encryptRecord,decryptRecord} from '../core/sync/crypto.js';
import {uuidv7} from './store.js';

// Credentials live in this browser's IndexedDB only. Workspace exports use an
// explicit settings allowlist and never include this internal setting.
export const deviceSession=(secrets,connection)=>({vaultId:secrets.vaultId,salt:secrets.salt,keyVersion:secrets.keyVersion,encKey:secrets.encKey,authToken:secrets.authToken,endpoint:connection.endpoint,provider:connection.provider});
export async function testEncryptedRoundTrip({store,transport,session,clock=()=>performance.now()}){
  const started=clock(),record=store.record({id:uuidv7(),key:'sync-probe',value:{nonce:uuidv7()}}),encrypted=await encryptRecord('settings',record,session);await transport.push([encrypted],session);
  let cursor=0,found=null;do{const page=await transport.pull(cursor,session);found=page.changes.find(row=>row.type==='settings'&&row.id===record.id)??found;cursor=page.cursor;if(!page.hasMore)break;}while(!found);
  if(!found||JSON.stringify(await decryptRecord(found,session))!==JSON.stringify(record))throw new Error('Encrypted round-trip verification failed.');
  await transport.push([await encryptRecord('settings',store.record({...record,deleted:true}),session)],session);
  return {passed:true,milliseconds:Math.round(clock()-started)};
}
export async function initializeSync({store,mode,origin=location.origin,events=window,fetch=globalThis.fetch,online=()=>navigator.onLine!==false,locks=globalThis.navigator?.locks}){
  let status={state:mode==='demo'?'demo':'local'},session=null,transport=null,engine=null,abort=null,debounce=null,interval=null,paused=false,stopped=false,generation=0;const listeners=new Set();
  const update=value=>{status={...status,...value};for(const listener of listeners)listener(status);};
  const stop=()=>{generation++;clearTimeout(debounce);clearInterval(interval);abort?.abort();transport=engine=null;};
  const make=()=>{const current=generation;abort=new AbortController();transport=createTransport({endpoint:session.endpoint,provider:session.provider,origin,fetch,signal:abort.signal});engine=createSyncEngine({store,session,transport,onStatus:value=>{if(current===generation)update(value);}});};
  async function run(){
    if(mode==='demo'||paused||stopped||!session)return status;
    const prefs=(await store.setting('preferences')).value;
    if(prefs.sync?.provider==='none'||prefs.sync?.vaultId!==session.vaultId||prefs.sync?.endpoint!==session.endpoint){stop();session=null;update({state:'local'});return status;}
    if(!online()){update({state:'offline',message:'Offline. Changes stay on this device until it reconnects.'});return status;}
    if(!engine)make();const current=engine,compute=()=>current.sync();
    return locks?locks.request(`waypost-sync:${session.vaultId}`,{ifAvailable:true},lock=>lock?compute():status):compute();
  }
  const background=()=>run().catch(()=>{/* Visible status carries the error; local edits remain usable. */});
  const schedule=()=>{clearTimeout(debounce);if(!paused&&session)debounce=setTimeout(background,1000);};
  const offline=()=>update({state:session?'offline':'local'}),onlineEvent=()=>background();
  const unsubscribe=store.subscribe(schedule);
  events.addEventListener('online',onlineEvent);events.addEventListener('offline',offline);
  const controller={get status(){return status;},get session(){return session;},subscribe(listener){listeners.add(listener);listener(status);return()=>listeners.delete(listener);},sync:run,
    pause(){paused=true;stop();},
    async connect(secrets,connection){if(mode==='demo')throw new Error('Sync is unavailable in the demo.');stop();session=deviceSession(secrets,connection);await store.setSetting('vault-session',session);const prefs=(await store.setting('preferences')).value;await store.setSetting('preferences',{...prefs,sync:{provider:connection.provider,endpoint:connection.endpoint,vaultId:session.vaultId}});paused=false;make();interval=setInterval(background,30000);interval.unref?.();return run();},
    async disconnect(){paused=true;stop();session=null;await store.setSetting('vault-session',null);const prefs=(await store.setting('preferences')).value;await store.setSetting('preferences',{...prefs,sync:{provider:'none',endpoint:null,vaultId:null}});update({state:'local',message:'Disconnected. Local records are kept.'});},
    async deleteVault(){if(!session)throw new Error('Unlock this vault before deleting its server copy.');paused=true;stop();make();try{await transport.deleteVault(session);await controller.disconnect();}catch(error){paused=false;interval=setInterval(background,30000);interval.unref?.();update({state:'error',message:error.message});throw error;}},
    close(){stopped=true;stop();unsubscribe();listeners.clear();events.removeEventListener('online',onlineEvent);events.removeEventListener('offline',offline);}
  };
  events.addEventListener('pagehide',()=>controller.close(),{once:true});
  if(mode!=='demo'){
    const preferences=(await store.setting('preferences')).value,saved=(await store.setting('vault-session'))?.value;
    if(preferences.sync?.provider!=='none'&&saved?.encKey?.type==='secret'&&saved.vaultId===preferences.sync?.vaultId){session=saved;try{make();interval=setInterval(background,30000);interval.unref?.();background();}catch(error){update({state:'locked',message:error.message});}}
    else if(preferences.sync?.provider!=='none')update({state:'locked',message:'Unlock this vault in Connect sync.'});
  }
  return controller;
}
