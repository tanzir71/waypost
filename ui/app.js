import {openWorkspace} from './store.js';
import {announce,dialog,el} from './dom.js';
import {installPalette} from './palette.js';
import {initializePwa} from './pwa.js';
import {initializeAgentTools} from './agent-tools.js';
import {setTheme} from './theme.js';
import {initializeSync} from './sync.js';
const config = window.WAYPOST_CONFIG;
for(const link of document.querySelectorAll('.bottom-nav a'))if(link.pathname===location.pathname)link.setAttribute('aria-current','page');
if (config.mode === 'demo') {
  document.querySelector('#demo-banner').hidden = false;
  document.querySelectorAll('[data-status-pill]').forEach(node => { node.textContent = 'Demo'; });
}
let store;
try {
  store=await openWorkspace();
  if(config.mode==='demo') {
    const response=await fetch(`${config.basePath}data/workspace-demo.json`);
    if(!response.ok) throw new Error('The sample workspace could not be loaded.');
    await store.seed(await response.json());
  }
  if(store.migrationMessage) announce(store.migrationMessage);
  window.addEventListener('pagehide',()=>store.close(),{once:true});
} catch(error) {announce(error.message);}
const theme=document.querySelector('#app-theme');
theme.value=document.documentElement.dataset.theme??'system';
theme.addEventListener('change',()=>setTheme(theme.value,store).catch(error=>announce(error.message)));
const views={today:()=>import('./views/today.js'),tracker:()=>import('./views/tracker.js'),import:()=>import('./views/import.js'),match:()=>import('./views/match.js'),parse:()=>import('./views/parse.js'),resumes:()=>import('./views/resumes.js'),gpa:()=>import('./views/gpa.js'),finals:()=>import('./views/finals.js'),scales:()=>import('./views/scales.js'),settings:()=>import('./views/settings.js'),agents:()=>import('./views/agents.js'),share:()=>import('./views/share.js'),setup:()=>import('./views/setup.js'),offers:()=>import('./views/offers.js'),deadlines:()=>import('./views/deadlines.js'),contacts:()=>import('./views/contacts.js'),letters:()=>import('./views/letters.js')};
const syncController=store?await initializeSync({store,mode:config.mode}):null;
syncController?.subscribe(status=>{for(const pill of document.querySelectorAll('[data-status-pill]')){pill.textContent=({local:'Local',demo:'Demo',syncing:'Syncing…',synced:'Synced',offline:'Offline',locked:'Unlock sync',error:'Sync error'})[status.state]??'Local';pill.title=status.message??'Workspace storage status';}});
installPalette({store,basePath:config.basePath});
const agentStatus=store?await initializeAgentTools(store):{supported:false,tools:[]};
initializePwa({...config,onFiles:async files=>{if(!store){announce('Allow local storage before importing opened files.');return;}const content=el('div'),modal=dialog('Review opened files',content),{renderImport}=await import('./views/import.js');await renderImport({store,basePath:config.basePath,view:content,actions:el('div'),files});modal.classList.add('file-launch-dialog');}});
async function mount() {
  const route=document.body.dataset.route;
  if(!store||!views[route]) return;
  const module=await views[route]();
  const render=module[`render${route[0].toUpperCase()+route.slice(1)}`];
  const actions=document.querySelector('#view-actions');actions.replaceChildren();
  await render({store,basePath:config.basePath,view:document.querySelector('#view'),actions,agentStatus,syncController});
}
try {await mount();} catch(error) {announce(`This view could not load: ${error.message}`);}
document.querySelector('#clear-demo').addEventListener('click',async()=>{
  if(!store)return;
  try {await store.clearSamples();await mount();announce('Sample data cleared. Your own records are kept.');} catch(error) {announce(error.message);}
});
