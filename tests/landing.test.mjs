import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,stat } from 'node:fs/promises';
import { matchResume,summarizeReport } from '../core/match/index.js';
import { files } from '../scripts/files.mjs';
const root=new URL('../',import.meta.url);

test('the deployed hero sample reproduces the independently committed Figma fixture',async()=>{
  const seed=JSON.parse(await readFile(new URL('data/demo.json',root),'utf8'));
  const fixture=JSON.parse(await readFile(new URL('tests/fixtures/hero.json',root),'utf8'));
  const report=matchResume(seed.resumeVersions[0],seed.jobs[0],{now:'2026-11-25'});
  assert.deepEqual({tier:report.tier,...summarizeReport(report)},fixture.expected);
  const serialized=JSON.parse(JSON.stringify(report));
  assert.equal(typeof serialized.checks.keywordCoverage,'number');
  assert.equal(serialized.required.length,3);
});

test('all committed HTML assets and local navigation targets resolve at a nested base path',async()=>{
  const pages=(await files(root)).filter(path=>path.endsWith('.html') && !path.endsWith('_shell.html'));
  const base=new URL('https://example.test/waypost/');
  for(const path of pages) {
    const html=await readFile(new URL(path,root),'utf8');
    for(const match of html.matchAll(/(?:src|href)="([^\"]+)"/g)) {
      const ref=match[1];
      if(ref.startsWith('#') || /^[a-z]+:/i.test(ref)) continue;
      const resolved=new URL(ref,new URL(path,base));
      assert.ok(resolved.pathname.startsWith(base.pathname),`${path}: escaped base ${ref}`);
      let local=decodeURIComponent(resolved.pathname.slice(base.pathname.length));
      if(!local || local.endsWith('/')) local+='index.html';
      assert.ok((await stat(new URL(local,root))).isFile(),`${path}: missing ${ref}`);
    }
  }
});

test('every first-party module import and CSS resource resolves locally',async()=>{
  for(const path of (await files(root)).filter(path=>/\.(js|mjs|css)$/.test(path) && !/^(vendor|tests)\//.test(path))) {
    const source=await readFile(new URL(path,root),'utf8');
    for(const match of source.matchAll(/(?:\bfrom\s*['"]|\bimport\s*['"]|url\(["']?)(\.[^'"\s)]+)/g)) {
      const target=new URL(match[1],new URL(path,root));
      assert.ok((await stat(target)).isFile(),`${path}: missing ${match[1]}`);
    }
  }
});

test('landing advertises only shipped tools and includes dated comparison sources',async()=>{
  const html=await readFile(new URL('index.html',root),'utf8');
  const data=JSON.parse(await readFile(new URL('data/competitors.json',root),'utf8'));
  assert.ok(html.includes(data.verifiedAt));
  for(const plan of data.plans) {
    assert.ok(html.includes(plan.source));
    assert.ok(html.includes(plan.displayPrice));
  }
  assert.match(html,/type="module" src="\.\/ui\/landing\.js"/);
  assert.match(html,/Live demo — runs in this page/);
  assert.match(html,/id="hero-file"[^>]*accept="\.pdf,\.docx,\.txt,\.json"/);
  const shipped=['tool-match','tool-parse','tool-resumes','tool-tracker','tool-gpa','tool-finals','tool-scales','tool-offers','tool-deadlines','tool-letters','tool-stories','tool-contacts'];
  for(const card of html.matchAll(/<a class="tool-card[^\"]*"([^>]*)>([\s\S]*?)<\/a>/g)) assert.match(card[2],shipped.some(id=>card[1].includes(id))?/>MVP</:/>Soon</);
  const structured=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match=>JSON.parse(match[1]));
  assert.equal(structured.find(item=>item['@type']==='SoftwareApplication').offers.price,'0');
  assert.equal(structured.find(item=>item['@type']==='FAQPage').mainEntity.length,3);
});
