import {readLink,syncLink,shareLinkButton} from '../links.js';
import {diffText,medianTier,matchingEffect} from '../../core/diff/index.js';
import {responseRates} from '../../core/tracker/index.js';
import {analyzeText,jsonResumeFromText} from '../../core/parse/index.js';
import {readResumeFile,saveOriginal} from '../read-file.js';
import {el,button,field,result,announce,download,dialog} from '../dom.js';
import {tierBadge,titleCase} from '../components/match-report.js';
export async function renderResumes({store,basePath,view,actions}) {
  let versions=(await store.all('resumeVersions')).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  const reports=await store.all('matchReports'),applications=await store.all('applications');
  const linked=readLink('resumes');
  let selected=versions.find(row=>row.id===linked.state.resume||row.label===linked.state.resume)??(!linked.state.resume&&!linked.invalid?versions.at(-1):null);
  let mode=linked.state.mode==='inline'?'inline':'side';
  const list=el('aside',{class:'resume-list','aria-label':'Resume versions'}),main=el('section',{class:'resume-detail'});
  const layout=el('div',{class:'resumes-layout'},list,main);
  async function reload(id) {versions=(await store.all('resumeVersions')).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));selected=versions.find(row=>row.id===id)??versions.at(-1);paint();}
  const usageByVersion=new Map(responseRates(applications,versions).map(row=>[row.resumeVersionId,row]));
  const status=version=>usageByVersion.get(version.id)??{sent:0,replies:0};
  function newVersion(parent=selected) {
    const id=crypto.randomUUID();
    const label=el('input',{id:`resume-label-${id}`,required:true,value:parent?`${parent.label} copy`:'My resume','data-testid':'resume-label'});
    const text=el('textarea',{id:`resume-text-${id}`,required:true,rows:16,'data-testid':'resume-text'},parent?.text??'');
    const form=el('form',{class:'stack'},field('Version label',label.id,label),field('Resume text',text.id,text),el('button',{type:'submit',class:'primary',text:'Save version','data-testid':'resume-save'}));
    const modal=dialog('New resume version',form);
    form.addEventListener('submit',async event=>{
      event.preventDefault();const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
      try {const row=await store.save('resumeVersions',{label:label.value.trim(),text:text.value,parentId:parent?.id??null,parse:analyzeText(text.value),jsonResume:jsonResumeFromText(text.value)});modal.close();await reload(row.id);announce('Resume version saved on this device. Score your jobs to compare its effect.');}
      catch(error){announce(error.message);submit.disabled=false;}
    });
  }
  async function uploadFile(file) {
    if(!file)return;
    try {
      announce('Extracting the resume on this device…');
      const parsed=await readResumeFile(file,{basePath});
      const row=store.record({label:file.name,text:parsed.text,parse:parsed.parse,jsonResume:parsed.jsonResume,parentId:selected?.id??null,originalFile:null});
      let warning='';
      try {row.originalFile=await saveOriginal(row.id,file);if(!row.originalFile)warning=' Original-file storage is unavailable here; the extracted text is saved.';}
      catch{warning=' Original-file storage failed; the extracted text is saved.';}
      await store.putMany({resumeVersions:[row]});await reload(row.id);announce(`Resume saved.${warning}`);
    } catch(error){announce(error.message);}
  }
  function lineNode(row,side) {
    const node=el('div',{class:`diff-line diff-${row.type}`,'data-testid':'diff-row','data-change':row.type},el('span',{class:'diff-marker','aria-hidden':true,text:row.type==='added'?'+':row.type==='removed'?'−':' '}));
    const text=el('span');
    for(const word of row.words) text.append(el('span',{class:word.type!=='equal'?`word-${word.type}`:'',text:word.text}));
    node.append(text);return node;
  }
  function paint() {
    if(selected)syncLink('resumes',{resume:selected.id,mode},{basePath});
    list.replaceChildren();main.replaceChildren();
    for(const version of [...versions].reverse()) {
      const median=medianTier(reports.filter(report=>report.resumeVersionId===version.id)),usage=status(version);
      const item=button('',()=>{selected=version;history.replaceState(null,'',`#resume=${encodeURIComponent(version.id)}`);paint();},'resume-version',{class:'resume-version','aria-pressed':version.id===selected?.id,'data-version-id':version.id});
      item.append(el('div',{class:'section-title'},el('h3',{text:version.label}),median?tierBadge(median):el('span',{class:'stage-tag',text:'Not scored'})),el('p',{class:'muted',text:`Edited ${new Date(version.updatedAt).toLocaleDateString()}`}),el('p',{class:'evidence',text:`Sent to ${usage.sent} · ${usage.replies} replies`}));list.append(item);
    }
    list.append(el('p',{class:'muted',text:'Tier shown is the median across this version’s scored jobs. Replies are based on recorded application history.'}));
    if(!selected) {main.append(el('div',{class:'empty-state'},el('h2',{text:'Your resume, with room to improve.'}),el('p',{text:'Import a file or create your first version. It stays on this device.'}),button('Create a resume',()=>newVersion(null),'resume-first-version')));result(null);return;}
    const index=versions.findIndex(row=>row.id===selected.id),parent=versions.find(row=>row.id===selected.parentId)??versions[index-1];
    main.append(el('div',{class:'section-title'},el('h2',{text:parent?`${parent.label} → ${selected.label}`:selected.label}),el('div',{class:'segmented'},button('Side by side',()=>{mode='side';paint();},'diff-side',{'aria-pressed':mode==='side'}),button('Inline',()=>{mode='inline';paint();},'diff-inline',{'aria-pressed':mode==='inline'}))));
    const diff=diffText(parent?.text??'',selected.text),panel=el('div',{class:`diff-panel diff-${mode}`});
    if(mode==='inline') diff.forEach(row=>panel.append(lineNode(row)));
    else {
      const before=el('div',{class:'diff-column','aria-label':'Previous resume version'}),after=el('div',{class:'diff-column','aria-label':'Selected resume version'});
      diff.forEach(row=>{if(row.type!=='added')before.append(lineNode(row));if(row.type!=='removed')after.append(lineNode(row));});panel.append(before,after);
    }
    main.append(panel);
    const before=reports.filter(report=>report.resumeVersionId===parent?.id),after=reports.filter(report=>report.resumeVersionId===selected.id),effect=matchingEffect(before,after);
    main.append(el('p',{class:'effect-callout',text:effect.jobs?`Effect on matching: median ${titleCase(effect.before)} → ${titleCase(effect.after)} across ${effect.jobs} common jobs.`:'Score this and the previous version against the same jobs to compare their effect.'}));
    const usage=status(selected);
    main.append(el('div',{class:'card actions'},el('span',{text:`${selected.label} was sent to ${usage.sent} jobs · ${usage.replies} replies`}),el('a',{href:`${basePath}app/tracker/`,'data-testid':'resume-view-tracker',text:'View in tracker'})));
    main.append(el('div',{class:'actions'},el('a',{href:`${basePath}app/parse/#resume=${encodeURIComponent(selected.id)}`,'data-testid':'resume-parse-check',class:'button',text:'Check parsing'}),button('Download JSON Resume',()=>download('resume.json',JSON.stringify(selected.jsonResume??jsonResumeFromText(selected.text),null,2)),'resume-export-json'),button('Download plain text',()=>download('resume.txt',selected.text,'text/plain'),'resume-export-text'),button('Use as default',async()=>{const preferences=(await store.setting('preferences')).value;await store.setSetting('preferences',{...preferences,defaultResumeVersionId:selected.id});announce('Default resume updated.');},'resume-set-default')));
    result({version:selected,diff,effect,usage});
  }
  const upload=el('input',{id:'resume-file',type:'file',accept:'.pdf,.docx,.txt,.json','data-testid':'resume-import',onchange:event=>uploadFile(event.target.files[0])});
  const uploader=el('details',{class:'view-inputs'},el('summary',{text:'Import PDF, DOCX, TXT or JSON Resume','data-testid':'resume-import-expand'}),field('Resume file','resume-file',upload));
  actions.append(shareLinkButton('resumes',()=>({resume:selected?.id??'',mode}),basePath),button('Copy JSON',async()=>{try{await navigator.clipboard.writeText(document.querySelector('#result-data').textContent);announce('Resume result JSON copied.');}catch{announce('Use Download JSON to save the result.');}},'resumes-copy-json',{class:'ghost'}),button('Download JSON',()=>download('waypost-resume-result.json',document.querySelector('#result-data').textContent),'resumes-download-json',{class:'ghost'}),button('Import resume',()=>{uploader.open=true;upload.focus();},'resume-import-open',{class:'ghost'}),button('New version',()=>newVersion(),'resume-new',{class:'primary'}));
  view.replaceChildren(uploader,layout);paint();
}
