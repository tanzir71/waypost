import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {calendarEvents,monthDays,adjacentMonth,agenda,deadlineInput,calendarDate} from '../core/calendar/index.js';
import {buildCalendarICS,validatePublishedICS,foldCalendarLine,escapeCalendarText,MAX_FEED_BYTES} from '../core/calendar/ics.js';
import {builtInScales} from '../core/scales/index.js';
import {calendarFeedURL} from '../core/calendar/publication.js';
import {base64url} from '../core/sync/protocol.js';
const a='019a9250-0000-7000-8000-000000000001',b='019a9250-0000-7000-8000-000000000002',c='019a9250-0000-7000-8000-000000000003',updatedAt='2026-11-26T00:00:00.000Z';

test('calendar uses Monday-start complete weeks, leap days, year transitions and exactly ten agenda dates',()=>{
 const december=monthDays('2026-12');assert.equal(december.length,35);assert.equal(december[0].date,'2026-11-30');assert.equal(december.at(-1).date,'2027-01-03');assert.equal(december.filter(row=>row.inMonth).length,31);assert.equal(monthDays('2026-11').length,42);assert.equal(monthDays('2028-02').filter(row=>row.inMonth).length,29);assert.equal(adjacentMonth('2026-12',1),'2027-01');assert.equal(adjacentMonth('2026-01',-1),'2025-12');assert.throws(()=>calendarDate('2026-02-29'));
 const rows=Array.from({length:12},(_,i)=>({date:`2026-12-${String(i+1).padStart(2,'0')}`}));assert.equal(agenda(rows,'2026-12-01').length,10);assert.equal(agenda(rows,'2026-12-01').at(-1).date,'2026-12-10');
});
test('combined sources use real tracker dates, offer decisions and dated finals; linked manual entries replace derived duplicates',()=>{
 const records={jobs:[{id:'job',company:'Halcyon',title:'Engineer'}],applications:[{id:a,jobId:'job',stage:'interview',next:{label:'Onsite',at:'2026-12-03T12:00:00.000Z'},updatedAt},{id:'closed',stage:'closed',next:{at:'2026-12-01T12:00:00.000Z'}}],offers:[{id:b,company:'Beacon',decideBy:'2026-12-05',updatedAt}],courses:[{id:c,name:'CSE 331',examDate:'2026-12-07',scaleId:'bd-ugc',targetGrade:'A',categories:[{weight:20,score:92},{weight:10,score:85},{weight:30,score:78},{weight:40,score:null}],updatedAt}]};
 const rows=calendarEvents(records,{scales:builtInScales()});assert.equal(rows.length,3);assert.equal(rows[0].title,'Halcyon · Onsite');assert.equal(rows[2].detail,'Need 61.8% for A');assert.equal(rows[0].publish,false);
 records.deadlines=[{id:'manual',title:'My exam entry',date:'2026-12-08',kind:'exam',linkedId:c,publish:true,updatedAt}];const linked=calendarEvents(records,{scales:builtInScales()});assert.equal(linked.length,3);assert.ok(!linked.some(row=>row.source==='courses'));assert.equal(linked.at(-1).title,'My exam entry');assert.equal(linked.at(-1).publish,true);assert.equal(deadlineInput({title:' Name ',date:'2026-12-05'}).title,'Name');assert.throws(()=>deadlineInput({title:'',date:'2026-12-05'}));
});
test('ICS exactly matches the RFC 5545 snapshot with stable UIDs, CRLF and exclusive next-day end',async()=>{
 const rows=[{id:a,title:'CSE 331 final, bring ID; Room A\\B\nCheck notice',date:'2026-12-07',updatedAt},{id:b,title:'Beacon decision',date:'2026-12-05',updatedAt}];const text=buildCalendarICS(rows),snapshot=await readFile(new URL('./fixtures/deadlines.ics',import.meta.url),'utf8');assert.equal(text,snapshot);assert.deepEqual(validatePublishedICS(text),{text,count:2});assert.equal(text,buildCalendarICS([...rows].reverse()));assert.ok(!text.includes('DESCRIPTION:'));assert.throws(()=>buildCalendarICS([rows[0],rows[0]]));
});
test('UTF-8 folding counts octets without splitting characters and published feeds reject injection/extra properties',()=>{
 const title='বাংলা পরীক্ষার সময়সূচি '.repeat(10),text=buildCalendarICS([{id:a,title,date:'2026-12-07',updatedAt}]);assert.equal(validatePublishedICS(text).count,1);for(const line of text.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);assert.ok(text.includes('\r\n '));assert.ok(!text.includes('\uFFFD'));assert.equal(foldCalendarLine('A'.repeat(76)),'A'.repeat(75)+'\r\n A');assert.equal(escapeCalendarText('A,B;C\\D\nE'),'A\\,B\\;C\\\\D\\nE');
 for(const invalid of [text.replace('END:VEVENT','URL:secret\r\nEND:VEVENT'),text.replace('SUMMARY:','DESCRIPTION:'),text.replaceAll('\r\n','\n'),'x'.repeat(MAX_FEED_BYTES+1)])assert.throws(()=>validatePublishedICS(invalid));
 const attack=buildCalendarICS([{id:a,title:'Title\nATTENDEE:fake',date:'2026-12-07',updatedAt}]);assert.equal(validatePublishedICS(attack).count,1);assert.ok(!attack.includes('\r\nATTENDEE:'));
  const token=base64url(new Uint8Array(32)),options={endpoint:'https://waypost.test/api/sync',provider:'cloudflare',token};assert.equal(calendarFeedURL({...options,icsUrl:'/custom-calendar'}),`https://waypost.test/custom-calendar/${token}.ics`);assert.throws(()=>calendarFeedURL({...options,icsUrl:'https://elsewhere.test/calendar'}));
});
