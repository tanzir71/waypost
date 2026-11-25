import {createAgentTools,registerAgentTools} from '../core/agents/index.js';
import {el,button,dialog,result,announce} from './dom.js';
export async function initializeAgentTools(store){
  const controller=new AbortController();window.addEventListener('pagehide',()=>controller.abort(),{once:true});
  const confirmApplication=(input,{signal}={})=>new Promise(resolve=>{
    let settled=false;const finish=value=>{if(settled)return;settled=true;resolve(value);modal.close();};
    const modal=dialog('Confirm application from agent',el('div',{class:'stack'},el('p',{text:'A browser agent proposes this tracker entry. Nothing is saved until you confirm.'}),el('dl',{class:'agent-proposal'},[['Role',input.title],['Company',input.company],['Stage',input.stage??'saved'],['URL',input.url??'Not supplied'],['Resume',input.resumeVersionId??'None']].map(([label,text])=>el('div',{},el('dt',{text:label}),el('dd',{text})))),...(input.text?[el('details',{},el('summary',{'data-testid':'agent-proposal-text',text:'Read proposed description'}),el('pre',{class:'job-import-description',text:input.text}))]:[]),el('div',{class:'actions'},button('Cancel',()=>finish(false),'agent-write-cancel',{class:'ghost'}),button('Confirm and save application',()=>finish(true),'agent-write-confirm',{class:'primary'}))));
    modal.addEventListener('close',()=>finish(false),{once:true});if(signal?.aborted)finish(false);else signal?.addEventListener('abort',()=>finish(false),{once:true});
  });
  return registerAgentTools({document,navigator,signal:controller.signal,tools:createAgentTools({store,confirmApplication,onResult:(value,name)=>{result(value);announce(`${name.replaceAll('_',' ')} complete.`);}})});
}
