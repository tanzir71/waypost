import schema from '../../schemas/workspace.json' with { type: 'json' };
export const stores = ['resumes','resumeVersions','jobs','matchReports','applications','contacts','letters','stories','offers','terms','courses','scales','deadlines','settings','changes'];
export const settingsDefaults = () => ({ theme:'system',defaultScaleId:'bd-ugc',defaultResumeVersionId:null,sync:{provider:'none',endpoint:null,vaultId:null},ai:{provider:null,byokVendor:null} });
const types = { object:v=>v!==null && typeof v==='object' && !Array.isArray(v),array:Array.isArray,string:v=>typeof v==='string',number:v=>typeof v==='number' && Number.isFinite(v),integer:Number.isInteger,boolean:v=>typeof v==='boolean',null:v=>v===null };
// The subset used by the published schema: local refs, allOf, types, required,
// properties, items, enums, constants, bounds, and date formats. No evaluation.
export function validate(value,rule=schema,path='$',errors=[],root=schema) {
  if(rule.$ref) {
    if(!rule.$ref.startsWith('#/')) throw new Error('Only local schema references are supported.');
    const target=rule.$ref.slice(2).split('/').reduce((node,key)=>node?.[key],root);
    if(!target) throw new Error('Unknown schema reference.');
    validate(value,target,path,errors,root);
  }
  for(const sub of rule.allOf??[]) validate(value,sub,path,errors,root);
  if(rule.type && ![rule.type].flat().some(type=>types[type]?.(value))) { errors.push(`${path}: expected ${[rule.type].flat().join(' or ')}`);return errors; }
  if('const' in rule && value!==rule.const) errors.push(`${path}: expected ${rule.const}`);
  if(rule.enum && !rule.enum.includes(value)) errors.push(`${path}: unsupported value`);
  if(typeof value==='string' && ((rule.minLength!==undefined&&value.length<rule.minLength)||(rule.maxLength!==undefined&&value.length>rule.maxLength))) errors.push(`${path}: text length out of range`);
  if(Array.isArray(value) && ((rule.minItems!==undefined&&value.length<rule.minItems)||(rule.maxItems!==undefined&&value.length>rule.maxItems))) errors.push(`${path}: item count out of range`);
  if(typeof value==='number' && ((rule.minimum!==undefined && value<rule.minimum)||(rule.maximum!==undefined && value>rule.maximum))) errors.push(`${path}: out of range`);
  if(typeof value==='string' && rule.format==='date-time' && (!/^\d{4}-\d{2}-\d{2}T/.test(value)||!Number.isFinite(Date.parse(value)))) errors.push(`${path}: invalid timestamp`);
  if(typeof value==='string' && rule.format==='date') {
    const date=new Date(`${value}T00:00:00Z`);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(date.valueOf())||date.toISOString().slice(0,10)!==value) errors.push(`${path}: invalid date`);
  }
  if(types.object(value)) {
    for(const key of rule.required??[]) if(!Object.hasOwn(value,key)) errors.push(`${path}.${key}: required`);
    for(const [key,item] of Object.entries(value)) {
      if(['__proto__','prototype','constructor'].includes(key)) { errors.push(`${path}.${key}: unsafe key`);continue; }
      if(rule.properties?.[key]) validate(item,rule.properties[key],`${path}.${key}`,errors,root);
      else if(rule.additionalProperties===false) errors.push(`${path}.${key}: unknown field`);
      else if(types.object(rule.additionalProperties)) validate(item,rule.additionalProperties,`${path}.${key}`,errors,root);
    }
  }
  if(Array.isArray(value) && rule.items) value.forEach((item,index)=>validate(item,rule.items,`${path}[${index}]`,errors,root));
  return errors;
}
export function validateWorkspace(workspace) {
  const errors=validate(workspace);
  for(const [type,records] of Object.entries(workspace?.records??{})) {
    if(!stores.includes(type)) errors.push(`Unknown store: ${type}`);
    if(type==='settings') continue;
    const seen=new Set();
    if(Array.isArray(records)) for(const record of records) {
      if(!types.object(record) || typeof record.id!=='string') { errors.push(`${type}: record metadata missing`);continue; }
      if(seen.has(record.id)) errors.push(`${type}: duplicate id ${record.id}`);
      seen.add(record.id);
    }
  }
  return {valid:errors.length===0,errors};
}
export function assertRecord(type,record) {
  if(!stores.includes(type)) throw new Error(`Unknown store: ${type}`);
  const definition={resumeVersions:'resumeVersion',jobs:'job',matchReports:'matchReport',applications:'application',contacts:'contact',offers:'offer',terms:'term',courses:'course',scales:'scale',deadlines:'deadline'}[type];
  const errors=validate(record,definition?schema.$defs[definition]:schema.$defs.base);
  if(errors.length) throw new Error(errors.slice(0,5).join('; '));
  return record;
}
