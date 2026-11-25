import {openWorkspace} from './store.js';
import {announce} from './dom.js';
const config = window.WAYPOST_CONFIG;
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
theme.addEventListener('change',async()=>{
  if(theme.value==='system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme=theme.value;
  try {localStorage.setItem('waypost:theme',theme.value);} catch { /* The theme still applies to this visit. */ }
  if(store) {
    try {const preferences=(await store.setting('preferences')).value;await store.setSetting('preferences',{...preferences,theme:theme.value});} catch(error) {announce(error.message);}
  }
});
const views={match:()=>import('./views/match.js'),parse:()=>import('./views/parse.js'),resumes:()=>import('./views/resumes.js')};
async function mount() {
  const route=document.body.dataset.route;
  if(!store||!views[route]) return;
  const module=await views[route]();
  const render=module[`render${route[0].toUpperCase()+route.slice(1)}`];
  const actions=document.querySelector('#view-actions');actions.replaceChildren();
  await render({store,basePath:config.basePath,view:document.querySelector('#view'),actions});
}
try {await mount();} catch(error) {announce(`This view could not load: ${error.message}`);}
document.querySelector('#clear-demo').addEventListener('click',async()=>{
  if(!store)return;
  try {await store.clearSamples();await mount();announce('Sample data cleared. Your own records are kept.');} catch(error) {announce(error.message);}
});
