import {validateScale,gradePoints} from '../scales/index.js';
import {number,round} from '../study/numbers.js';
export function planTargetGpa({current,completed,target,remaining,scale}) {
  validateScale(scale);number(current,'Current CGPA',0,scale.max);number(completed,'Completed credits');number(target,'Target CGPA',0,scale.max);number(remaining,'Remaining credits',0.01);
  const needed=(target*(completed+remaining)-current*completed)/remaining,maxAchievable=(current*completed+scale.max*remaining)/(completed+remaining);
  return {current,completed,target,remaining,scaleId:scale.id,needed,neededDisplay:round(needed),reachable:needed<=scale.max+1e-10,alreadySecured:needed<=0,maxAchievable,formula:`(${target} × (${completed} + ${remaining}) − ${current} × ${completed}) ÷ ${remaining}`};
}
export function weightedGpa(courses,scale,{planned=true}={}) {
  validateScale(scale);let credits=0,points=0;
  for(const course of courses) {
    const grade=planned?(course.targetGrade??course.grade):course.grade;
    if(grade===null||grade===undefined||grade==='')continue;
    number(course.credits,'Course credits',0.01);credits+=course.credits;points+=gradePoints(scale,grade)*course.credits;
  }
  return {credits,points,average:credits?points/credits:null};
}
export function solveCourseMix({courses,needed,scale}) {
  validateScale(scale);number(needed,'Needed average',-Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER);
  if(!courses.length||courses.length>500)throw new Error('Add 1–500 courses to solve a mix.');
  const grades=[...scale.grades].filter(row=>row.points>0).sort((a,b)=>a.points-b.points);
  const rows=courses.map(course=>{
    number(course.credits,'Course credits',0.01);number(course.difficulty??1,'Course difficulty',1,3);
    if(!Number.isInteger(course.difficulty??1))throw new Error('Course difficulty must be 1, 2 or 3.');
    const letter=course.targetGrade??course.grade;
    if(course.locked)gradePoints(scale,letter);
    return {...course,targetGrade:course.locked?letter:grades[0].letter};
  });
  let summary=weightedGpa(rows,scale),steps=0;
  while(summary.average+1e-10<needed) {
    let best=null;
    for(let i=0;i<rows.length;i++) {
      const row=rows[i];if(row.locked)continue;
      const point=gradePoints(scale,row.targetGrade),next=grades.find(grade=>grade.points>point);
      if(!next)continue;
      const gain=(next.points-point)*row.credits,ratio=gain/(row.difficulty??1);
      if(!best||ratio>best.ratio+1e-10||(Math.abs(ratio-best.ratio)<1e-10&&row.credits>rows[best.i].credits))best={i,next,gain,ratio};
    }
    if(!best)break;
    rows[best.i].targetGrade=best.next.letter;steps++;
    summary={...summary,points:summary.points+best.gain,average:(summary.points+best.gain)/summary.credits};
  }
  return {courses:rows,...summary,needed,reachable:summary.average+1e-10>=needed,steps,method:'Greedy marginal points × credits / difficulty; ties: larger credits, then original course order.'};
}
export function retakeWhatIf({current,completed,remaining,target,scale,credits,oldGrade,newGrade,policy=scale.retakePolicy}) {
  const baseline=planTargetGpa({current,completed,remaining,target,scale});number(credits,'Retake credits',0.01,completed);
  const old=gradePoints(scale,oldGrade),next=gradePoints(scale,newGrade);let quality=current*completed,counted=completed;
  if(policy==='replace')quality+=(next-old)*credits;
  else if(policy==='average')quality+=(next-old)/2*credits;
  else if(policy==='both-count'){quality+=next*credits;counted+=credits;}
  else throw new Error('Choose replace, average or both-count.');
  // The what-if assumes the retake has been completed outside the remaining
  // new credits. For both-count, the second attempt adds counted credits.
  const after=planTargetGpa({current:quality/counted,completed:counted,remaining,target,scale});
  return {policy,credits,oldGrade,newGrade,before:baseline,after};
}
export function termTrend(terms,courses,scale) {
  return [...terms].sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)).map(term=>{
    const summary=weightedGpa(courses.filter(row=>row.termId===term.id),scale,{planned:term.planned});
    if(summary.average===null&&!term.planned&&term.reportedGpa!==undefined){number(term.reportedGpa,'Reported term GPA',0,scale.max);return {...term,...summary,average:term.reportedGpa,reported:true};}
    return {...term,...summary,reported:false};
  });
}
