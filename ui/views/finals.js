import {finalNeeded,finalLadder} from '../../core/finals/index.js';
import {round} from '../../core/study/numbers.js';
import {readLink,syncLink} from '../links.js';
import {el,button,field,result,announce} from '../dom.js';
import {numberInput,selectInput,gradeSelect,studyPreferences,saveStudy,scaleOptions,studyActions} from '../study.js';
import {calendarDate} from '../../core/calendar/index.js';
const example=()=>[{name:'Homework',weight:20,score:92},{name:'Quizzes',weight:10,score:85},{name:'Midterm',weight:30,score:78},{name:'Final exam',weight:40,score:null}];
export async function renderFinals({store,basePath,view,actions}) {
  document.body.classList.add('study-view');
  document.querySelector('h1').textContent='Final exam needed';
  const linkedInput=readLink('finals'),preferences=await studyPreferences(store),scales=await scaleOptions(store),courses=await store.all('courses');
  let initial={...preferences.finals,...linkedInput.state},course=courses.find(row=>row.id===linkedInput.state.course);
  if(initial.weights)initial.categories=initial.weights.map((weight,i)=>({name:i===initial.weights.length-1?'Final exam':`Category ${i+1}`,weight,score:i===initial.weights.length-1?null:initial.scores?.[i]??NaN}));
  let scale=scales.find(row=>row.id===(course?.scaleId??initial.scaleId??'bd-ugc'))??scales[0],rows=structuredClone(course?.categories?.length?course.categories:initial.categories??example()),output=null,controls=[];
  const unavailable=!!(initial.scaleId&&!scales.some(row=>row.id===initial.scaleId)||initial.course&&!course);if(unavailable)announce('The linked scale or course is not in this workspace. Choose available inputs before calculating.');
  if(!Array.isArray(rows)||rows.length>100||!rows.length)rows=example();
  let target=course?.targetGrade??initial.target??'A';if(!scale.grades.some(row=>row.letter===target)&&!/^\d+(?:\.\d+)?$/.test(String(target)))target=scale.grades[0].letter;
  const scaleControl=selectInput('final-scale',scales,scale.id),targetControl=gradeSelect('final-target',scale,target),courseControl=selectInput('final-course',[{id:'',name:'Standalone calculation'},...courses],course?.id??''),categoryBody=el('tbody'),totals=el('p',{class:'muted','data-testid':'final-weight-status'}),summary=el('section',{class:'study-result','data-testid':'final-result','aria-label':'Final score needed'}),ladder=el('section',{class:'card stack'}),linked=el('section',{class:'card stack'});
  if(!scale.grades.some(row=>row.letter===target))targetControl.append(el('option',{value:target,text:`${target}% (custom target)`,selected:true}));
  const examDate=el('input',{id:'final-exam-date',type:'date',value:course?.examDate??'',disabled:!course,'data-testid':'final-exam-date'});
  const categories=el('section',{class:'card stack'},el('div',{class:'section-title'},el('h2',{text:'Categories'}),button('Add category',()=>{capture();rows.push({name:'New category',weight:0,score:0});paintCategories();compute();},'final-add-category',{class:'ghost small'})),el('div',{class:'table-scroll'},el('table',{class:'category-table'},el('caption',{class:'sr-only',text:'Assessment categories; select exactly one unknown final score'}),el('thead',{},el('tr',{},['Category','Weight %','Score %','Contribution','Final / remove'].map(text=>el('th',{scope:'col',text})))),categoryBody)),totals);
  view.replaceChildren(el('div',{class:'study-layout'},el('div',{class:'stack'},el('div',{class:'study-fields'},field('Course','final-course',courseControl),field('Target grade','final-target',targetControl)),categories,summary,ladder),el('aside',{class:'stack','aria-label':'Calculation and linked course'},el('section',{class:'card stack'},el('h2',{text:'How it’s computed'}),el('p',{class:'study-formula',text:'needed = (target − Σ wᵢ × sᵢ) ÷ w_final'}),el('p',{class:'muted',text:'Scores are percentages; weights must total 100%. Use the adjusted category score after any drop-lowest or curve rules from your course.'}),field('Active scale','final-scale',scaleControl)),linked)));
  const config=()=>({scaleId:scale.id,target:targetControl.value,categories:rows});
  const share=()=>{capture();return syncLink('finals',config(),{basePath});};
  function capture(){if(controls.length)rows=controls.map(({name,weight,score,unknown},i)=>({...rows[i],name:name.value.trim(),weight:weight.value===''?NaN:Number(weight.value),score:unknown.checked?null:score.value===''?NaN:Number(score.value)}));}
  function compute(){
    examDate.disabled=!course;
    capture();
    try{
      const grade=scale.grades.find(row=>row.letter===targetControl.value)??(/^\d+(?:\.\d+)?$/.test(targetControl.value)?{letter:`${targetControl.value}%`,min:Number(targetControl.value)}:{});if(grade.min===undefined)throw new Error('Edit the scale to add percentage cutoffs.');
      const value=finalNeeded({categories:rows,cutoff:grade.min}),all=finalLadder({categories:rows,scale});share();output={...value,target:grade.letter,scaleId:scale.id,courseId:course?.id??null,examDate:course?examDate.value||null:null,ladder:all};result(output);
      summary.replaceChildren(el('div',{},el('p',{class:'muted',text:`Score needed on the final for ${grade.letter} (${grade.min})`}),el('strong',{class:'study-number',text:value.neededDisplay.toFixed(1)})),el('div',{},el('p',{text:value.status==='already-secured'?'Already secured with a zero on the final.':value.status==='unreachable'?`Not reachable · the maximum course score is ${round(value.maximum,1)}.`:`Reachable. A perfect final takes the course to ${round(value.maximum,1)}.`}),el('p',{class:'study-formula',text:`needed = ${value.formula}`})));
      totals.textContent=`Weights total 100% · earned so far ${round(value.earned,2)} of ${round(100-value.finalWeight,2)}`;
      controls.forEach((row,i)=>{row.contribution.textContent=value.categories[i].contribution===null?'—':String(round(value.categories[i].contribution,2));});
      ladder.replaceChildren(el('h2',{text:'Every grade, at a glance'}),el('div',{class:'table-scroll'},el('table',{},el('caption',{class:'sr-only',text:'Score needed on the final at every cutoff'}),el('thead',{},el('tr',{},['Grade','Cutoff %','Needed on final %','Status'].map(text=>el('th',{scope:'col',text})))),el('tbody',{},all.map(row=>el('tr',{'data-testid':'final-ladder-row',class:row.letter===grade.letter?'selected-grade':''},el('th',{scope:'row',text:row.letter}),el('td',{class:'wp-num',text:`≥ ${row.cutoff}`}),el('td',{class:'wp-num'},el('span',{text:row.neededDisplay.toFixed(1)}),el('meter',{min:0,max:100,value:Math.max(0,Math.min(100,row.needed)),'aria-label':`${row.letter}: ${row.neededDisplay}% needed on final`})),el('td',{text:row.status==='already-secured'?'Already secured':row.status==='unreachable'?'Not reachable':'Reachable'})))))));
    }catch(error){output={error:error.message};result(output);totals.textContent=error.message;summary.replaceChildren(el('p',{text:error.message}));ladder.replaceChildren();}
    linked.replaceChildren(el('h2',{text:'Linked'}),el('p',{class:'muted',text:course?`${course.name} · target ${targetControl.value} from your course plan. Calculate saves these categories and the optional exam date to this course.`:'Choose a saved course to use its planned grade and save its exam date, or calculate independently.'}),field('Final exam date (optional)','final-exam-date',examDate),el('a',{class:'button small',href:`${basePath}app/gpa/`,text:'Open GPA planner','data-testid':'final-open-gpa'}),el('a',{href:`${basePath}app/deadlines/`,text:'Open Deadlines','data-testid':'final-open-deadlines'}));
    document.querySelector('.view-header .muted').textContent=course?`${course.name} · linked to the GPA planner`:'Weighted assessments · one unknown final score';
  }
  function paintCategories(){
    categoryBody.replaceChildren();controls=rows.map((row,i)=>{
      const name=el('input',{value:row.name,'aria-label':`Category ${i+1} name`,'data-testid':'final-category-name'}),weight=numberInput(`weight-${i}`,row.weight,{max:100,'aria-label':`Weight for ${row.name}`,'data-testid':'final-category-weight'}),score=numberInput(`score-${i}`,row.score??'',{max:100,disabled:row.score===null,'aria-label':`Score for ${row.name}`,'data-testid':'final-category-score'}),unknown=el('input',{type:'radio',name:'final-category',checked:row.score===null,'aria-label':`Use ${row.name} as the unknown final`,'data-testid':'final-category-unknown'}),contribution=el('span',{class:'wp-num'});
      for(const control of [name,weight,score])control.addEventListener('input',compute);
      unknown.addEventListener('change',()=>{const previous=rows.findIndex(row=>row.score===null);capture();if(previous!==i&&previous>=0)rows[previous].score=0;rows[i].score=null;paintCategories();compute();});
      categoryBody.append(el('tr',{'data-testid':'final-category-row'},el('td',{},name),el('td',{},weight),el('td',{},score),el('td',{},contribution),el('td',{},unknown,button('Remove',()=>{capture();rows.splice(i,1);paintCategories();compute();},'final-remove-category',{'aria-label':`Remove ${row.name}`,class:'ghost small'}))));return {name,weight,score,unknown,contribution};
    });
  }
  targetControl.addEventListener('change',compute);
  examDate.addEventListener('change',()=>{if(output&&!output.error){output.examDate=examDate.value||null;result(output);}});
  scaleControl.addEventListener('change',()=>{scale=scales.find(row=>row.id===scaleControl.value);const current=targetControl.value;targetControl.replaceChildren(...scale.grades.map(row=>el('option',{value:row.letter,text:row.letter,selected:row.letter===current})));compute();});
  courseControl.addEventListener('change',()=>{course=courses.find(row=>row.id===courseControl.value);if(course){const url=new URL(location.href);url.hash=new URLSearchParams({course:course.id});location.href=url.href;location.reload();}else{history.replaceState(null,'',location.pathname);compute();}});
  studyActions(actions,{getValue:()=>output,getLink:share,compute:async()=>{compute();if(output.error){announce(output.error);return;}try{if(course){if(examDate.value)calendarDate(examDate.value);course=await store.save('courses',{...course,categories:rows,examDate:examDate.value||null,sample:false});}await saveStudy(store,'finals',config());share();announce('Final calculation saved.');}catch(error){announce(error.message);}},label:'Calculate',testid:'final-calculate'});
  paintCategories();if(!unavailable&&(!linkedInput.provided||linkedInput.autorun))compute();else{summary.replaceChildren(el('p',{text:'Inputs prefilled. Choose Calculate to compute final targets.'}));result(null);}
}
