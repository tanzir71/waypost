import {announce} from './dom.js';
export function applyTheme(value){
  if(!['light','dark','system'].includes(value))throw new Error('Choose Light, Dark or System.');
  if(value==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=value;
  try{localStorage.setItem('waypost:theme',value);}catch{/* Theme still applies to this page. */}
  for(const control of document.querySelectorAll('[data-theme-control]'))control.value=value;
}
export async function setTheme(value,store){
  applyTheme(value);
  if(store){const previous=await store.setting('preferences');if(previous.value.theme!==value)await store.setSetting('preferences',{...previous.value,theme:value});}announce(`Appearance: ${value}.`);
}
export async function initializeTheme(store,{events=window}={}){
  let active=true,generation=0;
  const refresh=async()=>{const current=++generation;try{const preferences=await store.setting('preferences');if(active&&current===generation)applyTheme(preferences?.value.theme??'system');}catch(error){if(active)announce(`Appearance could not be loaded: ${error.message}`);}};
  await refresh();const unsubscribe=store.subscribe(change=>{if(change.types.includes('settings'))refresh();});
  const close=()=>{active=false;generation++;unsubscribe();};events.addEventListener('pagehide',close,{once:true});return {close};
}
export function restorePersistedPage(event,{reload=()=>location.reload()}={}){
  // pagehide closes IDB, sync and pending model work. A BFCache restoration
  // needs fresh connections, without resubmitting any previous form action.
  if(event.persisted)reload();
}
