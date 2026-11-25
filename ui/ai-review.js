import {applyRewrite,rewriteGoals,MAX_AI_TEXT} from '../core/ai/index.js';
import {readAI,suggestRewrite} from './ai.js';
import {el,button,field,dialog,announce} from './dom.js';
export async function rewriteControl({store,control,onChange,onState=()=>{}}){
 const configuration=await readAI(store),goal=el('select',{id:'ai-goal','data-testid':'ai-goal'},Object.entries(rewriteGoals).map(([value,text])=>el('option',{value,text}))),enabled=!!configuration.provider;
 const open=()=>{
  const selected=Number.isInteger(control.selectionStart)&&Number.isInteger(control.selectionEnd)&&control.selectionEnd>control.selectionStart,start=selected?control.selectionStart:0,end=selected?control.selectionEnd:control.value.length,snapshot={text:control.value,start,end},before=control.value.slice(start,end);
  if(!before.trim()||before.length>MAX_AI_TEXT){announce(`Select between 1 and ${MAX_AI_TEXT.toLocaleString()} characters to rewrite.`);return;}
  let cancelled=false,controller=null,review=null;const state=el('p',{'role':'status','data-testid':'ai-review-status',text:'Review the text before requesting a suggestion.'}),content=el('div',{class:'stack'},el('p',{class:configuration.provider==='byok'?'warning-callout':'muted',text:configuration.provider==='byok'?'This selected text is sent through your host to OpenAI with your API key. Provider charges and retention policies apply.':'English text is processed by Chrome’s on-device model. No writing text is sent to a provider.'}),el('h3',{text:'Text to rewrite'}),el('pre',{class:'writing-quote','data-testid':'ai-before',text:before}),el('p',{class:'muted',text:'Quantified source sentences must stay verbatim. Check the meaning and every claim before accepting. Accepting changes only this editor; save the draft separately.'}),state),modal=dialog('Review AI rewrite',content);
  const finish=status=>onState({provider:configuration.provider,status,...(review?{before:review.before,after:review.after}:{} )});
  const leave=()=>{cancelled=true;controller?.abort();};window.addEventListener('pagehide',leave,{once:true});
  modal.addEventListener('close',()=>{window.removeEventListener('pagehide',leave);if(!cancelled)finish('rejected');cancelled=true;controller?.abort();});
  const reject=button('Reject suggestion',()=>{modal.close();announce('Suggestion rejected. Draft unchanged.');},'ai-reject',{class:'ghost'}),request=button('Request suggestion',async()=>{
   request.disabled=true;controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),60000);finish('requesting');state.textContent='Preparing a suggestion…';
   try{
    review=await suggestRewrite(store,before,goal.value,{signal:controller.signal,expected:configuration});if(cancelled)return;finish('pending');state.textContent=review.changed?'Review the changes, then accept or reject.':'The provider returned the same wording.';
    const diff=el('div',{class:'ai-diff diff-panel stack','data-testid':'ai-diff','aria-label':'Suggested changes'});for(const row of review.rows)diff.append(el('div',{class:`diff-line diff-${row.type}`,'data-testid':'ai-diff-row','data-change':row.type},el('span',{class:'diff-marker',text:row.type==='added'?'+ Added: ':row.type==='removed'?'− Removed: ':'Unchanged: '}),el('span',{},...row.words.map(word=>el('span',{class:`word-${word.type}`,text:word.text})))));
    content.append(diff,el('div',{class:'actions'},button('Accept suggestion',()=>{
     try{control.value=applyRewrite(control.value,snapshot,review);onChange();cancelled=true;controller=null;finish('accepted');modal.close();announce('Suggestion accepted in the editor. Save the draft to keep it.');}catch(error){state.textContent=error.message;}
    },'ai-accept',{class:'primary',disabled:!review.changed}),reject));request.remove();
   }catch(error){if(cancelled)return;state.textContent=controller.signal.aborted?'Request cancelled or timed out. Draft unchanged.':error.message;finish('error');request.disabled=false;}
   finally{clearTimeout(timeout);}
  },'ai-request',{class:'primary'});
  content.append(el('div',{class:'actions'},request,button('Cancel rewrite',()=>modal.close(),'ai-cancel',{class:'ghost'})));
 };
 return el('div',{class:'stack ai-writing'},el('p',{class:'muted',text:enabled?`Optional AI · ${configuration.provider==='byok'?'OpenAI via your host':'Chrome on-device'} · select English text to rewrite, or use the whole draft.`:'Optional AI is off. Enable a provider in Settings to request rewrites.'}),field('Writing goal','ai-goal',goal),button('Review AI rewrite…',open,'ai-rewrite',{class:'ghost small',disabled:!enabled}));
}
