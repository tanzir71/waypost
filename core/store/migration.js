import { scoreBatch } from '../match/index.js';
import { settingsDefaults } from './schema.js';
// Conversion is pure. The adapter supplies a deterministic ID mapping and time,
// and commits the whole result before marking or backing up localStorage.
export function migrateLegacy(raw,{idFor,now,deviceId}) {
  const legacy=typeof raw==='string'?JSON.parse(raw):raw;
  if(!legacy || typeof legacy!=='object' || !Array.isArray(legacy.resumes)||!Array.isArray(legacy.jobs)) throw new Error('The old workspace is not valid. Its backup is kept.');
  const base=(type,source,index)=>({id:idFor(`${type}:${source.id??index}`),createdAt:source.createdAt&&Number.isFinite(Date.parse(source.createdAt))?source.createdAt:now,updatedAt:now,deviceId,deleted:false});
  const resumeVersions=legacy.resumes.map((resume,index)=>({...base('resume',resume,index),label:String(resume.name??resume.label??`Imported resume ${index+1}`),text:String(resume.text??''),parentId:null,jsonResume:{basics:{summary:String(resume.text??'')}}}));
  const jobs=legacy.jobs.map((job,index)=>({...base('job',job,index),title:String(job.title??'Imported job'),text:String(job.text??job.description??''),company:String(job.company??''),url:String(job.url??''),source:'file'}));
  // Old keyword-only scores cannot be treated as requirement evidence. Recompute
  // those reports and retain the original results in the migration archive.
  const matchReports=legacy.results?.length?scoreBatch(resumeVersions,jobs,{now}).map((report,index)=>({...base('report',{},index),...report})):[];
  return {resumeVersions,jobs,matchReports,settings:[{...base('settings',{},0),key:'preferences',value:settingsDefaults()},{...base('archive',{},0),key:'legacy-archive',value:{results:legacy.results??[],clusters:legacy.clusters??[],lastRunAt:legacy.lastRunAt??null}}]};
}
