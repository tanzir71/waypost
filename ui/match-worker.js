import {scoreMessage} from '../core/match/worker.js';
self.onmessage=event=>{
  try {self.postMessage({id:event.data.id,reports:scoreMessage(event.data)});}
  catch(error) {self.postMessage({id:event.data.id,error:error.message});}
};
