import {scoreBatch} from '../match/index.js';
import {planTargetGpa,solveCourseMix} from '../gpa/index.js';
import {finalNeeded,finalLadder} from '../finals/index.js';
import {builtInScales,convertGradeScale} from '../scales/index.js';
import {applicationFields,moveApplication,stages} from '../tracker/index.js';
import {stores,validate} from '../store/schema.js';
import {workspaceExport} from '../store/export.js';
const text=(max=100000)=>({type:'string',minLength:1,maxLength:max}),number={type:'number',minimum:0};
const schema=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const scaleFields={scale:text(200)};
const course={type:'object',required:['credits'],properties:{id:text(200),name:text(500),credits:{type:'number',minimum:0.01},targetGrade:text(30),grade:{type:['string','null']},locked:{type:'boolean'},difficulty:{type:'integer',minimum:1,maximum:3}}};
export const agentDefinitions=[
  {name:'score_resume_against_jobs',description:'Compare resume evidence with job requirements. Returns tiers, supporting lines, gaps and separate application questions.',inputSchema:schema({resumeVersionId:text(200),resumeText:text(),jobIds:{type:'array',maxItems:1000,items:text(200)},jdText:text(),title:text(500)}),readOnly:true},
  {name:'plan_target_gpa',description:'Calculate the average needed to reach a target GPA and a deterministic course mix with grade locks.',inputSchema:schema({current:number,credits:number,target:number,remaining:{type:'number',minimum:0.01},...scaleFields,courses:{type:'array',maxItems:500,items:course},locked:{type:'array',items:schema({courseId:text(200),grade:text(30)},['courseId','grade'])}},['current','credits','target','remaining']),readOnly:true},
  {name:'final_needed',description:'Calculate the final assessment score needed for a target and every grade cutoff.',inputSchema:schema({categories:{type:'array',minItems:1,maxItems:100,items:schema({name:{type:'string'},weight:{type:'number',minimum:0,maximum:100},score:{type:['number','null'],minimum:0,maximum:100}},['weight'])},target:{type:['string','number']},...scaleFields},['categories','target']),readOnly:true},
  {name:'convert_grade_scale',description:'Estimate grade equivalences with a method and confidence for every result. ECTS needs supplied cohort ranks.',inputSchema:schema({from:text(200),value:number,to:{type:'array',items:text(100)},cohort:schema({below:{type:'integer',minimum:0},total:{type:'integer',minimum:1}},['below','total']),table:{type:'object'}},['from','value']),readOnly:true},
  {name:'add_application',description:'Propose an application for the tracker. The page shows the proposed details and waits for explicit confirmation before saving.',inputSchema:schema({title:text(500),company:text(500),text:{type:'string',maxLength:100000},url:{type:'string',maxLength:4000},stage:{enum:stages},resumeVersionId:text(200)},['title','company']),readOnly:false},
  {name:'export_workspace',description:'Read the complete local workspace as portable JSON, excluding credentials and internal keys.',inputSchema:schema({}),readOnly:true}
];
export function createAgentTools({store,confirmApplication,onResult=()=>{},now=()=>new Date().toISOString()}) {
  const findScale=async id=>{const scale=[...builtInScales(),...await store.all('scales')].find(row=>row.id===(id??'bd-ugc'));if(!scale)throw new Error('That grade scale is not in this workspace.');return scale;};
  const execute={
    async score_resume_against_jobs(input){
      if(input.resumeVersionId&&input.resumeText)throw new Error('Choose a saved resume or supplied text.');
      const versions=await store.all('resumeVersions'),preferences=(await store.setting('preferences'))?.value;
      const resume=input.resumeText?{id:'agent-resume',text:input.resumeText}:versions.find(row=>row.id===(input.resumeVersionId??preferences?.defaultResumeVersionId))??(!input.resumeVersionId?versions.at(-1):null);
      if(!resume)throw new Error('Choose a valid resume version or provide resumeText.');
      if(input.jdText&&input.jobIds)throw new Error('Choose jobIds or jdText.');
      const saved=await store.all('jobs'),jobs=input.jdText?[{id:'agent-job',title:input.title??input.jdText.split('\n')[0],text:input.jdText}]:input.jobIds?input.jobIds.map(id=>{const row=saved.find(job=>job.id===id);if(!row)throw new Error(`Unknown job: ${id}`);return row;}):saved;
      return scoreBatch([resume],jobs,{now:now().slice(0,10)});
    },
    async plan_target_gpa(input){const scale=await findScale(input.scale),plan=planTargetGpa({...input,completed:input.credits,scale});let courses=input.courses;
      if(!courses){const terms=await store.all('terms');courses=(await store.all('courses')).filter(row=>(row.scaleId??'bd-ugc')===scale.id&&terms.some(term=>term.id===row.termId&&term.planned));}
      courses=courses.map(row=>{const lock=input.locked?.find(item=>item.courseId===row.id);return lock?{...row,locked:true,targetGrade:lock.grade}:row;});
      for(const lock of input.locked??[])if(!courses.some(row=>row.id===lock.courseId))throw new Error(`Unknown locked course: ${lock.courseId}`);
      return {...plan,mix:courses.length?solveCourseMix({courses,needed:plan.needed,scale}):null};
    },
    async final_needed(input){const scale=await findScale(input.scale),categories=input.categories.map((row,i)=>({...row,name:row.name??`Category ${i+1}`,score:row.score??null}));const cutoff=typeof input.target==='number'?input.target:scale.grades.find(row=>row.letter===input.target)?.min;if(cutoff===undefined)throw new Error('Choose a grade with a percentage cutoff, or a numeric percentage target.');return {...finalNeeded({categories,cutoff}),perGrade:finalLadder({categories,scale})};},
    async convert_grade_scale(input){return convertGradeScale({scale:await findScale(input.from),value:input.value,cohort:input.cohort,institution:input.table,to:input.to});},
    async add_application(input,{signal}={}){
      const {httpURL}=await import('../links/index.js');if(input.url&&!httpURL(input.url))throw new Error('Use an HTTP(S) job URL without credentials.');
      if(input.resumeVersionId&&!(await store.all('resumeVersions')).some(row=>row.id===input.resumeVersionId))throw new Error('That resume version is not available.');
      if(!input.title.trim()||!input.company.trim())throw new Error('Provide a role and company.');
      if(!confirmApplication)throw new Error('In-page confirmation is unavailable.');
      if(signal?.aborted)throw new Error('Application request cancelled.');
      const confirmed=await confirmApplication(input,{signal});if(!confirmed||signal?.aborted)return {saved:false,cancelled:true};
      const at=now(),job=store.record({title:input.title.trim(),company:input.company.trim(),url:input.url??'',text:input.text??'',source:'agent'});
      let app=applicationFields(job,input.resumeVersionId??null,at);if(input.stage&&input.stage!=='saved')app=moveApplication(app,input.stage,at);
      app=store.record(app);await store.putMany({jobs:[job],applications:[app]});return {saved:true,application:app,job};
    },
    async export_workspace(){const records=Object.fromEntries(await Promise.all(stores.filter(type=>type!=='changes').map(async type=>[type,await store.all(type,{deleted:true})])));return workspaceExport(records,{deviceId:store.deviceId,exportedAt:now()});}
  };
  return agentDefinitions.map(definition=>({name:definition.name,description:definition.description,inputSchema:definition.inputSchema,
    async execute(input={},options={}){const errors=validate(input,definition.inputSchema);if(errors.length)throw new Error(errors.slice(0,4).join('; '));if(options.signal?.aborted)throw new Error('Tool request cancelled.');const value=await execute[definition.name](input,options);onResult(value,definition.name);return value;},annotations:{readOnlyHint:definition.readOnly}}));
}
export async function registerAgentTools({document={},navigator={},tools,signal}) {
  const context=document.modelContext?.registerTool?document.modelContext:navigator.modelContext?.registerTool?navigator.modelContext:null;
  const status={supported:!!context,via:context?(context===document.modelContext?'document.modelContext':'navigator.modelContext'):null,tools:[]};
  for(const tool of tools){try{if(context)await context.registerTool(tool,{signal});status.tools.push({name:tool.name,status:context?'registered':'unavailable'});}catch(error){status.tools.push({name:tool.name,status:'error',error:error.message});}}
  return status;
}
