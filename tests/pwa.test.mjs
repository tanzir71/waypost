import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {requestPolicy,installEligibility} from '../core/pwa/policy.js';
import {precacheFiles} from '../scripts/precache.mjs';
const root=new URL('../',import.meta.url),scope='https://example.test/waypost/';
test('manifest has rooted-relative launches, sharing, file handlers and real safe-area logo icons',async()=>{
  const manifest=JSON.parse(await readFile(new URL('manifest.webmanifest',root),'utf8'));
  assert.equal(manifest.name,'Waypost');assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./app/');assert.equal(manifest.display,'standalone');assert.equal(manifest.launch_handler.client_mode,'focus-existing');
  assert.equal(manifest.share_target.method,'GET');assert.equal(manifest.share_target.action,'./app/share/');assert.deepEqual(manifest.share_target.params,{title:'title',text:'text',url:'url'});
  for(const ext of ['.pdf','.docx','.json'])assert.ok(Object.values(manifest.file_handlers[0].accept).flat().includes(ext));
  assert.deepEqual(manifest.shortcuts.map(row=>row.url),['./app/match/','./app/gpa/','./app/tracker/']);
  for(const icon of manifest.icons){const data=await readFile(new URL(icon.src,root));assert.equal(data.toString('hex',0,8),'89504e470d0a1a0a');const size=Number(icon.sizes.split('x')[0]);assert.equal(data.readUInt32BE(16),size);assert.equal(data.readUInt32BE(20),size);}
  assert.ok(manifest.icons.some(row=>row.purpose==='maskable'));
});
test('offline inventory covers every runtime route and asset, including module and JSON dependencies',async()=>{
  const paths=await precacheFiles();
  for(const path of ['app/index.html','app/gpa/index.html','app/share/index.html','app/import/index.html','agents/index.html','config.js','manifest.webmanifest','ui/app.js','core/match/index.js','data/scales/bd-ugc.json','schemas/workspace.json'])assert.ok(paths.includes(path),path);
  for(const path of paths){assert.ok((await stat(new URL(path,root))).isFile());assert.ok(!path.startsWith('server/')&&!path.startsWith('extension/')&&!path.startsWith('vendor/'));}
  for(const path of paths.filter(path=>path.endsWith('.html')))assert.equal(requestPolicy({url:new URL(path.replace(/index\.html$/,''),scope).href,method:'GET',headers:new Headers(),mode:'navigate'},scope,paths).strategy,'precache',path);
});
test('request policy caches clean share routes and excludes external, credential, sync and AI traffic',()=>{
  const req=(path,extra={})=>({url:new URL(path,scope).href,method:'GET',headers:new Headers(),mode:'cors',...extra});
  const cached=['app/share/index.html','app/gpa/index.html'];assert.equal(requestPolicy(req('app/share/?title=PRIVATE&text=SECRET'),scope,cached).key,scope+'app/share/index.html');
  for(const request of [req('https://elsewhere.test/asset.js'),req('server/php/sync.php'),req('api/sync/changes'),req('api/ai'),req('app/gpa/?text=SECRET'),req('ui/app.js',{headers:new Headers({authorization:'Bearer private'})}),req('app/gpa/',{method:'POST'})])assert.equal(requestPolicy(request,scope,cached).cache,false,request.url);
  assert.equal(requestPolicy(req('vendor/pdfjs/pdf.mjs'),scope,cached).strategy,'runtime');assert.equal(requestPolicy(req('app/gpa/'),scope,cached).key,scope+'app/gpa/index.html');
  assert.equal(installEligibility({visits:1,promptAvailable:true}),false);assert.equal(installEligibility({visits:2,promptAvailable:true}),true);assert.equal(installEligibility({visits:2,ios:true}),true);assert.equal(installEligibility({visits:2,ios:true,dismissed:true}),false);
});
test('the worker installs a complete cache, serves navigation offline and activates updates only on request',async()=>{
  const handlers=new Map(),tables=new Map(),paths=['app/index.html','app/gpa/index.html','app/share/index.html'],version='waypost-test';let activated=0,claimed=0;
  const key=value=>typeof value==='string'?value:value.url??String(value),caches={keys:async()=>[...tables.keys()],delete:async name=>tables.delete(name),open:async name=>{if(!tables.has(name))tables.set(name,new Map());const rows=tables.get(name);return {addAll:async requests=>{for(const request of requests)rows.set(key(request),new Response('cached:'+key(request)));},match:async value=>rows.get(key(value)),put:async(value,response)=>rows.set(key(value),response)};}};
  const self={registration:{scope},addEventListener:(name,fn)=>handlers.set(name,fn),clients:{claim:async()=>{claimed++;}},skipWaiting:()=>{activated++;}};
  const source=(await readFile(new URL('sw.js',root),'utf8')).replace(/^import .*;\r?\n/gm,'');runInNewContext(source,{VERSION:version,PRECACHE:paths,requestPolicy,self,caches,URL,Request,fetch:async()=>{throw new Error('offline');}});
  let pending;handlers.get('install')({waitUntil:value=>{pending=value;}});await pending;assert.equal(activated,0);
  handlers.get('activate')({waitUntil:value=>{pending=value;}});await pending;assert.equal(claimed,1);
  let response;handlers.get('fetch')({request:{url:scope+'app/gpa/',method:'GET',headers:new Headers(),mode:'navigate'},respondWith:value=>{response=value;}});assert.match(await (await response).text(),/gpa\/index\.html/);
  handlers.get('fetch')({request:{url:scope+'app/share/?text=PRIVATE',method:'GET',headers:new Headers(),mode:'navigate'},respondWith:value=>{response=value;}});assert.match(await (await response).text(),/share\/index\.html/);assert.ok([...tables.get(version).keys()].every(value=>!value.includes('PRIVATE')));
  handlers.get('message')({data:{type:'WAYPOST_ACTIVATE_UPDATE'}});assert.equal(activated,1);
});
