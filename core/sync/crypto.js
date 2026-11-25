import {base64url,unbase64,utf8,validateEnvelope,requireUUID,keyVersion} from './protocol.js';
import {assertRecord} from '../store/schema.js';
export const PBKDF2_ITERATIONS=600000;
const random=length=>crypto.getRandomValues(new Uint8Array(length));
const alphabet='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export async function digest(value){return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?utf8(value):value)));}
export async function deriveMaster(passphrase,salt){
  if(typeof passphrase!=='string'||passphrase.length<12||passphrase.length>1024)throw new Error('Use a passphrase of 12–1024 characters.');
  const bytes=typeof salt==='string'?unbase64(salt,{length:16}):salt;if(!(bytes instanceof Uint8Array)||bytes.length!==16)throw new Error('Use a 16-byte vault salt.');
  const material=await crypto.subtle.importKey('raw',utf8(passphrase),'PBKDF2',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes,iterations:PBKDF2_ITERATIONS,hash:'SHA-256'},material,256));
}
async function hkdf(bytes,salt,info){const material=await crypto.subtle.importKey('raw',bytes,'HKDF',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info:utf8(info)},material,256));}
export async function deriveVaultKeys(master,vaultId){
  requireUUID(vaultId);if(!(master instanceof Uint8Array)||master.length!==32)throw new Error('Invalid master key.');
  const salt=utf8(vaultId),enc=await hkdf(master,salt,'waypost:enc:v1'),auth=await hkdf(master,salt,'waypost:auth:v1');
  const encKey=await crypto.subtle.importKey('raw',enc,{name:'AES-GCM'},false,['encrypt','decrypt']);enc.fill(0);
  const authToken=base64url(auth);auth.fill(0);return {encKey,authToken,authHash:await digest(authToken)};
}
function additionalData(vaultId,version,row){return utf8(['waypost-record-v1',requireUUID(vaultId),keyVersion(version),row.type,row.id,row.updatedAt,row.deviceId]);}
export async function encryptRecord(type,record,{encKey,vaultId,keyVersion:version=1}){
  assertRecord(type,record);const envelope={id:record.id,type,updatedAt:record.updatedAt,deviceId:record.deviceId,iv:base64url(random(12)),ciphertext:''};
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv:unbase64(envelope.iv),additionalData:additionalData(vaultId,version,envelope),tagLength:128},encKey,utf8(record));envelope.ciphertext=base64url(new Uint8Array(encrypted));return validateEnvelope(envelope);
}
export async function decryptRecord(envelope,{encKey,vaultId,keyVersion:version=1}){
  validateEnvelope(envelope);let plaintext;
  try{plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(envelope.iv),additionalData:additionalData(vaultId,version,envelope),tagLength:128},encKey,unbase64(envelope.ciphertext));}catch{throw new Error('Encrypted record authentication failed. No local data was changed.');}
  const record=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plaintext));assertRecord(envelope.type,record);
  if(record.id!==envelope.id||record.updatedAt!==envelope.updatedAt||record.deviceId!==envelope.deviceId)throw new Error('Encrypted metadata does not match the record.');return record;
}
function encodeCode(bytes){let bits=0,value=0,code='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){bits-=5;code+=alphabet[(value>>>bits)&31];}}return code.match(/.{1,8}/g).join('-');}
function decodeCode(code){const clean=String(code).toUpperCase().replaceAll('-','').replaceAll(' ','');if(clean.length!==32||[...clean].some(char=>!alphabet.includes(char)))throw new Error('Enter the complete recovery code.');let bits=0,value=0;const bytes=[];for(const char of clean){value=(value<<5)|alphabet.indexOf(char);bits+=5;if(bits>=8){bits-=8;bytes.push((value>>>bits)&255);}}return Uint8Array.from(bytes);}
export async function recoveryCodeId(code){const secret=decodeCode(code),hash=new Uint8Array(await crypto.subtle.digest('SHA-256',secret));secret.fill(0);return base64url(hash.subarray(0,16));}
async function codeKey(secret,salt,vaultId,codeId){const bytes=await hkdf(secret,salt,`waypost:recovery:v1:${vaultId}:${codeId}`),key=await crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);bytes.fill(0);return key;}
export async function createRecoveryCodes(master,{vaultId,keyVersion:version=1}){
  const codes=[],wrappedKeys=[];for(let i=0;i<8;i++){
    const secret=random(20),code=encodeCode(secret),codeId=await recoveryCodeId(code),salt=random(16),iv=random(12),key=await codeKey(secret,salt,vaultId,codeId);secret.fill(0);
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:utf8(['waypost-recovery-v1',vaultId,version,codeId])},key,master);
    codes.push(code);wrappedKeys.push({codeId,salt:base64url(salt),iv:base64url(iv),ciphertext:base64url(new Uint8Array(ciphertext))});
  }return {codes,wrappedKeys};
}
export async function unwrapRecoveryCode(code,wrapped,{vaultId,keyVersion:version=1}){
  const codeId=await recoveryCodeId(code);if(codeId!==wrapped.codeId)throw new Error('Recovery code does not match this wrapper.');
  const secret=decodeCode(code),key=await codeKey(secret,unbase64(wrapped.salt,{length:16}),vaultId,codeId);secret.fill(0);
  try{return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(wrapped.iv,{length:12}),additionalData:utf8(['waypost-recovery-v1',vaultId,version,codeId])},key,unbase64(wrapped.ciphertext,{length:48})));}catch{throw new Error('Recovery code could not unlock this vault.');}
}
export async function createVaultSecrets(passphrase,{vaultId,keyVersion:version=1}){
  const salt=base64url(random(16)),master=await deriveMaster(passphrase,salt);
  try{return {vaultId,salt,keyVersion:version,...await deriveVaultKeys(master,vaultId),...await createRecoveryCodes(master,{vaultId,keyVersion:version})};}finally{master.fill(0);}
}
