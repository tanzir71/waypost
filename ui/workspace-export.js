import {stores} from '../core/store/schema.js';
import {workspaceExport} from '../core/store/export.js';
import {download,announce} from './dom.js';
export async function exportWorkspace(store) {
  const records=Object.fromEntries(await Promise.all(stores.filter(type=>type!=='changes').map(async type=>[type,await store.all(type,{deleted:true})])));
  const exportedAt=new Date().toISOString();
  const workspace=workspaceExport(records,{exportedAt,deviceId:store.deviceId});
  download(`waypost-workspace-${exportedAt.slice(0,10)}.json`,JSON.stringify(workspace,null,2));
  await store.setSetting('last-export',exportedAt);announce('Workspace exported as JSON. Credentials and internal keys are excluded.');
  return workspace;
}
