import defaults from '../defaults.js';
import {groupJobsByDate,filterJobsByDates,toScoringTextExport,toWaypostExport} from './job-data.js';
import {el,announce,result} from '../bundled/ui/dom.js';
import {tierBadge} from '../bundled/ui/components/match-report.js';
import {captureTab,quickMatch,sendURL,showChip} from './capture.js';
const api=chrome;let jobs=[],selectedDates=new Set(),current=null,tab=null,options={...defaults};
const read=document.querySelector('#read-page'),save=document.querySelector('#save-job'),send=document.querySelector('#send-job'),chip=document.querySelector('#chip-enabled');
try {const state=await api.storage.local.get({jobs:[],options:defaults});jobs=Array.isArray(state.jobs)?state.jobs:[];options={...defaults,...state.options};}catch(error){announce(error.message);}
document.querySelector('#open-options').addEventListener('click',()=>api.runtime.openOptionsPage());
read.addEventListener('click',async()=>{
  read.disabled=true;
  try {
    [tab]=await api.tabs.query({active:true,currentWindow:true});current=await captureTab(api,tab);
    document.querySelector('#page-title').textContent=current.title;document.querySelector('#page-company').textContent=current.company||new URL(current.url).hostname;
    document.querySelector('#page-details').textContent=`${current.description.trim().split(/\s+/).length} words · ${current.layout??'Generic page'} layout`;
    const report=quickMatch(current,options),quick=document.querySelector('#quick-match');quick.replaceChildren();
    if(report)quick.append(tierBadge(report.tier),el('span',{text:`vs ${options.resumeLabel} · ${report.required.filter(row=>row.status==='met').length} of ${report.required.length} required`}));
    else quick.append(el('span',{text:'Set a default resume in Options for a quick match.'}));
    save.disabled=false;send.disabled=false;chip.checked=(options.chipOrigins??[]).includes(new URL(tab.url).origin);
    result({job:current,matchReport:report});announce('Job text read on this device.');
  }catch(error){current=null;save.disabled=true;send.disabled=true;announce(error.message);}finally{read.disabled=false;}
});
save.addEventListener('click',async()=>{
  if(!current)return;try{jobs=[current,...jobs.filter(job=>job.url!==current.url)];selectedDates.add(current.collectedDate);await api.storage.local.set({jobs});paint();announce('Job saved in this browser.');}catch(error){announce(error.message);}
});
async function sendJobs(selected){try{if(!selected.length)throw new Error('Select at least one capture date.');await api.tabs.create({url:sendURL(selected,options)});announce('Opened Waypost. Review and confirm the import there.');}catch(error){announce(error.message);}}
send.addEventListener('click',()=>current&&sendJobs([current]));
document.querySelector('#send-selected').addEventListener('click',()=>sendJobs(filterJobsByDates(jobs,[...selectedDates])));
document.querySelector('#select-all').addEventListener('click',()=>{const groups=groupJobsByDate(jobs);selectedDates=selectedDates.size===groups.length?new Set():new Set(groups.map(group=>group.date));paint();});
for(const format of ['text','json'])document.querySelector(`#export-${format}`).addEventListener('click',async()=>{
  const selected=filterJobsByDates(jobs,[...selectedDates]);if(!selected.length){announce('Select at least one capture date.');return;}
  const text=format==='json'?JSON.stringify(toWaypostExport(selected,new Date()),null,2):toScoringTextExport(selected);
  const url=URL.createObjectURL(new Blob([text],{type:format==='json'?'application/json':'text/plain'}));
  try{await api.downloads.download({url,filename:`waypost-jobs-${new Date().toISOString().slice(0,10)}.${format==='json'?'json':'txt'}`,saveAs:true});}catch(error){announce(error.message);}finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
});
chip.addEventListener('change',async()=>{
  try {
    if(!current||!tab)throw new Error('Read this page before enabling its chip.');
    const origin=new URL(tab.url).origin;
    if(chip.checked) {
      const granted=await api.permissions.request({origins:[`${origin}/*`]});if(!granted){chip.checked=false;announce('Site access was not granted. The chip remains off.');return;}
      options.chipOrigins=[...new Set([...(options.chipOrigins??[]),origin])];await api.storage.local.set({options});await showChip(api,tab,current,options);announce('Chip enabled for this origin.');
    }else{options.chipOrigins=(options.chipOrigins??[]).filter(value=>value!==origin);await api.storage.local.set({options});await api.tabs.sendMessage(tab.id,{type:'WAYPOST_HIDE_CHIP'});await api.permissions.remove({origins:[`${origin}/*`]});announce('Chip disabled for this origin.');}
  }catch(error){
    const origin=tab?.url?new URL(tab.url).origin:null;
    if(chip.checked&&origin){options.chipOrigins=(options.chipOrigins??[]).filter(value=>value!==origin);try{await api.storage.local.set({options});await api.permissions.remove({origins:[`${origin}/*`]});}catch{/* A failed rollback is explained by the original error. */}}
    chip.checked=false;announce(error.message);
  }
});
function paint(){
  const groups=groupJobsByDate(jobs),container=document.querySelector('#date-groups');container.replaceChildren();
  selectedDates=new Set([...selectedDates].filter(date=>groups.some(group=>group.date===date)));
  for(const group of groups){const id=`date-${group.date}`,input=el('input',{id,type:'checkbox',checked:selectedDates.has(group.date),'data-testid':'capture-date'});input.addEventListener('change',()=>{if(input.checked)selectedDates.add(group.date);else selectedDates.delete(group.date);exportsState();});container.append(el('div',{class:'date-row','data-testid':'capture-date-row'},input,el('label',{for:id,text:new Date(`${group.date}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}),el('small',{text:`${group.jobs.length} jobs`})));}
  if(!groups.length)container.append(el('p',{class:'muted',text:'Read a job page and save it for later to start a collection.'}));exportsState();
}
function exportsState(){const none=!filterJobsByDates(jobs,[...selectedDates]).length;for(const id of ['export-text','export-json','send-selected'])document.getElementById(id).disabled=none;}
paint();
