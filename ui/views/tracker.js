import {stages,applicationFields,moveApplication,updateApplication,sortApplications,followupApplications} from '../../core/tracker/index.js';
import {el,button,field,result,announce,dialog,safeURL,download,copyJSON,localDay} from '../dom.js';
import {tierBadge,titleCase} from '../components/match-report.js';
export async function renderTracker({store,basePath,view,actions}) {
  let jobs=await store.all('jobs'),applications=await store.all('applications');
  const versions=await store.all('resumeVersions'),contacts=await store.all('contacts'),reports=await store.all('matchReports');
  const params=new URLSearchParams(location.hash.slice(1));
  let mode=params.get('view')==='table'?'table':'board',selectedId=params.get('selected'),filter=stages.includes(params.get('stage'))?params.get('stage'):'all',sort={key:'updatedAt',direction:'desc'};
  const output=el('div'),filterSelect=el('select',{id:'tracker-filter','data-testid':'tracker-filter'},el('option',{value:'all',text:'All stages',selected:filter==='all'}),stages.map(stage=>el('option',{value:stage,text:titleCase(stage),selected:stage===filter})));
  const titleFor=app=>{const job=jobs.find(row=>row.id===app.jobId);return `${job?.title??'Saved role'} at ${job?.company||'company not provided'}`;};
  const fragment=()=>history.replaceState(null,'',`#view=${mode}&stage=${filter}${selectedId?`&selected=${encodeURIComponent(selectedId)}`:''}`);
  async function reload(){jobs=await store.all('jobs');applications=await store.all('applications');paint();}
  async function move(app,stage){try{const next=moveApplication(app,stage,new Date().toISOString());await store.save('applications',next);selectedId=app.id;await reload();fragment();document.getElementById(`move-${app.id}`)?.focus();announce(`${titleFor(next)} moved to ${titleCase(stage)}.`);}catch(error){announce(error.message);}}
  function moveMenu(app) {
    const id=`move-${app.id}`;
    const select=el('select',{id,'data-testid':'move-to-menu','aria-label':`Move ${titleFor(app)} to a stage`},stages.map(stage=>el('option',{value:stage,text:`Move to ${titleCase(stage)}`,selected:stage===app.stage})));
    select.addEventListener('change',()=>move(app,select.value));return select;
  }
  function edit(app=null,initialStage='saved') {
    const job=jobs.find(row=>row.id===app?.jobId),token=app?.id??crypto.randomUUID();
    const controls={
      title:el('input',{id:`title-${token}`,value:job?.title??params.get('title')??'',required:true,'data-testid':'tracker-input-title'}),
      company:el('input',{id:`company-${token}`,value:job?.company??params.get('company')??'','data-testid':'tracker-input-company'}),
      url:el('input',{id:`url-${token}`,type:'url',value:job?.url??params.get('url')??'','data-testid':'tracker-input-url'}),
      text:el('textarea',{id:`text-${token}`,rows:5,'data-testid':'tracker-input-description'},job?.text??''),
      stage:el('select',{id:`stage-${token}`,'data-testid':'tracker-input-stage'},stages.map(stage=>el('option',{value:stage,text:titleCase(stage),selected:stage===(app?.stage??initialStage)}))),
      resume:el('select',{id:`resume-${token}`,'data-testid':'tracker-input-resume'},el('option',{value:'',text:'No resume selected'}),versions.map(version=>el('option',{value:version.id,text:version.label,selected:version.id===app?.resumeVersionId}))),
      applied:el('input',{id:`applied-${token}`,type:'date',value:app?.appliedAt??'','data-testid':'tracker-input-applied'}),
      next:el('input',{id:`next-${token}`,value:app?.next?.label??'','data-testid':'tracker-input-next'}),
      at:el('input',{id:`at-${token}`,type:'datetime-local',value:app?.next?.at?localDateTime(app.next.at):'','data-testid':'tracker-input-next-at'}),
      notes:el('textarea',{id:`notes-${token}`,rows:4,'data-testid':'tracker-input-notes'},app?.notes??'')
    };
    const form=el('form',{class:'stack'},Object.entries({title:'Role',company:'Company',url:'Job link',text:'Job description',stage:'Stage',resume:'Resume version used',applied:'Applied on',next:'Next step',at:'Next step date and time',notes:'Notes'}).map(([key,label])=>field(label,controls[key].id,controls[key])));
    const contactGroup=el('fieldset',{},el('legend',{text:'Contacts'}));
    for(const contact of contacts){const id=`contact-${token}-${contact.id}`;contactGroup.append(el('div',{class:'checkbox-field'},el('input',{id,type:'checkbox',value:contact.id,checked:app?.contactIds?.includes(contact.id),'data-testid':'tracker-contact'}),el('label',{for:id,text:`${contact.name} · ${contact.company??''}`})));}
    if(!contacts.length)contactGroup.append(el('p',{class:'muted',text:'Saved contacts will be available here.'}));form.append(contactGroup);
    if(app?.history?.length)form.append(el('details',{},el('summary',{text:'History','data-testid':'tracker-history-open'}),el('ol',{class:'history-list'},app.history.map(event=>el('li',{'data-testid':'history-row',text:`${new Date(event.at).toLocaleString()} · ${event.event}`})))));
    const message=el('p',{role:'status','aria-live':'polite'}),save=el('button',{type:'submit',class:'primary',text:app?'Save changes':'Save application','data-testid':'tracker-save'});form.append(message,save);
    const modal=dialog(app?'Application details':'Add job',form);
    form.addEventListener('submit',async event=>{
      event.preventDefault();save.disabled=true;
      try {
        if(!controls.title.value.trim())throw new Error('Enter a role title.');
        const url=controls.url.value.trim();if(url&&!safeURL(url))throw new Error('Use an HTTP or HTTPS job link.');
        if(Boolean(controls.next.value.trim())!==Boolean(controls.at.value))throw new Error('Give the next step both a label and a date.');
        const now=new Date().toISOString();
        const savedJob=store.record({...job,title:controls.title.value.trim(),company:controls.company.value.trim(),url,text:controls.text.value,source:job?.source??'paste',sample:false});
        let savedApp=app??applicationFields(savedJob,controls.resume.value||null,now);
        savedApp=moveApplication(savedApp,controls.stage.value,now);
        savedApp=updateApplication(savedApp,{resumeVersionId:controls.resume.value||null,appliedAt:controls.applied.value||savedApp.appliedAt,next:controls.next.value.trim()?{label:controls.next.value.trim(),at:new Date(controls.at.value).toISOString()}:null,notes:controls.notes.value,contactIds:[...form.querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value)},now);
        savedApp=store.record({...savedApp,sample:false});
        await store.putMany({jobs:[savedJob],applications:[savedApp]});selectedId=savedApp.id;modal.close();await reload();fragment();announce('Application saved on this device.');
      }catch(error){message.textContent=error.message;save.disabled=false;}
    });
  }
  function card(app) {
    const job=jobs.find(row=>row.id===app.jobId),version=versions.find(row=>row.id===app.resumeVersionId),report=reports.find(row=>row.jobId===app.jobId&&row.resumeVersionId===app.resumeVersionId);
    const node=el('article',{class:`tracker-card${app.id===selectedId?' selected':''}`,tabindex:0,'aria-label':titleFor(app),'data-testid':'tracker-card','data-stage':app.stage,'data-job-id':app.jobId,'data-application-id':app.id});
    const choose=()=>{selectedId=app.id;fragment();};node.addEventListener('focus',choose);node.addEventListener('click',choose);
    node.append(el('div',{class:'stack'},el('p',{text:job?.company||'Company not provided'}),button(job?.title??'Saved role',()=>edit(app),'tracker-open',{class:'tracker-title','aria-label':`Open application for ${titleFor(app)}`})),el('div',{class:'tracker-meta'},el('span',{class:'evidence',text:version?.label??'No resume selected'}),report?tierBadge(report.tier):el('span',{class:'stage-tag',text:'Not scored'})));
    if(app.next)node.append(el('p',{class:'evidence',text:`${app.next.label} · ${new Date(app.next.at).toLocaleDateString()}`}));
    node.append(moveMenu(app));return node;
  }
  function paint() {
    output.replaceChildren();
    const visible=applications.filter(app=>filter==='all'||app.stage===filter);
    document.querySelector('.view-header .muted').textContent=`${applications.length} applications · ${followupApplications(applications,localDay()).length} follow-ups due · captured jobs arrive from the clipper`;
    if(mode==='board') {
      const board=el('div',{class:'tracker-board','aria-label':'Application board'});
      for(const stage of stages) {
        const rows=visible.filter(app=>app.stage===stage);
        const heading=el('div',{class:'section-title'},el('h2',{text:`${titleCase(stage)} ${rows.length}`}),button('+',()=>edit(null,stage),`add-${stage}`,{class:'ghost small','aria-label':`Add a job to ${titleCase(stage)}`}));
        const section=el('section',{class:'tracker-column','aria-label':titleCase(stage)},heading,rows.map(card));
        if(stage==='closed')board.append(el('details',{class:'closed-column',open:filter==='closed'||rows.some(row=>row.id===selectedId)},el('summary',{text:`Closed ${rows.length}`,'data-testid':'tracker-closed-open'}),section));else board.append(section);
      }
      output.append(board);
    } else {
      const table=el('table',{'data-testid':'tracker-table'},el('caption',{class:'sr-only',text:'Applications with sortable columns'})),head=el('tr');
      for(const [key,label]of [['company','Company'],['title','Role'],['stage','Stage'],['nextAt','Next step'],['updatedAt','Updated']])head.append(el('th',{scope:'col','aria-sort':sort.key===key?(sort.direction==='asc'?'ascending':'descending'):'none'},button(label,()=>{sort={key,direction:sort.key===key&&sort.direction==='asc'?'desc':'asc'};paint();},`sort-${key}`,{class:'ghost small','aria-label':`Sort applications by ${label.toLowerCase()}`})));
      head.append(el('th',{scope:'col',text:'Actions'}));table.append(el('thead',{},head));const body=el('tbody');
      for(const app of sortApplications(visible,jobs,sort)) {const job=jobs.find(row=>row.id===app.jobId);body.append(el('tr',{'data-testid':'tracker-row','data-application-id':app.id},el('td',{text:job?.company??''}),el('th',{scope:'row'},button(job?.title??'Saved role',()=>edit(app),'tracker-table-open',{class:'ghost small'})),el('td',{text:titleCase(app.stage)}),el('td',{text:app.next?`${app.next.label} · ${new Date(app.next.at).toLocaleString()}`:'—'}),el('td',{text:new Date(app.updatedAt).toLocaleDateString()}),el('td',{},moveMenu(app))));}
      table.append(body);output.append(el('div',{class:'table-scroll',tabindex:0,role:'region','aria-label':'Application table'},table));
    }
    if(!applications.length)output.append(el('p',{class:'muted',text:'Save your first job, then keep its next action here.'}));
    result({applications:visible,jobs,view:mode,filter,sort});
  }
  const boardButton=button('Board',()=>{mode='board';boardButton.setAttribute('aria-pressed','true');tableButton.setAttribute('aria-pressed','false');fragment();paint();},'tracker-board',{'aria-pressed':mode==='board'});
  const tableButton=button('Table',()=>{mode='table';boardButton.setAttribute('aria-pressed','false');tableButton.setAttribute('aria-pressed','true');fragment();paint();},'tracker-table-view',{'aria-pressed':mode==='table'});
  filterSelect.addEventListener('change',()=>{filter=filterSelect.value;fragment();paint();});
  actions.append(el('div',{class:'segmented'},boardButton,tableButton),field('Filter stage','tracker-filter',filterSelect),button('Add job',()=>edit(),'tracker-add',{class:'primary small'}),button('Copy JSON',()=>copyJSON({jobs,applications}),'tracker-copy',{class:'small'}),button('Download JSON',()=>download('waypost-applications.json',JSON.stringify({jobs,applications},null,2)),'tracker-download',{class:'small'}));
  const keyboard=event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,[contenteditable="true"],dialog'))return;
    if(event.key.toLowerCase()==='n'){event.preventDefault();edit();}
    if(event.key.toLowerCase()==='m'&&selectedId){event.preventDefault();document.getElementById(`move-${selectedId}`)?.focus();}
  };
  document.addEventListener('keydown',keyboard);window.addEventListener('pagehide',()=>document.removeEventListener('keydown',keyboard),{once:true});
  view.replaceChildren(output,el('p',{class:'keyboard-hint'},el('kbd',{text:'N'}),' New job · ',el('kbd',{text:'M'}),' Move selected card · Every card has a Move to control.'));paint();
  if(params.get('add')==='1')edit();else if(params.get('edit')==='1'&&selectedId){const app=applications.find(row=>row.id===selectedId);if(app)edit(app);}
}
function localDateTime(value) {const date=new Date(value);return new Date(date.valueOf()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
