import { stores,assertRecord,settingsDefaults } from '../core/store/schema.js';
import { migrateLegacy } from '../core/store/migration.js';

export function uuidv7(now=Date.now()) {
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  let timestamp=BigInt(now);
  for(let i=5;i>=0;i--) {bytes[i]=Number(timestamp&255n);timestamp>>=8n;}
  bytes[6]=(bytes[6]&15)|112;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const request = req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
const complete = tx=>new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('Storage transaction aborted.'));});
export async function openWorkspace({indexedDB=globalThis.indexedDB,localStorage=globalThis.localStorage,storage=globalThis.navigator?.storage}={}) {
  if(!indexedDB) throw new Error('Local workspace storage is unavailable in this browser. Use the landing demo or allow site storage.');
  const opened=indexedDB.open('waypost',1);
  opened.onupgradeneeded=()=>{
    for(const type of stores) if(!opened.result.objectStoreNames.contains(type)) {
      const objectStore=opened.result.createObjectStore(type,{keyPath:'id'});
      if(type==='settings') objectStore.createIndex('key','key',{unique:true});
    }
  };
  const db=await request(opened);
  db.onversionchange=()=>db.close();
  let deviceId;
  try {deviceId=localStorage?.getItem('waypost:device');} catch { /* Storage still works without localStorage. */ }
  deviceId ||=uuidv7();
  try {localStorage?.setItem('waypost:device',deviceId);} catch { /* IndexedDB is the source of truth. */ }
  const all=async(type,{deleted=false}={})=>{
    const tx=db.transaction(type,'readonly');const done=complete(tx);
    const rows=await request(tx.objectStore(type).getAll());await done;
    return deleted?rows:rows.filter(row=>!row.deleted);
  };
  const get=async(type,id)=>{
    const tx=db.transaction(type,'readonly');const done=complete(tx);
    const row=await request(tx.objectStore(type).get(id));await done;return row;
  };
  const record=(data={})=>{const now=new Date().toISOString();return {...data,id:data.id??uuidv7(),createdAt:data.createdAt??now,updatedAt:now,deviceId,deleted:data.deleted??false};};
  let persistenceRequested=false;
  const putMany=async(records,{meaningful=true,guardSetting=null}={})=>{
    const types=Object.keys(records).filter(type=>records[type].length);
    if(!types.length) return;
    for(const type of types) records[type].forEach(row=>assertRecord(type,row));
    const tx=db.transaction([...new Set([...types,'changes',...(guardSetting?['settings']:[])])],'readwrite');const done=complete(tx);
    let written=false;
    const write=()=>{written=true;for(const type of types) for(const row of records[type]) {
      tx.objectStore(type).put(row);
      if(type!=='changes' && type!=='settings') tx.objectStore('changes').put(record({type,recordId:row.id}));
    }};
    if(guardSetting) {
      const check=tx.objectStore('settings').index('key').get(guardSetting);
      check.onsuccess=()=>{if(!check.result)write();};
    } else write();
    await done;
    if(meaningful && !persistenceRequested) {
      persistenceRequested=true;
      try {await storage?.persist?.();} catch { /* Settings reports persistence and quota separately. */ }
    }
    return written;
  };
  const setting=async key=>(await all('settings')).find(row=>row.key===key);
  const setSetting=async(key,value)=>{
    const previous=await setting(key);const row=record({...previous,key,value});
    try {await putMany({settings:[row]},{meaningful:false});return row;}
    catch(error) {if(error?.name==='ConstraintError' && !previous) {const winner=await setting(key);if(winner)return winner;}throw error;}
  };
  const device=await setting('device-id');
  if(device) deviceId=device.value;
  else deviceId=(await setSetting('device-id',deviceId)).value;
  let migrationMessage='';
  const marker=await setting('legacy-migrated');
  let legacy;
  try {legacy=localStorage?.getItem('ats-scoring:v1');} catch { /* No legacy store available. */ }
  if(legacy && !marker) {
    try {
      const mapping=new Map();
      const converted=migrateLegacy(legacy,{idFor:key=>{if(!mapping.has(key))mapping.set(key,uuidv7());return mapping.get(key);},now:new Date().toISOString(),deviceId});
      if(await setting('preferences')) converted.settings=converted.settings.filter(row=>row.key!=='preferences');
      // Include the marker in the same transaction. A crash cannot cause a
      // second migration or a marker with missing imported records.
      converted.settings.push(record({key:'legacy-migrated',value:true}));
      const imported=await putMany(converted,{guardSetting:'legacy-migrated'});
      try {localStorage?.setItem('ats-scoring:v1:migrated',legacy);} catch { /* Original is never deleted. */ }
      if(imported) migrationMessage='Your previous resumes, jobs and results were imported. The original local backup is kept.';
    } catch(error) {migrationMessage=`Migration could not finish: ${error.message} Your original data is unchanged.`;}
  }
  if(!(await setting('preferences'))) await setSetting('preferences',settingsDefaults());
  return {all,get,record,putMany,setting,setSetting,deviceId,migrationMessage,close:()=>db.close(),
    async save(type,data) {const row=record(data);await putMany({[type]:[row]});return row;},
    async remove(type,id) {const previous=await get(type,id);if(previous) await putMany({[type]:[record({...previous,deleted:true})]});},
    async clearSamples() {
      const records={};
      for(const type of stores.filter(type=>!['settings','changes'].includes(type))) records[type]=(await all(type)).filter(row=>row.sample).map(row=>record({...row,deleted:true}));
      await putMany(records,{meaningful:false});await setSetting('demo-seeded',true);
    },
    async seed(seed) {
      if(await setting('demo-seeded')) return;
      const mapping=new Map();
      for(const rows of Object.values(seed)) if(Array.isArray(rows)) for(const row of rows) if(row.id) mapping.set(row.id,uuidv7());
      const records={};
      const references=['parentId','jobId','resumeVersionId','termId','retakeOf','clusterId'];
      for(const [type,rows] of Object.entries(seed)) {
        if(!stores.includes(type)||!Array.isArray(rows)) continue;
        records[type]=rows.map(row=>{const copy={...row,id:mapping.get(row.id),sample:true};for(const key of references)if(mapping.has(copy[key]))copy[key]=mapping.get(copy[key]);return record(copy);});
      }
      records.settings=[record({key:'demo-seeded',value:true})];
      await putMany(records,{meaningful:false,guardSetting:'demo-seeded'});
    }
  };
}
