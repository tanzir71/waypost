import {stores,settingsDefaults,validateWorkspace} from './schema.js';
import {exportStudyPreferences} from '../study/preferences.js';
export function workspaceExport(records,{exportedAt,deviceId}) {
  const defaults=settingsDefaults(),preferences=records.settings?.find(row=>row.key==='preferences')?.value??defaults;
  // Only documented preference fields are exported. Credentials, vault keys,
  // migration archives and internal journal records never enter this payload.
  const settings={theme:preferences.theme??defaults.theme,defaultScaleId:preferences.defaultScaleId??defaults.defaultScaleId,defaultResumeVersionId:preferences.defaultResumeVersionId??null,sync:{provider:preferences.sync?.provider??'none',endpoint:preferences.sync?.endpoint??null,vaultId:preferences.sync?.vaultId??null},ai:{provider:preferences.ai?.provider??null,byokVendor:preferences.ai?.byokVendor??null}};
  if(preferences.study)settings.study=exportStudyPreferences(preferences.study);
  const workspace={format:'waypost-workspace',version:1,exportedAt,deviceId,records:{...Object.fromEntries(stores.filter(type=>!['settings','changes'].includes(type)).map(type=>[type,records[type]??[]])),settings}};
  const validation=validateWorkspace(workspace);if(!validation.valid)throw new Error(validation.errors.slice(0,4).join('; '));return workspace;
}
