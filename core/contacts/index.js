import {httpURL} from '../links/index.js';
import {calendarDate} from '../calendar/index.js';
export const interactionKinds=['note','contacted','referral','interview','other'];
const text=(value,label,max=10000)=>{if(typeof value!=='string'||value.length>max)throw new Error(`${label} must be text up to ${max} characters.`);return value.trim();};
export function contactInput(input){
  if(!input||typeof input!=='object')throw new Error('Supply contact details.');const name=text(input.name??'','Name',200);if(!name)throw new Error('Enter a contact name.');
  const link=text(input.link??'','Link',2000),email=text(input.email??'','Email',320);if(link&&!httpURL(link))throw new Error('Use an HTTP or HTTPS contact link without credentials.');if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter an email address or leave it blank.');
  const remindAt=input.remindAt??null;if(remindAt!==null){if(typeof remindAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(remindAt)||!Number.isFinite(Date.parse(remindAt)))throw new Error('Enter a valid reminder date.');calendarDate(remindAt.slice(0,10));}
  return {name,company:text(input.company??'','Company',200),role:text(input.role??'','Role',200),link:link?httpURL(link):'',email,notes:text(input.notes??'','Notes'),remindAt:remindAt?new Date(remindAt).toISOString():null};
}
export function addInteraction(contact,{id,at,kind='note',event}){
  const message=text(event,'Interaction',10000);if(!message)throw new Error('Enter an interaction note.');if(typeof id!=='string'||!id||typeof at!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(at)||!Number.isFinite(Date.parse(at))||!interactionKinds.includes(kind))throw new Error('Invalid interaction identity, date or kind.');calendarDate(at.slice(0,10));
  const history=[...(contact.history??[])];if(history.length>=1000)throw new Error('Export or shorten this contact’s history before adding more than 1000 entries.');if(history.some(row=>row.id===id))throw new Error('This interaction already exists.');history.push({id,at:new Date(at).toISOString(),kind,event:message});history.sort((a,b)=>a.at.localeCompare(b.at)||String(a.id??'').localeCompare(String(b.id??'')));return {...contact,history};
}
export const removeInteraction=(contact,id)=>({...contact,history:(contact.history??[]).filter(row=>row.id!==id)});
export function contactSummary(contacts,{day,q=''}={}){
  calendarDate(day);const query=String(q).normalize('NFKC').toLowerCase().trim();
  return contacts.filter(row=>!row.deleted).filter(row=>!query||[row.name,row.company,row.role,row.email,row.notes].some(value=>String(value??'').normalize('NFKC').toLowerCase().includes(query))).map(row=>({...row,due:!!row.remindAt&&row.remindAt.slice(0,10)<=day,lastContactAt:(row.history??[]).filter(event=>event.kind==='contacted').map(event=>event.at).sort().at(-1)??null})).sort((a,b)=>Number(b.due)-Number(a.due)||String(a.name??'').localeCompare(String(b.name??''))||a.id.localeCompare(b.id));
}
