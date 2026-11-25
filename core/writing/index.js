import {matchResume} from '../match/index.js';
export const letterKinds=['cover','referral','followup'];
export const starFields=['situation','task','action','result'];
const text=(value,label,max=20000)=>{if(typeof value!=='string'||value.length>max)throw new Error(`${label} must be text up to ${max} characters.`);return value.trim();};
export function storyInput(value){
  const title=text(value.title??'','Story title',200);if(!title)throw new Error('Enter a story title.');const skills=typeof value.skills==='string'?value.skills.split(','):value.skills??[];if(!Array.isArray(skills)||skills.length>50)throw new Error('Use up to 50 skill tags.');
  return {title,...Object.fromEntries(starFields.map(key=>[key,text(value[key]??'',key,10000)])),skills:[...new Set(skills.map(value=>text(value,'Skill tag',80)).filter(Boolean))]};
}
export const storyMissing=story=>starFields.filter(key=>!String(story[key]??'').trim());
export const storyEvidence=story=>[story.action,story.result].filter(value=>String(value??'').trim()).join('\n');
export function storyPlainText(story){return `${story.title}\n\n${starFields.map(key=>`${key[0].toUpperCase()+key.slice(1)}\n${story[key]??''}`).join('\n\n')}\n\nSkills: ${(story.skills??[]).join(', ')}\n`;}
export function writingEvidence({job,resume,stories=[]}){
  let requirements=[];if(job&&resume){const report=matchResume(resume,job);requirements=[...report.required,...report.preferred];}
  const candidates=new Map();for(const row of requirements){const lines=[row.evidence,...row.supportingEvidence??[]].filter(Boolean),copied=[...new Set(lines.map(line=>line.line).filter(line=>typeof line==='string'&&String(resume.text).includes(line)))];if(!copied.length)continue;const block={source:'resume',sourceId:resume.id??null,requirement:row.text,status:row.status,text:copied.join('\n')},key=JSON.stringify(['resume',resume.id,row.kind,row.text]);candidates.set(key,{...block,key,label:row.text,sourceLabel:resume.label??'Resume',lineIndices:lines.map(row=>row.lineIndex)});}
  for(const story of stories.filter(row=>!row.deleted)){const evidence=storyEvidence(story);if(evidence){const key=JSON.stringify(['story',story.id]);candidates.set(key,{key,source:'story',sourceId:story.id,requirement:'',text:evidence,status:'user-provided',label:story.title,sourceLabel:'Story bank',skills:story.skills??[]});}}
  return {requirements:requirements.map(row=>({text:row.text,kind:row.kind,status:row.status})),candidates:[...candidates.values()]};
}
function blockInput(row){if(!row||!['resume','story','manual'].includes(row.source)||row.sourceId!==undefined&&row.sourceId!==null&&typeof row.sourceId!=='string')throw new Error('Invalid evidence source.');return {source:row.source,sourceId:row.sourceId??null,requirement:text(row.requirement??'','Requirement',2000),text:text(row.text??'','Evidence block')};}
export function letterInput(value){
  const kind=value.kind??'cover';if(!letterKinds.includes(kind))throw new Error('Choose a letter or outreach kind.');const title=text(value.title??'','Draft title',200);if(!title)throw new Error('Enter a draft title.');
  if(!Array.isArray(value.blocks??[])||(value.blocks??[]).length>100)throw new Error('Use at most 100 evidence blocks.');const blocks=(value.blocks??[]).map(blockInput);
  return {title,kind,jobId:value.jobId??null,resumeVersionId:value.resumeVersionId??null,contactId:value.contactId??null,recipient:text(value.recipient??'','Recipient',200),sender:text(value.sender??'','Sender',200),subject:text(value.subject??'','Subject',500),text:text(value.text??'','Draft',60000),blocks};
}
export function composeLetter({kind='cover',job,recipient='',sender='',blocks=[]}){
  if(!letterKinds.includes(kind))throw new Error('Choose a letter kind.');const role=text(job?.title??'','Role',300),company=text(job?.company??'','Company',300);if(!role)throw new Error('Choose a job or enter its role before composing.');
  if(!Array.isArray(blocks)||blocks.length>100)throw new Error('Use at most 100 evidence blocks.');const selected=blocks.map(blockInput);if(selected.some(row=>!row.text))throw new Error('Selected evidence blocks cannot be empty.');
  const target=company?`${role} role at ${company}`:`${role} role`,greeting=text(recipient,'Recipient',200)||(kind==='cover'?'Hiring team':'there'),signoff=text(sender,'Sender',200)||'[Your name]',body=[...new Set(selected.map(row=>row.text))].join('\n\n');
  const opening=kind==='cover'?`I am applying for the ${target}.`:kind==='referral'?`I am interested in the ${target}. Would you be open to sharing advice about the team or the application process?`:`I would like to follow up on the ${target}.`;
  const close=kind==='cover'?'Thank you for considering my application.':'Thank you for your time and consideration.';
  return {kind,subject:kind==='cover'?`Application: ${role}${company?` — ${company}`:''}`:kind==='referral'?`Question about ${role}`:`Following up: ${role}`,text:[`${kind==='cover'?'Dear':'Hello'} ${greeting},`,opening,...(body?[body]:[]),close,signoff].join('\n\n'),blocks:selected};
}
