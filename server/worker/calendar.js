import {SyncRepository} from './repository.js';
import {unbase64} from '../../core/sync/protocol.js';
import {digest} from '../../core/sync/crypto.js';
export async function handleCalendarFeed(request,env){
  const url=new URL(request.url),headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'},error=(status,text)=>new Response(text,{status,headers:{...headers,'Content-Type':'text/plain; charset=utf-8',...(status===405?{Allow:'GET, HEAD'}:{})}});
  if(url.protocol!=='https:')return error(426,'HTTPS is required.');if(!['GET','HEAD'].includes(request.method))return error(405,'Use GET or HEAD.');
  const token=url.pathname.match(/\/api\/ics\/([A-Za-z0-9_-]{43})\.ics$/)?.[1];try{unbase64(token,{length:32});}catch{return error(404,'Calendar feed not found.');}
  if(!env.DB||!env.AUTH_PEPPER)return error(503,'Calendar storage is not configured.');
  try{const repo=new SyncRepository(env),window=Math.floor(Date.now()/60000),bucket=await digest(`${env.AUTH_PEPPER}:${request.headers.get('cf-connecting-ip')??'unknown'}:calendar:${window}`);if(!await repo.rate(bucket,window,Number(env.RATE_PER_MINUTE)||600))return new Response('Rate limit reached.',{status:429,headers:{...headers,'Retry-After':'60'}});
    const feed=await repo.publicCalendar(await digest(token));if(!feed)return error(404,'Calendar feed not found.');return new Response(request.method==='HEAD'?null:feed.ics,{headers:{...headers,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="waypost.ics"'}});
  }catch{return error(503,'Calendar storage is unavailable.');}
}
