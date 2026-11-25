function sequence(left,right) {
  if(left.length*right.length>1500000) throw new Error('The comparison is too large. Compare shorter resume versions.');
  const table=Array.from({length:left.length+1},()=>new Uint32Array(right.length+1));
  for(let i=left.length-1;i>=0;i--) for(let j=right.length-1;j>=0;j--) table[i][j]=left[i]===right[j]?table[i+1][j+1]+1:Math.max(table[i+1][j],table[i][j+1]);
  const rows=[];let i=0,j=0;
  while(i<left.length||j<right.length) {
    if(i<left.length&&j<right.length&&left[i]===right[j]) {rows.push({type:'equal',text:left[i]});i++;j++;}
    else if(j<right.length&&(i===left.length||table[i][j+1]>table[i+1][j])) rows.push({type:'added',text:right[j++]});
    else rows.push({type:'removed',text:left[i++]});
  }
  return rows;
}
export function wordDiff(before,after) {return sequence(before.match(/\S+|\s+/g)??[],after.match(/\S+|\s+/g)??[]);}
export function diffText(before,after) {
  const rows=sequence(String(before).replace(/\r\n/g,'\n').split('\n'),String(after).replace(/\r\n/g,'\n').split('\n'));
  for(const row of rows) row.words=[{type:row.type,text:row.text}];
  // Assign paired word highlights by contiguous edit block (not render order).
  for(let i=0;i<rows.length;) {
    if(rows[i].type==='equal') {i++;continue;}
    const block=[];while(i<rows.length&&rows[i].type!=='equal') block.push(rows[i++]);
    const removed=block.filter(row=>row.type==='removed'),added=block.filter(row=>row.type==='added');
    for(let k=0;k<Math.min(removed.length,added.length);k++) {
      const words=wordDiff(removed[k].text,added[k].text);
      removed[k].words=words.filter(word=>word.type!=='added');added[k].words=words.filter(word=>word.type!=='removed');
    }
  }
  return rows;
}
const tiers=['limited','partial','good','strong'];
export function medianTier(reports) {
  const values=reports.map(report=>tiers.indexOf(report.tier)).filter(value=>value>=0).sort((a,b)=>a-b);
  return values.length?tiers[values[Math.floor((values.length-1)/2)]]:null;
}
export function matchingEffect(before,after) {
  const byJob=new Map(before.map(report=>[report.jobId,report]));
  const common=after.filter(report=>byJob.has(report.jobId));
  return {jobs:common.length,before:medianTier(common.map(report=>byJob.get(report.jobId))),after:medianTier(common)};
}
