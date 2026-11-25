import aliases from '../../data/aliases.json' with { type: 'json' };
import vocabulary from '../../data/skills/labels.json' with { type: 'json' };
import { stem } from './stem.js';
import { scoreResumeAgainstJob } from '../scoring.js';

const stop = new Set('a an and are as at be been being build building by can candidate candidates demonstrated experience experienced expertise for from good have in into is it knowledge minimum must of on or our plus preferred proficiency proficient qualification qualifications required requirements responsible role skills strong technical that the their this to using we will with work working you your years year yrs ability able proven including across'.split(' ').map(stem));
const headings = /^(contact|profile|summary|experience|employment|work experience|professional experience|education|skills|technical skills|projects|certifications|publications)\s*:?$/i;
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const aliasPatterns = Object.entries(aliases).sort((a,b)=>b[0].length-a[0].length).map(([alias,canonical])=>[new RegExp(`(?<![a-z0-9])${escape(alias)}(?![a-z0-9])`,'gi'),canonical]);
const skillPatterns = [...vocabulary.labels].sort((a,b)=>b.length-a.length).map(label=>({label, token: label.replaceAll(' ','_'), pattern: new RegExp(`(?<![a-z0-9])${escape(label)}(?![a-z0-9])`,'gi')}));
const hardSkills = new Set(skillPatterns.map(item=>stem(item.token)));

