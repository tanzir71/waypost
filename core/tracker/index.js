export const stages=['saved','applied','screen','interview','offer','closed'];
export function applicationFields(job,resumeVersionId,now) {
  if(!job?.id) throw new Error('Choose a saved job before adding an application.');
  return {jobId:job.id,resumeVersionId:resumeVersionId??null,stage:'saved',appliedAt:null,next:null,contactIds:[],notes:'',history:[{at:now,event:'Saved application',stage:'saved'}]};
}
export function moveApplication(application,stage,now) {
  if(!stages.includes(stage)) throw new Error('Choose a valid application stage.');
  if(application.stage===stage) return application;
  return {...application,stage,appliedAt:application.appliedAt??(stage==='applied'?now.slice(0,10):null),history:[...(application.history??[]),{at:now,event:`Moved from ${application.stage} to ${stage}`,stage}]};
}
export function updateApplication(application,fields,now) {
  const allowed=['resumeVersionId','appliedAt','next','contactIds','notes'];
  const patch=Object.fromEntries(allowed.filter(key=>Object.hasOwn(fields,key)).map(key=>[key,fields[key]]));
  if(patch.next && (!patch.next.label?.trim()||!Number.isFinite(Date.parse(patch.next.at))))throw new Error('Give the next step a label and valid date.');
  if(patch.appliedAt && !/^\d{4}-\d{2}-\d{2}$/.test(patch.appliedAt))throw new Error('Choose a valid applied date.');
  if(patch.contactIds&&!Array.isArray(patch.contactIds))throw new Error('Contact references must be a list.');
  return {...application,...patch,history:[...(application.history??[]),{at:now,event:'Updated application details',stage:application.stage}]};
}
export function responseRates(applications,versions) {
  return versions.map(version=>{
    const sent=applications.filter(row=>!row.deleted&&row.resumeVersionId===version.id&&(row.appliedAt||row.history?.some(event=>event.stage==='applied')));
    const replied=sent.filter(row=>['screen','interview','offer'].includes(row.stage)||row.history?.some(event=>['screen','interview','offer'].includes(event.stage)));
    return {resumeVersionId:version.id,label:version.label,sent:sent.length,replies:replied.length,rate:sent.length?replied.length/sent.length:null};
  });
}
export function followupApplications(applications,day) {return applications.filter(row=>!row.deleted&&row.stage!=='closed'&&row.next?.at&&row.next.at.slice(0,10)<=day);}
export function sortApplications(applications,jobs,{key='updatedAt',direction='desc'}={}) {
  if(!['company','title','stage','nextAt','updatedAt'].includes(key))throw new Error('Unsupported sort column.');
  const jobMap=new Map(jobs.map(job=>[job.id,job]));
  const value=row=>key==='company'||key==='title'?(jobMap.get(row.jobId)?.[key]??''):key==='nextAt'?row.next?.at??'':row[key]??'';
  return [...applications].sort((a,b)=>(direction==='asc'?1:-1)*String(value(a)).localeCompare(String(value(b)))||a.id.localeCompare(b.id));
}
