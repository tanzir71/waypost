import {announce} from './dom.js';
export async function setTheme(value,store){
  if(!['light','dark','system'].includes(value))throw new Error('Choose Light, Dark or System.');
  if(value==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=value;
  try{localStorage.setItem('waypost:theme',value);}catch{/* Theme still applies to this page. */}
  for(const control of document.querySelectorAll('[data-theme-control]'))control.value=value;
  if(store){const previous=await store.setting('preferences');await store.setSetting('preferences',{...previous.value,theme:value});}announce(`Appearance: ${value}.`);
}
