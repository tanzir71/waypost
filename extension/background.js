import defaults from './defaults.js';
import {captureTab,showChip} from './src/capture.js';
// No content script runs by default. The optional chip runs only on an origin
// explicitly saved by the user and still covered by a granted host permission.
chrome.tabs.onUpdated.addListener(async(tabId,change,tab)=>{
  if(change.status!=='complete'||!tab.url||!/^https?:/i.test(tab.url))return;
  try {
    const {options:stored}=await chrome.storage.local.get({options:defaults}),options={...defaults,...stored};
    const origin=new URL(tab.url).origin;if(!options.chipOrigins?.includes(origin))return;
    if(!await chrome.permissions.contains({origins:[`${origin}/*`]}))return;
    const job=await captureTab(chrome,{...tab,id:tabId});await showChip(chrome,{...tab,id:tabId},job,options);
  }catch{/* A protected, non-job or unavailable page does not install a chip. */}
});
