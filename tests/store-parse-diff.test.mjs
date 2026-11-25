import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {migrateLegacy} from '../core/store/migration.js';
import {validateWorkspace,validate,assertRecord} from '../core/store/schema.js';
import {analyzeText,readPdfLayout} from '../core/parse/index.js';
import {diffText,wordDiff,matchingEffect} from '../core/diff/index.js';
const legacy=await readFile(new URL('./fixtures/legacy-localstorage.json',import.meta.url),'utf8');
test('legacy localStorage conversion preserves content, maps references and recomputes evidence',()=>{
  const records=migrateLegacy(legacy,{idFor:key=>`mapped-${key}`,now:'2026-11-25T00:00:00.000Z',deviceId:'test-device'});
  assert.equal(records.resumeVersions[0].label,'Backend CV');
  assert.equal(records.jobs[0].source,'file');
  assert.equal(records.matchReports[0].jobId,records.jobs[0].id);
  assert.equal(records.matchReports[0].resumeVersionId,records.resumeVersions[0].id);
  assert.equal(records.matchReports[0].required[0].evidence.line,'Built Go services with PostgreSQL databases.');
  assert.equal(records.settings.find(row=>row.key==='legacy-archive').value.results[0].bestScore,72);
  for(const [type,rows] of Object.entries(records)) rows.forEach(row=>assertRecord(type,row));
  assert.equal(JSON.parse(legacy).results[0].bestScore,72);
});
test('workspace schema rejects wrong shapes, duplicate IDs, corrupt dates and nested enum values',()=>{
  const records=migrateLegacy(legacy,{idFor:key=>key,now:'2026-11-25T00:00:00.000Z',deviceId:'device'});
  delete records.settings;
  const workspace={format:'waypost-workspace',version:1,exportedAt:'2026-11-25T00:00:00.000Z',records};
  assert.equal(validateWorkspace(workspace).valid,true);
  workspace.records.jobs.push(workspace.records.jobs[0]);
  assert.equal(validateWorkspace(workspace).valid,false);
  assert.ok(validate('2026-99-50',{type:'string',format:'date'}).length);
  assert.ok(validateWorkspace({...workspace,records:{settings:{ai:{provider:'enabled'}}}}).errors.length);
  assert.throws(()=>migrateLegacy('{}',{}),/not valid/);
});
test('parse issues flag inconsistent dates, ratings, missing contact and garbled Unicode by line',()=>{
  const report=analyzeText('SUMMARY\nEngineer\nEXPERIENCE\nEngineer Mar 2021–Present\nEngineer 03/2019–02/2021\nSKILLS\nGo ★★★ \uFFFD');
  assert.equal(report.status,'problems');
  for(const code of ['contact','dates','symbols','unicode']) assert.ok(report.issues.some(issue=>issue.code===code),code);
  assert.ok(report.lines[6].issues.includes('symbols'));
  assert.equal(report.text.split('\n')[6],report.lines[6].text);
});
test('PDF layout detects columns, reads each column in order and tracks header/footer contact',()=>{
  const item=(str,x,y)=>({str,width:80,transform:[1,0,0,12,x,y]});
  const layout=readPdfLayout([{width:600,height:800,items:[item('email@example.test',20,790),item('Left one',20,600),item('Right one',350,600),item('Left two',20,580),item('Right two',350,580)]}]);
  assert.equal(layout.warnings[0].code,'columns');
  assert.ok(layout.text.indexOf('Left two')<layout.text.indexOf('Right one'));
  const report=analyzeText(layout.text,layout);
  assert.ok(report.issues.some(issue=>issue.code==='contact'));
});
test('plain text checks do not invent font-embedding metadata or numeric outcomes',()=>{
  const report=analyzeText('Name\nname@example.test\nEXPERIENCE\n• Built tools.\n• Cut build time 20%.\nEDUCATION\nDegree\nSKILLS\nGo');
  assert.equal(report.checks.find(check=>check.key==='fonts').status,'partial');
  assert.equal(report.checks.find(check=>check.key==='quantified').detail,'1 of 2 bullets carry a number.');
});
test('line and word diffs round-trip both inputs with truthful additions and removals',()=>{
  const before='SUMMARY\nBuilt billing systems.\nSame line',after='SUMMARY\nBuilt reliable Go systems.\nSame line\nMentored 4 engineers.';
  const diff=diffText(before,after);
  assert.equal(diff.filter(row=>row.type!=='added').map(row=>row.text).join('\n'),before);
  assert.equal(diff.filter(row=>row.type!=='removed').map(row=>row.text).join('\n'),after);
  assert.ok(diff.find(row=>row.type==='removed').words.some(word=>word.type==='equal'));
  const words=wordDiff('cut costs','cut costs 22%');
  assert.equal(words.filter(word=>word.type==='added').map(word=>word.text).join(''),' 22%');
});
test('matching effect compares only common jobs and the median tier',()=>{
  assert.deepEqual(matchingEffect([{jobId:'a',tier:'good'},{jobId:'x',tier:'limited'}],[{jobId:'a',tier:'strong'},{jobId:'b',tier:'limited'}]),{jobs:1,before:'good',after:'strong'});
});
