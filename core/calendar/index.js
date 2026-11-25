import {finalNeeded} from '../finals/index.js';
export const deadlineKinds=['application','scholarship','exam','interview','offer','other'];
export function calendarDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'0001-01-01'||value>'9998-12-31')throw new Error('Use a calendar date between years 0001 and 9998.');
  const parsed=new Date(`${value}T00:00:00Z`);if(!Number.isFinite(parsed.valueOf())||parsed.toISOString().slice(0,10)!==value)throw new Error('Invalid calendar date.');return value;
}
export const dayAfter=(date,days=1)=>{calendarDate(date);if(!Number.isSafeInteger(days)||Math.abs(days)>366)throw new Error('Invalid day offset.');return new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10);};
export function monthDays(month){
  if(typeof month!=='string'||!/^\d{4}-\d{2}$/.test(month))throw new Error('Use a month in YYYY-MM format.');
  const first=calendarDate(`${month}-01`),start=new Date(`${first}T00:00:00Z`),offset=(start.getUTCDay()+6)%7;
  const next=new Date(start);next.setUTCMonth(next.getUTCMonth()+1);const count=Math.round((next-start)/86400000),cells=Math.ceil((offset+count)/7)*7;
  return Array.from({length:cells},(_,index)=>{const date=dayAfter(first,index-offset);return {date,day:Number(date.slice(8)),inMonth:date.startsWith(month)};});
}
export function adjacentMonth(month,offset){
  monthDays(month);if(!Number.isInteger(offset)||Math.abs(offset)>120)throw new Error('Invalid month offset.');const date=new Date(`${month}-01T00:00:00Z`);date.setUTCMonth(date.getUTCMonth()+offset);const output=date.toISOString().slice(0,7);calendarDate(output+'-01');return output;
}
export function deadlineInput(input){
  if(!input||typeof input!=='object'||typeof input.title!=='string'||!input.title.trim()||input.title.length>1000)throw new Error('Enter a deadline title of 1–1000 characters.');
  const date=calendarDate(input.date),kind=input.kind??'other';if(!deadlineKinds.includes(kind))throw new Error('Choose a deadline kind.');
  if(input.linkedId!==undefined&&input.linkedId!==null&&typeof input.linkedId!=='string')throw new Error('Invalid linked record.');
  return {title:input.title.trim(),date,kind,linkedId:input.linkedId??null,publish:input.publish===true};
}
export function calendarSources(records,{scales=[]}={}){
  const active=type=>(records[type]??[]).filter(row=>!row.deleted),jobs=new Map(active('jobs').map(row=>[row.id,row])),sources=[];
  const add=(row,source,value)=>sources.push({id:row.id,sourceId:row.id,source,publish:row.publish===true,updatedAt:row.updatedAt,linkedId:null,...value});
  for(const row of active('applications'))if(row.stage!=='closed'){
    const job=jobs.get(row.jobId),company=job?.company||job?.title||'Application';add(row,'applications',{title:`${company} · ${row.next?.label||'Next step'}`,date:row.next?.at?.slice(0,10)??null,kind:row.stage==='interview'?'interview':'application',detail:job?.title??'',linkedId:row.jobId});
  }
  for(const row of active('offers'))if(!row.isCurrent)add(row,'offers',{title:`${row.company||'Offer'} decision`,date:row.decideBy??null,kind:'offer',detail:''});
  for(const row of active('courses')){
    let detail='';const scale=scales.find(scale=>scale.id===row.scaleId),grade=scale?.grades.find(grade=>grade.letter===row.targetGrade);
    if(grade&&row.categories){try{const final=finalNeeded({categories:row.categories,cutoff:grade.min});detail=final.status==='reachable'?`Need ${final.neededDisplay}% for ${grade.letter}`:final.status==='already-secured'?`${grade.letter} already secured`:`${grade.letter} not reachable; maximum ${final.maximum}%`;}catch{/* A dated final still appears; invalid assessment inputs do not invent a target. */}}
    add(row,'courses',{title:`${row.name||'Course'} final`,date:row.examDate??null,kind:'exam',detail});
  }
  return sources;
}
export function calendarEvents(records,options={}){
  const manual=(records.deadlines??[]).filter(row=>!row.deleted),sources=calendarSources(records,options),covered=new Set(manual.filter(row=>row.linkedId).map(row=>row.linkedId)),events=[];
  for(const row of manual){const input=deadlineInput(row),linked=sources.find(source=>source.id===input.linkedId);events.push({...input,id:row.id,source:'deadlines',sourceId:row.id,updatedAt:row.updatedAt,detail:input.kind==='exam'?linked?.detail??'':''});}
  for(const source of sources)if(source.date&&!covered.has(source.id)){calendarDate(source.date);events.push(source);}
  return events.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
export function agenda(events,day,{days=10}={}){calendarDate(day);if(!Number.isInteger(days)||days<1||days>366)throw new Error('Invalid agenda duration.');const end=dayAfter(day,days-1);return events.filter(row=>row.date>=day&&row.date<=end);}
