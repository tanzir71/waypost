import {todaySummary} from '../../core/today/index.js';
import {el,button,result,announce,copyJSON,localDay} from '../dom.js';
import {tierBadge,titleCase} from '../components/match-report.js';
import {exportWorkspace} from '../workspace-export.js';
export async function renderToday({store,basePath,view,actions}) {
  const records=Object.fromEntries(await Promise.all(['jobs','applications','resumeVersions','matchReports','deadlines'].map(async type=>[type,await store.all(type)])));
  const now=new Date(),day=localDay(now);
  const summary=todaySummary(records,{now:now.toISOString(),day});
  const lastExport=(await store.setting('last-export'))?.value;
  document.querySelector('h1').textContent=now.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
  document.querySelector('.view-header .muted').textContent=`${summary.followups} follow-ups due · ${summary.deadlines} deadlines this week${lastExport?` · last export ${new Date(lastExport).toLocaleDateString()}`:''}`;
  const left=el('div',{class:'stack'}),right=el('aside',{class:'stack','aria-label':'Study and workspace'}),layout=el('div',{class:'today-layout'},left,right);
  const next=el('section',{class:'card stack today-next'},el('div',{class:'section-title'},el('h2',{text:'Next up'}),el('span',{class:'wp-num',text:summary.next.length})));
  for(const item of summary.next) {
    const href=item.type==='knockout'?`app/match/#job=${encodeURIComponent(item.jobId)}&resume=${encodeURIComponent(item.resumeVersionId)}`:item.type==='deadline'?`app/deadlines/#id=${encodeURIComponent(item.deadlineId)}`:`app/tracker/#selected=${encodeURIComponent(item.applicationId)}&edit=1`;
    const icon=item.type==='followup'?'bell':item.type==='deadline'?'calendar-reminder':item.type==='interview'?'message-reminder':'alert-reminder';
    next.append(el('article',{class:'next-row','data-testid':'next-up-row','data-record-id':item.id},el('span',{class:'next-icon'},el('img',{src:`${basePath}assets/icons/${icon}.svg`,width:18,height:18,alt:'','aria-hidden':true})),el('div',{class:'next-copy'},el('h3',{text:item.title}),el('p',{class:'muted',text:[item.detail,item.at.slice(0,10)].filter(Boolean).join(' · ')})),el('a',{class:'button small',href:basePath+href,text:item.type==='knockout'?'Answer':item.type==='interview'?'Prepare':'Open','aria-label':`${item.type==='knockout'?'Answer':'Open'} ${item.title}`,'data-testid':'next-up-action'})));
  }
  if(!summary.next.length)next.append(el('p',{class:'muted',text:'Nothing due right now. Add applications and next steps in Tracker to keep your next actions here.'}));
  left.append(next);
  const pipeline=el('section',{class:'card stack today-pipeline'},el('div',{class:'section-title'},el('h2',{text:'Pipeline'}),el('span',{class:'evidence',text:'last 30 days'})));
  const table=el('table',{},el('caption',{class:'sr-only',text:'Applications by current stage, updated in the last 30 days'}),el('thead',{class:'sr-only'},el('tr',{},el('th',{scope:'col',text:'Stage'}),el('th',{scope:'col',text:'Applications'}))),el('tbody'));
  const total=summary.pipeline.reduce((sum,row)=>sum+row.count,0);
  for(const row of summary.pipeline)table.tBodies[0].append(el('tr',{'data-testid':'pipeline-row'},el('th',{scope:'row',text:titleCase(row.stage)}),el('td',{},el('meter',{min:0,max:Math.max(total,1),value:row.count,'aria-label':`${titleCase(row.stage)}: ${row.count} applications`}),el('span',{class:'wp-num',text:row.count}))));
  pipeline.append(table);
  const rates=el('table',{},el('caption',{class:'muted',text:'Response rate by resume'}),el('thead',{},el('tr',{},el('th',{scope:'col',text:'Version'}),el('th',{scope:'col',text:'Replies / sent'}),el('th',{scope:'col',text:'Rate'}))),el('tbody'));
  for(const row of summary.responseRates)rates.tBodies[0].append(el('tr',{'data-testid':'response-rate-row'},el('th',{scope:'row',text:row.label}),el('td',{class:'wp-num',text:`${row.replies} / ${row.sent}`}),el('td',{class:'wp-num',text:row.rate===null?'Not sent':`${Math.round(row.rate*100)}%`})));
  pipeline.append(rates);left.append(pipeline);
  const study=el('section',{class:'card stack today-study'},el('h2',{text:'Study'})),gpa=(await store.setting('gpa-result'))?.value;
  if(gpa)study.append(el('dl',{class:'study-values'},['current','target','needed'].map(key=>el('div',{},el('dt',{text:titleCase(key)}),el('dd',{class:'wp-num',text:Number(gpa[key]).toFixed(2)})))));
  else study.append(el('p',{class:'muted',text:'Your saved GPA target will appear here when you plan it.'}));
  study.append(el('a',{href:`${basePath}app/gpa/`,'data-testid':'today-gpa',text:'Open GPA planner'}));right.append(study);
  const best=el('section',{class:'card stack today-best'},el('h2',{text:'Best matches this week'}));
  for(const report of summary.bestMatches) {
    const job=records.jobs.find(row=>row.id===report.jobId);
    best.append(el('a',{class:'best-match-row',href:`${basePath}app/match/#job=${encodeURIComponent(report.jobId)}&resume=${encodeURIComponent(report.resumeVersionId)}`,'data-testid':'today-match'},el('span',{},el('strong',{text:job.title}),el('small',{text:job.company??''})),tierBadge(report.tier)));
  }
  if(!summary.bestMatches.length)best.append(el('p',{class:'muted',text:'Score saved jobs to see your strongest recent matches.'}));right.append(best);
  const workspace=el('section',{class:'card stack today-workspace'},el('h2',{text:'Workspace'}),el('span',{class:'status-pill',text:window.WAYPOST_CONFIG.mode==='demo'?'Demo':'Local · not synced'}));
  try {
    const [usage,persistent]=await Promise.all([navigator.storage?.estimate?.(),navigator.storage?.persisted?.()]);
    workspace.append(el('p',{class:'muted',text:`Stored in this browser (IndexedDB${persistent?', persistent':''}). ${usage?.usage!==undefined?`${(usage.usage/1024/1024).toFixed(1)} MB used.`:'Storage estimate unavailable.'}`}));
  }catch{workspace.append(el('p',{class:'muted',text:'Stored in this browser. Storage estimates are unavailable.'}));}
  workspace.append(el('div',{class:'actions'},button('Export JSON',()=>exportWorkspace(store).catch(error=>announce(error.message)),'export-button'),...(window.WAYPOST_CONFIG.mode==='demo'?[]:[el('a',{href:`${basePath}app/setup/`,text:'Set up sync','data-testid':'today-setup'})])));right.append(workspace);
  actions.append(el('a',{class:'button ghost small',href:`${basePath}app/import/`,text:'Import clipper file','data-testid':'today-import'}),el('a',{class:'button primary small',href:`${basePath}app/match/#import=1`,text:'Paste a job','data-testid':'today-paste'}),button('Copy JSON',()=>copyJSON(summary),'today-copy',{class:'small'}));
  view.replaceChildren(layout);result(summary);
}
