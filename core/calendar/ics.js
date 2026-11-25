import {calendarDate,dayAfter} from './index.js';
import {requireUUID,bytesLength} from '../sync/protocol.js';
export const MAX_FEED_BYTES=256*1024,MAX_FEED_EVENTS=1000;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const header=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Waypost//Deadlines//EN','CALSCALE:GREGORIAN'];
function titleText(value){if(typeof value!=='string')throw new Error('Use a calendar title.');const text=value.replace(/\r\n?/g,'\n');if(!text.trim()||text.length>1000||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(text)||decoder.decode(encoder.encode(text))!==text)throw new Error('Use a nonempty calendar title up to 1000 characters without control characters.');return text;}
export function escapeCalendarText(value){return titleText(value).replaceAll('\\','\\\\').replaceAll(';','\\;').replaceAll(',','\\,').replaceAll('\n','\\n');}
export function foldCalendarLine(value){
  const lines=[];let line='',size=0;for(const character of value){const bytes=encoder.encode(character).length;if(size+bytes>75){lines.push(line);line=' ';size=1;}line+=character;size+=bytes;}lines.push(line);return lines.join('\r\n');
}
function stamp(value){if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw new Error('A valid record update timestamp is required.');const iso=new Date(value).toISOString();if(!/^\d{4}-/.test(iso))throw new Error('Invalid calendar timestamp.');return iso.replaceAll('-','').replaceAll(':','').replace(/\.\d{3}Z$/,'Z');}
export function buildCalendarICS(events){
  if(!Array.isArray(events)||events.length>10000)throw new Error('Export up to 10,000 calendar events at a time.');const seen=new Set(),lines=[...header];
  for(const row of [...events].sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.id).localeCompare(String(b.id)))){
    requireUUID(row.id);if(seen.has(row.id))throw new Error('Duplicate calendar UID.');seen.add(row.id);calendarDate(row.date);
    lines.push('BEGIN:VEVENT',`UID:${row.id}@waypost`,`DTSTAMP:${stamp(row.updatedAt)}`,`DTSTART;VALUE=DATE:${row.date.replaceAll('-','')}`,`DTEND;VALUE=DATE:${dayAfter(row.date).replaceAll('-','')}`,`SUMMARY:${escapeCalendarText(row.title)}`,'END:VEVENT');
  }lines.push('END:VCALENDAR');return lines.map(foldCalendarLine).join('\r\n')+'\r\n';
}
function unescapeText(value){let output='';for(let i=0;i<value.length;i++){if(value[i]!=='\\'){output+=value[i];continue;}const next=value[++i];if(!['\\',';',',','n'].includes(next))throw new Error('Invalid calendar text escape.');output+=next==='n'?'\n':next;}return output;}
function dateValue(value){if(!/^\d{8}$/.test(value))throw new Error('Invalid calendar DATE.');return calendarDate(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6)}`);}
// Publication is restricted to the canonical titles-and-dates format produced
// above. URLs, descriptions, attendees and arbitrary calendar properties fail.
export function validatePublishedICS(text){
  if(typeof text!=='string'||bytesLength(text)>MAX_FEED_BYTES||decoder.decode(encoder.encode(text))!==text)throw new Error('Published calendar must be valid UTF-8 and at most 256 KB.');
  if(!text.endsWith('\r\n')||text.replaceAll('\r\n','').match(/[\r\n]/)||text.split('\r\n').some(line=>bytesLength(line)>75))throw new Error('Invalid calendar line endings or folding.');
  const lines=text.replace(/\r\n[ \t]/g,'').slice(0,-2).split('\r\n');if(header.some((line,i)=>lines[i]!==line)||lines.at(-1)!=='END:VCALENDAR')throw new Error('Invalid calendar header.');
  const events=[];for(let i=header.length;i<lines.length-1;i+=7){const part=lines.slice(i,i+7);if(part[0]!=='BEGIN:VEVENT'||part[6]!=='END:VEVENT'||!part[1].startsWith('UID:')||!part[2].startsWith('DTSTAMP:')||!part[3].startsWith('DTSTART;VALUE=DATE:')||!part[4].startsWith('DTEND;VALUE=DATE:')||!part[5].startsWith('SUMMARY:'))throw new Error('Published calendars contain only event titles and dates.');
    const uid=part[1].slice(4);if(!uid.endsWith('@waypost'))throw new Error('Invalid calendar UID.');const id=requireUUID(uid.slice(0,-8)),date=dateValue(part[3].slice(19)),end=part[4].slice(17),time=part[2].slice(8);
    if(end!==dayAfter(date).replaceAll('-','')||!/^\d{8}T\d{6}Z$/.test(time))throw new Error('Invalid all-day event.');const updatedAt=`${time.slice(0,4)}-${time.slice(4,6)}-${time.slice(6,8)}T${time.slice(9,11)}:${time.slice(11,13)}:${time.slice(13,15)}.000Z`;
    if(stamp(updatedAt)!==time)throw new Error('Invalid calendar timestamp.');events.push({id,date,updatedAt,title:unescapeText(part[5].slice(8))});
  }
  if(events.length>MAX_FEED_EVENTS||buildCalendarICS(events)!==text)throw new Error('Use a canonical calendar of at most 1000 selected events.');return {text,count:events.length};
}
