import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fakeDOM,walk} from './helpers/dom.mjs';
import {memoryIndexedDB,memoryLocalStorage} from './helpers/memory-indexeddb.mjs';
import {openWorkspace} from '../ui/store.js';
import {renderGpa} from '../ui/views/gpa.js';
import {renderFinals} from '../ui/views/finals.js';
import {renderScales} from '../ui/views/scales.js';
import {renderMatch} from '../ui/views/match.js';
import {renderShare} from '../ui/views/share.js';
import {renderAgents} from '../ui/views/agents.js';
import {renderSettings} from '../ui/views/settings.js';
import {reviewWorkspaceImport} from '../ui/workspace-import.js';
import {initializePwa} from '../ui/pwa.js';
import {installPalette} from '../ui/palette.js';
import {buildDeepLink} from '../core/links/deep.js';
import {scoreBatch} from '../core/match/index.js';
import {workspaceExport} from '../core/store/export.js';
import {el} from '../ui/dom.js';
const open=()=>openWorkspace({indexedDB:memoryIndexedDB(),localStorage:memoryLocalStorage(),storage:{}}),basePath='/waypost/';
const scorerFactory=()=>({score:async(resumes,jobs)=>scoreBatch(resumes,jobs,{now:'2026-11-25'}),close(){}});
function accessible(dom){for(const node of walk(dom.body)){
  if(['A','BUTTON','SUMMARY'].includes(node.tagName)){assert.ok(node.textContent||node.attributes['aria-label'],`Unnamed ${node.tagName}`);assert.ok(node.attributes['data-testid'],`No hook for ${node.textContent}`);}
  if(['INPUT','SELECT','TEXTAREA'].includes(node.tagName))assert.ok(node.attributes['aria-label']||walk(dom.body).some(row=>row.tagName==='LABEL'&&row.attributes.for===node.attributes.id),`Unlabelled ${node.attributes.id}`);
}}
test('real study views honor documented flat fragments, prefill-only and read-only autorun',async()=>{
  const store=await open();let dom=fakeDOM('/waypost/app/gpa/#current=3.42&credits=64&target=3.6&remaining=64');
  try{await renderGpa({store,basePath,...dom});assert.equal(dom.readResult(),null);assert.equal(dom.find('gpa-input-current')[0].value,'3.42');}finally{dom.restore();}
  dom=fakeDOM('/waypost/app/gpa/#current=3.42&credits=64&target=3.6&remaining=64&autorun=1');
  try{await renderGpa({store,basePath,...dom});assert.equal(dom.readResult().plan.neededDisplay,3.78);assert.equal(await store.setting('gpa-result'),undefined);}finally{dom.restore();}
  dom=fakeDOM('/waypost/app/finals/#w=20,10,30,40&s=92,85,78&target=75&scale=bd-ugc&autorun=1');
  try{await renderFinals({store,basePath,...dom});assert.equal(dom.readResult().neededDisplay,61.8);assert.equal((await store.setting('preferences')).value.study,undefined);accessible(dom);}finally{dom.restore();}
  dom=fakeDOM('/waypost/app/scales/#from=bd-ugc&value=3.62&to=percentage,in-10&autorun=1');
  try{await renderScales({store,basePath,...dom});assert.deepEqual(dom.readResult().results.map(row=>row.value),[72.4,9.05]);}finally{dom.restore();store.close();}
});
test('a private match link computes without saving raw input or derived reports',async()=>{
  const store=await open(),fixture=JSON.parse(await readFile(new URL('fixtures/northwind.json',import.meta.url),'utf8')),path=buildDeepLink('match',{jdText:fixture.job.text,resumeText:fixture.resume.text},{basePath,autorun:true}),dom=fakeDOM(path);
  try{await renderMatch({store,basePath,...dom,scorerFactory});assert.equal(dom.readResult().tier,'strong');assert.equal((await store.all('jobs')).length,0);assert.equal((await store.all('resumeVersions')).length,0);assert.equal((await store.all('matchReports')).length,0);accessible(dom);}finally{dom.restore();store.close();}
});
test('shared jobs and workspace restores require explicit in-page save controls',async()=>{
  const store=await open();let dom=fakeDOM('/waypost/app/share/?title=Shared%20Engineer&url=https%3A%2F%2Fexample.test%2Fjob');
  try{await renderShare({store,basePath,...dom,scorerFactory});assert.equal((await store.all('applications')).length,0);assert.equal(location.search,'');assert.equal(dom.find('share-title')[0].value,'Shared Engineer');accessible(dom);await dom.find('share-save-tracker')[0].fire('click');assert.equal((await store.all('applications')).length,1);assert.equal((await store.all('jobs'))[0].source,'share-target');}finally{dom.restore();}
  const contact=store.record({name:'New contact'}),workspace=workspaceExport({contacts:[contact]},{deviceId:store.deviceId,exportedAt:new Date().toISOString()});dom=fakeDOM('/waypost/app/settings/');
  try{await reviewWorkspaceImport(store,workspace);assert.equal((await store.all('contacts')).length,0);await dom.find('workspace-import-confirm')[0].fire('click');assert.equal((await store.all('contacts')).length,1);assert.equal((await store.setting('preferences')).value.ai.provider,null);}finally{dom.restore();store.close();}
});
test('Settings and Agents expose native named controls and a working private-link builder',async()=>{
  const store=await open();let dom=fakeDOM('/waypost/app/settings/');
  try{await renderSettings({store,basePath,...dom,agentStatus:{supported:false,tools:[]}});accessible(dom);assert.equal(dom.find('ai-provider')[0].value,'off');assert.equal(dom.find('sync-provider').length,1);}finally{dom.restore();}
  dom=fakeDOM('/waypost/app/settings/');window.WAYPOST_CONFIG.mode='demo';
  try{await renderSettings({store,basePath,...dom,agentStatus:{supported:false,tools:[]}});assert.equal(dom.find('sync-provider').length,0);}finally{dom.restore();}
  dom=fakeDOM('/waypost/app/agents/');
  try{await renderAgents({store,basePath,...dom,agentStatus:{supported:false,tools:[]}});assert.equal(dom.find('agent-tool-row').length,6);assert.ok(dom.readResult().url.includes('#current=3.42'));assert.equal(new URL(dom.readResult().url).search,'');accessible(dom);}finally{dom.restore();store.close();}
});
test('palette opens a native dialog, filters an intent and opens its URL by keyboard',async()=>{
  const store=await open(),dom=fakeDOM('/waypost/app/');
  try{const palette=installPalette({store,basePath});await palette.open();const input=dom.find('command-query')[0];input.value='plan gpa 3.6';await input.fire('input');assert.ok(dom.find('command-option')[0].textContent.includes('GPA target planner'));await input.fire('keydown',{key:'Enter'});assert.equal(new URL(location.href).pathname,'/waypost/app/gpa/');assert.ok(location.hash.includes('target=3.6'));accessible(dom);}finally{dom.restore();store.close();}
});
test('PWA installation waits for a second visit and focused launches deliver files to review',async()=>{
  let dom=fakeDOM('/waypost/app/'),local=memoryLocalStorage(),session=memoryLocalStorage(),consumer,received;
  try{document.body.append(el('div',{id:'pwa-notices'}));window.launchQueue={setConsumer:fn=>{consumer=fn;}};initializePwa({basePath,mode:'pwa',localStorage:local,sessionStorage:session,onFiles:files=>{received=files;}});await dom.events.fire('beforeinstallprompt',{prompt:async()=>{},userChoice:Promise.resolve({outcome:'dismissed'})});assert.equal(dom.find('install-card')[0].hidden,true);await consumer({files:[{getFile:async()=>({name:'resume.pdf'})}]});assert.equal(received[0].name,'resume.pdf');}finally{dom.restore();}
  dom=fakeDOM('/waypost/app/');session=memoryLocalStorage();
  try{document.body.append(el('div',{id:'pwa-notices'}));initializePwa({basePath,mode:'pwa',localStorage:local,sessionStorage:session});await dom.events.fire('beforeinstallprompt',{prompt:async()=>{},userChoice:Promise.resolve({outcome:'dismissed'})});assert.equal(dom.find('install-card')[0].hidden,false);await dom.find('install-dismiss')[0].fire('click');assert.equal(dom.find('install-card')[0].hidden,true);}finally{dom.restore();}
});
