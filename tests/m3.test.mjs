import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseJobExport,encodeJobExport,decodeJobExport,handoffURL} from '../core/import/index.js';
import {encodeText,decodeText} from '../core/links/index.js';
import {applicationFields,moveApplication,updateApplication,responseRates,sortApplications} from '../core/tracker/index.js';
import {todaySummary} from '../core/today/index.js';
import {workspaceExport} from '../core/store/export.js';
import {matchResume} from '../core/match/index.js';
import {matchResume as bundledMatch} from '../extension/bundled/core/match/index.js';
import {normalizeCapturedJob,toWaypostExport} from '../core/import/clipper.js';
import {captureTab} from '../extension/src/capture.js';
import {memoryIndexedDB,memoryLocalStorage} from './helpers/memory-indexeddb.mjs';
import {openWorkspace} from '../ui/store.js';
import {sampleRemovalPlan} from '../core/store/samples.js';
const now='2026-11-25T12:00:00.000Z';
const job={id:'job',title:'Backend Engineer — বাংলা',company:'Northwind',text:'Requirements:\nGo services\nPreferred:\nPostgreSQL',url:'https://example.test/jobs/1'};
test('job exports validate legacy envelopes, single captures, bounds and safe links',()=>{
  assert.equal(parseJobExport({source:'ats-job-collector-extension',jobs:[job]}).jobs[0].title,job.title);
  assert.equal(parseJobExport({...job,source:'clipper'}).jobs.length,1);
  for(const value of [{jobs:[]},{jobs:[{...job,url:'javascript:alert(1)'}]},{jobs:[{...job,title:''}]},{jobs:[{...job,text:22}]},{source:'unknown',jobs:[job]},{jobs:[{...job,url:'https://user:password@example.test/'}]}])assert.throws(()=>parseJobExport(value));
});
test('private #job handoffs round-trip UTF-8 and contain no query or plaintext request data',()=>{
  const envelope=parseJobExport({jobs:[job]}),encoded=encodeJobExport(envelope);
  assert.deepEqual(decodeJobExport(encoded),envelope);
  const url=new URL(handoffURL('https://example.test/waypost/',envelope));
  assert.equal(url.pathname,'/waypost/app/import/');assert.equal(url.search,'');assert.ok(url.hash.startsWith('#job='));
  assert.equal(decodeText(encodeText('বাংলা résumé 👋')),'বাংলা résumé 👋');
  assert.throws(()=>encodeJobExport({jobs:[{...job,text:'x'.repeat(30000)}]}),/too large/);
  assert.throws(()=>decodeJobExport('bad!'),/Invalid/);
});
test('tracker transitions retain application dates, history and user details',()=>{
  const saved={id:'app',...applicationFields(job,'v3',now),notes:'Referral from a colleague'};
  const applied=moveApplication(saved,'applied',now),screen=moveApplication(applied,'screen','2026-11-26T12:00:00Z');
  assert.equal(applied.appliedAt,'2026-11-25');assert.equal(screen.appliedAt,applied.appliedAt);assert.equal(screen.notes,saved.notes);
  assert.equal(screen.history.length,3);assert.equal(saved.history.length,1);assert.equal(saved.stage,'saved');
  assert.equal(moveApplication(screen,'screen',now),screen);assert.throws(()=>moveApplication(saved,'hired',now));
  assert.throws(()=>updateApplication(saved,{next:{label:'Follow up',at:'invalid'}},now));
});
test('response rates count actual sent versions and replies retained in history',()=>{
  const versions=[{id:'v3',label:'v3'},{id:'v1',label:'v1'}];
  const sent=moveApplication({...applicationFields(job,'v3',now),id:'a'},'applied',now);
  const replied=moveApplication(moveApplication({...sent,id:'b'},'screen',now),'closed',now);
  assert.deepEqual(responseRates([sent,replied],versions),[{resumeVersionId:'v3',label:'v3',sent:2,replies:1,rate:.5},{resumeVersionId:'v1',label:'v1',sent:0,replies:0,rate:null}]);
  const input=[{id:'a',jobId:'a'},{id:'b',jobId:'b'}];assert.equal(sortApplications(input,[{id:'a',company:'Z'},{id:'b',company:'A'}],{key:'company',direction:'asc'})[0].id,'b');assert.equal(input[0].id,'a');
});
test('Today combines due actions, near deadlines, interviews and unique unanswered knockouts',()=>{
  const apps=[{id:'due',jobId:'job',stage:'applied',updatedAt:now,next:{label:'Follow up',at:'2026-11-24T12:00:00Z'}},{id:'interview',jobId:'job',stage:'interview',updatedAt:now,next:{label:'Prepare examples',at:'2026-11-26T12:00:00Z'}},{id:'old',jobId:'job',stage:'applied',updatedAt:'2026-08-01T00:00:00Z'}];
  const knockout={question:'Are you authorized to work here?',answered:null};
  const summary=todaySummary({jobs:[job],applications:apps,deadlines:[{id:'soon',date:'2026-11-28',title:'Essay',kind:'scholarship'},{id:'later',date:'2026-12-20',title:'Exam',kind:'exam'}],matchReports:[{jobId:'job',resumeVersionId:'v1',tier:'good',updatedAt:now,knockouts:[knockout]},{jobId:'job',resumeVersionId:'v3',tier:'strong',updatedAt:now,knockouts:[knockout]}]},{now});
  assert.deepEqual(summary.next.map(row=>row.type).sort(),['deadline','followup','interview','knockout']);
  assert.equal(summary.pipeline.find(row=>row.stage==='applied').count,1);assert.equal(summary.bestMatches[0].tier,'strong');assert.equal(summary.followups,1);
});
test('workspace exports omit credential settings while preserving all record collections',()=>{
  const workspace=workspaceExport({jobs:[],settings:[{key:'preferences',value:{theme:'dark',ai:{provider:'byok',byokVendor:'custom',apiKey:'DO-NOT-EXPORT'},sync:{provider:'none',authKey:'DO-NOT-EXPORT'}}},{key:'vault-keys',value:'DO-NOT-EXPORT'}]},{exportedAt:now,deviceId:'device'});
  assert.ok(!JSON.stringify(workspace).includes('DO-NOT-EXPORT'));assert.equal(workspace.records.settings.theme,'dark');assert.equal(workspace.records.matchReports.length,0);
});
test('clipper preserves paragraph structure and the generated matcher agrees with the app',async()=>{
  const capture=normalizeCapturedJob({title:'Engineer',company:'Northwind',description:'Required:\nGo services\n\nPreferred:\nPostgres',url:job.url},new Date(now));
  assert.ok(capture.description.includes('\n\n'));assert.equal(toWaypostExport([capture],new Date(now)).jobs[0].company,'Northwind');
  const fixture=JSON.parse(await readFile(new URL('./fixtures/northwind.json',import.meta.url),'utf8'));
  assert.deepEqual(bundledMatch(fixture.resume,fixture.job,{now}),matchResume(fixture.resume,fixture.job,{now}));
});
test('clipper reads only by explicit script injection and validates page protocols',async()=>{
  const calls=[];const api={scripting:{executeScript:async config=>calls.push(config)},tabs:{sendMessage:async()=>({title:'Engineer',description:'Required:\nGo',company:'Northwind'})}};
  const captured=await captureTab(api,{id:42,url:job.url});assert.equal(captured.description,'Required:\nGo');assert.deepEqual(calls[0],{target:{tabId:42},files:['content.js']});
  await assert.rejects(captureTab(api,{id:42,url:'chrome://settings'}),/HTTP/);
});
test('MV3 permissions are exact, always-on scripts absent and chips opt in per site',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../extension/manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.name,'Waypost Clipper');assert.equal(manifest.manifest_version,3);
  assert.deepEqual([...manifest.permissions].sort(),['activeTab','storage','downloads','scripting'].sort());assert.equal(manifest.content_scripts,undefined);assert.equal(manifest.host_permissions,undefined);
  const defaults=JSON.parse(await readFile(new URL('../extension/defaults.json',import.meta.url),'utf8'));assert.deepEqual(defaults.chipOrigins,[]);
  const background=await readFile(new URL('../extension/background.js',import.meta.url),'utf8');assert.match(background,/chipOrigins/);assert.match(background,/permissions\.contains/);
});
test('M2 demos receive M3 examples once and cleared samples never reappear',async()=>{
  const seed=JSON.parse(await readFile(new URL('../data/workspace-demo.json',import.meta.url),'utf8'));
  const indexedDB=memoryIndexedDB(),localStorage=memoryLocalStorage();
  const store=await openWorkspace({indexedDB,localStorage,storage:{}});
  // Simulate a previously seeded M2 workspace, before supplements existed.
  const mapping=new Map();for(const row of [...seed.jobs,...seed.resumeVersions])mapping.set(row.id,store.record(row));
  await store.putMany({jobs:seed.jobs.map(row=>({...mapping.get(row.id),sample:true})),resumeVersions:seed.resumeVersions.map(row=>({...mapping.get(row.id),sample:true}))},{meaningful:false});
  await store.setSetting('demo-seeded',true);await store.seed(seed);await store.seed(seed);assert.equal((await store.all('applications')).length,12);
  const jobs=await store.all('jobs');for(const app of await store.all('applications'))assert.ok(jobs.some(row=>row.id===app.jobId));
  await store.clearSamples();await store.seed(seed);assert.equal((await store.all('applications')).length,0);store.close();
});
test('clearing samples protects dependencies of personal records and can clear untouched demo stages',()=>{
  const sampleJob={id:'sample-job',sample:true},sampleResume={id:'sample-resume',sample:true};
  const plan=sampleRemovalPlan({jobs:[sampleJob,{id:'unused',sample:true}],resumeVersions:[sampleResume],applications:[{id:'own',jobId:'sample-job',resumeVersionId:'sample-resume',sample:false},{id:'demo',jobId:'unused',sample:true}]});
  assert.deepEqual(plan.jobs.map(row=>row.id),['unused']);assert.deepEqual(plan.resumeVersions,[]);assert.deepEqual(plan.applications.map(row=>row.id),['demo']);
});
test('the chip service worker injects only after both per-origin opt-in and permission',async()=>{
  let listener,enabled=false,granted=false,injections=0;const messages=[];
  const previous=globalThis.chrome;
  globalThis.chrome={tabs:{onUpdated:{addListener:fn=>{listener=fn;}},sendMessage:async(id,message)=>{messages.push(message.type);return message.type==='WAYPOST_CAPTURE_JOB'?{title:'Engineer',description:'Required:\nGo services',company:'Northwind'}:{shown:true};}},storage:{local:{get:async()=>({options:{appUrl:'https://example.test/waypost/',chipOrigins:enabled?['https://jobs.example.test']:[],resumeText:''}})}},permissions:{contains:async()=>granted},scripting:{executeScript:async()=>{injections++;}}};
  try {
    await import('../extension/background.js?contract-test');
    const tab={id:12,url:'https://jobs.example.test/job'};
    await listener(12,{status:'complete'},tab);assert.equal(injections,0);
    enabled=true;await listener(12,{status:'complete'},tab);assert.equal(injections,0);
    granted=true;await listener(12,{status:'complete'},tab);assert.equal(injections,1);assert.deepEqual(messages,['WAYPOST_CAPTURE_JOB','WAYPOST_SHOW_CHIP']);
    await listener(12,{status:'complete'},{id:12,url:'https://different.example.test/job'});assert.equal(injections,1);
  }finally{globalThis.chrome=previous;}
});
