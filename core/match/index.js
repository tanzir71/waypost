import aliases from '../../data/aliases.json' with { type: 'json' };
import vocabulary from '../../data/skills/labels.json' with { type: 'json' };
import onet from '../../data/skills/onet.json' with { type: 'json' };
import { stem } from './stem.js';
import { scoreResumeAgainstJob,clusterJobs,extractAttributes } from '../scoring.js';

const stop = new Set('a an and are as at be been being build building by can candidate candidates demonstrated experience experienced expertise for from good have in into is it knowledge minimum must of on or our plus preferred proficiency proficient qualification qualifications required requirements responsible role skills strong technical that the their this to using we will with work working you your years year yrs ability able proven including across'.split(' ').map(stem));
const headings = /^(contact|profile|summary|experience|employment|work experience|professional experience|education|skills|technical skills|projects|leadership|certifications|publications)\s*:?$/i;
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const aliasPatterns = Object.entries(aliases).sort((a,b)=>b[0].length-a[0].length).map(([alias,canonical])=>[new RegExp(`(?<![a-z0-9])${escape(alias)}(?![a-z0-9])`,'gi'),canonical]);
const skillPatterns = [...new Set([...vocabulary.labels,...onet.labels.map(label=>label.toLowerCase())])].sort((a,b)=>b.length-a.length).map(label=>({label, token: label.replaceAll(' ','_'), pattern: new RegExp(`(?<![a-z0-9])${escape(label)}(?![a-z0-9])`,'gi')}));
const hardSkills = new Set(skillPatterns.map(item=>stem(item.token)));
const isKnockoutQuestion=text=>/sponsorship|work authori[sz]|authori[sz]ed to work|security clearance|degree (?:is )?required|must (?:live|reside|be located)/i.test(text)||/\b(?:do you have|have you|are you)\b.*\b(?:degree|clearance|\d+\+?\s*(?:years|yrs)|located|relocat)/i.test(text);

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
        if (isKnockoutQuestion(text)) continue;
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

