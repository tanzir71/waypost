import {stages,responseRates,followupApplications} from '../tracker/index.js';
import {calendarEvents} from '../calendar/index.js';
import {contactSummary} from '../contacts/index.js';
const dayMs=86400000;
export function todaySummary(records,{now,day=now.slice(0,10)}) {
  const nowMs=Date.parse(now);if(!Number.isFinite(nowMs))throw new Error('A valid current timestamp is required.');
  const start=Date.parse(`${day}T00:00:00Z`),weekEnd=new Date(start+7*dayMs).toISOString().slice(0,10);
  const jobs=new Map((records.jobs??[]).filter(row=>!row.deleted).map(row=>[row.id,row]));
  const applications=(records.applications??[]).filter(row=>!row.deleted);
  const pipeline=stages.map(stage=>({stage,count:applications.filter(row=>row.stage===stage&&Date.parse(row.updatedAt??row.createdAt)>=nowMs-30*dayMs&&Date.parse(row.updatedAt??row.createdAt)<=nowMs).length}));
  const next=[];
  const due=new Set(followupApplications(applications,day).map(row=>row.id));
  for(const app of applications.filter(row=>row.stage!=='closed')) {
    const job=jobs.get(app.jobId);
    if(due.has(app.id)) next.push({id:`followup:${app.id}`,type:'followup',applicationId:app.id,jobId:app.jobId,title:`${app.next.label} · ${job?.company||job?.title||'Application'}`,detail:job?.title??'',at:app.next.at});
    else if(app.stage==='interview'&&app.next?.at&&app.next.at.slice(0,10)<=weekEnd)next.push({id:`interview:${app.id}`,type:'interview',applicationId:app.id,jobId:app.jobId,title:`Interview at ${job?.company??'your next company'}`,detail:app.next.label,at:app.next.at});
  }
  for(const deadline of calendarEvents({...records,applications:[]},{scales:records.scales??[]}).filter(row=>row.date>=day&&row.date<=weekEnd))next.push({id:`deadline:${deadline.id}`,type:'deadline',deadlineId:deadline.id,title:deadline.title,detail:deadline.detail||deadline.kind,at:deadline.date});
  for(const contact of contactSummary(records.contacts??[],{day}).filter(row=>row.due))next.push({id:`contact:${contact.id}`,type:'contact',contactId:contact.id,title:`Contact reminder · ${contact.name}`,detail:contact.company||contact.role||'',at:contact.remindAt});
  const seen=new Set();
  for(const report of (records.matchReports??[]).filter(row=>!row.deleted&&jobs.has(row.jobId))) for(const knockout of report.knockouts??[]) {
    const answered=jobs.get(report.jobId).knockoutAnswers?.[knockout.question]??knockout.answered;
    const id=`knockout:${report.jobId}:${knockout.question}`;
    if(answered===null&&!seen.has(id)){seen.add(id);next.push({id,type:'knockout',jobId:report.jobId,resumeVersionId:report.resumeVersionId,title:`Knockout to answer at ${jobs.get(report.jobId).company||'a saved job'}`,detail:knockout.question,at:day});}
  }
  next.sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
  const tierOrder=['strong','good','partial','limited'],best=new Map();
  for(const report of (records.matchReports??[]).filter(row=>!row.deleted&&jobs.has(row.jobId)&&Date.parse(row.updatedAt??now)>=nowMs-7*dayMs)) {
    const previous=best.get(report.jobId);
    if(!previous||tierOrder.indexOf(report.tier)<tierOrder.indexOf(previous.tier))best.set(report.jobId,report);
  }
  return {day,next,pipeline,responseRates:responseRates(applications,records.resumeVersions??[]),bestMatches:[...best.values()].sort((a,b)=>tierOrder.indexOf(a.tier)-tierOrder.indexOf(b.tier)).slice(0,3),followups:next.filter(row=>row.type==='followup').length,deadlines:next.filter(row=>row.type==='deadline').length};
}
