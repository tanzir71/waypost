import schema from '../../schemas/job-export.json' with {type:'json'};
import {validate} from '../store/schema.js';
import {httpURL,encodeText,decodeText} from '../links/index.js';
export function parseJobExport(input) {
  const value=typeof input==='string'?JSON.parse(input):input;
  if(!value||typeof value!=='object')throw new Error('Choose a job or a job export.');
  const raw=Array.isArray(value)?value:Array.isArray(value.jobs)?value.jobs:[value];
  const jobs=raw.map(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('Each job must be an object.');
    const copy={};
    for(const key of ['id','title','text','company','location','url','collectedAt','source']) if(row[key]!==undefined)copy[key]=row[key];
    if(copy.text===undefined&&typeof row.description==='string')copy.text=row.description;
    return copy;
  });
  const envelope={source:Array.isArray(value.jobs)?value.source??'waypost-clipper':'waypost-clipper',jobs,...(value.exportedAt?{exportedAt:value.exportedAt}:{}),...(value.version!==undefined?{version:value.version}:{})};
  const errors=validate(envelope,schema,'$',[],schema);
  for(const job of jobs) {
    if(typeof job.title==='string'&&!job.title.trim())errors.push('Every job needs a title.');
    if(typeof job.text==='string'&&!job.text.trim())errors.push('Every job needs description text.');
    if(job.url&&!httpURL(job.url)) errors.push('Job links must use HTTP or HTTPS without credentials.');
  }
  if(errors.length)throw new Error(errors.slice(0,4).join('; '));
  return envelope;
}
export function encodeJobExport(value) {
  const encoded=encodeText(JSON.stringify(parseJobExport(value)));
  if(encoded.length>32768)throw new Error('This job export is too large for a private link. Export JSON and import it, or paste instead.');
  return encoded;
}
export function decodeJobExport(encoded) {
  if(encoded.length>32768)throw new Error('This private link is too large. Import JSON or paste instead.');
  return parseJobExport(decodeText(encoded,32768));
}
export function handoffURL(appUrl,value) {
  const valid=httpURL(appUrl);if(!valid)throw new Error('Enter an HTTP or HTTPS Waypost deployment URL.');
  const root=new URL(valid);root.search='';root.hash='';if(!root.pathname.endsWith('/'))root.pathname+='/';
  const url=new URL('app/import/',root);url.hash=`job=${encodeJobExport(value)}`;return url.href;
}
