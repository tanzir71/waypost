import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {memoryIndexedDB,memoryLocalStorage} from './helpers/memory-indexeddb.mjs';
import {fakeDOM,walk} from './helpers/dom.mjs';
import {openWorkspace} from '../ui/store.js';
import {renderGpa} from '../ui/views/gpa.js';
import {renderFinals} from '../ui/views/finals.js';
import {renderScales} from '../ui/views/scales.js';
import {workspaceExport} from '../core/store/export.js';
const seed=JSON.parse(await readFile(new URL('../data/workspace-demo.json',import.meta.url),'utf8'));
const open=()=>openWorkspace({indexedDB:memoryIndexedDB(),localStorage:memoryLocalStorage(),storage:{persist:async()=>true}});
function accessible(dom){for(const node of walk(dom.body)){
  if(['A','BUTTON','SUMMARY'].includes(node.tagName)){assert.ok(node.textContent||node.attributes['aria-label'],`Unnamed ${node.tagName}`);assert.ok(node.attributes['data-testid'],`No hook for ${node.textContent}`);}
  if(['INPUT','SELECT','TEXTAREA'].includes(node.tagName))assert.ok(node.attributes['aria-label']||walk(dom.body).some(row=>row.tagName==='LABEL'&&row.attributes.for===node.attributes.id),`Unlabelled ${node.attributes.id}`);
}}
test('study views compute shared fixtures, persist results and categories, and expose named controls',async()=>{
  const store=await open();await store.seed(seed);
  let dom=fakeDOM();
  try{
    await renderGpa({store,basePath:'/waypost/',...dom});assert.equal(dom.readResult().plan.neededDisplay,3.78);assert.equal(dom.readResult().mix.average.toFixed(2),'3.81');assert.equal(dom.find('course-row').length,5);accessible(dom);
    await dom.find('gpa-solve')[0].fire('click');assert.equal((await store.setting('gpa-result')).value.neededDisplay,3.78);assert.ok(dom.readResult().mix.average>=3.78);
  }finally{dom.restore();}
  const course=(await store.all('courses')).find(row=>row.categories);dom=fakeDOM(`/waypost/app/finals/#course=${course.id}&autorun=1`);
  try{
    await renderFinals({store,basePath:'/waypost/',...dom});const needed=dom.readResult().neededDisplay;assert.equal(needed,74.3); // Solver upgraded the linked Algorithms target to A+.
    assert.equal(dom.find('final-ladder-row').length,10);accessible(dom);
    dom.find('final-category-name')[0].value='Assignments';await dom.find('final-category-name')[0].fire('input');await dom.find('final-calculate')[0].fire('click');assert.equal((await store.get('courses',course.id)).categories[0].name,'Assignments');
  }finally{dom.restore();}
  dom=fakeDOM('/waypost/app/scales/');
  try{
    await renderScales({store,...dom});assert.equal(dom.readResult().results[1].value,72.4);assert.equal(dom.find('conversion-row').length,6);accessible(dom);
    await dom.find('scale-convert')[0].fire('click');const preferences=(await store.setting('preferences')).value;assert.equal(preferences.study.conversion.value,3.62);
  }finally{dom.restore();store.close();}
});
test('M3 demos receive study records once and exports retain plans and user tables without arbitrary settings',async()=>{
  const store=await open();await store.setSetting('demo-seeded',true);await store.setSetting('demo-supplements-m3',true);await store.putMany({jobs:[store.record({...seed.jobs[0],sample:true})]},{meaningful:false});
  await store.seed(seed);await store.seed(seed);assert.equal((await store.all('courses')).length,5);const terms=await store.all('terms');for(const course of await store.all('courses'))assert.ok(terms.some(row=>row.id===course.termId));
  const preferences=(await store.setting('preferences')).value;await store.setSetting('preferences',{...preferences,study:{gpa:{current:3.42,completed:64,target:3.6,remaining:64,scaleId:'bd-ugc',secret:'HIDDEN'},institutionTables:[{id:'table',name:'My institution',system:'GPA',source:'Policy',rows:[{min:0,max:4,value:3.5}],secret:'HIDDEN'}],secret:'HIDDEN'}});
  const exported=workspaceExport({settings:await store.all('settings'),courses:await store.all('courses'),terms},{deviceId:store.deviceId,exportedAt:new Date().toISOString()});assert.equal(exported.records.settings.study.gpa.current,3.42);assert.equal(exported.records.settings.study.institutionTables[0].rows[0].value,3.5);assert.ok(!JSON.stringify(exported).includes('HIDDEN'));
  await store.clearSamples();await store.seed(seed);assert.equal((await store.all('courses')).length,0);store.close();
});
test('a fresh workspace saves a GPA target without courses and custom institution mappings compute after explicit save',async()=>{
  const store=await open();let dom=fakeDOM();
  try{
    await renderGpa({store,basePath:'/waypost/',...dom});assert.equal(dom.find('course-row').length,0);await dom.find('gpa-solve')[0].fire('click');assert.equal((await store.setting('gpa-result')).value.neededDisplay,3.78);
    await dom.find('gpa-add-term')[0].fire('click');dom.find('term-label')[0].value='Completed term';dom.find('term-planned')[0].checked=false;dom.find('term-reported')[0].value='3.4';const form=walk(dom.body).find(row=>row.tagName==='DIALOG').querySelector('form');await form.fire('submit');assert.equal((await store.all('terms'))[0].reportedGpa,3.4);
  }finally{dom.restore();}
  dom=fakeDOM('/waypost/app/scales/');
  try{
    await renderScales({store,...dom});await dom.find('scale-edit-tables')[0].fire('click');dom.find('institution-name')[0].value='Example University';dom.find('institution-system')[0].value='Admissions band';dom.find('institution-value')[0].value='Upper band';const form=walk(dom.body).find(row=>row.tagName==='DIALOG').querySelector('form');await form.fire('submit');assert.equal(dom.readResult().results.at(-1).value,'Upper band');assert.equal((await store.setting('preferences')).value.study.institutionTables.length,1);accessible(dom);
  }finally{dom.restore();store.close();}
});
