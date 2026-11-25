import bd from '../../data/scales/bd-ugc.json' with {type:'json'};
import us from '../../data/scales/us-4.json' with {type:'json'};
import india from '../../data/scales/in-10.json' with {type:'json'};
import {number,round} from '../study/numbers.js';
// Callers edit copies; bundled tables remain the default reference.
export const builtInScales=()=>structuredClone([bd,us,india]);
export function validateScale(scale) {
  if(!scale||typeof scale.name!=='string'||!scale.name.trim())throw new Error('Give the scale a name.');
  number(scale.max,'Scale ceiling',0.01,100);
  if(!['replace','average','both-count'].includes(scale.retakePolicy))throw new Error('Choose a retake policy.');
  if(!Array.isArray(scale.grades)||scale.grades.length<2||scale.grades.length>50)throw new Error('A scale needs 2–50 grades.');
  const letters=new Set(),points=new Set();
  for(const grade of scale.grades) {
    if(typeof grade.letter!=='string'||!grade.letter.trim()||letters.has(grade.letter))throw new Error('Grade letters must be unique and nonempty.');
    number(grade.points,'Grade points',0,scale.max);
    if(points.has(grade.points))throw new Error('Grade points must be unique.');
    letters.add(grade.letter);points.add(grade.points);
    if((grade.min===undefined)!==(grade.max===undefined))throw new Error('Supply both percentage limits or leave both blank.');
    if(grade.min!==undefined){number(grade.min,'Minimum percentage',0,100);number(grade.max,'Maximum percentage',grade.min,100);}
  }
  const ordered=[...scale.grades].sort((a,b)=>a.points-b.points);
  if(ordered.at(-1).points!==scale.max||!ordered.some(row=>row.points>0))throw new Error('The top grade must equal the scale ceiling.');
  const bands=ordered.filter(row=>row.min!==undefined);
  for(let i=1;i<bands.length;i++)if(bands[i].min<=bands[i-1].max)throw new Error('Percentage bands must increase with grade points and must not overlap.');
  return scale;
}
export function gradePoints(scale,letter) {
  const found=scale.grades.find(row=>row.letter===letter);
  if(!found)throw new Error(`Unknown grade: ${letter}.`);
  return found.points;
}
export function bandPercentage(value,scale) {
  validateScale(scale);number(value,'CGPA',0,scale.max);
  const anchors=[...scale.grades].sort((a,b)=>a.points-b.points);
  if(anchors.some(row=>row.min===undefined))return null;
  if(value<anchors[0].points)return null;
  const lower=anchors.findLast(row=>row.points<=value),upper=anchors.find(row=>row.points>value);
  if(!upper)return lower.min; // A grade-point ceiling cannot identify 80% vs 100%.
  return lower.min+(value-lower.points)/(upper.points-lower.points)*(upper.min-lower.min);
}
export function ukClassification(percentage) {
  number(percentage,'Percentage',0,100);
  return percentage>=70?'First (estimate)':percentage>=60?'2:1 (estimate)':percentage>=50?'2:2 (estimate)':percentage>=40?'Third (estimate)':'Below honours pass (estimate)';
}
export function ectsGrade(cohort) {
  if(!cohort)return null;
  const {below,total}=cohort;number(total,'Cohort size',1,10000000);number(below,'Students ranked below',0,total);
  if(!Number.isInteger(total)||!Number.isInteger(below))throw new Error('Cohort counts must be whole numbers.');
  const percentile=below/total*100;
  return {grade:percentile>=90?'A':percentile>=65?'B':percentile>=35?'C':percentile>=10?'D':'E',percentile};
}
export function validateInstitutionTable(table) {
  if(!table||typeof table.name!=='string'||!table.name.trim()||typeof table.system!=='string'||!table.system.trim()||!Array.isArray(table.rows)||!table.rows.length||table.rows.length>100)throw new Error('Name the institution and destination system, and add 1–100 ranges.');
  const rows=[...table.rows].sort((a,b)=>a.min-b.min);
  for(let i=0;i<rows.length;i++) {
    const row=rows[i];number(row.min,'Range minimum');number(row.max,'Range maximum',row.min);
    if(!['string','number'].includes(typeof row.value)||String(row.value).trim()===''||(typeof row.value==='number'&&!Number.isFinite(row.value)))throw new Error('Each range needs an output value.');
    if(i&&row.min<=rows[i-1].max)throw new Error('Institution ranges must not overlap; use distinct inclusive endpoints.');
  }
  return table;
}
export function convertGradeScale({scale,value,cohort=null,institution=null,to=null}) {
  validateScale(scale);number(value,'CGPA',0,scale.max);
  const percentage=bandPercentage(value,scale),ects=ectsGrade(cohort);
  const output=[
    {system:'US 4.0',value:round(value/scale.max*4),method:scale.max===4?'Same-ceiling direct':'Linear rescale ×4 / source ceiling',confidence:scale.max===4?'high':'medium',note:'Numeric ceiling comparison only. Letter cutoffs differ by school.'},
    {system:'Percentage',value:percentage===null?null:round(percentage,1),method:'Source band interpolation',confidence:'medium',note:percentage===null?'Add percentage bands to the source scale.':'Interpolates minimum percentage anchors, not actual marks. At the ceiling it returns the top band minimum.'},
    {system:'Indian 10-point CGPA',value:round(value/scale.max*10),method:'Linear rescale ×10 / source ceiling',confidence:'medium',note:'Many universities publish their own conversion table.'},
    {system:'UK classification',value:percentage===null?null:ukClassification(percentage),method:'Percentage band',confidence:'low',note:'Assumes UK marking: First ≥70, 2:1 ≥60, 2:2 ≥50, Third ≥40. Ask the admissions office.'},
    {system:'ECTS grade',value:ects?.grade??null,method:'Relative to cohort',confidence:ects?'medium':'low',note:ects?`${round(ects.percentile,1)}th percentile among passing students; A top 10%, B next 25%, C next 30%, D next 25%, E final 10%.`:'Not computable without your rank among a cohort of passing students.'}
  ];
  if(institution){validateInstitutionTable(institution);const row=institution.rows.find(row=>value>=row.min&&value<=row.max);output.push({system:institution.system,value:row?.value??null,method:'Institution table',confidence:'medium',note:row?`User-supplied table: ${institution.name}. Verify its source and currency.`:`No inclusive range covers ${value} in ${institution.name}.`});}
  else output.push({system:'Institution conversion',value:null,method:'Per-school mapping',confidence:'low',note:'Supply an institution table to calculate its equivalence.'});
  if(!to)return output;
  const names={'us-4':'US 4.0',percentage:'Percentage','in-10':'Indian 10-point CGPA',uk:'UK classification',ects:'ECTS grade',institution:institution?.system??'Institution conversion'};
  if(!Array.isArray(to)||to.some(id=>!names[id]&&!output.some(row=>row.system===id)))throw new Error('Unknown destination scale.');
  return output.filter(row=>to.some(id=>(names[id]??id)===row.system));
}
