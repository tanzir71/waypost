import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {routes} from '../core/routes.js';
import {parseDeepLink,buildDeepLink} from '../core/links/deep.js';
import {encodeText} from '../core/links/index.js';
import {commandResults} from '../core/commands/index.js';
import {createAgentTools,registerAgentTools} from '../core/agents/index.js';
import {planWorkspaceImport} from '../core/store/import.js';
import {workspaceExport} from '../core/store/export.js';
import {openWorkspace} from '../ui/store.js';
import {memoryIndexedDB,memoryLocalStorage} from './helpers/memory-indexeddb.mjs';
const now='2026-11-25T12:00:00.000Z';
const examples={today:{action:'next'},match:{jdText:'Engineer\nRequired:\nJavaScript',resume:'v3'},parse:{text:'Ayesha\nSkills: JS'},resumes:{resume:'version'},tracker:{view:'table',add:true,title:'Engineer',company:'Northwind',url:'https://example.test/job'},gpa:{current:3.42,completed:64,target:3.6,remaining:64,scaleId:'bd-ugc',locked:[{courseId:'course',grade:'A+'}]},finals:{weights:[20,10,30,40],scores:[92,85,78],target:'A',scaleId:'bd-ugc'},scales:{scaleId:'bd-ugc',value:3.62,to:['percentage','in-10'],cohort:{below:90,total:100}},letters:{job:'job',resume:'resume',draft:'Hello'},offers:{offers:[{company:'A',base:100}],weights:{cash:100}},deadlines:{month:'2026-11',date:'2026-11-28',title:'Exam'},contacts:{q:'Ayesha'},agents:{tool:'gpa',input:{target:3.6}},settings:{section:'storage'},setup:{provider:'php',endpoint:'https://example.test/sync.php'},share:{title:'Engineer',url:'https://example.test/job',text:'Description'},import:{paste:true}};
test('deep links round-trip every tool at a nested base path, including UTF-8, arrays and private text',()=>{
  for(const route of routes){const state=examples[route.id],link=buildDeepLink(route.id,state,{basePath:'/waypost/',autorun:true}),url=new URL(link,'https://example.test');assert.equal(url.search,'');assert.ok(url.pathname.startsWith('/waypost/app/'));assert.deepEqual(parseDeepLink(route.id,url.hash),{state,autorun:true,provided:true});}
  assert.deepEqual(parseDeepLink('gpa','#current=3.42&credits=64&target=3.6&remaining=64&autorun=1').state,{current:3.42,completed:64,target:3.6,remaining:64});
  assert.equal(parseDeepLink('gpa','#plan='+encodeText(JSON.stringify({current:3.42,target:3.6}))).state.target,3.6);
  assert.equal(parseDeepLink('scales','#value=3.62').autorun,false);
  assert.throws(()=>parseDeepLink('gpa','#target=Infinity'));assert.throws(()=>parseDeepLink('match','#jd=%21'));
  assert.throws(()=>parseDeepLink('agents','#input='+encodeText('{"__proto__":{}}')));assert.throws(()=>buildDeepLink('match',{jdText:'x'.repeat(32769)}));
  assert.throws(()=>buildDeepLink('tracker',{url:'javascript:alert(1)'}));assert.throws(()=>buildDeepLink('gpa',{}, {basePath:'//elsewhere/'}));
});
test('palette intents and actions all map to private native routes, with record jumps',()=>{
  const options={basePath:'/waypost/',jobs:[{id:'j',title:'Engineer',company:'Northwind'}],applications:[{id:'a',jobId:'j',stage:'applied'}]};
  const planned=commandResults('plan gpa 3.6',options)[0];assert.equal(planned.id,'intent-gpa');assert.equal(parseDeepLink('gpa',new URL(planned.href,'https://example.test').hash).state.target,3.6);
  const all=commandResults('',options);assert.ok(all.some(row=>row.id==='action-score'));assert.ok(all.some(row=>row.id==='jump-a'));
  for(const row of all){const url=new URL(row.href,'https://example.test');assert.equal(url.origin,'https://example.test');assert.equal(url.search,'');}
});
test('six agent tools register with document first, legacy fallback, unavailable and partial-error status',async()=>{
  const store=await openWorkspace({indexedDB:memoryIndexedDB(),localStorage:memoryLocalStorage(),storage:{}}),tools=createAgentTools({store,now:()=>now}),names=[];
  const document={modelContext:{registerTool:async tool=>names.push(tool.name)}},navigator={modelContext:{registerTool:()=>{throw new Error('Wrong context');}}};
  const status=await registerAgentTools({document,navigator,tools});assert.equal(status.via,'document.modelContext');assert.equal(names.length,6);assert.equal(status.tools.every(row=>row.status==='registered'),true);
  assert.equal((await registerAgentTools({navigator:{modelContext:document.modelContext},tools})).via,'navigator.modelContext');
  assert.equal((await registerAgentTools({tools})).supported,false);
  const partial=await registerAgentTools({document:{modelContext:{registerTool:tool=>{if(tool.name==='final_needed')throw new Error('Unavailable');}}},tools});assert.equal(partial.tools.find(row=>row.name==='final_needed').status,'error');store.close();
});
test('agent computations use the shared fixtures and application writes wait for confirmation',async()=>{
  const store=await openWorkspace({indexedDB:memoryIndexedDB(),localStorage:memoryLocalStorage(),storage:{}});let approve,proposed=0;const output=[];
  const tools=Object.fromEntries(createAgentTools({store,now:()=>now,onResult:value=>output.push(value),confirmApplication:()=>{proposed++;return new Promise(resolve=>{approve=resolve;});}}).map(tool=>[tool.name,tool]));
  assert.equal((await tools.plan_target_gpa.execute({current:3.42,credits:64,target:3.6,remaining:64})).neededDisplay,3.78);
  assert.equal((await tools.final_needed.execute({categories:[{weight:20,score:92},{weight:10,score:85},{weight:30,score:78},{weight:40}],target:'A'})).neededDisplay,61.8);
  assert.equal((await tools.convert_grade_scale.execute({from:'bd-ugc',value:3.62,to:['percentage']}))[0].value,72.4);
  const fixture=JSON.parse(await readFile(new URL('fixtures/northwind.json',import.meta.url),'utf8'));assert.equal((await tools.score_resume_against_jobs.execute({resumeText:fixture.resume.text,jdText:fixture.job.text,title:fixture.job.title}))[0].tier,'strong');
  const pending=tools.add_application.execute({title:'Engineer',company:'Northwind',stage:'applied'});await new Promise(resolve=>setTimeout(resolve,5));assert.equal(proposed,1);assert.equal((await store.all('applications')).length,0);approve(false);assert.equal((await pending).saved,false);
  const confirmed=tools.add_application.execute({title:'Engineer',company:'Northwind',stage:'applied'});await new Promise(resolve=>setTimeout(resolve,5));approve(true);const saved=await confirmed;assert.equal(saved.application.stage,'applied');assert.equal((await store.all('applications')).length,1);
  assert.equal((await tools.export_workspace.execute()).format,'waypost-workspace');assert.ok(output.length>=6);await assert.rejects(tools.plan_target_gpa.execute({current:'3.42'}));await assert.rejects(tools.add_application.execute({title:'Bad',company:'URL',url:'javascript:alert(1)'}));store.close();
});
test('workspace import plans LWW records, strips connections and explains unavailable original uploads',async()=>{
  const store=await openWorkspace({indexedDB:memoryIndexedDB(),localStorage:memoryLocalStorage(),storage:{}}),version=store.record({label:'Resume',text:'Exact text',originalFile:{opfsPath:'/originals/file'}});
  const source=workspaceExport({resumeVersions:[version],settings:[{key:'preferences',value:{sync:{provider:'php',endpoint:'https://example.test'},ai:{provider:'byok'},study:{gpa:examples.gpa}}}]},{deviceId:store.deviceId,exportedAt:now});
  const plan=planWorkspaceImport(source);assert.equal(plan.summary.added,1);assert.equal(plan.records.resumeVersions[0].originalFile,null);assert.equal(plan.summary.originalsUnavailable,1);assert.equal(plan.preferences.sync.provider,'none');assert.equal(plan.preferences.ai.provider,null);
  assert.equal(planWorkspaceImport(source,{resumeVersions:[version]}).summary.skipped,1);assert.throws(()=>planWorkspaceImport({...source,format:'unknown'}));store.close();
});