export function normalize(text) {
  let value = String(text).toLowerCase().replace(/[’']/g,'').replace(/[‐‑–—]/g,'-');
  for (const [pattern,canonical] of aliasPatterns) value = value.replace(pattern,canonical);
  for (const skill of skillPatterns) value = value.replace(skill.pattern,skill.token);
  return (value.match(/[a-z][a-z0-9_+#.-]*/g) ?? []).map(token=>stem(token.replace(/[.-]+$/,''))).filter(token=>token && !stop.has(token));
}

export function extractRequirements(description) {
  const rows = [];
  let kind = 'required', skip = false;
  const lines = String(description).replace(/\r\n/g,'\n').split('\n');
  for (let index=0; index<lines.length; index++) {
    let line = lines[index].trim().replace(/^(?:[-*•●]|\d+[.)])\s+/, '');
    if (!line) continue;
    if (/^(?:benefits|what we offer|equal opportunity|about (?:us|the company)|compensation|salary)\b/i.test(line)) { skip=true; continue; }
    const section = line.match(/^(required|requirements|must have|qualifications|minimum qualifications|preferred|nice to have|bonus|plus)\s*:?(.*)$/i);
    if (section) {
      kind = /preferred|nice|bonus|plus/i.test(section[1]) ? 'preferred' : 'required';
      skip=false; line=section[2].trim();
    }
    if (!line || skip) continue;
    // The first unlabelled line of a multiline description is the job title.
    if (index===0 && lines.length>1 && !section && !/^(?:[-*•]|\d+[.)])\s/.test(lines[index]) && !/\b(?:must|required|experience|years|yrs)\b/i.test(line)) continue;
    for (let text of line.split(/;|(?<=[.!?])\s+(?=[A-Z])/)) {
      const pieces = kind === 'preferred' ? text.split(/,\s*|\s+and\s+/i) : [text];
      for (text of pieces) {
        text=text.trim().replace(/[.;]$/,'');
        if (!text || /equal opportunity|regardless of|all qualified applicants/i.test(text)) continue;
        if (/\b(?:sponsorship|work authori[sz]|security clearance|degree required|must (?:live|reside|be located))\b/i.test(text)) continue;
        rows.push({ text, kind: /\b(?:must|required)\b|\d+\+?\s*(?:years|yrs)\b/i.test(text) ? 'required' : kind });
      }
    }
  }
  return rows;
}

export function indexResume(text) {
  let section = 'CONTACT';
  const lines = String(text).replace(/\r\n/g,'\n').split('\n').map((line,lineIndex)=>{
    if (headings.test(line.trim())) section=line.trim().replace(/:$/,'').toUpperCase();
    const tokens=normalize(line), frequencies=new Map();
    tokens.forEach(term=>frequencies.set(term,(frequencies.get(term)??0)+1));
    return { line, lineIndex:lineIndex+1, section, tokens, frequencies, heading:headings.test(line.trim()) };
  }).filter(item=>item.line.trim());
  const df=new Map();
  for (const line of lines) for (const token of new Set(line.tokens)) df.set(token,(df.get(token)??0)+1);
  return { lines, df, averageLength: Math.max(1,lines.reduce((sum,line)=>sum+line.tokens.length,0)/Math.max(1,lines.length)) };
}

function bm25(terms,line,index) {
  let value=0;
  for (const term of terms) {
    const tf=line.frequencies.get(term)??0;
    if (!tf) continue;
    const idf=Math.log(1+(index.lines.length-(index.df.get(term)??0)+.5)/((index.df.get(term)??0)+.5));
    value += idf * tf * 2.2 / (tf+1.2*(.25+.75*line.tokens.length/index.averageLength));
  }
  return value;
}

export function yearsOfExperience(text, now = new Date().toISOString().slice(0,10)) {
  const month='(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
  const pattern=new RegExp(`(?:(${month})\\s+)?((?:19|20)\\d{2})\\s*[-–—]\\s*(?:(${month})\\s+)?((?:19|20)\\d{2}|present|current|now)`,'gi');
  const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const intervals=[];
  let section='EXPERIENCE';
  for (const line of String(text).split('\n')) {
    if(headings.test(line.trim())) section=line.trim().toUpperCase();
    if (/EDUCATION|CERTIFICATION/.test(section)) continue;
    for (const match of line.matchAll(pattern)) {
      const start=Number(match[2])*12+(match[1]?months.indexOf(match[1].slice(0,3).toLowerCase()):0);
      const end=/^\d+$/.test(match[4]) ? Number(match[4])*12+(match[3]?months.indexOf(match[3].slice(0,3).toLowerCase())+1:12) : Number(now.slice(0,4))*12+Number(now.slice(5,7));
      if (end>=start && start<=Number(now.slice(0,4))*12+Number(now.slice(5,7))) intervals.push([start,Math.min(end,Number(now.slice(0,4))*12+Number(now.slice(5,7)))]);
    }
  }
  intervals.sort((a,b)=>a[0]-b[0]);
  const merged=[];
  for(const interval of intervals) {
    const last=merged.at(-1);
    if(last && interval[0]<=last[1]) last[1]=Math.max(last[1],interval[1]);
    else merged.push([...interval]);
  }
  return Math.round(merged.reduce((sum,[start,end])=>sum+end-start,0)/12*10)/10;
}

function scoreRequirement(requirement,index,years) {
  const terms=[...new Set(normalize(requirement.text))];
  const ranked=index.lines.filter(line=>!line.heading).map(line=>({line,score:bm25(terms,line,index)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score || a.line.lineIndex-b.line.lineIndex);
  const best=ranked[0]?.line;
  const support=ranked.slice(0,2).map(item=>item.line);
  const covered=new Set(support.flatMap(line=>line.tokens));
  // "Go or Rust" is an alternative, not two mandatory skills.
  const alternatives=requirement.text.match(/\b([\w+#.]+)\s+or\s+([\w+#.]+)\b/i);
  const either=alternatives ? alternatives.slice(1).map(word=>normalize(word)[0]).filter(Boolean) : [];
  let total=0,found=0,alreadyEither=false;
  for (const term of terms) {
    const weight=hardSkills.has(term)?2:1;
    if(either.includes(term)) {
      if(alreadyEither) continue;
      alreadyEither=true; total+=weight;
      if(either.some(token=>covered.has(token))) found+=weight;
    } else { total+=weight; if(covered.has(term)) found+=weight; }
  }
  const ratio=total ? found/total : 0;
  const ask=Number(requirement.text.match(/(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)\b/i)?.[1]??0);
  const onlySkills=!!support.length && support.every(line=>/SKILLS/.test(line.section));
  let status=ratio>=.8?'met':ratio>=.4?'partial':'missing';
  const scaleContext=/\bat scale\b/i.test(requirement.text) && !support.some(line=>/\d|\b(?:scale|million|billion|qps|tps|throughput)\b/i.test(line.line));
  if(status==='met' && (onlySkills || years<ask || scaleContext)) status='partial';
  const missing=terms.filter(term=>!covered.has(term) && !either.includes(term));
  let note=status==='missing' ? 'No supporting evidence found. Add experience only if true.' : status==='partial' ? `Some evidence found; ${missing.length ? `not supported: ${missing.map(term=>term.replaceAll('_',' ')).join(', ')}.` : 'more context is needed.'}` : 'Supported by the quoted resume evidence.';
  if(onlySkills) note='Listed in Skills; no supporting work or project context found.';
  if(years<ask) note=`${years} dated years found; ${ask}+ required. Dates may need clarification.`;
  if(scaleContext) note='Technology found without evidence of scale. Add volume or QPS only if true.';
  return { ...requirement,status,evidence:best?{line:best.line,section:best.section,lineIndex:best.lineIndex}:null, supportingEvidence:support.slice(1).map(line=>({line:line.line,section:line.section,lineIndex:line.lineIndex})),note };
}

export function tierFor(score) { return score>=.85?'strong':score>=.65?'good':score>=.4?'partial':'limited'; }
export function summarizeReport(report) {
  const rows=[...report.required,...report.preferred];
  return { met:rows.filter(r=>r.status==='met').length,partial:rows.filter(r=>r.status==='partial').length,missing:rows.filter(r=>r.status==='missing').length,total:rows.length };
}
function stuffingWarnings(text,jobText) {
  const resume=normalize(text),jd=normalize(jobText),warnings=[];
  const counts=new Map();
  resume.forEach(term=>counts.set(term,(counts.get(term)??0)+1));
  for(const [term,count] of counts) {
    const jobCount=jd.filter(word=>word===term).length;
    if(jobCount && count>=5 && count>3*jobCount) warnings.push(`Repeated term: ${term.replaceAll('_',' ')} (${count} times; ${jobCount} in job).`);
  }
  if(/[\u200B-\u200D\u2060\uFEFF]/.test(text)) warnings.push('Invisible Unicode characters found; review the original document.');
  return warnings;
}

export function matchResume(resume,job,options={}) {
  const resumeText=String(resume.text??''),jobText=String(job.text??'');
  const index=options.index??indexResume(resumeText);
  const requirements=options.requirements??extractRequirements(jobText);
  const years=yearsOfExperience(resumeText,options.now);
  const scored=requirements.map(req=>scoreRequirement(req,index,years));
  const required=scored.filter(req=>req.kind==='required'), preferred=scored.filter(req=>req.kind==='preferred');
  const points=row=>row.status==='met'?1:row.status==='partial'?.5:0;
  const requiredScore=required.length ? required.reduce((sum,row)=>sum+points(row),0)/required.length : 0;
  // A conservative preferred contribution stays below the specified +0.05 cap.
  const preferredBonus=preferred.length ? .02*preferred.reduce((sum,row)=>sum+points(row),0)/preferred.length : 0;
  const score=Math.min(1,requiredScore+preferredBonus);
  const knockouts=jobText.split(/\n|(?<=[.?])\s+/).filter(line=>/sponsorship|work authori[sz]|security clearance|degree required|must (?:live|reside|be located)/i.test(line)).map(question=>({question:question.trim(),answered:options.knockoutAnswers?.[question.trim()]??null}));
  let tier=tierFor(score);
  if(knockouts.some(item=>item.answered===false) && ['strong','good'].includes(tier)) tier='partial';
  const bullets=index.lines.filter(line=>!line.heading && /EXPERIENCE|PROJECT/.test(line.section) && !/\b(?:19|20)\d{2}\s*[-–—]/.test(line.line));
  const title=new Set(normalize(job.title??''));
  const resumeTitle=new Set(normalize(index.lines.find(line=>/engineer|developer|designer|analyst|manager/i.test(line.line))?.line??''));
  const intersection=[...title].filter(term=>resumeTitle.has(term)).length;
  const union=new Set([...title,...resumeTitle]).size;
  return { jobId:job.id??'job',resumeVersionId:resume.id??'resume',tier,required,preferred,
    checks:{ coverage:tierFor(requiredScore),title:tierFor(union?intersection/union:0),years:{found:years,asked:Math.max(0,...requirements.map(req=>Number(req.text.match(/(\d+)\+?\s*(?:years|yrs)/i)?.[1]??0)))||null},quantified:{withNumbers:bullets.filter(line=>/\d|[%$£€]|\b(?:hours?|minutes?|seconds?)\b/.test(line.line)).length,bullets:bullets.length},parse:resume.parse?.issues?.length?'warnings':'clean',keywordCoverage:scoreResumeAgainstJob(resume,job).score},
    knockouts,stuffingWarnings:stuffingWarnings(resumeText,jobText),clusterGaps:[],requiredScore,preferredBonus,
    explanation:required.length?'Based on requirement evidence, not an employer hiring prediction.':'No scorable requirements found. Add the requirements section of the job description.' };
}

export function scoreBatch(resumes,jobs,options={}) {
  const indexed=resumes.map(resume=>({resume,index:indexResume(resume.text)}));
  return jobs.flatMap(job=>{
    const requirements=extractRequirements(job.text);
    return indexed.map(({resume,index})=>matchResume(resume,job,{...options,index,requirements}));
  });
}
