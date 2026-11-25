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
await writeFile(new URL('data/workspace-demo.json',root),JSON.stringify({resumeVersions,jobs,matchReports},null,2)+'\n');
console.log('Generated sample workspace: 12 jobs, 3 versions, 36 evidence reports.');
