export function number(value,name,min=0,max=Number.MAX_SAFE_INTEGER) {
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(`${name} must be between ${min} and ${max}.`);
  return value;
}
// Decimal half-up display rounding, including binary values just below .05.
export const round=(value,places=2)=>Math.round((value+Number.EPSILON*Math.max(1,Math.abs(value))*8)*10**places)/10**places;
