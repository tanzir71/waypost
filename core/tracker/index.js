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
