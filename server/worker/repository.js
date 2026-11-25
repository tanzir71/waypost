import {base64url,unbase64,utf8,bytesLength,R2_THRESHOLD,DEFAULT_VAULT_BYTES} from '../../core/sync/protocol.js';
import {digest} from '../../core/sync/crypto.js';
import {validatePublishedICS} from '../../core/calendar/ics.js';
import {calendarToken} from '../../core/calendar/publication.js';
export class RepositoryError extends Error {constructor(code,message,status=409){super(message);this.code=code;this.status=status;}}
const envelope=row=>({id:row.id,type:row.type,updatedAt:row.updated_at,deviceId:row.device_id,iv:row.iv,ciphertext:row.ciphertext});
export class SyncRepository {
  constructor(env){this.db=env.DB;this.blobs=env.BLOBS;this.pepper=env.AUTH_PEPPER;this.maxBytes=Number(env.MAX_VAULT_BYTES)||DEFAULT_VAULT_BYTES;}
  statement(tag,sql,args=[]){return this.db.prepare(`/*${tag}*/ ${sql}`).bind(...args);}
  async hashToken(token){const key=await crypto.subtle.importKey('raw',utf8(this.pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);return base64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,utf8(token))));}
  async verifyToken(token,hash){const key=await crypto.subtle.importKey('raw',utf8(this.pepper),{name:'HMAC',hash:'SHA-256'},false,['verify']);return crypto.subtle.verify('HMAC',key,unbase64(hash,{length:32}),utf8(token));}
  async checks(){let database=false;try{if(this.db){await this.statement('schema:check','SELECT vault_id,calendar_version FROM vaults LIMIT 1').all();database=true;}}catch{}return [{id:'https',label:'HTTPS',passed:true},{id:'database',label:'D1 schema available',passed:database},{id:'blobs',label:'R2 binding available',passed:!!this.blobs},{id:'pepper',label:'Server authentication secret configured',passed:typeof this.pepper==='string'&&this.pepper.length>=32}];}
  async rate(bucket,window,limit){await this.statement('rate:prune','DELETE FROM rate_limits WHERE window < ?',[window-60]).run();const row=await this.statement('rate:tick','INSERT INTO rate_limits(bucket,window,count) VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count',[bucket,window]).first();return row.count<=limit;}
  getVault(id){return this.statement('vault:get','SELECT * FROM vaults WHERE vault_id=?',[id]).first();}
  async create(data,token){
    const existing=await this.getVault(data.vaultId);if(existing){if(await this.verifyToken(token,existing.auth_hash)&&existing.salt===data.salt&&existing.wrapped_keys===JSON.stringify(data.wrappedKeys))return {created:false,vault:existing};throw new RepositoryError('vault_exists','Vault identifier already exists.');}
    await this.statement('vault:create','INSERT INTO vaults(vault_id,salt,auth_hash,wrapped_keys,key_version,max_bytes,created_at) VALUES(?,?,?,?,?,?,?)',[data.vaultId,data.salt,await this.hashToken(token),JSON.stringify(data.wrappedKeys),1,this.maxBytes,new Date().toISOString()]).run();return {created:true,vault:await this.getVault(data.vaultId)};
  }
  async pointers(vaultId,keys,rotationId=null){
    if(!keys.length)return [];const table=rotationId?'staged_changes':'changes',args=rotationId?[vaultId,rotationId,...keys]:[vaultId,...keys];
    return (await this.statement(rotationId?'stage:pointers':'changes:pointers',`SELECT r2_key FROM ${table} WHERE vault_id=? ${rotationId?'AND rotation_id=?':''} AND (type || ':' || id) IN (${keys.map(()=>'?').join(',')})`,args).all()).results.map(row=>row.r2_key).filter(Boolean);
  }
  async write(vault,changes,rotationId=null){
    const keys=changes.map(row=>`${row.type}:${row.id}`),previous=await this.pointers(vault.vault_id,keys,rotationId),candidates=[],statements=[];
    try{for(const row of changes){const blob=JSON.stringify(row),size=bytesLength(blob),version=rotationId?vault.key_version+1:vault.key_version;let pointer=null;
      if(size>R2_THRESHOLD){pointer=`${vault.vault_id}/v${version}/${rotationId??'live'}/${row.type}/${row.id}/${crypto.randomUUID()}-${await digest(blob)}.json`;await this.blobs.put(pointer,blob);candidates.push(pointer);}
      const fields=[vault.vault_id,...(rotationId?[rotationId]:[]),row.type,row.id,row.updatedAt,row.deviceId,version,row.iv,pointer?null:row.ciphertext,pointer,size];
      if(rotationId)statements.push(this.statement('stage:upsert','INSERT INTO staged_changes(vault_id,rotation_id,type,id,updated_at,device_id,key_version,iv,ciphertext,r2_key,bytes) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM rotations WHERE vault_id=? AND rotation_id=?) ON CONFLICT(vault_id,rotation_id,type,id) DO UPDATE SET updated_at=excluded.updated_at,device_id=excluded.device_id,iv=excluded.iv,ciphertext=excluded.ciphertext,r2_key=excluded.r2_key,bytes=excluded.bytes',[...fields,vault.vault_id,rotationId]));
      else statements.push(this.statement('changes:upsert','INSERT INTO changes(vault_id,type,id,updated_at,device_id,key_version,iv,ciphertext,r2_key,bytes) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(vault_id,type,id) DO UPDATE SET updated_at=excluded.updated_at,device_id=excluded.device_id,key_version=excluded.key_version,iv=excluded.iv,ciphertext=excluded.ciphertext,r2_key=excluded.r2_key,bytes=excluded.bytes WHERE excluded.updated_at > changes.updated_at OR (excluded.updated_at=changes.updated_at AND excluded.device_id > changes.device_id)',fields));
    }
      if(statements.length)await this.db.batch(statements);
    }finally{const retained=new Set(await this.pointers(vault.vault_id,keys,rotationId));const garbage=[...new Set([...previous,...candidates])].filter(key=>!retained.has(key));if(garbage.length)await this.blobs.delete(garbage);}
    return (await this.getVault(vault.vault_id)).cursor;
  }
  async list(vault,since){
    if(since>vault.cursor)throw new RepositoryError('cursor_out_of_range','Server cursor changed; restart the read cursor.');
    const rows=(await this.statement('changes:list','SELECT * FROM changes WHERE vault_id=? AND seq>? ORDER BY seq LIMIT 50',[vault.vault_id,since]).all()).results,changes=[];let size=0,large=0,last=since;
    for(const row of rows){if(row.r2_key&&large>=10||size+row.bytes>4.5*1024*1024)break;let value;
      if(row.r2_key){large++;const object=await this.blobs.get(row.r2_key);if(!object)throw new RepositoryError('retry_read','A concurrent update changed this page. Retry the same cursor.',503);value=await object.json();if(value.id!==row.id||value.updatedAt!==row.updated_at||value.deviceId!==row.device_id||value.iv!==row.iv)throw new RepositoryError('blob_mismatch','Encrypted blob metadata is inconsistent.',503);}
      else value=envelope(row);changes.push(value);size+=row.bytes;last=row.seq;
    }
    const hasMore=changes.length<rows.length||rows.length===50;return {changes,cursor:hasMore?last:Math.max(last,vault.cursor),hasMore,keyVersion:vault.key_version};
  }
  async rotation(vaultId){return this.statement('rotation:get','SELECT * FROM rotations WHERE vault_id=?',[vaultId]).first();}
  async startRotation(vault,data){
    const current=await this.getVault(vault.vault_id);if(current.key_version!==vault.key_version||current.cursor!==data.baseCursor)throw new RepositoryError('concurrent_change','Vault changed; retry recovery with a fresh snapshot.');
    if(await this.rotation(vault.vault_id))throw new RepositoryError('rotation_pending','A key rotation is already pending. Cancel it before retrying.');
    await this.statement('rotation:create','INSERT INTO rotations(vault_id,rotation_id,base_cursor,key_version,salt,auth_hash,wrapped_keys,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM vaults WHERE vault_id=? AND cursor=? AND key_version=?)',[vault.vault_id,data.rotationId,data.baseCursor,data.keyVersion,data.salt,await this.hashToken(data.newAuthToken),JSON.stringify(data.wrappedKeys),new Date().toISOString(),vault.vault_id,data.baseCursor,vault.key_version]).run();
    if(!await this.rotation(vault.vault_id))throw new RepositoryError('concurrent_change','Vault changed before rotation started.');
  }
  async commitRotation(vault,rotationId,count){
    const rotation=await this.rotation(vault.vault_id);if(!rotation||rotation.rotation_id!==rotationId)throw new RepositoryError('rotation_missing','Pending key rotation was not found.');
    const guard='EXISTS(SELECT 1 FROM vaults WHERE vault_id=? AND applied_rotation=?)';
    const committed=await this.db.batch([
      this.statement('rotation:commit','UPDATE vaults SET salt=?,auth_hash=?,wrapped_keys=?,key_version=?,applied_rotation=?,cursor=cursor+1,calendar_version=calendar_version+1,calendar_mutation=NULL WHERE vault_id=? AND key_version=? AND cursor=? AND (SELECT COUNT(*) FROM staged_changes WHERE vault_id=? AND rotation_id=?)=? AND NOT EXISTS(SELECT 1 FROM changes c LEFT JOIN staged_changes s ON s.vault_id=c.vault_id AND s.rotation_id=? AND s.type=c.type AND s.id=c.id WHERE c.vault_id=? AND (s.id IS NULL OR s.updated_at!=c.updated_at OR s.device_id!=c.device_id)) AND NOT EXISTS(SELECT 1 FROM staged_changes s LEFT JOIN changes c ON c.vault_id=s.vault_id AND c.type=s.type AND c.id=s.id WHERE s.vault_id=? AND s.rotation_id=? AND c.id IS NULL)',[rotation.salt,rotation.auth_hash,rotation.wrapped_keys,rotation.key_version,rotationId,vault.vault_id,vault.key_version,rotation.base_cursor,vault.vault_id,rotationId,count,rotationId,vault.vault_id,vault.vault_id,rotationId]),
      this.statement('rotation:revoke-calendar',`DELETE FROM calendar_feeds WHERE vault_id=? AND ${guard}`,[vault.vault_id,vault.vault_id,rotationId]),
      this.statement('rotation:delete-old',`DELETE FROM changes WHERE vault_id=? AND ${guard}`,[vault.vault_id,vault.vault_id,rotationId]),
      this.statement('rotation:install',`INSERT INTO changes(vault_id,type,id,updated_at,device_id,key_version,iv,ciphertext,r2_key,bytes) SELECT vault_id,type,id,updated_at,device_id,key_version,iv,ciphertext,r2_key,bytes FROM staged_changes WHERE vault_id=? AND rotation_id=? AND ${guard}`,[vault.vault_id,rotationId,vault.vault_id,rotationId]),
      this.statement('rotation:clear-stage',`DELETE FROM staged_changes WHERE vault_id=? AND rotation_id=? AND ${guard}`,[vault.vault_id,rotationId,vault.vault_id,rotationId]),
      this.statement('rotation:clear',`DELETE FROM rotations WHERE vault_id=? AND rotation_id=? AND ${guard}`,[vault.vault_id,rotationId,vault.vault_id,rotationId])
    ]);
    if(committed[0].meta.changes!==1)throw new RepositoryError('concurrent_change','Vault changed during recovery. Old keys remain active; retry with a fresh snapshot.');
    await this.deletePrefix(`${vault.vault_id}/v${vault.key_version}/`);return this.getVault(vault.vault_id);
  }
  async cancelRotation(vault,rotationId){const row=await this.rotation(vault.vault_id);if(!row||rotationId&&row.rotation_id!==rotationId)return;const guard='EXISTS(SELECT 1 FROM vaults WHERE vault_id=? AND key_version=?)';await this.db.batch([this.statement('rotation:abort-stage',`DELETE FROM staged_changes WHERE vault_id=? AND rotation_id=? AND ${guard}`,[vault.vault_id,row.rotation_id,vault.vault_id,vault.key_version]),this.statement('rotation:abort',`DELETE FROM rotations WHERE vault_id=? AND rotation_id=? AND ${guard}`,[vault.vault_id,row.rotation_id,vault.vault_id,vault.key_version])]);const current=await this.getVault(vault.vault_id);if(!current||current.key_version!==vault.key_version)throw new RepositoryError('key_version_changed','Vault keys changed. Unlock again.');await this.deletePrefix(`${vault.vault_id}/v${row.key_version}/${row.rotation_id}/`);}
  async deletePrefix(prefix){for(;;){const listed=await this.blobs.list({prefix,limit:1000});if(!listed.objects.length)return;await this.blobs.delete(listed.objects.map(row=>row.key));}}
  async calendarStatus(id){const row=await this.statement('calendar:status','SELECT calendar_version AS version,EXISTS(SELECT 1 FROM calendar_feeds WHERE vault_id=?) AS published,(SELECT updated_at FROM calendar_feeds WHERE vault_id=?) AS updatedAt,(SELECT content_hash FROM calendar_feeds WHERE vault_id=?) AS contentHash,(SELECT nonce FROM calendar_feeds WHERE vault_id=?) AS nonce FROM vaults WHERE vault_id=?',[id,id,id,id,id]).first();if(!row)throw new RepositoryError('vault_missing','Vault not found.',404);return {...row,published:!!row.published};}
  publicCalendar(hash){return this.statement('calendar:public','SELECT ics FROM calendar_feeds WHERE token_hash=?',[hash]).first();}
  async saveCalendar(vault,token,data,{create=false}={}){
    try{validatePublishedICS(data.ics);unbase64(data.token,{length:32});if(create){unbase64(data.nonce,{length:32});const expected=await calendarToken({vaultId:vault.vault_id,keyVersion:vault.key_version,authToken:token},data.nonce);if(expected!==data.token)throw new Error('Invalid calendar token binding.');}}catch(error){throw new RepositoryError('calendar_input',error.message,400);}
    const version=create?data.expectedVersion:data.version;if(!Number.isSafeInteger(version)||version<0)throw new RepositoryError('calendar_version','Invalid calendar version.',400);
    const hash=await digest(data.token),contentHash=await digest(data.ics),now=new Date().toISOString();
    if(create){const mutation=crypto.randomUUID(),result=await this.db.batch([
      this.statement('calendar:advance','UPDATE vaults SET calendar_version=calendar_version+1,calendar_mutation=? WHERE vault_id=? AND key_version=? AND calendar_version=?',[mutation,vault.vault_id,vault.key_version,version]),
      this.statement('calendar:publish','INSERT INTO calendar_feeds(vault_id,token_hash,nonce,version,ics,content_hash,updated_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM vaults WHERE vault_id=? AND key_version=? AND calendar_mutation=?) ON CONFLICT(vault_id) DO UPDATE SET token_hash=excluded.token_hash,nonce=excluded.nonce,version=excluded.version,ics=excluded.ics,content_hash=excluded.content_hash,updated_at=excluded.updated_at',[vault.vault_id,hash,data.nonce,version+1,data.ics,contentHash,now,vault.vault_id,vault.key_version,mutation])
    ]);if(result[0].meta.changes!==1)throw new RepositoryError('calendar_changed','Calendar publication changed. Refresh before publishing again.');}
    else{const result=await this.statement('calendar:update','UPDATE calendar_feeds SET ics=?,content_hash=?,updated_at=? WHERE vault_id=? AND token_hash=? AND version=? AND EXISTS(SELECT 1 FROM vaults WHERE vault_id=? AND key_version=? AND calendar_version=?)',[data.ics,contentHash,now,vault.vault_id,hash,version,vault.vault_id,vault.key_version,version]).run();if(!result.meta.changes)throw new RepositoryError('calendar_revoked','Calendar feed was revoked or replaced.');}
    return this.calendarStatus(vault.vault_id);
  }
  async revokeCalendar(vault,version){
    if(!Number.isSafeInteger(version)||version<0)throw new RepositoryError('calendar_version','Invalid calendar version.',400);const mutation=crypto.randomUUID(),result=await this.db.batch([
      this.statement('calendar:advance','UPDATE vaults SET calendar_version=calendar_version+1,calendar_mutation=? WHERE vault_id=? AND key_version=? AND calendar_version=?',[mutation,vault.vault_id,vault.key_version,version]),
      this.statement('calendar:revoke','DELETE FROM calendar_feeds WHERE vault_id=? AND EXISTS(SELECT 1 FROM vaults WHERE vault_id=? AND key_version=? AND calendar_mutation=?)',[vault.vault_id,vault.vault_id,vault.key_version,mutation])
    ]);if(result[0].meta.changes!==1)throw new RepositoryError('calendar_changed','Calendar publication changed. Refresh before revoking again.');return this.calendarStatus(vault.vault_id);
  }
  async remove(vault){const removed=await this.statement('vault:delete','DELETE FROM vaults WHERE vault_id=? AND key_version=?',[vault.vault_id,vault.key_version]).run();if(!removed.meta.changes)throw new RepositoryError('key_version_changed','Vault keys changed. Unlock again.');await this.deletePrefix(vault.vault_id+'/');}
}
