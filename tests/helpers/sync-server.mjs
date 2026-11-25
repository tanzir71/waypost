import {readFileSync} from 'node:fs';
// D1's async interface over an isolated in-memory database. Node 20 has no
// built-in SQLite, so the fallback models the same atomic storage contract.
let DatabaseSync;try{({DatabaseSync}=await import('node:sqlite'));}catch{}
export class MemoryR2 {
  objects=new Map(); async put(key,value){this.objects.set(key,String(value));}
  async get(key){const text=this.objects.get(key);return text===undefined?null:{json:async()=>JSON.parse(text),text:async()=>text};}
  async delete(keys){for(const key of [keys].flat())this.objects.delete(key);}
  async list({prefix='',limit=1000}={}){return {objects:[...this.objects.keys()].filter(key=>key.startsWith(prefix)).slice(0,limit).map(key=>({key}))};}
}
export class MemoryD1 {
  constructor({native=true}={}){this.native=native&&DatabaseSync?new DatabaseSync(':memory:'):null;this.state={vaults:new Map(),changes:new Map(),stages:new Map(),rotations:new Map(),rates:new Map(),feeds:new Map()};if(this.native)this.native.exec(readFileSync(new URL('../../server/worker/schema.sql',import.meta.url),'utf8'));}
  prepare(sql){const db=this;return {sql,args:[],bind(...args){this.args=args;return this;},async first(){return (await db.execute(this)).results[0]??null;},async all(){return db.execute(this);},async run(){return db.execute(this);}};}
  async batch(statements){const snapshot=structuredClone(this.state);this.native?.exec('BEGIN');try{const rows=[];for(const item of statements)rows.push(await this.execute(item));this.native?.exec('COMMIT');return rows;}catch(error){this.native?.exec('ROLLBACK');this.state=snapshot;throw error;}}
  async execute({sql,args:a}){
    if(this.native){const stmt=this.native.prepare(sql);if(stmt.columns().length)return {results:stmt.all(...a).map(row=>({...row})),meta:{changes:0}};return {results:[],meta:{changes:Number(stmt.run(...a).changes)}};}
    const tag=sql.match(/^\/\*([^*]+)\*\//)?.[1],s=this.state,v=s.vaults.get(a[0]);let rows=[],changed=0;
    const active=id=>[...s.changes.values()].filter(row=>row.vault_id===id),staged=id=>[...s.stages.values()].filter(row=>row.vault_id===id),key=row=>`${row.vault_id}:${row.type}:${row.id}`;
    const quota=vault=>{if(vault.size_bytes<0||vault.size_bytes>vault.max_bytes)throw new Error('CHECK constraint failed');};
    switch(tag){
      case 'schema:check':break;
      case 'rate:prune':for(const [key,row]of s.rates)if(row.window<a[0])s.rates.delete(key);break;
      case 'rate:tick':{const row=s.rates.get(a[0])??{window:a[1],count:0};row.count++;s.rates.set(a[0],row);rows=[{count:row.count}];break;}
      case 'vault:get':rows=v?[v]:[];break;
      case 'vault:create':if(v)throw new Error('UNIQUE');s.vaults.set(a[0],{vault_id:a[0],salt:a[1],auth_hash:a[2],wrapped_keys:a[3],key_version:a[4],max_bytes:a[5],created_at:a[6],cursor:0,size_bytes:0,calendar_version:0,calendar_mutation:null});changed=1;break;
      case 'changes:pointers':rows=active(a[0]).filter(row=>a.slice(1).includes(`${row.type}:${row.id}`)).map(row=>({r2_key:row.r2_key}));break;
      case 'stage:pointers':rows=staged(a[0]).filter(row=>row.rotation_id===a[1]&&a.slice(2).includes(`${row.type}:${row.id}`)).map(row=>({r2_key:row.r2_key}));break;
      case 'changes:list':rows=active(a[0]).filter(row=>row.seq>a[1]).sort((a,b)=>a.seq-b.seq).slice(0,50);break;
      case 'changes:upsert':case 'stage:upsert':{
        const stage=tag.startsWith('stage'),values=stage?[a[0],...a.slice(2)]:a,row=Object.fromEntries(['vault_id','type','id','updated_at','device_id','key_version','iv','ciphertext','r2_key','bytes'].map((field,i)=>[field,values[i]]));
        if(stage){if(s.rotations.get(a[0])?.rotation_id!==a[1])break;row.rotation_id=a[1];s.stages.set(`${key(row)}:${a[1]}`,row);if(staged(a[0]).reduce((sum,row)=>sum+row.bytes,0)>v.max_bytes)throw new Error('rotation_quota');changed=1;}
        else{if(row.key_version!==v.key_version)throw new Error('key_version_changed');const previous=s.changes.get(key(row));if(previous&&(row.updated_at<previous.updated_at||row.updated_at===previous.updated_at&&row.device_id<=previous.device_id))break;v.size_bytes+=row.bytes-(previous?.bytes??0);quota(v);row.seq=++v.cursor;s.changes.set(key(row),row);changed=1;}break;
      }
      case 'rotation:get':rows=s.rotations.has(a[0])?[s.rotations.get(a[0])]:[];break;
      case 'rotation:create':if(v.cursor===a[9]&&v.key_version===a[10]){if(s.rotations.has(a[0]))throw new Error('UNIQUE');s.rotations.set(a[0],Object.fromEntries(['vault_id','rotation_id','base_cursor','key_version','salt','auth_hash','wrapped_keys','created_at'].map((key,i)=>[key,a[i]])));changed=1;}break;
      case 'rotation:commit':{
        const vault=s.vaults.get(a[5]),old=active(a[5]),next=staged(a[5]).filter(row=>row.rotation_id===a[4]);
        if(vault.key_version===a[6]&&vault.cursor===a[7]&&next.length===a[10]&&next.length===old.length&&old.every(row=>next.some(other=>row.type===other.type&&row.id===other.id&&row.updated_at===other.updated_at&&row.device_id===other.device_id))){Object.assign(vault,{salt:a[0],auth_hash:a[1],wrapped_keys:a[2],key_version:a[3],applied_rotation:a[4],cursor:vault.cursor+1,calendar_version:vault.calendar_version+1,calendar_mutation:null});changed=1;}break;
      }
      case 'rotation:revoke-calendar':if(v.applied_rotation===a[2])s.feeds.delete(a[0]);break;
      case 'rotation:delete-old':if(v.applied_rotation===a[2]){for(const row of active(a[0]))s.changes.delete(key(row));v.size_bytes=0;changed=1;}break;
      case 'rotation:install':if(v.applied_rotation===a[3])for(const row of staged(a[0]).filter(row=>row.rotation_id===a[1])){v.size_bytes+=row.bytes;quota(v);s.changes.set(key(row),{...row,seq:++v.cursor});changed++;}break;
      case 'rotation:clear-stage':case 'rotation:abort-stage':if(tag.includes('abort')?v?.key_version===a[3]:v.applied_rotation===a[3])for(const [key,row]of s.stages)if(row.vault_id===a[0]&&row.rotation_id===a[1])s.stages.delete(key);break;
      case 'rotation:clear':case 'rotation:abort':if((tag.includes('abort')?v?.key_version===a[3]:v.applied_rotation===a[3])&&s.rotations.get(a[0])?.rotation_id===a[1])s.rotations.delete(a[0]);break;
      case 'calendar:status':{const feed=s.feeds.get(a[0]);rows=v?[{version:v.calendar_version,published:!!feed,updatedAt:feed?.updated_at??null,contentHash:feed?.content_hash??null,nonce:feed?.nonce??null}]:[];break;}
      case 'calendar:public':rows=[...s.feeds.values()].filter(row=>row.token_hash===a[0]).map(row=>({ics:row.ics}));break;
      case 'calendar:advance':{const vault=s.vaults.get(a[1]);if(vault?.key_version===a[2]&&vault.calendar_version===a[3]){vault.calendar_version++;vault.calendar_mutation=a[0];changed=1;}break;}
      case 'calendar:publish':if(v?.key_version===a[8]&&v.calendar_mutation===a[9]){s.feeds.set(a[0],Object.fromEntries(['vault_id','token_hash','nonce','version','ics','content_hash','updated_at'].map((key,i)=>[key,a[i]])));changed=1;}break;
      case 'calendar:update':{const vault=s.vaults.get(a[3]),feed=s.feeds.get(a[3]);if(feed&&feed.token_hash===a[4]&&feed.version===a[5]&&vault.key_version===a[7]&&vault.calendar_version===a[8]){Object.assign(feed,{ics:a[0],content_hash:a[1],updated_at:a[2]});changed=1;}break;}
      case 'calendar:revoke':if(v?.key_version===a[2]&&v.calendar_mutation===a[3]){s.feeds.delete(a[0]);changed=1;}break;
      case 'vault:delete':if(v?.key_version===a[1]){s.vaults.delete(a[0]);s.rotations.delete(a[0]);s.feeds.delete(a[0]);for(const [key,row]of s.changes)if(row.vault_id===a[0])s.changes.delete(key);for(const [key,row]of s.stages)if(row.vault_id===a[0])s.stages.delete(key);changed=1;}break;
      default:throw new Error(`Unhandled D1 fake operation: ${tag}`);
    }
    return {results:structuredClone(rows),meta:{changes:changed}};
  }
  close(){this.native?.close();}
}
