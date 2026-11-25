import defaults from '../defaults.js';
import {httpURL} from '../bundled/core/links/index.js';
import {el,button,announce,dialog} from '../bundled/ui/dom.js';
let options={...defaults};
const url=document.querySelector('#app-url'),label=document.querySelector('#resume-label'),text=document.querySelector('#resume-text');
try{const stored=await chrome.storage.local.get({options:defaults});options={...defaults,...stored.options};url.value=options.appUrl;label.value=options.resumeLabel;text.value=options.resumeText;}catch(error){announce(error.message);}
document.querySelector('#options-form').addEventListener('submit',async event=>{
  event.preventDefault();
  try{const valid=httpURL(url.value);if(!valid)throw new Error('Enter an HTTP or HTTPS app URL without credentials.');if(text.value.length>100000)throw new Error('Use a resume shorter than 100,000 characters.');const root=new URL(valid);root.search='';root.hash='';if(!root.pathname.endsWith('/'))root.pathname+='/';options={...options,appUrl:root.href,resumeLabel:label.value.trim()||'My resume',resumeText:text.value};await chrome.storage.local.set({options});announce('Options saved in this browser.');}catch(error){announce(error.message);}
});
document.querySelector('#resume-file').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>1024*1024)throw new Error('Use a plain text resume smaller than 1 MB.');text.value=await file.text();label.value=file.name;announce('Resume text loaded. Save options to use it.');}catch(error){announce(error.message);}});
function sites(){const list=document.querySelector('#chip-sites');list.replaceChildren();for(const origin of options.chipOrigins??[])list.append(el('div',{class:'section-title'},el('p',{text:origin}),button('Revoke',async()=>{try{await chrome.permissions.remove({origins:[`${origin}/*`]});options.chipOrigins=options.chipOrigins.filter(site=>site!==origin);await chrome.storage.local.set({options});sites();announce('Site access revoked. Reload an open page to remove its existing chip.');}catch(error){announce(error.message);}},'clipper-revoke-site',{'aria-label':`Revoke Waypost chip access for ${origin}`})));if(!options.chipOrigins?.length)list.append(el('p',{class:'muted',text:'No site access is enabled.'}));}
document.querySelector('#clear-captures').addEventListener('click',()=>{
  const modal=dialog('Clear captured jobs',el('div',{class:'stack'},el('p',{text:'Remove all jobs saved by this extension? Your Waypost workspace is kept.'}),button('Clear captured jobs',async()=>{try{await chrome.storage.local.set({jobs:[]});modal.close();announce('Captured jobs cleared.');}catch(error){announce(error.message);}},'clipper-confirm-clear',{class:'primary'})));
});
sites();