export function yearsOfExperience(text, now = null) {
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
      const current=now?Number(now.slice(0,4))*12+Number(now.slice(5,7)):Infinity;
      const closed=/^\d+$/.test(match[4]);
      if(!closed&&!now) throw new Error('Provide the current date to count ongoing experience.');
      const end=closed ? Number(match[4])*12+(match[3]?months.indexOf(match[3].slice(0,3).toLowerCase())+1:0) : current;
      if (end>=start && start<=current) intervals.push([start,Math.min(end,current)]);
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

function prepareRequirement(requirement) {
  const alternatives=requirement.text.match(/\b([\w+#.]+)\s+or\s+([\w+#.]+)\b/i);
  return {terms:[...new Set(normalize(requirement.text))],either:alternatives?alternatives.slice(1).map(word=>normalize(word)[0]).filter(Boolean):[],ask:Number(requirement.text.match(/(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)\b/i)?.[1]??0)};
}
function scoreRequirement(requirement,index,years,prepared=prepareRequirement(requirement)) {
  const {terms,either,ask}=prepared;
  const ranked=index.lines.filter(line=>!line.heading).map(line=>({line,score:bm25(terms,line,index)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score || a.line.lineIndex-b.line.lineIndex);
  const best=ranked[0]?.line;
  const support=best?[best]:[];
  const extra=ranked.slice(1).find(item=>terms.some(term=>item.line.tokens.includes(term)&&!best.tokens.includes(term))||(/SKILLS/.test(best.section)&&!/SKILLS/.test(item.line.section)&&terms.some(term=>hardSkills.has(term)&&item.line.tokens.includes(term))));
  if(extra) support.push(extra.line);
  const covered=new Set(support.flatMap(line=>line.tokens));
  // "Go or Rust" is an alternative, not two mandatory skills.
  const asksScale=/\bat scale\b/i.test(requirement.text);
  const scaleEvidence=support.some(line=>terms.some(term=>hardSkills.has(term)&&line.tokens.includes(term)) && /\b\d[\d,.]*\s*(?:[KMGT]B|million|billion|[km]?\s*(?:qps|tps|rps)|users|requests|records)\b|\b(?:scaled|scaling|throughput)\b/i.test(line.line));
  if(asksScale && scaleEvidence) covered.add(stem('scale'));
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
  const contextual=new Set(support.filter(line=>!/SKILLS/.test(line.section)).flatMap(line=>line.tokens));
  const onlySkills=!!support.length && (support.every(line=>/SKILLS/.test(line.section))||terms.some(term=>hardSkills.has(term)&&covered.has(term)&&!contextual.has(term)&&(!either.includes(term)||!either.some(alt=>contextual.has(alt)))));
  let status=ratio>=.8?'met':ratio>=.4?'partial':'missing';
  const scaleContext=asksScale && !scaleEvidence;
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
const frequencies=tokens=>{const counts=new Map();for(const token of tokens)counts.set(token,(counts.get(token)??0)+1);return counts;};
function stuffingWarnings(text,counts,jobCounts) {
  const warnings=[];
  for(const [term,count] of counts) {
    const jobCount=jobCounts.get(term)??0;
    if(jobCount && count>=5 && count>3*jobCount) warnings.push(`Repeated term: ${term.replaceAll('_',' ')} (${count} times; ${jobCount} in job).`);
  }
  if(/[\u200B-\u200D\u2060\uFEFF]/.test(text)) warnings.push('Invisible Unicode characters found; review the original document.');
  return warnings;
}

export function matchResume(resume,job,options={}) {
  const resumeText=String(resume.text??''),jobText=String(job.text??'');
  const preparedResume=options.preparedResume??prepareResume(resume,options);
  const preparedJob=options.preparedJob??prepareJob(job);
  const {index,years,bullets,title:resumeTitle}=preparedResume;
  const {requirements,title}=preparedJob;
  const scored=requirements.map((req,i)=>scoreRequirement(req,index,years,preparedJob.requirementData[i]));
  const required=scored.filter(req=>req.kind==='required'), preferred=scored.filter(req=>req.kind==='preferred');
  const points=row=>row.status==='met'?1:row.status==='partial'?.5:0;
  const requiredScore=required.length ? required.reduce((sum,row)=>sum+points(row),0)/required.length : 0;
  // A conservative preferred contribution stays below the specified +0.05 cap.
  const preferredBonus=preferred.length ? .02*preferred.reduce((sum,row)=>sum+points(row),0)/preferred.length : 0;
  const score=Math.min(1,requiredScore+preferredBonus);
  const knockouts=preparedJob.knockouts.map(question=>({question,answered:options.knockoutAnswers?.[question]??job.knockoutAnswers?.[question]??null}));
  let tier=tierFor(score);
  if(knockouts.some(item=>item.answered===false) && ['strong','good'].includes(tier)) tier='partial';
  const intersection=[...title].filter(term=>resumeTitle.has(term)).length;
  const union=new Set([...title,...resumeTitle]).size;
  return { jobId:job.id??'job',resumeVersionId:resume.id??'resume',tier,required,preferred,
    checks:{ coverage:tierFor(requiredScore),title:tierFor(union?intersection/union:0),years:{found:years,asked:Math.max(0,...preparedJob.requirementData.map(data=>data.ask))||null},quantified:{withNumbers:preparedResume.quantified,bullets:bullets.length},parse:resume.parse?.status??(resume.parse?(resume.parse.issues?.length?'warnings':'clean'):'warnings'),keywordCoverage:scoreResumeAgainstJob(resume,job,{resumeAttributes:preparedResume.attributes,jobAttributes:preparedJob.attributes}).score},
    knockouts,stuffingWarnings:stuffingWarnings(resumeText,preparedResume.counts,preparedJob.counts),clusterGaps:[],requiredScore,preferredBonus,
    explanation:knockouts.some(item=>item.answered===false)?'A stated application requirement is not satisfied. The tier is capped at Partial; review the knockout answers.':required.length?'Based on requirement evidence, not an employer hiring prediction.':'No scorable requirements found. Add the requirements section of the job description.' };
}

function prepareResume(resume,options) {
  const index=options.index??indexResume(resume.text);
  const bullets=index.lines.filter(line=>!line.heading && /EXPERIENCE|PROJECT|LEADERSHIP/.test(line.section) && /^\s*[-•*]\s/.test(line.line));
  const role=index.lines.filter(line=>/EXPERIENCE|EMPLOYMENT/.test(line.section)).map(line=>line.line.match(/(?:(?:sr|jr|senior|junior|lead|staff|principal|backend|frontend|full.stack|software|product|data|platform|ui|ux)\.?\s+)*(?:engineer|developer|designer|analyst|manager)/i)?.[0]).find(Boolean)??'';
  return {index,years:yearsOfExperience(resume.text,options.now),bullets,quantified:bullets.filter(line=>/\d|[%$£€]|\b(?:hours?|minutes?|seconds?)\b/.test(line.line)).length,title:new Set(normalize(role)),counts:frequencies(index.lines.flatMap(line=>line.tokens)),attributes:new Set(extractAttributes(resume.text))};
}
function prepareJob(job) {
  const requirements=extractRequirements(job.text);
  return {requirements,requirementData:requirements.map(prepareRequirement),title:new Set(normalize(job.title??'')),counts:frequencies(normalize(job.text)),attributes:extractAttributes(job.text),knockouts:job.text.split(/\n|(?<=[.?])\s+/).filter(isKnockoutQuestion).map(line=>line.trim())};
}
export function scoreBatch(resumes,jobs,options={}) {
  const indexed=resumes.map(resume=>({resume,preparedResume:prepareResume(resume,options)}));
  const reports=jobs.flatMap(job=>{
    const preparedJob=prepareJob(job);
    return indexed.map(({resume,preparedResume})=>matchResume(resume,job,{...options,preparedResume,preparedJob}));
  });
  const clusters=clusterJobs(jobs);
  const vocab=skillPatterns.map(skill=>({label:skill.label,token:stem(skill.token)}));
  const jobTokens=new Map(jobs.map(job=>[job.id,new Set(normalize(job.text))]));
  for(const {resume,preparedResume} of indexed) {
    for(const cluster of clusters) {
      const ids=new Set(cluster.jobIds);
      const gaps=vocab.filter(skill=>!preparedResume.counts.has(skill.token)).map(skill=>({term:skill.label,count:cluster.jobIds.filter(id=>jobTokens.get(id)?.has(skill.token)).length,of:cluster.jobIds.length})).filter(gap=>gap.count).sort((a,b)=>b.count-a.count||a.term.localeCompare(b.term));
      for(const report of reports.filter(report=>report.resumeVersionId===resume.id&&ids.has(report.jobId))) {
        report.clusterGaps=gaps;report.clusterJobCount=cluster.jobIds.length;
        for(const row of [...report.required,...report.preferred].filter(row=>row.status==='missing')) {
          const terms=new Set(normalize(row.text));
          row.clusterPrevalence={count:cluster.jobIds.filter(id=>[...terms].filter(term=>hardSkills.has(term)).some(term=>jobTokens.get(id)?.has(term))).length,of:cluster.jobIds.length};
        }
      }
    }
  }
  return reports;
}
