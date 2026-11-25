import {analyzeText} from '../../core/parse/index.js';
import {readResumeFile} from '../read-file.js';
import {el,button,field,result,announce,download,copyJSON} from '../dom.js';
export async function renderParse({store,basePath,view,actions}) {
  let versions=(await store.all('resumeVersions')).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  const params=new URLSearchParams(location.hash.slice(1));
  let version=versions.find(row=>row.id===params.get('resume'))??versions.at(-1);
  let report=version?.parse??(version?analyzeText(version.text):null);
  const content=el('div',{class:'parse-layout'}),textPanel=el('section',{class:'parse-text-panel','aria-label':'Extracted resume text'}),rail=el('aside',{class:'checks-rail','aria-label':'Parse checks'});
  const select=el('select',{id:'parse-version','data-testid':'parse-version'});
  versions.forEach(row=>select.append(el('option',{value:row.id,text:row.label,selected:row.id===version?.id})));
  const file=el('input',{id:'parse-file',type:'file',accept:'.pdf,.docx,.txt,.json','data-testid':'parse-upload'});
  const pasted=el('textarea',{id:'parse-paste',rows:5,'data-testid':'parse-paste'});
  const form=el('form',{'aria-label':'Check resume text',class:'stack'},field('Choose a saved resume','parse-version',select),field('Upload a resume','parse-file',file),el('details',{},el('summary',{text:'Or paste resume text','data-testid':'parse-paste-open'}),field('Resume text','parse-paste',pasted),button('Check pasted text',()=>{version=null;report=analyzeText(pasted.value);paint();},'parse-paste-check')));
  form.addEventListener('submit',event=>event.preventDefault());
  function paint() {
    textPanel.replaceChildren();rail.replaceChildren();
    if(!report) {textPanel.append(el('h2',{text:'As a parser reads it'}),el('p',{class:'muted',text:'Upload a resume, choose a saved version or paste text to inspect the reading order.'}));result(null);return;}
    textPanel.append(el('div',{class:'section-title'},el('h2',{text:'As a parser reads it'}),el('span',{class:'evidence',text:'reading order ↓'})));
    for(const line of report.lines) {
      const severe=report.issues.some(issue=>issue.severity==='limited'&&issue.lineIndices.includes(line.lineIndex));
      textPanel.append(el('div',{class:`parse-line ${line.issues.length?(severe?'parse-limited':'parse-partial'):''}`,'data-testid':'parse-line','data-line':line.lineIndex},el('span',{class:'section-gutter',text:line.section}),el('span',{class:'parse-line-text',text:line.text||' '})));
    }
    textPanel.append(el('p',{class:'parse-legend',text:'Amber: needs review · Red: possible missing or garbled content. Checks are heuristics; compare with the original.'}));
    const checks=el('section',{class:'card stack'},el('h2',{text:'Checks'}));
    for(const check of report.checks) checks.append(el('div',{class:`parse-check check-${check.status}`,'data-testid':'parse-check'},el('span',{'aria-hidden':true,text:check.status==='met'?'✓':check.status==='partial'?'△':'×'}),el('div',{},el('h3',{text:check.label}),el('p',{class:'muted',text:check.detail}))));
    rail.append(checks,el('section',{class:'card stack'},el('h2',{text:'Detected sections'}),el('div',{class:'tag-list'},report.sections.map(section=>el('span',{class:'stage-tag',text:section.toLowerCase()})))));
    for(const warning of report.metadata.parserWarnings??[]) rail.append(el('p',{class:'muted',text:warning}));
    result(report);
    document.querySelector('.view-header .muted').textContent=`${version?.label??'Unsaved resume'} · ${report.pages?`${report.pages} pages · `:''}${report.words} words · extracted on this device`;
  }
  select.addEventListener('change',()=>{version=versions.find(row=>row.id===select.value);report=version?.parse??analyzeText(version?.text??'');history.replaceState(null,'',`#resume=${encodeURIComponent(select.value)}`);paint();});
  file.addEventListener('change',async()=>{
    const upload=file.files[0];if(!upload)return;
    try {announce('Extracting text on this device…');const parsed=await readResumeFile(upload,{basePath});version=null;report=parsed.parse;paint();announce('Parse check complete. The extracted text is ready.');}
    catch(error){announce(error.message);}
  });
  actions.append(button('Download plain text',()=>report&&download('waypost-resume.txt',report.text,'text/plain'),'parse-download'),button('Copy JSON',()=>report&&copyJSON(report),'parse-copy'),button('Download JSON',()=>report&&download('waypost-parse.json',JSON.stringify(report,null,2)),'parse-download-json'));
  content.append(textPanel,rail);view.replaceChildren(el('details',{class:'view-inputs',open:!report},el('summary',{text:'Choose or upload a resume','data-testid':'parse-source-open'}),form),content);paint();
}
