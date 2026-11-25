import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { matchResume,extractRequirements,indexResume,normalize,yearsOfExperience,summarizeReport } from '../core/match/index.js';
import { stem } from '../core/match/stem.js';
const fixture=JSON.parse(await readFile(new URL('./fixtures/hero.json',import.meta.url),'utf8'));

test('hero fixture reproduces Good with 4 met, 1 partial and 1 missing',()=>{
  const report=matchResume(fixture.resume,fixture.job,{now:'2026-11-25'});
  assert.deepEqual({tier:report.tier,...summarizeReport(report)},fixture.expected);
  assert.equal(report.required[1].status,'partial');
  assert.equal(report.preferred[0].status,'missing');
  assert.ok(Number.isFinite(report.checks.keywordCoverage));
  for(const row of [...report.required,...report.preferred]) if(row.evidence) assert.equal(fixture.resume.text.split('\n')[row.evidence.lineIndex-1],row.evidence.line);
});
test('requirements handle inline sections, alternatives and boilerplate',()=>{
  const rows=extractRequirements('Engineer\nRequired: Go or Rust; PostgreSQL\nPreferred: Kafka, Terraform\nBenefits\nFree lunches\nEqual opportunity employer');
  assert.deepEqual(rows.map(r=>[r.text,r.kind]),[['Go or Rust','required'],['PostgreSQL','required'],['Kafka','preferred'],['Terraform','preferred']]);
});
test('normalization aliases skills and stems morphology without changing evidence',()=>{
  assert.deepEqual(normalize('JS ts k8s postgres pg'),['javascript','typescript','kubernet','postgresql','postgresql']);
  assert.equal(stem('relational'),'relat');
  assert.equal(stem('running'),'run');
  assert.equal(indexResume('SKILLS\nPostgres').lines[1].line,'Postgres');
});
test('overlapping dated jobs count once and education does not count as tenure',()=>{
  assert.equal(yearsOfExperience('EXPERIENCE\nEngineer Jan 2019–Dec 2022\nEngineer Jan 2021–Dec 2024\nEDUCATION\nUniversity 2010–2018','2026-11-25'),6);
});
test('skills-only and insufficient numeric evidence stay partial',()=>{
  const report=matchResume({text:'EXPERIENCE\nEngineer Jan 2024–Dec 2024\nBuilt Go services.\nSKILLS\nPostgres'},{text:'Required:\n5+ years Go\nPostgreSQL'});
  assert.deepEqual(report.required.map(row=>row.status),['partial','partial']);
});
test('an explicitly failed knockout caps the tier and unanswered questions are not scored',()=>{
  const job={...fixture.job,text:fixture.job.text+'\nWork authorization without sponsorship?'};
  const report=matchResume(fixture.resume,job,{knockoutAnswers:{'Work authorization without sponsorship?':false}});
  assert.equal(report.tier,'partial');
  assert.equal(report.knockouts[0].answered,false);
  assert.equal(summarizeReport(report).total,6);
});
test('empty job has no invented evidence and stuffing is flagged',()=>{
  assert.equal(matchResume({text:'Go'},{text:''}).tier,'limited');
  const report=matchResume({text:'EXPERIENCE\nGo Go Go Go Go Go'},{text:'Required: Go'});
  assert.ok(report.stuffingWarnings.length);
});
