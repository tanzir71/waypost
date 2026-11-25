import test from 'node:test';
import assert from 'node:assert/strict';
import {builtInScales,convertGradeScale,validateScale,validateInstitutionTable,bandPercentage,ectsGrade} from '../core/scales/index.js';
import {planTargetGpa,weightedGpa,solveCourseMix,retakeWhatIf,termTrend} from '../core/gpa/index.js';
import {finalNeeded,finalLadder} from '../core/finals/index.js';
const scale=builtInScales()[0],input={current:3.42,completed:64,target:3.6,remaining:64,scale};
const courses=['A','A','A+','A','A'].map((targetGrade,i)=>({id:`c${i}`,name:`Course ${i}`,credits:i===4?1.5:3,targetGrade,locked:i===2,difficulty:1}));
const categories=[{name:'Homework',weight:20,score:92},{name:'Quizzes',weight:10,score:85},{name:'Midterm',weight:30,score:78},{name:'Final exam',weight:40,score:null}];
test('study fixtures reproduce 3.78 needed, 3.81 explicit mix, 61.8 final and conversion arithmetic',()=>{
  assert.equal(planTargetGpa(input).neededDisplay,3.78);
  assert.equal(weightedGpa(courses,scale).average.toFixed(2),'3.81');
  const ladder=finalLadder({categories,scale});
  assert.deepEqual(ladder.slice(0,4).map(row=>[row.letter,row.neededDisplay]),[['A+',74.3],['A',61.8],['A−',49.3],['B+',36.8]]);
  assert.equal(ladder[0].maximum,90.3);
  const conversion=convertGradeScale({scale,value:3.62});
  assert.equal(conversion[0].value,3.62);assert.equal(conversion[1].value,72.4);assert.equal(conversion[2].value,9.05);
  // The mockup says 2:1, but its specified percentage→UK method yields First.
  assert.equal(conversion[3].value,'First (estimate)');
  assert.equal(conversion[4].value,null);
});
test('GPA bounds, already secured, no completed credits, unreachable ceiling',()=>{
  assert.equal(planTargetGpa({...input,current:0,completed:0}).needed,3.6);
  const impossible=planTargetGpa({...input,target:4});assert.equal(impossible.reachable,false);assert.equal(impossible.maxAchievable,3.71);
  assert.equal(planTargetGpa({...input,current:4,target:1}).alreadySecured,true);
  for(const extra of [{remaining:0},{completed:-1},{current:4.1},{target:NaN}])assert.throws(()=>planTargetGpa({...input,...extra}));
});
test('greedy mix is deterministic, honors locks, difficulty, marginal gains and larger-credit ties',()=>{
  const copy=structuredClone(courses),solved=solveCourseMix({courses,needed:3.78,scale});
  assert.equal(solved.reachable,true);assert.equal(solved.courses[2].targetGrade,'A+');assert.deepEqual(courses,copy);
  assert.deepEqual(solved,solveCourseMix({courses,needed:3.78,scale}));
  const simple={name:'Simple',max:4,retakePolicy:'replace',grades:[{letter:'F',points:0},{letter:'P',points:2},{letter:'A',points:4}]};
  const two=[{id:'small',credits:1,difficulty:1},{id:'large',credits:3,difficulty:3}];
  const tied=solveCourseMix({courses:two,needed:2.5,scale:simple});assert.equal(tied.courses[1].targetGrade,'A');assert.equal(tied.courses[0].targetGrade,'P');
  const hard=solveCourseMix({courses:[{id:'hard',credits:3,difficulty:3},{id:'easy',credits:3,difficulty:1}],needed:3,scale:simple});assert.equal(hard.courses[1].targetGrade,'A');
  assert.equal(solveCourseMix({courses:courses.map(row=>({...row,locked:true})),needed:4,scale}).reachable,false);
  assert.throws(()=>solveCourseMix({courses:[],needed:3,scale}));assert.throws(()=>solveCourseMix({courses:[{credits:0}],needed:3,scale}));
  assert.throws(()=>solveCourseMix({courses:[{credits:3,locked:true,targetGrade:'Z'}],needed:3,scale}));
});
test('retake policy changes quality points and counted credits without mutating originals',()=>{
  const retake={...input,credits:3,oldGrade:'C',newGrade:'A'};
  const replace=retakeWhatIf(retake),average=retakeWhatIf({...retake,policy:'average'}),both=retakeWhatIf({...retake,policy:'both-count'});
  assert.ok(Math.abs(replace.after.needed-3.7096875)<1e-10);assert.ok(average.after.needed>replace.after.needed);assert.equal(both.after.completed,67);
  assert.throws(()=>retakeWhatIf({...retake,credits:65}));
  const terms=[{id:'t2',order:2,planned:true},{id:'t1',order:1,planned:false}];
  const trend=termTrend(terms,[{...courses[0],termId:'t2'},{...courses[1],termId:'t1',grade:'B'}],scale);
  assert.deepEqual(trend.map(row=>row.average),[3,3.75]);assert.equal(terms[0].id,'t2');
});
test('final calculator rejects invalid weighting and distinguishes secured from impossible',()=>{
  assert.equal(finalNeeded({categories,cutoff:45}).status,'already-secured');
  assert.equal(finalNeeded({categories,cutoff:95}).status,'unreachable');
  assert.equal(finalNeeded({categories:[{weight:100,score:null}],cutoff:70}).needed,70);
  for(const rows of [categories.slice(1),categories.map(row=>({...row,score:null})),categories.map(row=>({...row,score:101})),[{weight:100,score:20}]])assert.throws(()=>finalNeeded({categories:rows,cutoff:70}));
  assert.throws(()=>finalLadder({categories,scale:{...scale,grades:scale.grades.map(({min,max,...row})=>row)}}));
});
test('conversion methods preserve uncertainty, validate tables and need real cohort counts',()=>{
  assert.equal(bandPercentage(4,scale),80);assert.equal(bandPercentage(3.5,scale),70);
  assert.equal(convertGradeScale({scale,value:0})[3].value,'Below honours pass (estimate)');
  assert.equal(ectsGrade({below:90,total:100}).grade,'A');assert.equal(ectsGrade({below:65,total:100}).grade,'B');assert.equal(ectsGrade({below:35,total:100}).grade,'C');assert.equal(ectsGrade({below:10,total:100}).grade,'D');assert.equal(ectsGrade({below:0,total:100}).grade,'E');
  assert.throws(()=>ectsGrade({below:100,total:0}));assert.throws(()=>ectsGrade({below:1.5,total:10}));
  const institution={name:'User table',system:'Example equivalence',rows:[{min:3.5,max:3.75,value:'Upper second'}]};
  assert.equal(convertGradeScale({scale,value:3.62,institution}).at(-1).value,'Upper second');
  assert.equal(convertGradeScale({scale,value:3,institution}).at(-1).value,null);
  assert.throws(()=>validateInstitutionTable({...institution,rows:[{min:0,max:2,value:1},{min:2,max:3,value:2}]}));
  for(const table of builtInScales())assert.equal(validateScale(table),table);
  assert.throws(()=>validateScale({...scale,grades:scale.grades.map(row=>({...row,letter:'A'}))}));
  assert.throws(()=>validateScale({...scale,grades:scale.grades.map(row=>({...row,min:50,max:60}))}));
  assert.throws(()=>convertGradeScale({scale,value:Infinity}));
});
