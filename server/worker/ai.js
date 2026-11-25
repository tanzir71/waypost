import {aiKey,relayInput,providerText} from '../../core/ai/index.js';
import {boundedJSON} from '../../core/ai/transport.js';
import {SyncRepository} from './repository.js';
import {digest} from '../../core/sync/crypto.js';
const response=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...(status===429?{'Retry-After':'60'}:{})}});
export async function handleAI(request,env,{fetcher=globalThis.fetch}={}){
 const url=new URL(request.url);
 if(url.protocol!=='https:')return response({error:'HTTPS is required.'},426);
 if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return response({error:'Same-origin requests only.'},403);
 if(request.method!=='POST')return response({error:'Use POST from the application.'},405);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return response({error:'Expected JSON.'},415);
 if(!env.DB||typeof env.AUTH_PEPPER!=='string'||env.AUTH_PEPPER.length<32)return response({error:'AI relay rate limiting is not configured.'},503);
 let key,input;try{key=aiKey(request.headers.get('x-waypost-ai-key'));input=relayInput(await boundedJSON(request,65536));}catch{return response({error:'Invalid AI request, key or size.'},400);}
 try{
  const window=Math.floor(Date.now()/60000),bucket=await digest(`${env.AUTH_PEPPER}:${request.headers.get('cf-connecting-ip')??'unknown'}:ai:${window}`);if(!await new SyncRepository(env).rate(bucket,window,30))return response({error:'AI rate limit reached.'},429);
  // Server-only fixed upstream. Never forward a caller URL, cookies or vault token.
  const upstream=await fetcher('https://api.openai.com/v1/responses',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify(input),signal:AbortSignal.any([request.signal,AbortSignal.timeout(45000)])});
  if(!upstream.ok){await upstream.body?.cancel();return response({error:'AI provider could not complete this request.'},[401,403].includes(upstream.status)?401:upstream.status===429?429:502);}
  const text=providerText(await boundedJSON(upstream));return response({text});
 }catch{return response({error:'AI request failed. Your draft is unchanged.'},502);}
}
