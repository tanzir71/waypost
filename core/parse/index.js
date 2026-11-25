const sectionPattern=/^(CONTACT|SUMMARY|PROFILE|EXPERIENCE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EMPLOYMENT|EDUCATION|SKILLS|TECHNICAL SKILLS|PROJECTS|LEADERSHIP|CERTIFICATIONS|PUBLICATIONS)\s*:?$/i;
const sectionName=value=>/EXPERIENCE|EMPLOYMENT/i.test(value)?'EXPERIENCE':/SKILLS/i.test(value)?'SKILLS':value.toUpperCase().replace(/:$/,'');
export function readPdfLayout(pages) {
  const output=[],warnings=[];
  for(const [pageIndex,page] of pages.entries()) {
    const items=page.items.filter(item=>typeof item.str==='string' && item.str.trim()).map(item=>({...item,x:item.transform[4],y:item.transform[5]}));
    const byRow=[...items].sort((a,b)=>b.y-a.y||a.x-b.x);
    const rows=[];
    for(const item of byRow) {
      let row=rows.find(row=>Math.abs(row.y-item.y)<3);
      if(!row) {row={y:item.y,items:[]};rows.push(row);}
      row.items.push(item);
    }
    const width=page.width??600,height=page.height??800;
    let splitRows=0;
    for(const row of rows) {
      row.items.sort((a,b)=>a.x-b.x);
      if(row.items.some((item,i)=>i>0 && item.x-(row.items[i-1].x+(row.items[i-1].width??0))>width*.17)) splitRows++;
    }
    const columns=splitRows>=Math.max(2,rows.length*.2);
    if(columns) warnings.push({page:pageIndex+1,code:'columns',message:'Possible multiple columns. Review the extracted left-to-right column order.'});
    const groups=columns?[items.filter(item=>item.x<width/2),items.filter(item=>item.x>=width/2)]:[items];
    for(const group of groups) {
      const sorted=group.sort((a,b)=>b.y-a.y||a.x-b.x),lines=[];
      for(const item of sorted) {
        const last=lines.at(-1);
        if(last && Math.abs(last.y-item.y)<3) last.items.push(item);
        else lines.push({y:item.y,items:[item]});
      }
      for(const line of lines) {
        line.items.sort((a,b)=>a.x-b.x);
        output.push({text:line.items.map(item=>item.str).join(' ').replace(/\s+/g,' ').trim(),page:pageIndex+1,y:line.y,zone:line.y>height*.92?'header':line.y<height*.08?'footer':'body'});
      }
    }
  }
  return {text:output.map(line=>line.text).join('\n'),lines:output,warnings,pages:pages.length};
}
export function analyzeText(text,metadata={}) {
  text=String(text).replace(/\r\n?/g,'\n');
  let section='CONTACT';
  const lines=text.split('\n').map((text,index)=>{
    if(sectionPattern.test(text.trim())) section=sectionName(text.trim());
    return {text,lineIndex:index+1,section,issues:[]};
  });
  const issues=[];
  function issue(code,message,severity='partial',indices=[]) {
    const row={code,message,severity,lineIndices:indices};issues.push(row);
    for(const index of indices) if(lines[index-1]) lines[index-1].issues.push(code);
  }
  const sections=[...new Set(lines.filter(line=>line.text.trim()).map(line=>line.section))];
  const contact=/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+?\d[\d ()-]{7,}\d)/;
  const contactLines=lines.filter(line=>contact.test(line.text));
  const bodyContact=contactLines.some(line=>!metadata.lines?.[line.lineIndex-1] || metadata.lines[line.lineIndex-1].zone==='body');
  if(!bodyContact) issue('contact',contactLines.length?'Contact details appear only in a header or footer. Move them into the body.':'No email or phone number was found. Verify your contact details.','limited',contactLines.map(line=>line.lineIndex));
  const standard=['SUMMARY','EXPERIENCE','EDUCATION','SKILLS','PROJECTS'].filter(name=>sections.includes(name));
  if(standard.length<3) issue('headings','Use standard headings so a reader can find your experience, education and skills.');
  const formats=new Map();
  for(const line of lines) {
    const found=[];
    if(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/i.test(line.text)) found.push('month-name');
    if(/\b\d{1,2}[/.-](?:19|20)\d{2}\b/.test(line.text)) found.push('numeric-month');
    found.forEach(format=>{if(!formats.has(format)) formats.set(format,[]);formats.get(format).push(line.lineIndex);});
    if(/[★☆●■▰▱█▓▒░\uE000-\uF8FF]/.test(line.text)) issue('symbols','Ratings or private-use symbols may parse as noise. State the skill plainly.','limited',[line.lineIndex]);
    if((line.text.match(/[\uFFFD\u0000]/g)??[]).length || /(?:[A-Za-z]\s){8,}[A-Za-z]/.test(line.text)) issue('unicode','Possible garbled text or a missing Unicode map. Review this line against the original.','limited',[line.lineIndex]);
  }
  if(formats.size>1) issue('dates','Date formats differ. Use one consistent month/year format.','partial',[...formats.values()].flat());
  if(metadata.warnings?.some(row=>row.code==='columns')) issue('reading-order','Possible multiple columns. Confirm the reading order against your original.');
  const words=text.trim()?text.trim().split(/\s+/).length:0;
  if(!words) issue('empty','No readable text was extracted. This may be an image-only document; paste text or use a text-based resume.','limited');
  if(words>1400 || (metadata.pages??0)>3) issue('length',`${words} words across ${metadata.pages??'unknown'} pages. Review length in relation to your experience.`);
  const bullets=lines.filter(line=>/^(?:\s*[-•*]|\s*\d+[.)])\s/.test(line.text));
  const quantified=bullets.filter(line=>/\d|[%$£€]|\b(?:hours?|minutes?|seconds?)\b/.test(line.text));
  if(bullets.length && quantified.length/bullets.length<.6) issue('quantified',`${quantified.length} of ${bullets.length} bullets carry a number. Add truthful measures where useful.`);
  const fontsKnown=metadata.fonts?.length && metadata.fonts.every(font=>typeof font.embedded==='boolean');
  if(metadata.fonts?.some(font=>font.embedded===false)) issue('fonts','An unembedded font was reported. Verify the extracted text before using it.');
  const status=code=>issues.some(row=>row.code===code)?(issues.some(row=>row.code===code&&row.severity==='limited')?'limited':'partial'):'met';
  const checks=[
    {key:'reading-order',label:'Reading order',status:status('reading-order'),detail:metadata.lines?'Extracted by page and position; review against the original.':'Plain text order; original layout is not available.'},
    {key:'contact',label:'Contact in body',status:status('contact'),detail:bodyContact?'Contact text found outside detected header/footer zones.':'Contact details need review.'},
    {key:'headings',label:'Standard headings',status:status('headings'),detail:`${standard.length} of 5 common sections found.`},
    {key:'dates',label:'Dates',status:status('dates'),detail:formats.size>1?'Mixed date formats.':formats.size?'One date format detected.':'No month/year dates detected.'},
    {key:'symbols',label:'Ratings as text',status:status('symbols'),detail:status('symbols')==='met'?'No rating or private-use glyphs detected.':'Review highlighted symbols.'},
    {key:'fonts',label:'Fonts and Unicode',status:status('unicode')==='limited'?'limited':fontsKnown?status('fonts'):'partial',detail:fontsKnown?'Font embedding metadata and Unicode text checked.':'Embedding is not exposed for all fonts; Unicode quality is checked heuristically.'},
    {key:'length',label:'Length',status:status('length'),detail:`${metadata.pages?`${metadata.pages} pages · `:''}${words} words.`},
    {key:'quantified',label:'Quantified bullets',status:status('quantified'),detail:`${quantified.length} of ${bullets.length} bullets carry a number.`}
  ];
  return {text,lines,sections,issues,checks,words,pages:metadata.pages??null,status:issues.some(row=>row.severity==='limited')?'problems':issues.length?'warnings':'clean',metadata};
}
export function jsonResumeFromText(text) {
  const lines=String(text).split('\n').map(line=>line.trim()).filter(Boolean);
  const email=String(text).match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0];
  return {basics:{name:lines[0]??'',...(email?{email}:{}),summary:String(text)},meta:{note:'Derived from the saved text; review structured fields before reuse.'}};
}
