import {recordReferences} from './references.js';
export function sampleRemovalPlan(records) {
  const rows=Object.values(records).flat().filter(row=>!row.deleted),protectedIds=new Set(rows.filter(row=>!row.sample).map(row=>row.id));
  let changed=true;
  while(changed){changed=false;for(const row of rows)if(protectedIds.has(row.id))for(const id of recordReferences(row))if(!protectedIds.has(id)){protectedIds.add(id);changed=true;}}
  return Object.fromEntries(Object.entries(records).map(([type,items])=>[type,items.filter(row=>row.sample&&!row.deleted&&!protectedIds.has(row.id))]));
}
