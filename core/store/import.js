import {validateWorkspace,stores,settingsDefaults} from './schema.js';
import {compareRecords} from './merge.js';
import {exportStudyPreferences} from '../study/preferences.js';
export function planWorkspaceImport(workspace,existing={}) {
  const validation=validateWorkspace(workspace);if(!validation.valid)throw new Error(`Invalid workspace: ${validation.errors.slice(0,4).join('; ')}`);
  const records={},summary={added:0,updated:0,skipped:0,originalsUnavailable:0};
  for(const type of stores.filter(type=>!['settings','changes'].includes(type))) {
    const local=new Map((existing[type]??[]).map(row=>[row.id,row]));records[type]=[];
    for(const row of workspace.records[type]??[]) {
      const previous=local.get(row.id);
      if(previous&&compareRecords(row,previous)<=0){summary.skipped++;continue;}
      const copy=structuredClone(row);
      // A JSON export contains extracted text, not private filesystem files.
      if(type==='resumeVersions'&&copy.originalFile){copy.originalFile=null;summary.originalsUnavailable++;}
      records[type].push(copy);summary[previous?'updated':'added']++;
    }
  }
  const value=workspace.records.settings??{},defaults=settingsDefaults();
  const preferences={...defaults,theme:value.theme??defaults.theme,defaultScaleId:value.defaultScaleId??defaults.defaultScaleId,defaultResumeVersionId:value.defaultResumeVersionId??null,...(value.study?{study:exportStudyPreferences(value.study)}:{})};
  // Imported endpoint/provider preferences never activate external connections.
  return {records,preferences,summary};
}
