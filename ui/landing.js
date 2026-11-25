import { matchResume,summarizeReport } from '../core/match/index.js';
import { renderMatchReport } from './components/match-report.js';

const basePath=window.WAYPOST_CONFIG.basePath;
const form=document.querySelector('#hero-match');
const input=document.querySelector('#hero-jd');
const select=document.querySelector('#hero-resume');
const upload=document.querySelector('#hero-file');
const announce=document.querySelector('#hero-announcement');
const submit=document.querySelector('#hero-match-button');
let sample,resume,lastReport;
function compute() {
  const text=input.value.trim();
  if(!text) { input.setCustomValidity('Paste a job description to match.'); input.reportValidity(); return; }
  input.setCustomValidity('');
  lastReport=matchResume(resume,{id:'hero-job',title:text.split('\n')[0],text});
  document.querySelector('#result-data').textContent=JSON.stringify(lastReport);
  renderMatchReport(document.querySelector('#hero-result'),lastReport,basePath,{preview:true});
  const counts=summarizeReport(lastReport);
  announce.textContent=`Matching complete: ${lastReport.tier}. ${counts.met} of ${counts.total} requirements met.`;
  document.querySelector('#hero-copy').disabled=false;
  document.querySelector('#hero-download').disabled=false;
}
try {
  const response=await fetch(`${basePath}data/demo.json`);
  if(!response.ok) throw new Error('The sample could not be loaded. Reload to try again.');
  sample=await response.json();
  resume=sample.resumeVersions[0];
  input.value ||= sample.jobs[0].text;
  submit.disabled=false;
  compute();
} catch(error) { announce.textContent=error.message; }
input.addEventListener('input',()=>input.setCustomValidity(''));
form.addEventListener('submit',event=>{event.preventDefault();compute();});
select.addEventListener('change',()=>{
  if(select.value==='upload') { document.querySelector('#hero-upload-field').hidden=false;submit.disabled=true;upload.focus(); }
  else { document.querySelector('#hero-upload-field').hidden=true;resume=sample.resumeVersions[0];submit.disabled=false; }
});
upload.addEventListener('change',async()=>{
  try {
    const file=upload.files[0];
    if(!file) return;
    if(file.size>2*1024*1024) throw new Error('Use a text resume smaller than 2 MB.');
    const text=await file.text();
    if(!text.trim()) throw new Error('The resume is empty. Choose a text file with your resume content.');
    resume={id:'uploaded-hero-resume',label:file.name,text};
    submit.disabled=false;
    const option=select.querySelector('[value="upload"]');option.textContent=file.name;
    announce.textContent=`${file.name} is ready. Select Match to compare.`;
  } catch(error) { submit.disabled=true;announce.textContent=error.message; }
});
document.querySelector('#hero-sample').addEventListener('click',()=>{
  if(!sample) return;
  input.value=sample.jobs[0].text;select.value='sample';resume=sample.resumeVersions[0];
  submit.disabled=false;
  document.querySelector('#hero-upload-field').hidden=true;
  compute();form.scrollIntoView({block:'center'});
});
document.querySelector('#hero-copy').addEventListener('click',async()=>{
  try { await navigator.clipboard.writeText(JSON.stringify(lastReport,null,2)); announce.textContent='Match report copied as JSON.'; }
  catch { announce.textContent='Clipboard unavailable. Download the JSON report instead.'; }
});
document.querySelector('#hero-download').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(lastReport,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='waypost-match.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
const menu=document.querySelector('#mobile-menu');
document.querySelector('#menu-toggle').addEventListener('click',event=>{
  menu.hidden=!menu.hidden;event.currentTarget.setAttribute('aria-expanded',String(!menu.hidden));
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape') {menu.hidden=true;document.querySelector('#menu-toggle').setAttribute('aria-expanded','false');}
});
const theme=document.querySelector('#theme');
document.querySelector('#more-tools').addEventListener('click',event=>{
  const expanded=document.querySelector('#tools').classList.toggle('tools-expanded');
  event.currentTarget.setAttribute('aria-expanded',String(expanded));
  event.currentTarget.textContent=expanded?'Show fewer tools':'View all tools';
});
theme.value=document.documentElement.dataset.theme??'system';
theme.addEventListener('change',()=>{
  if(theme.value==='system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme=theme.value;
  try {localStorage.setItem('waypost:theme',theme.value);} catch { /* Theme still applies for this visit. */ }
});

// Prices come from the committed, dated source file, never a runtime API.
try {
  const response=await fetch(`${basePath}data/competitors.json`);
  if(!response.ok) throw new Error();
  const data=await response.json();
  document.querySelector('#pricing-date').textContent=`Paid plan prices in USD, as of ${data.verifiedAt}. Free plans and billing terms vary. Trademarks belong to their owners.`;
  data.plans.forEach(plan=>{
    const cell=document.querySelector(`[data-price="${plan.id}"]`);
    if(cell) cell.textContent=plan.displayPrice;
  });
} catch {document.querySelector('#pricing-date').textContent='Price data unavailable. Follow the pricing sources for current plans.';}
