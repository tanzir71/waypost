import {calendarEvents,calendarSources} from '../core/calendar/index.js';
import {buildCalendarICS,validatePublishedICS} from '../core/calendar/ics.js';
import {builtInScales} from '../core/scales/index.js';
import {calendarToken,calendarFeedURL,newCalendarPublication} from '../core/calendar/publication.js';
import {digest} from '../core/sync/crypto.js';
export async function readCalendar(store){const records=Object.fromEntries(await Promise.all(['deadlines','applications','jobs','courses','offers'].map(async type=>[type,await store.all(type)]))),scales=[...builtInScales(),...await store.all('scales')];return {records,scales,events:calendarEvents(records,{scales}),sources:calendarSources(records,{scales})};}
export async function calendarPreview(store){const {events}=await readCalendar(store),selected=events.filter(row=>row.publish),ics=buildCalendarICS(selected);validatePublishedICS(ics);return {events:selected,ics,hash:await digest(ics)};}
export async function setEventPublished(store,event,publish){if(!['deadlines','applications','offers','courses'].includes(event.source))throw new Error('Unknown calendar source.');const row=await store.get(event.source,event.sourceId);if(!row||row.deleted)throw new Error('This calendar item no longer exists.');return store.save(event.source,{...row,publish:!!publish,sample:false});}
const visibleStatus=(metadata,session,token,count)=>({state:'published',url:calendarFeedURL({...session,token}),version:metadata.version,updatedAt:metadata.updatedAt,count});
export async function refreshCalendarPublication({store,session,transport,active=()=>true}){
  const metadata=await transport.request('/calendar',{auth:session});if(!active())return null;if(!metadata.published)return {state:'off',version:metadata.version};
  const token=await calendarToken(session,metadata.nonce),preview=await calendarPreview(store);calendarFeedURL({...session,token});if(!active())return null;let current=metadata;
  if(preview.hash!==metadata.contentHash)current=await transport.request('/calendar',{method:'PUT',auth:session,data:{token,version:metadata.version,ics:preview.ics}});
  return active()?visibleStatus(current,session,token,preview.events.length):null;
}
export async function publishCalendar({store,session,transport,expectedHash,expectedVersion}){
  const preview=await calendarPreview(store);if(!preview.events.length)throw new Error('Select at least one deadline to publish.');if(expectedHash&&preview.hash!==expectedHash)throw new Error('Selected deadlines changed. Review the calendar preview again.');
  if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw new Error('Sync and review the publication state before publishing.');
  const publication=await newCalendarPublication(session);calendarFeedURL({...session,token:publication.token});const current=await transport.request('/calendar',{method:'POST',auth:session,data:{...publication,ics:preview.ics,expectedVersion}});
  return visibleStatus(current,session,publication.token,preview.events.length);
}
export async function revokeCalendar({session,transport}){const metadata=await transport.request('/calendar',{auth:session});return {state:'off',...await transport.request('/calendar',{method:'DELETE',auth:session,data:{expectedVersion:metadata.version}})};}
