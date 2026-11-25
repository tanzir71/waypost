import {assertRecord,stores} from '../store/schema.js';
import {exportStudyPreferences} from '../study/preferences.js';
import {compareRecords} from '../store/merge.js';
export const syncedPreferences=value=>({theme:value.theme??'system',defaultScaleId:value.defaultScaleId??'bd-ugc',defaultResumeVersionId:value.defaultResumeVersionId??null,...(value.study?{study:exportStudyPreferences(value.study)}:{})});
export function syncRecords(records,{vaultId}){
  const output=[];
  for(const type of stores.filter(type=>!['settings','changes'].includes(type)))for(const row of records[type]??[]){const record=type==='resumeVersions'?{...row,originalFile:null}:structuredClone(row);assertRecord(type,record);output.push({type,record});}
  const preferences=records.settings?.find(row=>row.key==='preferences');
  if(preferences)output.push({type:'settings',record:{...preferences,id:vaultId,key:'preferences',value:syncedPreferences(preferences.value)}});return output;
}
export function chooseRemote(local,remote,type){
  if(local&&compareRecords(remote,local)<=0)return null;
  if(type==='settings'){
    if(remote.key!=='preferences')return null;
    return {...remote,id:local?.id??remote.id,value:{...local?.value,...syncedPreferences(remote.value),sync:local?.value?.sync??{provider:'none',endpoint:null,vaultId:null},ai:local?.value?.ai??{provider:null,byokVendor:null}}};
  }
  return type==='resumeVersions'&&local?.text===remote.text?{...remote,originalFile:local.originalFile??null}:remote;
}
