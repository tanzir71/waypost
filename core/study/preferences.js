// Study inputs contain no provider credentials. Select exact fields rather
// than copying arbitrary nested settings into workspace exports.
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));
export function exportStudyPreferences(study={}) {
  const output={};
  if(study.gpa)output.gpa=pick(study.gpa,['current','completed','target','remaining','scaleId','termId','scope']);
  if(study.finals)output.finals={...pick(study.finals,['scaleId','target']),categories:(study.finals.categories??[]).map(row=>pick(row,['name','weight','score']))};
  if(study.conversion){output.conversion=pick(study.conversion,['scaleId','value','institutionId','to']);if(study.conversion.cohort)output.conversion.cohort=pick(study.conversion.cohort,['below','total']);}
  if(study.institutionTables)output.institutionTables=study.institutionTables.map(table=>({...pick(table,['id','name','system','source']),rows:table.rows.map(row=>pick(row,['min','max','value']))}));
  return output;
}
