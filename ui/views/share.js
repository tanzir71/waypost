import {applicationFields} from '../../core/tracker/index.js';
import {createScorer} from '../worker-client.js';
import {readLink,syncLink} from '../links.js';
import {el,button,field,result,announce,safeURL,dialog} from '../dom.js';
export async function renderShare({store,basePath,view,scorerFactory=createScorer}) {
  const query=new URLSearchParams(location.search),linked=readLink('share'),initial={...Object.fromEntries(['title','text','url'].map(key=>[key,query.get(key)??''])),...linked.state};
  if(location.search)history.replaceState(null,'',location.pathname+location.hash);
  const title=el('input',{id:'share-title',value:initial.title,maxLength:500,required:true,'data-testid':'share-title'}),company=el('input',{id:'share-company',value:initial.company??'',maxLength:500,'data-testid':'share-company'}),url=el('input',{id:'share-url',type:'url',value:initial.url,maxLength:4000,'data-testid':'share-url'}),text=el('textarea',{id:'share-text',rows:7,maxLength:100000,'data-testid':'share-text'});text.value=initial.text;
  let busy=false,modal;const versions=await store.all('resumeVersions'),resume=el('select',{id:'share-resume','data-testid':'share-resume'},el('option',{value:'',text:'Choose a resume to score'}),versions.map(row=>el('option',{value:row.id,text:row.label})));
  const fields=()=>({title:title.value,company:company.value,url:url.value,text:text.value});
  function prefill(){result({pendingJob:fields()});syncLink('share',fields(),{basePath});}
  const status=el('p',{role:'status','aria-live':'polite'}),buttons=el('div',{class:'actions'}),form=el('form',{class:'stack'},field('Title','share-title',title),field('Company (optional)','share-company',company),field('Link','share-url',url),field('Description','share-text',text),el('p',{class:'muted',text:'Paste the full description before scoring. A shared link alone is saved as a bookmark; Waypost does not fetch the page.'}),field('Resume version','share-resume',resume),buttons,status);
  async function save(score){if(busy||!form.reportValidity())return;
    const source=fields();if(source.url&&!safeURL(source.url)){status.textContent='Use an HTTP(S) job URL without credentials.';return;}if(!source.title.trim()){status.textContent='Give the job a title.';return;}if(score&&(!source.text.trim()||!resume.value)){status.textContent='Add the full description and choose a resume before scoring.';return;}
    busy=true;for(const control of buttons.children)control.disabled=true;
    try{const job=store.record({...source,title:source.title.trim(),url:safeURL(source.url)??'',source:'share-target'}),records={jobs:[job]};let reports=[],application;
      if(score){const scorer=scorerFactory();try{reports=(await scorer.score(versions.filter(row=>row.id===resume.value),[job])).map(row=>store.record(row));records.matchReports=reports;}finally{scorer.close();}}
      else{application=store.record(applicationFields(job,null,new Date().toISOString()));records.applications=[application];}
      await store.putMany(records);result({job,application:application??null,reports});form.replaceChildren(el('p',{text:score?'Job saved and scored.':'Job saved to Tracker.'}),el('a',{class:'button primary',href:`${basePath}app/${score?'match':'tracker'}/#${score?'job':'selected'}=${encodeURIComponent(score?job.id:application.id)}`,text:score?'Open Honest Match':'Open Tracker','data-testid':'share-open-saved'}));announce('Shared job saved.');
    }catch(error){status.textContent=error.message;}finally{busy=false;for(const control of buttons.children)control.disabled=false;}
  }
  buttons.append(button('Save to tracker',()=>save(false),'share-save-tracker'),button('Save & score',()=>save(true),'share-save-score',{class:'primary',disabled:!versions.length}));form.addEventListener('submit',event=>event.preventDefault());for(const control of [title,company,url,text])control.addEventListener('input',prefill);
  const open=()=>{modal=dialog('Add to Waypost',form);modal.classList.add('share-dialog');};view.replaceChildren(el('p',{class:'muted',text:'Review the shared details before saving.'}),button('Review shared job',open,'share-open-review'));prefill();open();
}
