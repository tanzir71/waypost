import {scoreBatch} from './index.js';
export function scoreMessage({resumes,jobs,now}) {
  if(!Array.isArray(resumes)||!Array.isArray(jobs)) throw new Error('Resumes and jobs must be arrays.');
  if(resumes.length>100||jobs.length>1000) throw new Error('Score at most 100 resume versions and 1,000 jobs at a time.');
  return scoreBatch(resumes,jobs,{now});
}
