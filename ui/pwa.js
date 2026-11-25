import {el,button,announce} from './dom.js';
import {installEligibility} from '../core/pwa/policy.js';
export function initializePwa({basePath,mode,window=globalThis.window,navigator=globalThis.navigator,localStorage=globalThis.localStorage,sessionStorage=globalThis.sessionStorage,onFiles=()=>{}}) {
  let visits=1,dismissed=false,prompt=null,reloading=false;
  try{const previous=Number(localStorage.getItem('waypost:visits'))||0;if(!sessionStorage.getItem('waypost:visit')){visits=previous+1;sessionStorage.setItem('waypost:visit','1');localStorage.setItem('waypost:visits',String(visits));}else visits=previous||1;dismissed=localStorage.getItem('waypost:install-dismissed')==='1';}catch{/* No install nag when visit storage is unavailable. */}
  const host=document.querySelector('#pwa-notices')??document.querySelector('main'),offline=el('p',{class:'offline-banner',role:'status','data-testid':'offline-banner'}),card=el('section',{class:'install-card',hidden:true,'data-testid':'install-card'}),update=el('section',{class:'update-toast',hidden:true,role:'status','data-testid':'update-toast'});
  host.prepend(offline,card,update);
  function connection(){offline.hidden=navigator.onLine!==false;offline.textContent='Offline · local tools work · sync paused';}
  connection();window.addEventListener('online',connection);window.addEventListener('offline',connection);
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent??'')||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
  const standalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
  function paintInstall(){
    const eligible=installEligibility({visits,dismissed,standalone:standalone(),ios,promptAvailable:!!prompt});card.hidden=!eligible;if(!eligible)return;
    card.replaceChildren(el('div',{class:'install-heading'},el('img',{src:`${basePath}assets/icons/logo.svg`,alt:'',width:28,height:28,'aria-hidden':true}),el('h2',{text:'Install Waypost'})),el('p',{text:'Open your private workspace offline from your home screen.'}),el('ul',{},['Works without an account','Open PDF, DOCX and workspace JSON files where supported','Receive shared job links; review before saving'].map(text=>el('li',{text}))),...(ios?[el('p',{class:'muted',text:'On iOS: open Safari’s Share menu, then choose Add to Home Screen.'})]:[]),el('div',{class:'actions'},button('Not now',()=>{dismissed=true;try{localStorage.setItem('waypost:install-dismissed','1');}catch{}paintInstall();},'install-dismiss',{class:'ghost'}),...(!ios?[button('Install',async()=>{if(!prompt)return;const active=prompt;prompt=null;await active.prompt();await active.userChoice;paintInstall();},'install-button',{class:'primary'})]:[])));
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;paintInstall();});
  window.addEventListener('appinstalled',()=>{prompt=null;card.hidden=true;});paintInstall();
  if(navigator.serviceWorker&&window.isSecureContext){
    navigator.serviceWorker.register(`${basePath}sw.js`,{scope:basePath,type:'module',updateViaCache:'none'}).then(registration=>{
      function offer(worker){if(!worker||!navigator.serviceWorker.controller)return;update.hidden=false;update.replaceChildren(el('span',{text:'New version ready'}),button('Reload',()=>{if(reloading)return;reloading=true;worker.postMessage({type:'WAYPOST_ACTIVATE_UPDATE'});},'update-reload',{class:'small'}));}
      offer(registration.waiting);registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')offer(registration.waiting??worker);});});
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)window.location.reload();});
    }).catch(error=>announce(`Offline setup could not finish: ${error.message}. Keep this tab open and try again online.`));
  }
  // focus-existing launches can deliver files or a share target to any route.
  if(window.launchQueue?.setConsumer)window.launchQueue.setConsumer(async launch=>{
    if(launch.files?.length){try{await onFiles(await Promise.all(launch.files.map(handle=>handle.getFile())));}catch(error){announce(error.message);}return;}
    if(launch.targetURL){const url=new URL(launch.targetURL),root=new URL(basePath,window.location.href);if(url.origin===root.origin&&url.pathname.startsWith(root.pathname)&&url.href!==window.location.href)window.location.assign(url.href);}
  });
  return {visits};
}
