import {normalizeCapturedJob,toWaypostExport} from './job-data.js';
import {matchResume} from '../bundled/core/match/index.js';
import {handoffURL} from '../bundled/core/import/index.js';
export async function captureTab(api,tab) {
  if(!tab?.id||!/^https?:/i.test(tab.url??''))throw new Error('Open an HTTP or HTTPS job page before reading it.');
  await api.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});
  const captured=await api.tabs.sendMessage(tab.id,{type:'WAYPOST_CAPTURE_JOB'});
  if(captured?.error)throw new Error(captured.error);
  if(!captured?.description?.trim())throw new Error('No job text was found. Paste the description into Waypost instead.');
  return normalizeCapturedJob({...captured,url:tab.url},new Date());
}
export function quickMatch(job,options) {
  if(!options.resumeText?.trim())return null;
  return matchResume({id:'clipper-default',label:options.resumeLabel,text:options.resumeText},{id:job.id,title:job.title,text:job.description},{now:new Date().toISOString().slice(0,10)});
}
export function sendURL(jobs,options) {return handoffURL(options.appUrl,toWaypostExport(jobs,new Date()));}
export async function showChip(api,tab,job,options) {
  const report=quickMatch(job,options),url=sendURL([job],options);
  return api.tabs.sendMessage(tab.id,{type:'WAYPOST_SHOW_CHIP',tier:report?.tier??null,url});
}
