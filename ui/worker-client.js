export function createScorer(WorkerClass=globalThis.Worker) {
  let worker;let next=0;const pending=new Map();
  const close=()=>{worker?.terminate();worker=null;for(const item of pending.values()) {clearTimeout(item.timer);item.reject(new Error('Scoring worker stopped. Please score again.'));}pending.clear();};
  return {
    score(resumes,jobs) {
      if(!WorkerClass) return Promise.reject(new Error('This browser cannot run the scoring worker. Try a browser with module worker support.'));
      if(!worker) {
        worker=new WorkerClass(new URL('./match-worker.js',import.meta.url),{type:'module'});
        worker.onmessage=event=>{const item=pending.get(event.data.id);if(!item)return;clearTimeout(item.timer);pending.delete(event.data.id);if(event.data.error)item.reject(new Error(event.data.error));else item.resolve(event.data.reports);};
        worker.onerror=()=>close();
      }
      const id=++next;
      return new Promise((resolve,reject)=>{const timer=setTimeout(()=>close(),60000);pending.set(id,{resolve,reject,timer});worker.postMessage({id,resumes,jobs,now:new Date().toISOString().slice(0,10)});});
    },close
  };
}
