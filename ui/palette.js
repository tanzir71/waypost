import {commandResults} from '../core/commands/index.js';
import {el,button,field} from './dom.js';
export function installPalette({store,basePath}) {
  let activeDialog=null;
  async function open(){
    if(activeDialog){activeDialog.querySelector('input')?.focus();return;}
    const previous=document.activeElement,records=store?Object.fromEntries(await Promise.all(['jobs','applications','resumeVersions'].map(async type=>[type,await store.all(type)]))):{};
    let choices=[],index=0;
    const input=el('input',{id:'command-query',role:'combobox','aria-autocomplete':'list','aria-expanded':'true','aria-controls':'command-results',autocomplete:'off',placeholder:'Search tools or type “plan gpa 3.6”','data-testid':'command-query'}),list=el('div',{id:'command-results',role:'listbox','aria-label':'Commands',class:'command-results'}),status=el('p',{class:'sr-only',role:'status'});
    const modal=el('dialog',{class:'command-menu','aria-label':'Command menu','data-testid':'command-menu'},el('div',{class:'command-input'},field('Search or run a command','command-query',input),button('Close',()=>modal.close(),'command-close',{class:'ghost small'})),list,status,el('p',{class:'command-footer',text:'↑↓ navigate · Enter open · Escape close · Every command is a URL'}));
    function paint(){choices=commandResults(input.value,{basePath,jobs:records.jobs,applications:records.applications,versions:records.resumeVersions});index=Math.min(index,Math.max(0,choices.length-1));list.replaceChildren();let group;
      for(const [i,choice]of choices.entries()){
        if(choice.group!==group){group=choice.group;list.append(el('p',{class:'eyebrow',role:'presentation',text:group}));}
        const option=el('a',{id:`command-${choice.id}`,href:choice.href,role:'option','aria-selected':i===index,tabindex:-1,class:'command-option','data-testid':'command-option'},el('img',{src:`${basePath}assets/icons/${choice.icon}.svg`,width:18,height:18,alt:'','aria-hidden':true}),el('span',{},el('strong',{text:choice.label}),el('small',{text:choice.detail})));list.append(option);
      }
      const selected=choices[index];if(selected)input.setAttribute('aria-activedescendant',`command-${selected.id}`);else input.removeAttribute('aria-activedescendant');status.textContent=`${choices.length} commands found.`;
      if(!choices.length)list.append(el('p',{class:'muted',text:'No matching command. Try a tool name or “plan gpa 3.6”.'}));
    }
    input.addEventListener('input',()=>{index=0;paint();});input.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();if(!choices.length)return;index=event.key==='Home'?0:event.key==='End'?choices.length-1:(index+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length;paint();document.getElementById(`command-${choices[index].id}`)?.scrollIntoView({block:'nearest'});}else if(event.key==='Enter'&&choices[index]){event.preventDefault();location.assign(choices[index].href);}});
    modal.addEventListener('close',()=>{modal.remove();activeDialog=null;previous?.focus();},{once:true});document.body.append(modal);activeDialog=modal;paint();modal.showModal();input.focus();
  }
  for(const selector of ['[data-testid="open-search"]','#mobile-search','#mobile-more'])document.querySelector(selector)?.addEventListener('click',event=>{event.preventDefault();open();});
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();open();}});
  return {open};
}
