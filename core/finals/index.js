import {validateScale} from '../scales/index.js';
import {number,round} from '../study/numbers.js';
export function finalNeeded({categories,cutoff}) {
  number(cutoff,'Target cutoff',0,100);
  if(!Array.isArray(categories)||!categories.length||categories.length>100)throw new Error('Add 1–100 assessment categories.');
  let totalWeight=0,earned=0,finalWeight=0,unknown=0;
  const rows=categories.map(row=>{
    number(row.weight,'Category weight',0,100);totalWeight+=row.weight;
    if(row.score===null){unknown++;finalWeight=row.weight;return {...row,contribution:null};}
    number(row.score,'Category score',0,100);const contribution=row.weight*row.score/100;earned+=contribution;return {...row,contribution};
  });
  if(Math.abs(totalWeight-100)>1e-8)throw new Error(`Weights must total 100% (currently ${round(totalWeight,4)}%).`);
  if(unknown!==1||finalWeight<=0)throw new Error('Exactly one category must have an unknown score and a positive final weight.');
  const needed=(cutoff-earned)/(finalWeight/100),maximum=earned+finalWeight;
  return {categories:rows,totalWeight,earned,finalWeight,cutoff,needed,neededDisplay:round(needed,1),maximum:round(maximum,4),status:needed<=1e-10?'already-secured':needed>100+1e-10?'unreachable':'reachable',formula:`(${cutoff} − ${round(earned,6)}) ÷ ${round(finalWeight/100,6)}`};
}
export function finalLadder({categories,scale}) {
  validateScale(scale);
  if(scale.grades.some(row=>row.min===undefined))throw new Error('Final targets require percentage cutoffs in the active scale.');
  return [...scale.grades].sort((a,b)=>b.points-a.points).map(grade=>({letter:grade.letter,...finalNeeded({categories,cutoff:grade.min})}));
}
