import {parseDeepLink,buildDeepLink} from '../core/links/deep.js';
import {announce,button} from './dom.js';
export function readLink(route){try{return parseDeepLink(route,location.hash);}catch(error){announce(`Link not applied: ${error.message}`);return {state:{},autorun:false,provided:false};}}
export function syncLink(route,state,{basePath=window.WAYPOST_CONFIG.basePath,autorun=false}={}) {try{const path=buildDeepLink(route,state,{basePath,autorun});history.replaceState(null,'',path);return new URL(path,location.href).href;}catch(error){announce(error.message);return null;}}
export function shareLinkButton(route,readState,basePath){return button('Share link',async()=>{const href=syncLink(route,readState(),{basePath});if(!href)return;try{await navigator.clipboard.writeText(href);announce('Private link copied. Review its contents before sharing.');}catch{announce('Copy this page’s address to share the private input link.');}},'share-link',{class:'ghost small'});}
