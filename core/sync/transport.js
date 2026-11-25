import {endpointURL,MAX_REQUEST_BYTES,bytesLength} from './protocol.js';
export class SyncError extends Error {constructor(message,{status=0,code='network',retryAfter=0}={}){super(message);this.name='SyncError';this.status=status;this.code=code;this.retryAfter=retryAfter;}}
export function createTransport({endpoint,provider='php',origin,fetch:fetcher=globalThis.fetch,session=null,signal:defaultSignal,wait=(ms,signal)=>new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new SyncError('Sync cancelled.',{code:'aborted'}));},timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});})}) {
  const root=endpointURL(endpoint,{origin});
  async function once(path,{method='GET',data,query={},auth=session,signal=defaultSignal}={}){
    const url=new URL(provider==='php'?root:root+path);if(provider==='php')url.searchParams.set('route',path);
    for(const [key,value]of Object.entries(query))if(value!==undefined)url.searchParams.set(key,String(value));
    const headers={'Accept':'application/json'};let body;
    if(data!==undefined){body=JSON.stringify(data);if(bytesLength(body)>MAX_REQUEST_BYTES)throw new SyncError('Sync request exceeds 5 MB.',{code:'request_limit'});headers['Content-Type']='application/json';}
    if(auth){headers.Authorization=`Bearer ${auth.authToken}`;headers['X-Waypost-Vault']=auth.vaultId;headers['X-Waypost-Key-Version']=String(auth.keyVersion);}
    const controller=new AbortController(),abort=()=>controller.abort(signal?.reason),timer=setTimeout(()=>controller.abort(),20000);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
    try{
      const response=await fetcher(url.href,{method,headers,body,signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
      const reader=response.body?.getReader();let raw='',length=0;
      if(reader){const decoder=new TextDecoder();while(true){const item=await reader.read();if(item.done)break;length+=item.value.length;if(length>MAX_REQUEST_BYTES){await reader.cancel();throw new SyncError('Sync response exceeds 5 MB.',{code:'response_limit'});}raw+=decoder.decode(item.value,{stream:true});}raw+=decoder.decode();}else raw=await response.text();
      let value;try{value=JSON.parse(raw);}catch{throw new SyncError(`The sync endpoint did not return JSON (HTTP ${response.status}).`,{status:response.status,code:'not_json'});}
      if(!response.ok)throw new SyncError(value.error??`Sync request failed (HTTP ${response.status}).`,{status:response.status,code:value.code??'server',retryAfter:Math.max(1,Math.min(60,Number(response.headers.get('Retry-After'))||1))*1000});return value;
    }catch(error){if(error instanceof SyncError)throw error;throw new SyncError(controller.signal.aborted?'Sync request cancelled or timed out.':'Sync server could not be reached.',{code:controller.signal.aborted?'aborted':'network'});}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  async function request(path,options={}){for(let attempt=0;;attempt++){try{return await once(path,options);}catch(error){if(attempt>=3||!(error.status===429||error.code==='retry_read'))throw error;await wait(error.retryAfter,options.signal??defaultSignal);}}}
  return {request,checks:()=>request('/checks',{auth:null}),metadata:vaultId=>request('/vault',{query:{vaultId},auth:null}),recover:(vaultId,codeId)=>request('/recover',{method:'POST',data:{vaultId,codeId},auth:null}),create:secrets=>request('/vault',{method:'POST',data:{vaultId:secrets.vaultId,salt:secrets.salt,keyVersion:secrets.keyVersion,authHash:secrets.authHash,wrappedKeys:secrets.wrappedKeys},auth:secrets}),pull:(cursor,auth=session)=>request('/changes',{query:{since:cursor},auth}),push:(changes,auth=session)=>request('/changes',{method:'POST',data:{changes},auth}),deleteVault:(auth=session)=>request('/vault',{method:'DELETE',auth})};
}
