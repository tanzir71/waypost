import {parseJobExport,decodeJobExport} from '../../core/import/index.js';
import {parseImportedJobs} from '../../core/scoring.js';
import {applicationFields} from '../../core/tracker/index.js';
import {readResumeFile,saveOriginal} from '../read-file.js';
import {createScorer} from '../worker-client.js';
import {el,button,field,result,announce,safeURL,copyJSON,download} from '../dom.js';
import {shareLinkButton} from '../links.js';
import {reviewWorkspaceImport} from '../workspace-import.js';
export async function renderImport({store,basePath,view,actions,files=[]}) {
  actions.append(shareLinkButton('import',()=>({paste:true}),basePath),button('Copy JSON',()=>copyJSON(JSON.parse(document.querySelector('#result-data').textContent)),'import-copy-json',{class:'small'}),button('Download JSON',()=>download('waypost-import-review.json',document.querySelector('#result-data').textContent),'import-download-json',{class:'small'}));
  let pending=[],resumeUpload=null,previewResume=null,busy=false;
  const versions=await store.all('resumeVersions'),preview=el('section',{class:'import-preview stack','aria-label':'Review import'});
  const upload=el('input',{id:'import-file',type:'file',accept:'.json,.txt,.pdf,.docx','data-testid':'import-file'}),paste=el('textarea',{id:'import-text',rows:8,'data-testid':'import-text'});
  const message=el('p',{role:'status','aria-live':'polite','data-testid':'import-message'});
  const form=el('form',{class:'card stack','aria-label':'Choose an import'},field('Clipper export or resume file','import-file',upload),el('details',{},el('summary',{text:'Or paste job descriptions','data-testid':'import-paste-open'}),field('Job descriptions (separate jobs with ---)','import-text',paste),button('Review pasted jobs',()=>{try{review({jobs:parseImportedJobs(paste.value,'paste')},'paste');}catch(error){message.textContent=error.message;}},'import-review-paste')));
  form.addEventListener('submit',event=>event.preventDefault());
  function review(value,source='clipper'){pending=parseJobExport(value).jobs.map(job=>({...job,reviewId:crypto.randomUUID(),importSource:source}));previewResume=null;resumeUpload=null;paint();}
  async function save({tracker=false,score=false}={}) {
    if(busy)return;
    const selected=pending.filter((row,index)=>selectedJobs.has(index));
    if(!selected.length){message.textContent='Select at least one job to save.';return;}
    busy=true;const controls=[...preview.querySelectorAll('button,input')].map(control=>[control,control.disabled]);controls.forEach(([control])=>{control.disabled=true;});
    try {
      const records=selected.map(job=>store.record({title:job.title,company:job.company??'',location:job.location??'',url:safeURL(job.url)??'',text:job.text,source:job.importSource,...(job.collectedAt?{collectedAt:job.collectedAt}:{})}));
      const applications=tracker?records.map(job=>store.record(applicationFields(job,versions.at(-1)?.id,new Date().toISOString()))):[];
      const reports=score?(await createScorerOnce(versions,records)).map(report=>store.record(report)):[];
      await store.putMany({jobs:records,applications,matchReports:reports});pending=[];history.replaceState(null,'',`${location.pathname}#saved=1`);
      paint();result({savedJobs:records,savedApplications:applications,matchReports:reports});message.textContent=`Saved ${records.length} jobs${tracker?' to Tracker':''}${score?' and scored every resume version':''}.`;
      preview.append(el('a',{class:'button primary',href:`${basePath}app/${tracker?'tracker':'match'}/#${tracker?'selected':'job'}=${encodeURIComponent(tracker?applications[0].id:records[0].id)}`,text:tracker?'Open Tracker':'Open Honest Match','data-testid':'import-open-saved'}));
    }catch(error){message.textContent=error.message;}finally{busy=false;controls.forEach(([control,disabled])=>{control.disabled=disabled;});}
  }
  let selectedJobs=new Set();
  function paint(){
    preview.replaceChildren();
    if(previewResume) {
      preview.append(el('h2',{text:'Review your resume'}),el('p',{class:'muted',text:`${resumeUpload.name} · ${previewResume.parse.words} words. The file is read locally.`}),el('pre',{class:'resume-import-preview',text:previewResume.text}),button('Save resume version',async event=>{
        if(busy)return;busy=true;const control=event.currentTarget;control.disabled=true;
        try {const row=store.record({label:resumeUpload.name,text:previewResume.text,parse:previewResume.parse,jsonResume:previewResume.jsonResume,parentId:versions.at(-1)?.id??null,originalFile:null});let warning='';try{row.originalFile=await saveOriginal(row.id,resumeUpload);if(!row.originalFile)warning=' Original-file storage is unavailable; extracted text was saved.';}catch{warning=' Original-file storage failed; extracted text was saved.';}await store.putMany({resumeVersions:[row]});preview.replaceChildren(el('p',{text:`Resume saved.${warning}`}),el('a',{class:'button',href:`${basePath}app/resumes/#resume=${encodeURIComponent(row.id)}`,text:'Open Resumes','data-testid':'import-open-resume'}));result(row);}catch(error){message.textContent=error.message;}finally{busy=false;control.disabled=false;}
      },'import-confirm-resume',{class:'primary'}));result({pendingResume:previewResume});return;
    }
    if(!pending.length){preview.append(el('p',{class:'muted',text:'Imports are reviewed here before anything is saved.'}));result(null);return;}
    selectedJobs=new Set(pending.map((_,index)=>index));
    preview.append(el('h2',{text:`Review ${pending.length} jobs`}),el('p',{class:'muted',text:'Choose which jobs to keep. Saving happens only after you use one of the buttons below.'}));
    pending.forEach((job,index)=>{
      const id=`pending-job-${job.reviewId}`;
      const check=el('input',{id,type:'checkbox',checked:true,'data-testid':'import-job-select'});check.addEventListener('change',()=>{if(check.checked)selectedJobs.add(index);else selectedJobs.delete(index);});
      preview.append(el('article',{class:'card stack','data-testid':'import-job-row'},el('div',{class:'checkbox-field'},check,el('label',{for:id,text:`${job.title} · ${job.company??'Company not provided'}`})),el('details',{},el('summary',{text:'Read job description','data-testid':'import-description-open'}),el('pre',{text:job.text,class:'job-import-description'}))));
    });
    preview.append(el('div',{class:'actions'},button('Save jobs',()=>save(),'import-confirm-save',{class:'primary',disabled:busy}),button('Save & score',()=>save({score:true}),'import-confirm-score',{disabled:busy||!versions.length}),button('Save to tracker',()=>save({tracker:true}),'import-confirm-tracker',{disabled:busy})),...(!versions.length?[el('p',{class:'muted',text:'Add a resume in Resumes before using Save & score.'})]:[]));
    result({pendingJobs:pending});
  }
  async function readFile(file){
    if(!file)return;
    try {message.textContent='Reading on this device…';
      if(/\.(pdf|docx)$/i.test(file.name)){previewResume=await readResumeFile(file,{basePath});resumeUpload=file;pending=[];paint();}
      else {if(file.size>50*1024*1024)throw new Error('Use a workspace smaller than 50 MB, or a job export smaller than 5 MB.');const text=await file.text();if(file.name.toLowerCase().endsWith('.json')){const value=JSON.parse(text);if(value.format==='waypost-workspace'){await reviewWorkspaceImport(store,value);return;}if(file.size>5*1024*1024)throw new Error('Use a job export smaller than 5 MB.');if(value.basics){previewResume=await readResumeFile(file,{basePath});resumeUpload=file;pending=[];paint();}else review(value,'file');}else {if(file.size>5*1024*1024)throw new Error('Use a job export smaller than 5 MB.');review({jobs:parseImportedJobs(text,'file')},'file');}}
      message.textContent='Ready to review.';
    }catch(error){message.textContent=error.message;}
  }
  upload.addEventListener('change',()=>readFile(upload.files[0]));
  view.replaceChildren(form,preview,message);paint();
  const payload=new URLSearchParams(location.hash.slice(1)).get('job');
  if(payload)try{review(decodeJobExport(payload));}catch(error){message.textContent=`Import not saved: ${error.message}`;}
  if(files.length){const select=el('select',{id:'opened-file','data-testid':'opened-file'},files.map((file,index)=>el('option',{value:index,text:file.name})));select.addEventListener('change',()=>readFile(files[Number(select.value)]));form.prepend(field('Opened files','opened-file',select));await readFile(files[0]);}
  if(new URLSearchParams(location.hash.slice(1)).get('paste')==='1'){form.querySelector('details').open=true;paste.focus();}
}
async function createScorerOnce(versions,jobs){const scorer=createScorer();try{return await scorer.score(versions,jobs);}finally{scorer.close();}}
