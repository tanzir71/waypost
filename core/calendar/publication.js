import {base64url,unbase64,utf8,requireUUID,keyVersion,endpointURL} from '../sync/protocol.js';
export const calendarBinding=(vaultId,version,nonce)=>`waypost-calendar-v1:${requireUUID(vaultId)}:${keyVersion(version)}:${nonce}`;
export async function calendarToken({vaultId,keyVersion:version,authToken},nonce){
  unbase64(nonce,{length:32});const key=await crypto.subtle.importKey('raw',unbase64(authToken,{length:32}),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,utf8(calendarBinding(vaultId,version,nonce)))));
}
export async function newCalendarPublication(session){const nonce=base64url(crypto.getRandomValues(new Uint8Array(32)));return {nonce,token:await calendarToken(session,nonce)};}
export function calendarFeedURL({endpoint,provider,token,icsUrl=null}){
  unbase64(token,{length:32});const url=new URL(endpoint);
  const configured=icsUrl?new URL(endpointURL(icsUrl,{origin:url.origin})):null;
  if(provider==='php'){const feed=configured??new URL('ics.php',url);feed.searchParams.set('token',token);return feed.href;}
  if(configured&&provider==='cloudflare'){configured.pathname=configured.pathname.replace(/\/$/,'')+'/'+token+'.ics';return configured.href;}
  if(provider!=='cloudflare'||!url.pathname.endsWith('/api/sync'))throw new Error('Use a Worker endpoint ending in /api/sync for calendar publication.');
  url.pathname=url.pathname.slice(0,-4)+'ics/'+token+'.ics';return url.href;
}
