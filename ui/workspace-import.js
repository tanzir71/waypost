import {stores} from '../core/store/schema.js';
import {planWorkspaceImport} from '../core/store/import.js';
import {el,button,dialog,result,announce} from './dom.js';
import {setTheme} from './theme.js';
const readExisting=async store=>Object.fromEntries(await Promise.all(stores.filter(type=>!['settings','changes'].includes(type)).map(async type=>[type,await store.all(type,{deleted:true})])));
export async function reviewWorkspaceImport(store,workspace,{onComplete=()=>{}}={}) {
  const plan=planWorkspaceImport(workspace,await readExisting(store));let busy=false;
  const description=el('p',{text:`${plan.summary.added} new records · ${plan.summary.updated} newer records · ${plan.summary.skipped} current/newer local records kept.`});
  const message=el('p',{role:'status','aria-live':'polite'}),confirm=button('Confirm workspace import',async()=>{
    if(busy)return;busy=true;confirm.disabled=true;
    try{
      const current=planWorkspaceImport(workspace,await readExisting(store)),previous=await store.setting('preferences');
      const records={...current.records,settings:[store.record({...previous,key:'preferences',value:current.preferences}),store.record({key:'demo-seeded',value:true}),store.record({key:'demo-cleared',value:true})]};
      // Reuse marker IDs when present, preserving the unique setting keys.
      for(let i=1;i<records.settings.length;i++){const existing=await store.setting(records.settings[i].key);if(existing)records.settings[i]=store.record({...existing,value:true});}
      await store.putMany(records);await setTheme(current.preferences.theme);result({imported:current.summary});await onComplete(current);modal.close();announce(`Workspace imported: ${current.summary.added} new and ${current.summary.updated} updated records. Sync and AI remain off.`);
    }catch(error){message.textContent=error.message;}finally{busy=false;confirm.disabled=false;}
  },'workspace-import-confirm',{class:'primary'});
  const modal=dialog('Review workspace import',el('div',{class:'stack'},description,el('p',{text:'This merges records by update time; newer local records are kept. Imported sync and AI connections are off.'}),el('p',{class:'muted',text:'JSON backups contain extracted resume text and workspace records. Original PDF/DOCX uploads are not included; reimport those files on this device if needed.'}),el('div',{class:'actions'},button('Cancel',()=>modal.close(),'workspace-import-cancel',{class:'ghost'}),confirm),message));result({pendingImport:plan.summary});return modal;
}
export async function readWorkspaceFile(file){if(file.size>50*1024*1024)throw new Error('Use a workspace JSON file smaller than 50 MB.');return JSON.parse(await file.text());}
