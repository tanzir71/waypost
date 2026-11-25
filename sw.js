import {VERSION,PRECACHE} from './precache.js';
import {requestPolicy} from './core/pwa/policy.js';
const scope=self.registration.scope,shellCache=VERSION,runtimeCache=`${VERSION}-runtime`;
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(shellCache);
    // The browser only installs the new worker after every required asset is
    // available. No skipWaiting until a person accepts the update toast.
    await cache.addAll(PRECACHE.map(path=>new Request(new URL(path,scope),{cache:'reload'})));
  })());
});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('waypost-')&&![shellCache,runtimeCache].includes(key)).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='WAYPOST_ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const policy=requestPolicy(event.request,scope,PRECACHE);if(!policy.cache)return;
  event.respondWith((async()=>{
    const cache=await caches.open(policy.strategy==='runtime'?runtimeCache:shellCache),cached=await cache.match(policy.key);
    if(cached)return cached;
    try{const request=policy.strategy==='precache'?new Request(policy.key,{cache:'no-cache',credentials:'same-origin',referrerPolicy:'no-referrer'}):event.request;const response=await fetch(request);if(response.ok&&response.type!=='opaque')await cache.put(policy.key,response.clone());return response;}
    catch(error){if(event.request.mode==='navigate'){const fallback=await (await caches.open(shellCache)).match(new URL('app/index.html',scope));if(fallback)return fallback;}throw error;}
  })());
});
