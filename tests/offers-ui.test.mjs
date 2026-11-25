import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fakeDOM,walk} from './helpers/dom.mjs';
import {openWorkspace} from '../ui/store.js';
import {memoryIndexedDB,memoryLocalStorage} from './helpers/memory-indexeddb.mjs';
import {renderOffers} from '../ui/views/offers.js';
import {workspaceExport} from '../core/store/export.js';
import {planWorkspaceImport} from '../core/store/import.js';
import {buildDeepLink} from '../core/links/deep.js';
const fixture=JSON.parse(await readFile(new URL('./fixtures/offers.json',import.meta.url),'utf8')),seed=JSON.parse(await readFile(new URL('../data/workspace-demo.json',import.meta.url),'utf8'));
const newStore=()=>openWorkspace({indexedDB:memoryIndexedDB(),localStorage:memoryLocalStorage(),storage:{}});

test('offer view computes the Figma comparison, leaves invalid weights unscored and saves priorities without credentials',async()=>{
  const dom=fakeDOM('/waypost/app/offers/'),store=await newStore();try{await store.seed(seed);await renderOffers({store,basePath:'/waypost/',view:dom.view,actions:dom.actions});assert.equal(dom.readResult().rows[0].total,110600);assert.equal(dom.readResult().rows[0].year1Cash,98600);assert.equal(dom.find('offer-row-adjusted').length,1);assert.equal(dom.find('offer-adjusted-bar').length,3);
    dom.find('offer-weight-team')[0].value=11;await dom.find('offer-weight-team')[0].fire('input');assert.ok(dom.readResult().weightsError);assert.equal(dom.readResult().rows[0].weightedScore,null);assert.equal(dom.readResult().rows[0].total,110600);
    dom.find('offer-weight-team')[0].value=10;await dom.find('offer-weight-team')[0].fire('input');await dom.find('offer-save-weights')[0].fire('click');const records={settings:await store.all('settings'),offers:await store.all('offers')},backup=workspaceExport(records,{deviceId:store.deviceId,exportedAt:new Date().toISOString()}),imported=planWorkspaceImport(backup);assert.equal(imported.preferences.offers.weights.compensation,40);assert.equal(backup.records.offers.length,3);
    for(const control of walk(dom.body).filter(row=>['BUTTON','INPUT','SELECT','TEXTAREA','SUMMARY','A'].includes(row.tagName))){assert.ok(control.getAttribute('data-testid'),control.tagName);if(['INPUT','SELECT','TEXTAREA'].includes(control.tagName))assert.ok(control.getAttribute('aria-label')||walk(dom.body).some(row=>row.tagName==='LABEL'&&row.getAttribute('for')===control.getAttribute('id')));}
  }finally{store.close();dom.restore();}
});

test('adding, editing, applying a CSV city and deleting offers writes actual validated records',async()=>{
  const dom=fakeDOM('/waypost/app/offers/'),store=await newStore();try{await renderOffers({store,basePath:'/waypost/',view:dom.view,actions:dom.actions});assert.equal(dom.readResult().rows.length,0);await dom.find('offer-add')[0].fire('click');dom.find('offer-company')[0].value='New company';dom.find('offer-base')[0].value=100000;dom.find('offer-equityPerYear')[0].value=20000;dom.find('offer-cliffMonths')[0].value=6;let form=walk(dom.body).find(row=>row.tagName==='FORM');await form.fire('submit');const offer=(await store.all('offers'))[0];assert.equal(offer.base,100000);assert.equal(dom.readResult().rows[0].year1Cash,null);
    await dom.find('offer-import-index')[0].fire('click');const input=dom.find('offer-cost-csv')[0];input.files=[{size:40,text:async()=> 'city,index\r\nManchester,82\r\n'}];await input.fire('change');await walk(dom.body).find(row=>row.tagName==='DIALOG').close();await dom.find('offer-edit')[0].fire('click');dom.find('offer-index-city')[0].value='Manchester';await dom.find('offer-index-city')[0].fire('change');assert.equal(Number(dom.find('offer-colIndex')[0].value),82);dom.find('offer-vestedEquityYear1')[0].value=4000;form=walk(dom.body).find(row=>row.tagName==='FORM');await form.fire('submit');assert.equal(dom.readResult().rows[0].year1Cash,104000);assert.equal((await store.get('offers',offer.id)).costCity,'Manchester');
    await dom.find('offer-delete')[0].fire('click');assert.equal((await store.all('offers')).length,1);await dom.find('offer-delete-confirm')[0].fire('click');assert.equal((await store.all('offers')).length,0);assert.equal((await store.all('offers',{deleted:true}))[0].deleted,true);
  }finally{store.close();dom.restore();}
});

test('shared offers prefill without computing/saving until requested; existing demos get samples once and never after clear',async()=>{
  const path=buildDeepLink('offers',{offers:fixture.offers},{basePath:'/waypost/'}),dom=fakeDOM(path),store=await newStore();try{await renderOffers({store,basePath:'/waypost/',view:dom.view,actions:dom.actions});assert.equal(dom.readResult(),null);assert.equal((await store.all('offers')).length,0);await dom.find('offer-compare')[0].fire('click');assert.equal(dom.readResult().rows[0].total,110600);assert.equal((await store.all('offers')).length,0);
    await store.putMany({jobs:[store.record({...seed.jobs[0],id:undefined,sample:true})],settings:['demo-seeded','demo-supplements-m3','demo-supplements-m4'].map(key=>store.record({key,value:true}))},{meaningful:false});await store.seed(seed);assert.equal((await store.all('offers')).length,3);await store.seed(seed);assert.equal((await store.all('offers')).length,3);await store.clearSamples();await store.seed(seed);assert.equal((await store.all('offers')).length,0);
  }finally{store.close();dom.restore();}
});
test('shared offers get distinct temporary controls and save copies even when a source ID matches a local record',async()=>{
 const store=await newStore(),local=await store.save('offers',{company:'Kept local',base:123,currency:'GBP'}),path=buildDeepLink('offers',{offers:[{...local,company:'Shared update',base:456},{company:'Shared without ID',base:789,currency:'GBP'}]},{basePath:'/waypost/'}),dom=fakeDOM(path);
 try{await renderOffers({store,basePath:'/waypost/',view:dom.view,actions:dom.actions});const checks=dom.find('offer-select');assert.equal(checks.length,2);assert.notEqual(checks[0].getAttribute('id'),checks[1].getAttribute('id'));await dom.find('offer-compare')[0].fire('click');assert.equal(dom.readResult().rows.length,2);await dom.find('offer-edit')[0].fire('click');await walk(dom.body).find(row=>row.tagName==='FORM').fire('submit');assert.equal((await store.all('offers')).length,2);assert.equal((await store.get('offers',local.id)).company,'Kept local');assert.equal((await store.get('offers',local.id)).base,123);assert.ok((await store.all('offers')).some(row=>row.company==='Shared update'&&row.id!==local.id));
 }finally{dom.restore();store.close();}
});
