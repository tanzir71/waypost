import {builtInScales,validateScale} from '../core/scales/index.js';
import {el,button,field,dialog,announce,download} from './dom.js';
export const numberInput=(id,value,attrs={})=>el('input',{id,type:'number',value,step:'any',min:0,'data-testid':id,...attrs});
export const selectInput=(id,options,value,attrs={})=>el('select',{id,'data-testid':id,...attrs},options.map(item=>el('option',{value:item.id??item.letter,selected:(item.id??item.letter)===value,text:item.name??item.letter})));
export const gradeSelect=(id,scale,value,attrs={})=>selectInput(id,scale.grades,value,attrs);
export const studyPreferences=async store=>(await store.setting('preferences'))?.value?.study??{};
export async function saveStudy(store,key,value) {
  const preferences=(await store.setting('preferences')).value;
  await store.setSetting('preferences',{...preferences,study:{...preferences.study,[key]:value}},{meaningful:true});
}
export async function scaleOptions(store) {return [...builtInScales(),...await store.all('scales')];}
export function studyActions(actions,{getValue,getLink,compute,label='Calculate',testid='calculate-button'}) {
  actions.append(button('Share link',async()=>{try{await navigator.clipboard.writeText(getLink());announce('Private input link copied. Review its contents before sharing.');}catch{announce('Clipboard unavailable. Copy this page’s address after calculating.');}},'share-link',{class:'ghost small'}),button('Copy JSON',()=>getValue()&&import('./dom.js').then(({copyJSON})=>copyJSON(getValue())),'copy-json',{class:'small'}),button('Download JSON',()=>getValue()&&download('waypost-study-result.json',JSON.stringify(getValue(),null,2)),'download-json',{class:'ghost small'}));
  if(compute)actions.append(button(label,compute,testid,{class:'primary small'}));
}
export function editScale({store,scale,onSave}) {
  let grades=structuredClone(scale.grades),inputs=[];
  const name=el('input',{id:'scale-name',value:`${scale.name.replace(/ · custom$/,'')} · custom`,required:true,'data-testid':'scale-name'}),ceiling=numberInput('scale-max',scale.max,{min:0.01,max:100}),policy=selectInput('scale-policy',[{id:'replace',name:'Replace old grade'},{id:'average',name:'Average the two grades'},{id:'both-count',name:'Count both attempts'}],scale.retakePolicy),source=el('input',{id:'scale-source',value:scale.source??'',placeholder:'Table source or institution policy','data-testid':'scale-source'});
  const body=el('tbody'),table=el('table',{},el('caption',{class:'sr-only',text:'Editable grade scale'}),el('thead',{},el('tr',{},['Letter','Points','Min %','Max %','Actions'].map(text=>el('th',{scope:'col',text})))),body);
  function capture(){grades=inputs.map(row=>({letter:row.letter.value.trim(),points:Number(row.points.value),...(row.min.value===''&&row.max.value===''?{}:{min:row.min.value===''?undefined:Number(row.min.value),max:row.max.value===''?undefined:Number(row.max.value)})}));}
  function paint(){body.replaceChildren();inputs=grades.map((grade,i)=>{
    const key=`grade-${i}`,letter=el('input',{value:grade.letter,'aria-label':`Letter for grade ${i+1}`,'data-testid':'scale-grade-letter',required:true}),points=numberInput(`${key}-points`,grade.points,{'aria-label':`Points for grade ${i+1}`,max:100,required:true,'data-testid':'scale-grade-points'}),min=numberInput(`${key}-min`,grade.min??'',{'aria-label':`Minimum percentage for grade ${i+1}`,max:100,'data-testid':'scale-grade-min'}),max=numberInput(`${key}-max`,grade.max??'',{'aria-label':`Maximum percentage for grade ${i+1}`,max:100,'data-testid':'scale-grade-max'});
    body.append(el('tr',{'data-testid':'scale-edit-row'},el('td',{},letter),el('td',{},points),el('td',{},min),el('td',{},max),el('td',{},button('Remove',()=>{capture();grades.splice(i,1);paint();},'scale-remove-grade',{'aria-label':`Remove grade ${grade.letter}`,class:'ghost small'}))));return {letter,points,min,max};
  });}
  const form=el('form',{class:'stack'},field('Scale name','scale-name',name),el('div',{class:'study-fields'},field('Ceiling','scale-max',ceiling),field('Retake policy','scale-policy',policy)),field('Source / policy note','scale-source',source),el('div',{class:'table-scroll'},table),button('Add grade',()=>{capture();grades.push({letter:'',points:0});paint();},'scale-add-grade'),el('p',{class:'muted',text:'Percentage bands are optional. Leave both limits blank for point-only scales.'}),el('button',{type:'submit',class:'primary',text:'Save custom scale','data-testid':'scale-save'}));
  const modal=dialog('Edit grade scale',form);paint();
  form.addEventListener('submit',async event=>{event.preventDefault();try{capture();const next=validateScale({name:name.value.trim(),max:Number(ceiling.value),retakePolicy:policy.value,grades,source:source.value.trim()});const saved=await store.save('scales',next);modal.close();await onSave(saved);announce('Custom scale saved.');}catch(error){announce(error.message);}});
}
