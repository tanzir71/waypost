export function compareRecords(a,b) {
  const time=Date.parse(a.updatedAt)-Date.parse(b.updatedAt),left=a.deviceId??'',right=b.deviceId??'';
  return time|| (left===right?0:left>right?1:-1);
}
export function mergeRecords(local,incoming) {
  const rows=new Map(local.map(row=>[row.id,row]));
  for(const row of incoming){const previous=rows.get(row.id);if(!previous||compareRecords(row,previous)>0)rows.set(row.id,row);}
  return [...rows.values()];
}
