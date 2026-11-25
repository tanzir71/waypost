import {parseImportedJobs} from '../../core/scoring.js';
import {applicationFields} from '../../core/tracker/index.js';
import {createScorer} from '../worker-client.js';
import {el,button,field,result,announce,download,copyJSON,safeURL,dialog} from '../dom.js';
import {readLink,syncLink,shareLinkButton} from '../links.js';
import {tierBadge,requirementRow,titleCase} from '../components/match-report.js';
const tierOrder=['strong','good','partial','limited'];
const reportOrder=(a,b)=>tierOrder.indexOf(a.tier)-tierOrder.indexOf(b.tier)||b.requiredScore-a.requiredScore||b.preferredBonus-a.preferredBonus;
export async function renderMatch({store,basePath,view,actions,scorerFactory=createScorer}) {
  let jobs=(await store.all('jobs')).sort((a,b)=>(a.seedOrder??Number.MAX_SAFE_INTEGER)-(b.seedOrder??Number.MAX_SAFE_INTEGER)||a.createdAt.localeCompare(b.createdAt)),versions=(await store.all('resumeVersions')).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)),reports=await store.all('matchReports');
  const preferences=(await store.setting('preferences')).value,linked=readLink('match');
  if(linked.state.jdText)jobs=[{id:'link-job',title:linked.state.jdText.split('\n')[0]||'Shared job description',text:linked.state.jdText,source:'deep-link',_ephemeral:true}];
  if(linked.state.resumeText)versions=[{id:'link-resume',label:'Unsaved link resume',text:linked.state.resumeText,_ephemeral:true}];
  let selectedJob=linked.invalid?null:jobs.find(job=>job.id===linked.state.job)??(!linked.state.job?jobs[0]:null);
  let selectedResume=versions.find(version=>version.id===preferences.defaultResumeVersionId)??versions.at(-1);
  let filter='all',busy=false,lastElapsed;
  const scorer=scorerFactory();window.addEventListener('pagehide',()=>scorer.close(),{once:true});
  const list=el('aside',{class:'job-list','aria-label':'Jobs'}),main=el('section',{class:'match-report','aria-label':'Requirement evidence'}),rail=el('aside',{class:'checks-rail','aria-label':'Match checks'});
  const layout=el('div',{class:'match-layout'},list,main,rail);
  const scoreButton=button('',score,'score-button',{class:'primary small'});
  const currentReport=()=>reports.find(report=>report.jobId===selectedJob?.id&&report.resumeVersionId===selectedResume?.id);
  const bestReport=job=>reports.filter(report=>report.jobId===job.id).sort(reportOrder)[0];
  const linkState=()=>({...(!selectedJob?{}:selectedJob._ephemeral?{jdText:selectedJob.text}:{job:selectedJob.id}),...(!selectedResume?{}:selectedResume._ephemeral?{resumeText:selectedResume.text}:{resume:selectedResume.id})});
  const syncFragment=()=>syncLink('match',linkState(),{basePath});
  function updateCount(elapsed=lastElapsed) {
    lastElapsed=elapsed;
    document.querySelector('.view-header .muted').textContent=`${jobs.length} jobs · ${versions.length} resume versions${elapsed!==undefined?` · scored on this device in ${Math.round(elapsed)} ms`:''}`;
    scoreButton.textContent=busy?'Scoring…':`Score ${jobs.length} jobs`;scoreButton.disabled=busy||!jobs.length||!versions.length;
  }
  async function score({persist=true}={}) {
    if(busy||!jobs.length||!versions.length) return;
    busy=true;updateCount();const start=performance.now();
    try {
      const computed=await scorer.score(versions,jobs);
      const previous=new Map(reports.map(report=>[`${report.jobId}:${report.resumeVersionId}`,report]));
      reports=computed.map(report=>store.record({...previous.get(`${report.jobId}:${report.resumeVersionId}`),...report,sample:Boolean(jobs.find(job=>job.id===report.jobId)?.sample&&versions.find(version=>version.id===report.resumeVersionId)?.sample)}));
      if(persist)await store.putMany({matchReports:reports.filter(row=>!jobs.find(job=>job.id===row.jobId)?._ephemeral&&!versions.find(version=>version.id===row.resumeVersionId)?._ephemeral)});
      const best=[...reports].sort(reportOrder)[0];
      announce(`Scoring complete: ${jobs.length} jobs, best match ${titleCase(best?.tier??'limited')}.`);
      lastElapsed=performance.now()-start;
    } catch(error){announce(error.message);} finally {busy=false;paint();}
  }
  async function importText(text,source) {
    if(text.length>5*1024*1024) throw new Error('Import a job file smaller than 5 MB.');
    if(/^[\[{]/.test(text.trim())) {
      const data=JSON.parse(text);const rows=Array.isArray(data)?data:data.jobs;
      if(!Array.isArray(rows)||rows.some(job=>!job||typeof(job.text??job.description)!=='string')) throw new Error('Choose a JSON job export with text or description for each job.');
    }
    const imported=parseImportedJobs(text,source);
    if(!imported.length) throw new Error('No job descriptions were found.');
    if(imported.length+jobs.length>1000) throw new Error('Keep at most 1,000 jobs in a scoring batch.');
    const rows=imported.map(job=>store.record({title:job.title,text:job.text,company:job.company??'',url:safeURL(job.url)??'',source:source==='paste'?'paste':'file'}));
    await store.putMany({jobs:rows});jobs.push(...rows);selectedJob=rows[0];paint();announce(`${rows.length} jobs imported. Choose Score ${jobs.length} jobs to compare all versions.`);
  }
  function importDialog() {
    if(busy) {announce('Scoring is in progress. Import jobs after it completes.');return;}
    const paste=el('textarea',{id:'jobs-paste',rows:12,required:true,'data-testid':'job-import-text'});
    const upload=el('input',{id:'jobs-file',type:'file',accept:'.txt,.json','data-testid':'job-import-file'});
    const form=el('form',{class:'stack'},el('p',{class:'muted',text:'Paste one or more descriptions separated by a line containing ---. Or choose a Clipper TXT/JSON export.'}),field('Job descriptions','jobs-paste',paste),field('Import job file','jobs-file',upload),el('button',{type:'submit',class:'primary',text:'Import jobs','data-testid':'job-import-submit'}));
    const modal=dialog('Import jobs',form);
    form.addEventListener('submit',async event=>{event.preventDefault();try{await importText(paste.value,'paste');modal.close();}catch(error){announce(error.message);}});
    upload.addEventListener('change',async()=>{const file=upload.files[0];if(!file)return;try{if(file.size>5*1024*1024)throw new Error('Use a job file smaller than 5 MB.');await importText(await file.text(),'file');modal.close();}catch(error){announce(error.message);}});
  }
  function addToTracker() {
    if(!selectedJob)return;
    const job=selectedJob,resume=selectedResume;
    const form=el('div',{class:'stack'},el('p',{text:`Save ${job.title} at ${job.company||'this company'} to the Saved stage with ${resume?._ephemeral?'no saved resume (link text stays unsaved)':resume?.label??'no resume selected'}?`}),button('Save application',async()=>{
      try {let savedJob=job;if(job._ephemeral){const {id,_ephemeral,...data}=job;savedJob=store.record(data);}const application=store.record(applicationFields(savedJob,resume?._ephemeral?null:resume?.id,new Date().toISOString()));await store.putMany({...(job._ephemeral?{jobs:[savedJob]}:{}),applications:[application]});modal.close();announce('Application saved to your tracker.');}catch(error){announce(error.message);}
    },'tracker-confirm-add',{class:'primary'}));const modal=dialog('Add to tracker',form);
  }
  function paint() {
    list.replaceChildren();main.replaceChildren();rail.replaceChildren();updateCount();
    const filters=el('div',{class:'filter-chips','aria-label':'Filter jobs by match tier'});
    for(const tier of ['all',...tierOrder]) {
      const count=tier==='all'?jobs.length:jobs.filter(job=>bestReport(job)?.tier===tier).length;
      filters.append(button(`${titleCase(tier)} ${count}`,()=>{filter=tier;paint();},`filter-${tier}`,{'aria-pressed':filter===tier,class:'small'}));
    }
    list.append(filters);
    for(const job of jobs.filter(job=>filter==='all'||bestReport(job)?.tier===filter)) {
      const best=bestReport(job),version=versions.find(row=>row.id===best?.resumeVersionId);
      const row=button('',()=>{selectedJob=job;selectedResume=versions.find(row=>row.id===best?.resumeVersionId)??selectedResume;syncFragment();paint();},'job-row',{class:'job-row','data-job-id':job.id,'data-tier':best?.tier??'unscored','aria-pressed':job.id===selectedJob?.id});
      row.append(el('span',{class:`tier-dot ${best?`dot-${best.tier}`:''}`,'aria-hidden':true}),el('span',{class:'job-row-text'},el('span',{text:job.title}),el('small',{text:`${job.company||'Company not provided'} · ${version?`best ${version.label}`:'not scored'}`})));list.append(row);
    }
    if(!jobs.length)list.append(el('p',{class:'muted',text:'Import a job description to start.'}));
    if(!selectedJob||!selectedResume) {
      main.append(el('div',{class:'empty-state'},el('h2',{text:!selectedResume?'Add a resume first':'Choose a job to compare'}),el('p',{text:'Keep resume versions in Resumes and import the jobs you want to compare.'}),el('a',{class:'button',href:`${basePath}app/resumes/`,text:'Open Resumes','data-testid':'match-add-resume'})));
      result(null);return;
    }
    const report=currentReport();
    const heading=el('div',{class:'section-title'},el('div',{},el('h2',{text:selectedJob.title}),el('p',{class:'muted',text:[selectedJob.company,selectedJob.location].filter(Boolean).join(' · ')})),report?tierBadge(report.tier):el('span',{class:'stage-tag',text:'Not scored'}));
    main.append(heading);
    const link=safeURL(selectedJob.url);if(link)main.append(el('a',{href:link,text:'Open original job','data-testid':'job-source-link',rel:'noopener noreferrer',target:'_blank'}));
    const tabs=el('div',{class:'version-tabs',role:'tablist','aria-label':'Resume versions'});
    versions.forEach(version=>{
      const versionReport=reports.find(row=>row.jobId===selectedJob.id&&row.resumeVersionId===version.id);
      const tab=button('',()=>{selectedResume=version;syncFragment();paint();},'resume-tab',{id:`resume-tab-${version.id}`,role:'tab','aria-selected':version.id===selectedResume.id,'aria-controls':'selected-match-report',tabindex:version.id===selectedResume.id?0:-1});
      tab.append(el('span',{class:`tier-dot dot-${versionReport?.tier??'unscored'}`,'aria-hidden':true}),el('span',{text:version.label}));tabs.append(tab);
    });
    tabs.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();let index=versions.findIndex(row=>row.id===selectedResume.id);index=event.key==='Home'?0:event.key==='End'?versions.length-1:(index+(event.key==='ArrowRight'?1:-1)+versions.length)%versions.length;selectedResume=versions[index];syncFragment();paint();document.querySelector(`#resume-tab-${selectedResume.id}`)?.focus();});
    main.append(tabs);
    if(!report){main.append(el('p',{class:'muted',text:`Choose Score ${jobs.length} jobs to compare every resume version.`}));result(null);return;}
    const panel=el('div',{id:'selected-match-report',role:'tabpanel','aria-labelledby':`resume-tab-${selectedResume.id}`,class:'stack'});
    for(const kind of ['required','preferred']) {
      const rows=report[kind];panel.append(el('div',{class:'requirement-heading'},el('h3',{class:'eyebrow',text:titleCase(kind)}),el('span',{class:'evidence',text:`${rows.filter(row=>row.status==='met').length} of ${rows.length} met`})),el('div',{class:'requirement-list'},rows.map(row=>requirementRow(row,basePath))));
    }
    main.append(panel);
    const checks=report.checks,checkCard=el('section',{class:'card stack'},el('h2',{text:'Checks'}));
    const table=el('table',{},el('caption',{class:'sr-only',text:'Matching checks'}),el('thead',{class:'sr-only'},el('tr',{},el('th',{scope:'col',text:'Check'}),el('th',{scope:'col',text:'Evidence'}))));
    const body=el('tbody');
    for(const [label,value] of [['Coverage',titleCase(checks.coverage)],['Title',titleCase(checks.title)],['Years',`${checks.years.found} / ${checks.years.asked??'not specified'}`],['Quantified bullets',`${checks.quantified.withNumbers} of ${checks.quantified.bullets}`],['Parse',titleCase(checks.parse)],['Keyword coverage (secondary)',`${checks.keywordCoverage}%`]]) body.append(el('tr',{'data-testid':'match-check-row'},el('th',{scope:'row',text:label}),el('td',{class:'wp-num',text:value})));
    table.append(body);checkCard.append(table);rail.append(checkCard);
    if(report.clusterGaps.length) {
      const gaps=el('section',{class:'card stack'},el('h2',{text:`Across ${report.clusterJobCount} similar jobs`}));
      const gapTable=el('table',{},el('caption',{class:'muted',text:'Skills absent from this resume, ranked by frequency'}),el('thead',{},el('tr',{},el('th',{scope:'col',text:'Skill'}),el('th',{scope:'col',text:'Jobs'}))));
      const tbody=el('tbody');
      for(const gap of report.clusterGaps.slice(0,8)) tbody.append(el('tr',{'data-testid':'cluster-gap-row'},el('th',{scope:'row',text:gap.term}),el('td',{},el('meter',{min:0,max:gap.of,value:gap.count,'aria-label':`${gap.term}: ${gap.count} of ${gap.of} jobs`}),el('span',{class:'evidence',text:` ${gap.count}/${gap.of}`}))));
      gapTable.append(tbody);gaps.append(gapTable);rail.append(gaps);
    }
    const knockouts=el('section',{class:'card stack knockout-panel'},el('h2',{text:'Knockouts to answer'}));
    if(!report.knockouts.length)knockouts.append(el('p',{text:'No knockout questions detected in this posting. Review the application separately.'}));
    report.knockouts.forEach(knockout=>{
      const id=`knockout-${selectedJob.id}-${encodeURIComponent(knockout.question)}`;
      const select=el('select',{id,'data-testid':'knockout-answer'},el('option',{value:'',text:'Not answered',selected:knockout.answered===null}),el('option',{value:'yes',text:'Requirement satisfied',selected:knockout.answered===true}),el('option',{value:'no',text:'Requirement not satisfied',selected:knockout.answered===false}));
      select.addEventListener('change',async()=>{try{const patch={...selectedJob,knockoutAnswers:{...selectedJob.knockoutAnswers,[knockout.question]:select.value===''?null:select.value==='yes'}};selectedJob=selectedJob._ephemeral?patch:await store.save('jobs',patch);jobs=jobs.map(job=>job.id===selectedJob.id?selectedJob:job);await score({persist:!selectedJob._ephemeral});}catch(error){announce(error.message);}});
      knockouts.append(field(knockout.question,id,select));
    });
    rail.append(knockouts);
    report.stuffingWarnings.forEach(warning=>rail.append(el('p',{class:'warning-callout',text:warning})));
    rail.append(el('a',{class:'button',href:`${basePath}app/letters/#job=${encodeURIComponent(selectedJob.id)}&resume=${encodeURIComponent(selectedResume.id)}`,text:'Draft letter from this report','data-testid':'draft-letter'}),button('Add to tracker',addToTracker,'add-to-tracker',{class:'ghost'}));
    result(report);
  }
  const fragment=new URLSearchParams(location.hash.slice(1));selectedResume=versions.find(row=>row.id===linked.state.resume||row.label===linked.state.resume)??(!linked.state.resume?selectedResume:null);
  actions.append(shareLinkButton('match',linkState,basePath),button('Import jobs',importDialog,'import-jobs',{class:'ghost small'}),button('Copy JSON',()=>currentReport()&&copyJSON(currentReport()),'copy-json',{class:'small'}),button('Download JSON',()=>currentReport()&&download('waypost-match.json',JSON.stringify(currentReport(),null,2)),'download-json',{class:'small'}),scoreButton);
  view.replaceChildren(layout);paint();
  if(linked.state.import)importDialog();
  if(linked.autorun)await score({persist:false});
}
