import {stores} from '../store/schema.js';
export const PROTOCOL_VERSION=1,MAX_REQUEST_BYTES=5*1024*1024,MAX_RECORD_BYTES=4*1024*1024,DEFAULT_VAULT_BYTES=200*1024*1024,R2_THRESHOLD=64*1024,MAX_BATCH_RECORDS=10;
export const SYNC_TYPES=stores.filter(type=>type!=='changes');
export const utf8=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value));
export const bytesLength=value=>utf8(value).byteLength;
export function base64url(bytes){let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
export function unbase64(value,{length,max=MAX_REQUEST_BYTES}={}) {
  if(typeof value!=='string'||value.length>Math.ceil(max*4/3)||!/^[A-Za-z0-9_-]+$/.test(value)||value.length%4===1)throw new Error('Invalid encoded bytes.');
  const bytes=Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),char=>char.charCodeAt(0));
  if(bytes.length>max||length!==undefined&&bytes.length!==length||base64url(bytes)!==value)throw new Error('Invalid encoded byte length.');return bytes;
}
export const isUUID=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
export function requireUUID(value){if(!isUUID(value))throw new Error('A UUIDv7 identifier is required.');return value;}
export function keyVersion(value){if(!Number.isSafeInteger(value)||value<1||value>1000000)throw new Error('Invalid vault key version.');return value;}
export function validateEnvelope(row){
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(key=>!['id','type','updatedAt','deviceId','iv','ciphertext'].includes(key)))throw new Error('Invalid encrypted record fields.');
  requireUUID(row.id);requireUUID(row.deviceId);if(!SYNC_TYPES.includes(row.type))throw new Error('Unknown encrypted record type.');
  if(typeof row.updatedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(row.updatedAt)||!Number.isFinite(Date.parse(row.updatedAt))||new Date(row.updatedAt).toISOString()!==row.updatedAt)throw new Error('Use canonical UTC record timestamps.');
  unbase64(row.iv,{length:12});const ciphertext=unbase64(row.ciphertext,{max:MAX_RECORD_BYTES});if(ciphertext.length<16)throw new Error('Encrypted record is too short.');
  if(bytesLength(row)>MAX_RECORD_BYTES)throw new Error('An encrypted record exceeds the 4 MB record limit.');return row;
}
export function validateVault(data){
  if(!data||typeof data!=='object')throw new Error('Vault metadata is required.');requireUUID(data.vaultId);keyVersion(data.keyVersion??1);unbase64(data.salt,{length:16});unbase64(data.authHash,{length:32});
  if(!Array.isArray(data.wrappedKeys)||data.wrappedKeys.length!==8)throw new Error('Exactly eight recovery wrappers are required.');
  const ids=new Set();for(const wrapped of data.wrappedKeys){if(!wrapped||Object.keys(wrapped).some(key=>!['codeId','salt','iv','ciphertext'].includes(key)))throw new Error('Invalid recovery wrapper.');unbase64(wrapped.codeId,{length:16});unbase64(wrapped.salt,{length:16});unbase64(wrapped.iv,{length:12});unbase64(wrapped.ciphertext,{length:48});if(ids.has(wrapped.codeId))throw new Error('Duplicate recovery identifier.');ids.add(wrapped.codeId);}return data;
}
export function splitChanges(changes,max=MAX_REQUEST_BYTES){
  const batches=[];let batch=[],size=bytesLength({changes:[]});
  for(const row of changes){validateEnvelope(row);const length=bytesLength(row)+(batch.length?1:0);if(length+bytesLength({changes:[]})>max)throw new Error('An encrypted record exceeds the request limit.');if(batch.length&&(size+length>max||batch.length>=MAX_BATCH_RECORDS)){batches.push(batch);batch=[];size=bytesLength({changes:[]});}batch.push(row);size+=length;}
  if(batch.length)batches.push(batch);return batches;
}
export const recordKey=row=>`${row.type}:${row.id}`;
export const recordVersion=row=>`${row.updatedAt}|${row.deviceId}`;
export function endpointURL(endpoint,{origin}={}) {
  const url=new URL(endpoint,origin);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('Use an HTTPS sync endpoint without credentials, query or fragment.');
  if(origin&&url.origin!==new URL(origin).origin)throw new Error('Host the sync endpoint on this app’s origin.');return url.href.replace(/\/$/,'');
}
