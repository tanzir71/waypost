import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {scoreBatch,matchResume} from '../core/match/index.js';
import {scoreMessage} from '../core/match/worker.js';
import {openWorkspace,uuidv7} from '../ui/store.js';
import {readResumeFile,saveOriginal} from '../ui/read-file.js';
import {validateWorkspace} from '../core/store/schema.js';
import {memoryIndexedDB,memoryLocalStorage} from './helpers/memory-indexeddb.mjs';
const root=new URL('../',import.meta.url);
const fixture=JSON.parse(await readFile(new URL('tests/fixtures/northwind.json',root),'utf8'));
test('Northwind Figma report is Strong, 9 of 11 required and 3 of 4 preferred',()=>{
  const report=matchResume(fixture.resume,fixture.job,{now:'2026-11-25'});
  assert.equal(report.tier,'strong');assert.equal(report.required.length,11);
  assert.equal(report.required.filter(row=>row.status==='met').length,9);
  assert.equal(report.preferred.filter(row=>row.status==='met').length,3);
  assert.equal(report.checks.years.found,6);
  assert.equal(report.required.find(row=>row.text==='PostgreSQL at scale').status,'met');
  for(const row of [...report.required,...report.preferred]) if(row.evidence) assert.ok(fixture.resume.text.includes(row.evidence.line));
});
test('all 50 jobs × 5 versions score in under 300 ms using prepared indexes',()=>{
  const resumes=Array.from({length:5},(_,i)=>({...fixture.resume,id:`resume-${i}`})),jobs=Array.from({length:50},(_,i)=>({...fixture.job,id:`job-${i}`}));
  const start=performance.now();const reports=scoreBatch(resumes,jobs,{now:'2026-11-25'});const elapsed=performance.now()-start;
  assert.equal(reports.length,250);assert.ok(elapsed<300,`50 × 5 took ${elapsed.toFixed(1)} ms`);
  assert.ok(reports[0].clusterGaps.some(gap=>gap.term==='kafka'&&gap.count===50));
});
test('the worker message contract calls the shared engine and rejects invalid batches',()=>{
  const input={resumes:[fixture.resume],jobs:[fixture.job],now:'2026-11-25'};
  assert.deepEqual(scoreMessage(input),scoreBatch(input.resumes,input.jobs,{now:input.now}));
  assert.throws(()=>scoreMessage({resumes:null,jobs:[]}),/arrays/);
});
test('shared batch preparation preserves independent evidence and per-job knockout answers',()=>{
  const jobs=[{...fixture.job,id:'first',title:'Backend Engineer'},{...fixture.job,id:'second',title:'Platform Engineer',text:fixture.job.text+'\nDo you require sponsorship?',knockoutAnswers:{'Do you require sponsorship?':false}}];
  const reports=scoreBatch([fixture.resume],jobs,{now:'2026-11-25'});
  for(let i=0;i<jobs.length;i++) {
    const standalone=matchResume(fixture.resume,jobs[i],{now:'2026-11-25'});
    assert.equal(reports[i].tier,standalone.tier);assert.deepEqual(reports[i].checks,standalone.checks);
    assert.deepEqual(reports[i].required.map(({clusterPrevalence,...row})=>row),standalone.required);
  }
  assert.notEqual(reports[0].required[0],reports[1].required[0]);
  reports[0].required[0].evidence.line='Changed by a consumer';
  assert.notEqual(reports[0].required[0].evidence.line,reports[1].required[0].evidence.line);
  assert.equal(reports[1].tier,'partial');
});
test('IndexedDB adapter seeds once, preserves linked UUIDv7 records and clears only samples',async()=>{
  const indexedDB=memoryIndexedDB(),localStorage=memoryLocalStorage();let persistCalls=0;
  const store=await openWorkspace({indexedDB,localStorage,storage:{persist:async()=>{persistCalls++;return true;}}});
  const seed=JSON.parse(await readFile(new URL('data/workspace-demo.json',root),'utf8'));
  await store.seed(seed);await store.seed(seed);
  assert.equal((await store.all('jobs')).length,12);assert.equal(persistCalls,0);
  const versions=await store.all('resumeVersions'),reports=await store.all('matchReports'),jobs=await store.all('jobs');
  for(const report of reports) {assert.ok(versions.some(version=>version.id===report.resumeVersionId));assert.ok(jobs.some(job=>job.id===report.jobId));}
  for(const row of [...versions,...reports,...jobs]) assert.match(row.id,/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const own=await store.save('jobs',{title:'My own job',text:'Required: Go',source:'paste'});
  assert.equal(persistCalls,1);
  await store.clearSamples();await store.seed(seed);
  assert.deepEqual((await store.all('jobs')).map(job=>job.id),[own.id]);
  assert.equal((await store.all('jobs',{deleted:true})).filter(job=>job.deleted).length,12);
  assert.equal((await store.all('changes')).some(change=>change.recordId===own.id),true);
  store.close();
  const reopened=await openWorkspace({indexedDB,localStorage,storage:{}});
  assert.equal((await reopened.all('jobs'))[0].id,own.id);assert.equal(reopened.deviceId,store.deviceId);reopened.close();
});
test('adapter migration commits once and retains the original localStorage backup',async()=>{
  const legacy=await readFile(new URL('tests/fixtures/legacy-localstorage.json',root),'utf8');
  const indexedDB=memoryIndexedDB(),localStorage=memoryLocalStorage({'ats-scoring:v1':legacy});
  const store=await openWorkspace({indexedDB,localStorage,storage:{}});
  assert.match(store.migrationMessage,/imported/);assert.equal(localStorage.getItem('ats-scoring:v1:migrated'),legacy);
  assert.equal(localStorage.getItem('ats-scoring:v1'),legacy);store.close();
  const reopened=await openWorkspace({indexedDB,localStorage,storage:{}});
  assert.equal(reopened.migrationMessage,'');assert.equal((await reopened.all('resumeVersions')).length,1);reopened.close();
});
test('PDF import stays local and passes actual text items to reading-order analysis',async()=>{
  let config,destroyed=false;const globals={};
  const mock={GlobalWorkerOptions:globals,getDocument(options){config=options;return {promise:Promise.resolve({numPages:1,getPage:async()=>({getViewport:()=>({width:600,height:800}),getTextContent:async()=>({styles:{f:{fontFamily:'Test'}},items:[{str:'Alex',width:50,transform:[1,0,0,12,20,700]},{str:'alex@example.test',width:100,transform:[1,0,0,12,20,680]}]}),cleanup(){}})}),destroy:async()=>{destroyed=true;}};}};
  const file={name:'resume.pdf',size:10,type:'application/pdf',arrayBuffer:async()=>new ArrayBuffer(10)};
  const parsed=await readResumeFile(file,{basePath:'/waypost/',pdfLoader:async()=>mock});
  assert.equal(parsed.text,'Alex\nalex@example.test');assert.equal(destroyed,true);
  for(const key of ['cMapUrl','standardFontDataUrl','wasmUrl','iccUrl']) assert.ok(config[key].startsWith('/waypost/vendor/pdfjs/'));
  assert.equal(globals.workerSrc,'/waypost/vendor/pdfjs/build/pdf.worker.min.mjs');assert.equal(config.isEvalSupported,false);
});
test('DOCX raw text and JSON Resume imports preserve content without inserting HTML',async()=>{
  const docx=await readResumeFile({name:'resume.docx',size:10,type:'',arrayBuffer:async()=>new ArrayBuffer(10)},{docxLoader:async()=>({extractRawText:async()=>({value:'Name\n<script>alert(1)</script>',messages:[]})})});
  assert.equal(docx.text,'Name\n<script>alert(1)</script>');
  const data={basics:{name:'Name',email:'name@example.test'},work:[{name:'Northwind',position:'Engineer',startDate:'2020',endDate:'2025',highlights:['Cut cost 22%']}],skills:[{name:'Go',keywords:['Go']}]};
  const parsed=await readResumeFile({name:'resume.json',size:100,text:async()=>JSON.stringify(data)});
  assert.deepEqual(parsed.jsonResume,data);assert.match(parsed.text,/EXPERIENCE\nNorthwind · Engineer · 2020–2025/);
  await assert.rejects(readResumeFile({name:'resume.exe',size:10}),/Choose a PDF/);
  assert.equal(await saveOriginal('id',{},{}),null);
});
test('pinned parsers, licenses and attributed O*NET skill subset are committed locally',async()=>{
  const versions=JSON.parse(await readFile(new URL('vendor/VERSIONS.json',root),'utf8'));
  assert.equal(versions.pdfjs.version,'6.5.438');assert.equal(versions.mammoth.version,'1.13.0');
  for(const path of ['vendor/pdfjs/build/pdf.min.mjs','vendor/pdfjs/build/pdf.worker.min.mjs','vendor/pdfjs/LICENSE','vendor/mammoth/mammoth.browser.min.js','vendor/mammoth/LICENSE']) assert.ok((await stat(new URL(path,root))).size>1000);
  const onet=JSON.parse(await readFile(new URL('data/skills/onet.json',root),'utf8'));assert.equal(onet.license,'CC-BY-4.0');assert.ok(onet.labels.includes('Microsoft SQL Server'));
});
