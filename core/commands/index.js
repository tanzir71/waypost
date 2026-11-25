import {routes} from '../routes.js';
import {buildDeepLink} from '../links/deep.js';
export function commandResults(query,{basePath='/',jobs=[],applications=[],versions=[]}={}) {
  const q=String(query).trim().toLowerCase(),result=[];
  const add=(id,group,label,detail,route,state={},autorun=false,icon='search')=>result.push({id,group,label,detail,icon,href:buildDeepLink(route,state,{basePath,autorun})});
  const gpa=q.match(/(?:plan\s+)?gpa\s+(\d+(?:\.\d+)?)/);
  if(gpa)add('intent-gpa','Tools','GPA target planner',`Run with target ${Number(gpa[1]).toFixed(2)}`,'gpa',{target:Number(gpa[1])},true,'grad');
  for(const route of routes.filter(row=>row.group))if(!q||`${route.label} ${route.description}`.toLowerCase().includes(q)||q.split(/\s+/).some(term=>term.length>2&&route.label.toLowerCase().includes(term)))add(`tool-${route.id}`,'Tools',route.label,route.description,route.id,{},false,route.icon);
  const actions=[['score','Score '+jobs.length+' jobs','Honest Match · all resume versions','match',{},true,'target'],['paste','Add job from clipboard','Open a paste form; review before saving','import',{paste:true},false,'plus'],['export','Export workspace JSON','Save a local backup without credentials','settings',{action:'export'},true,'download'],['resume','Import a resume','Read a PDF, DOCX, TXT or JSON Resume locally','import',{},false,'upload']];
  for(const [id,label,detail,route,state,autorun,icon]of actions)if(!q||`${label} ${detail}`.toLowerCase().includes(q)||q==='export'&&id==='export')add(`action-${id}`,'Actions',label,detail,route,state,autorun,icon);
  for(const app of applications){const job=jobs.find(row=>row.id===app.jobId);if(job&&(!q||`${job.title} ${job.company}`.toLowerCase().includes(q)))add(`jump-${app.id}`,'Jump to',`${job.company||'Company not provided'} — ${job.title}`,`Tracker · ${app.stage}`,'tracker',{selected:app.id,edit:true},false,'kanban');}
  for(const version of versions)if(q&&version.label.toLowerCase().includes(q))add(`resume-${version.id}`,'Jump to',version.label,'Resume version','resumes',{resume:version.id},false,'layers');
  return result.slice(0,60);
}
