export const weightKeys=['compensation','growth','flexibility','team'];
export const defaultWeights=()=>({compensation:40,growth:30,flexibility:20,team:10});
const number=(value,label,{min=0,max=1e12}={})=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(`${label} must be between ${min} and ${max}.`);return value;};
export function validateWeights(weights){
  if(!weights||typeof weights!=='object'||weightKeys.some(key=>!Object.hasOwn(weights,key))||Object.keys(weights).some(key=>!weightKeys.includes(key)))throw new Error('Supply the four priority weights.');
  const result=Object.fromEntries(weightKeys.map(key=>[key,number(weights[key],key,{max:100})]));if(Math.abs(Object.values(result).reduce((sum,n)=>sum+n,0)-100)>1e-8)throw new Error('Priority weights must total 100%.');return result;
}
export const offerPreferences=value=>({weights:validateWeights(value?.weights??defaultWeights())});
export function calculateOffer(offer){
  if(!offer||typeof offer!=='object'||Array.isArray(offer))throw new Error('Supply an offer.');
  for(const key of ['id','company','role','location','vesting','costCity','commute','notes'])if(offer[key]!==undefined&&(typeof offer[key]!=='string'||offer[key].length>10000))throw new Error(`Use text for offer ${key}.`);
  if(offer.deleted!==undefined&&typeof offer.deleted!=='boolean')throw new Error('Use a boolean for deleted.');
  const currency=String(offer.currency??'GBP').toUpperCase();if(!/^[A-Z]{3}$/.test(currency))throw new Error('Use a three-letter currency code.');
  const fields=Object.fromEntries(['base','bonusTarget','equityPerYear','signing','benefitsValue'].map(key=>[key,number(offer[key]??0,key)])),colIndex=number(offer.colIndex??100,'Cost-of-living index',{min:0.01,max:1e6}),cliffMonths=number(offer.cliffMonths??0,'Cliff months',{max:120});if(!Number.isInteger(cliffMonths))throw new Error('Cliff months must be a whole number.');
  const total=Object.values(fields).reduce((sum,value)=>sum+value,0),adjusted=total/(colIndex/100),withoutEquity=total-fields.equityPerYear;
  let vested=offer.vestedEquityYear1;
  if(vested!==undefined&&vested!==null)vested=number(vested,'Year-1 vested equity');else vested=fields.equityPerYear===0||cliffMonths>=12?0:cliffMonths===0?fields.equityPerYear:null;
  const ratings={};for(const key of weightKeys.filter(key=>key!=='compensation'))ratings[key]=offer.ratings?.[key]===undefined||offer.ratings[key]===null?null:number(offer.ratings[key],`${key} rating`,{max:10});
  return {...offer,...fields,currency,colIndex,cliffMonths,ratings,total,adjusted,year1Cash:vested===null?null:withoutEquity+vested,vestedEquityYear1:vested,cashNote:'Year-1 cash estimate includes the entered benefits value and target bonus; it is not take-home pay. A partial-year cliff needs an explicit vested-equity estimate.'};
}
export function compareOffers(offers,{weights=defaultWeights(),allowInvalidWeights=false}={}){
  let priorities,weightsError=null;try{priorities=validateWeights(weights);}catch(error){if(!allowInvalidWeights)throw error;priorities=null;weightsError=error.message;}if(!Array.isArray(offers)||offers.length>12)throw new Error('Compare up to 12 offers.');
  const rows=offers.map(calculateOffer).filter(row=>!row.deleted),currencies=new Set(rows.map(row=>row.currency));if(currencies.size>1)throw new Error('Compare one currency at a time. Convert amounts yourself before comparing; no exchange rate is assumed.');
  const maximum=Math.max(0,...rows.map(row=>row.adjusted));
  for(const row of rows){const values={...row.ratings,compensation:maximum>0?10*row.adjusted/maximum:0};row.weightedScore=!priorities||weightKeys.some(key=>priorities[key]>0&&values[key]===null)?null:weightKeys.reduce((sum,key)=>sum+(values[key]??0)*priorities[key]/100,0);row.compensationRating=values.compensation;}
  const best=Object.fromEntries(['base','bonusTarget','equityPerYear','signing','benefitsValue','total','adjusted'].map(key=>[key,Math.max(0,...rows.map(row=>row[key]))]));
  return {currency:rows[0]?.currency??null,weights:priorities,weightsError,rows,best,formula:'Year-1 total = base + target bonus + equity/year + signing + benefits. Adjusted total = year-1 total ÷ (cost index / 100).',scoreNote:'Compensation is adjusted total relative to the best entered offer. Other 0–10 ratings are supplied by you; missing positive-weight ratings leave the score uncomputed.'};
}
export function parseCostIndexCSV(text){
  if(typeof text!=='string'||text.length>1024*1024)throw new Error('Use a cost-index CSV up to 1 MB.');
  const rows=[];let row=[],value='',quoted=false,closed=false;
  const cell=()=>{row.push(value.trim());value='';closed=false;};const line=()=>{cell();if(row.some(Boolean))rows.push(row);row=[];};
  const source=text.replace(/^\uFEFF/,'');for(let i=0;i<source.length;i++){const char=source[i];if(quoted){if(char==='"'){if(source[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=char;}else if(char==='"'){if(value||closed)throw new Error('Invalid CSV quoting.');quoted=true;}else if(char===',')cell();else if(char==='\n'||char==='\r'){line();if(char==='\r'&&source[i+1]==='\n')i++;}else{if(closed&&!/\s/.test(char))throw new Error('Invalid CSV quoting.');value+=char;}}
  if(quoted)throw new Error('Unclosed CSV quote.');if(value||row.length)line();if(rows.length<2||rows.length>1001)throw new Error('Use a header and 1–1000 cost-index rows.');
  const headers=rows.shift().map(value=>value.toLowerCase()),city=headers.indexOf('city'),index=headers.indexOf('index');if(city<0||index<0)throw new Error('CSV needs city,index columns.');
  const seen=new Set();return rows.map(cells=>{if(cells.length!==headers.length)throw new Error('CSV rows must match the header.');const name=cells[city];if(!name||seen.has(name.toLowerCase()))throw new Error('Use unique, nonempty city names.');seen.add(name.toLowerCase());if(!cells[index])throw new Error('Cost index is required.');return {city:name,index:number(Number(cells[index]),'Cost index',{min:0.01,max:1e6})};});
}
