import {stores} from '../core/store/schema.js';
import {workspaceExport} from '../core/store/export.js';
import {download,announce} from './dom.js';
export async function readWorkspace(store) {
  const records=Object.fromEntries(await Promise.all(stores.filter(type=>type!=='changes').map(async type=>[type,await store.all(type,{deleted:true})])));
  const exportedAt=new Date().toISOString();
  return workspaceExport(records,{exportedAt,deviceId:store.deviceId});
}
export async function exportWorkspace(store) {
  const workspace=await readWorkspace(store),exportedAt=workspace.exportedAt;
  download(`waypost-workspace-${exportedAt.slice(0,10)}.json`,JSON.stringify(workspace,null,2));
  await store.setSetting('last-export',exportedAt);announce('Workspace exported as JSON. Credentials and internal keys are excluded.');
  return workspace;
}
export async function saveWorkspaceFolder(store,{showDirectoryPicker=window.showDirectoryPicker}={}) {
  if(!showDirectoryPicker)throw new Error('Folder backups are unavailable in this browser. Use Export JSON.');
  const directory=await showDirectoryPicker({mode:'readwrite'}),workspace=await readWorkspace(store),filename=`waypost-${workspace.exportedAt.replace(/[:.]/g,'-')}.json`;
  const file=await directory.getFileHandle(filename,{create:true}),stream=await file.createWritable();try{await stream.write(JSON.stringify(workspace,null,2));await stream.close();}catch(error){await stream.abort?.();throw error;}
  await store.setSetting('last-export',workspace.exportedAt);announce(`Saved ${filename} in the chosen folder. Original uploads are not included.`);return workspace;
}
