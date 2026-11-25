import {readFile,writeFile} from 'node:fs/promises';
import {scoreBatch} from '../core/match/index.js';
import {analyzeText,jsonResumeFromText} from '../core/parse/index.js';
const root=new URL('../',import.meta.url);
const fixture=JSON.parse(await readFile(new URL('tests/fixtures/northwind.json',root),'utf8'));
const dates=['2026-06-01T12:00:00.000Z','2026-11-04T12:00:00.000Z','2026-11-23T12:00:00.000Z'];
const resumeVersions=[
  {id:'northwind-v1',label:'v1 · Student',parentId:null,text:'Ayesha Rahman\nayesha@example.test\nSUMMARY\nComputer science graduate.\nEDUCATION\nBSc Computer Science\nSKILLS\nGo, PostgreSQL, Git\nPROJECTS\n• Built a small REST API for a class project.'},
  {id:'northwind-v2',label:'v2 · Generalist',parentId:'northwind-v1',text:fixture.resume.text.replace('Backend engineer building payment systems in Go.','Software engineer with experience across web and backend.').replace('• Moved billing to Go services, building distributed systems; cut infrastructure cost 22%.','• Worked on billing services.').replace('• Sharded Postgres to 4 TB, p95 latency down 38%.','• Used PostgreSQL.').replace('• Mentored 4 engineers through promotion.','• Helped new team members.')},fixture.resume
].map((row,i)=>({...row,createdAt:dates[i],updatedAt:dates[i],parse:analyzeText(row.text),jsonResume:jsonResumeFromText(row.text)}));
const jobs=[fixture.job,...[['ledgerline','Platform Engineer','Ledgerline'],['arcadia','Backend Engineer II','Arcadia Bank'],['kestrel','Software Engineer, Data','Kestrel'],['tidewater','SRE','Tidewater'],['orbit','Backend Engineer','Orbit'],['meridian','Payments Engineer','Meridian'],['cedar','Senior Software Engineer','Cedar']].map(([id,title,company],i)=>({...fixture.job,id,title,company,text:fixture.job.text.replace('Senior Backend Engineer',title).replace('Terraform',i<4?'Terraform':'Infrastructure documentation').replace('Kafka or Pulsar',i<5?'Kafka or Pulsar':'message queues')})),
  {id:'halcyon',title:'Graduate SWE',company:'Halcyon',source:'paste',text:'Graduate SWE\nRequired:\nGit\nREST API\nTesting\nPreferred:\nGo'},
  {id:'orchard',title:'Full Stack Developer',company:'Orchard',source:'paste',text:'Full Stack Developer\nRequired:\nJavaScript\nTypeScript\nReact\nPostgreSQL\nPreferred:\nGo'},
  {id:'harbor',title:'Product Designer',company:'Harbor',source:'paste',text:'Product Designer\nRequired:\nUser research\nDesign systems\nAccessibility\nPreferred:\nProject management'},
  {id:'atlas',title:'Data Analyst',company:'Atlas',source:'paste',text:'Data Analyst\nRequired:\nPython\nSQL\nData analysis\nPreferred:\nMachine learning'}
].map((job,seedOrder)=>({...job,seedOrder,createdAt:'2026-11-21T12:00:00.000Z',updatedAt:'2026-11-21T12:00:00.000Z'}));
const matchReports=scoreBatch(resumeVersions,jobs,{now:'2026-11-25'}).map((report,i)=>({...report,id:`sample-report-${i}`,createdAt:'2026-11-25T00:00:00.000Z',updatedAt:'2026-11-25T00:00:00.000Z'}));
const demoStages=['applied','screen','applied','saved','applied','screen','saved','saved','interview','saved','offer','closed'];
const applications=jobs.map((job,i)=>{
  const stage=demoStages[i],version=i===8?'northwind-v1':i===2||i===9?'northwind-v2':'northwind-v3';
  const applied=stage!=='saved',history=[{at:'2026-11-15T12:00:00.000Z',event:'Saved application',stage:'saved'}];
  if(applied)history.push({at:'2026-11-17T12:00:00.000Z',event:'Applied with saved resume',stage:'applied'});
  if(!['saved','applied'].includes(stage))history.push({at:'2026-11-23T12:00:00.000Z',event:`Moved to ${stage}`,stage});
  return {id:`sample-application-${job.id}`,jobId:job.id,resumeVersionId:version,stage,appliedAt:applied?'2026-11-17':null,next:stage==='applied'?{label:'Follow up',at:'2026-11-25T09:00:00.000Z'}:stage==='interview'?{label:'Prepare interview examples',at:'2026-11-26T10:00:00.000Z'}:stage==='offer'?{label:'Compare the offer',at:'2026-12-05T12:00:00.000Z'}:null,contactIds:[],notes:'Sample application. Replace it with your own details.',history,createdAt:'2026-11-15T12:00:00.000Z',updatedAt:'2026-11-23T12:00:00.000Z'};
});
const deadlines=[{id:'sample-scholarship',title:'Scholarship essay (sample)',date:'2026-11-28',kind:'scholarship'},{id:'sample-exam',title:'Algorithms revision (sample)',date:'2026-11-30',kind:'exam'}].map(row=>({...row,createdAt:'2026-11-21T12:00:00.000Z',updatedAt:'2026-11-21T12:00:00.000Z'}));
const terms=Array.from({length:6},(_,i)=>({id:`study-s${i+1}`,label:`S${i+1}`,order:i+1,planned:i===5,scaleId:'bd-ugc',...(i<5?{reportedGpa:[3.21,3.35,3.48,3.55,3.51][i]}:{})}));
// Historical bars are explicitly reported term GPAs from the Figma sample.
// They do not pretend to reconstruct grades from course records we lack.
const courses=[
  ...[['CSE 331 · Algorithms',3,'A'],['CSE 340 · Operating Systems',3,'A'],['MAT 361 · Probability',3,'A+'],['ENG 201 · Technical Writing',3,'A'],['CSE 350 · Software Engineering Lab',1.5,'A']].map(([name,credits,targetGrade],i)=>({id:`study-course-${i}`,name,credits,targetGrade,grade:i===2?'A+':null,locked:i===2,difficulty:1,termId:'study-s6',scaleId:'bd-ugc',...(i===0?{categories:[{name:'Homework',weight:20,score:92},{name:'Quizzes',weight:10,score:85},{name:'Midterm',weight:30,score:78},{name:'Final exam',weight:40,score:null}]}:{})}))
];
await writeFile(new URL('data/workspace-demo.json',root),JSON.stringify({resumeVersions,jobs,matchReports,applications,deadlines,terms,courses},null,2)+'\n');
console.log('Generated sample workspace: jobs, versions, reports, applications, deadlines, terms and courses.');
