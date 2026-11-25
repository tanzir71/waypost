import {routes,routePath} from '../routes.js';
import {decodeText,encodeText,httpURL} from './index.js';
const types={
  today:{action:'text'},match:{job:'text',resume:'text',jdText:'encoded',resumeText:'encoded',import:'bool'},
  parse:{resume:'text',text:'encoded'},resumes:{resume:'text',mode:'text'},
  tracker:{view:'text',stage:'text',selected:'text',add:'bool',edit:'bool',title:'text',company:'text',url:'url',notes:'encoded'},
  gpa:{current:'number',completed:'number',target:'number',remaining:'number',scaleId:'text',termId:'text',scope:'text',locked:'locks'},
  finals:{weights:'numbers',scores:'numbers',target:'text',scaleId:'text',course:'text',categories:'json'},
  scales:{scaleId:'text',value:'number',to:'strings',institutionId:'text',cohort:'json',table:'json'},
  letters:{job:'text',resume:'text',tab:'text',draft:'encoded'},offers:{selected:'strings',offers:'json',weights:'json'},
  deadlines:{month:'text',id:'text',date:'text',title:'text',kind:'text'},contacts:{id:'text',q:'text'},
  agents:{tool:'text',input:'json'},settings:{section:'text',action:'text'},setup:{provider:'text',endpoint:'url'},
  share:{title:'text',company:'text',url:'url',text:'encoded'},import:{job:'text',paste:'bool',text:'encoded'}
};
const external={gpa:{completed:'credits',scaleId:'scale',termId:'term'},finals:{weights:'w',scores:'s',scaleId:'scale'},scales:{scaleId:'from'},match:{jdText:'jd'}};
const numeric=value=>{if((typeof value!=='number'&&typeof value!=='string')||String(value).trim()===''||!Number.isFinite(Number(value)))throw new Error('Use finite numbers in tool links.');return Number(value);};
function safeJSON(value,depth=0) {
  if(depth>12)throw new Error('Tool link is nested too deeply.');
  if(value===null||['string','boolean'].includes(typeof value))return value;
  if(typeof value==='number'){numeric(value);return value;}
  if(Array.isArray(value)){if(value.length>1000)throw new Error('Tool link contains too many items.');return value.map(item=>safeJSON(item,depth+1));}
  if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new Error('Tool link must contain plain JSON data.');
  const result={};
  for(const [key,item]of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))throw new Error('Unsafe tool-link property.');result[key]=safeJSON(item,depth+1);}
  return result;
}
function coerce(kind,value,fromURL=false) {
  if(kind==='bool'){if(fromURL&&['0','1'].includes(value))return value==='1';if(typeof value!=='boolean')throw new Error('Use 1 or 0 for tool-link switches.');return value;}
  if(kind==='number')return numeric(value);
  if(kind==='numbers')return (fromURL?(value===''?[]:value.split(',')):value).map(numeric);
  if(kind==='strings'){const rows=fromURL?(value?value.split(','):[]):value;if(!Array.isArray(rows)||rows.some(row=>typeof row!=='string'))throw new Error('Expected a list of names.');return rows;}
  if(kind==='locks'){
    const rows=fromURL?(value?value.split(',').map(pair=>{const colon=pair.indexOf(':');if(colon<1)throw new Error('Locks use COURSE:GRADE.');return {courseId:pair.slice(0,colon),grade:pair.slice(colon+1)};}):[]):value;
    if(!Array.isArray(rows)||rows.some(row=>typeof row.courseId!=='string'||typeof row.grade!=='string'||!row.grade))throw new Error('Locks need course IDs and grade letters.');return rows;
  }
  if(kind==='json'){const data=safeJSON(fromURL?JSON.parse(decodeText(value)):value);if(new TextEncoder().encode(JSON.stringify(data)).length>32768)throw new Error('Tool link is too large. Paste instead.');return data;}
  if(typeof value!=='string')throw new Error('Tool-link text must be a string.');
  if(kind==='encoded'){const decoded=fromURL?decodeText(value):value;if(new TextEncoder().encode(decoded).length>32768)throw new Error('Tool link is too large. Paste instead.');return decoded;}
  if(new TextEncoder().encode(value).length>32768)throw new Error('Tool link is too large. Paste instead.');
  if(kind==='url'&&value&&!httpURL(value))throw new Error('Tool links accept HTTP(S) URLs without credentials.');
  return value;
}
export function normalizeLinkState(route,state) {
  if(!types[route])throw new Error('Unknown Waypost tool.');
  safeJSON(state);const normalized={};
  for(const [key,value]of Object.entries(state))if(types[route][key]&&value!==undefined)normalized[key]=coerce(types[route][key],value);
  if(route==='gpa')for(const key of ['current','completed','target','remaining'])if(normalized[key]!==undefined&&(normalized[key]<0||normalized[key]>100000))throw new Error('GPA link numbers are out of range.');
  if(route==='tracker'&&normalized.view&&!['board','table'].includes(normalized.view))throw new Error('Tracker view must be board or table.');
  return normalized;
}
export function parseDeepLink(route,hash='') {
  if(String(hash).length>90000)throw new Error('Tool link is too large. Paste instead.');
  const params=new URLSearchParams(String(hash).replace(/^#/,'')),fields=types[route];if(!fields)throw new Error('Unknown Waypost tool.');
  let state={};
  // M4 links remain readable. New links use the documented individual fields.
  if(params.has('plan')){const plan=safeJSON(JSON.parse(decodeText(params.get('plan'))));if(!plan||Array.isArray(plan)||typeof plan!=='object')throw new Error('A tool plan must be an object.');state=normalizeLinkState(route,plan);}
  for(const [key,kind]of Object.entries(fields)) {
    const name=external[route]?.[key]??key;
    if(params.has(name))state[key]=coerce(kind,params.get(name),true);
  }
  const autorun=params.get('autorun')==='1';
  if(params.has('autorun')&&!['0','1'].includes(params.get('autorun')))throw new Error('autorun must be 1 or 0.');
  return {state:normalizeLinkState(route,state),autorun,provided:Object.keys(state).length>0};
}
export function buildDeepLink(route,state={}, {basePath='/',autorun=false}={}) {
  if(!basePath.startsWith('/')||basePath.startsWith('//')||/[?#]/.test(basePath))throw new Error('Use a local deployment base path.');
  const record=routes.find(item=>item.id===route);if(!record)throw new Error('Unknown Waypost tool.');
  const params=new URLSearchParams();
  for(const [key,value]of Object.entries(normalizeLinkState(route,state))) {
    const kind=types[route][key],name=external[route]?.[key]??key;
    const encoded=kind==='json'?encodeText(JSON.stringify(value)):kind==='encoded'?encodeText(value):kind==='bool'?(value?'1':'0'):kind==='locks'?value.map(row=>`${row.courseId}:${row.grade}`).join(','):Array.isArray(value)?value.join(','):String(value);
    params.set(name,encoded);
  }
  if(autorun)params.set('autorun','1');
  const fragment=params.toString();if(fragment.length>90000)throw new Error('Tool link is too large. Paste instead.');
  return `${basePath.replace(/\/?$/,'/')}${routePath(record)}${fragment?'#'+fragment:''}`;
}
export const linkFields=route=>Object.keys(types[route]??{});
