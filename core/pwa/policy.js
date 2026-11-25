export function requestPolicy(request,scope,precache=[]) {
  const url=new URL(request.url),base=new URL(scope);
  if(request.method!=='GET'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return {cache:false};
  const relative=url.pathname.slice(base.pathname.length);
  if(request.headers?.has('authorization')||/^(?:server|api)\//.test(relative)||/^(?:sync|ics)(?:\/|\.)/.test(relative))return {cache:false};
  // Shared title/text/url are GET parameters required by the OS protocol. Only
  // the clean share route is cached; the payload remains in the live request.
  if(url.search&&!relative.match(/^app\/share\/$/))return {cache:false};
  const canonical=relative===''?'index.html':relative.endsWith('/')?relative+'index.html':relative;
  if(precache.includes(canonical))return {cache:true,strategy:'precache',key:new URL(canonical,base).href};
  if(/^(?:vendor|models)\//.test(relative)&&!url.search)return {cache:true,strategy:'runtime',key:url.href};
  return request.mode==='navigate'?{cache:true,strategy:'navigate',key:url.href}:{cache:false};
}
export function installEligibility({visits,dismissed=false,standalone=false,ios=false,promptAvailable=false}) {return visits>=2&&!dismissed&&!standalone&&(ios||promptAvailable);}
