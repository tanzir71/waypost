export function httpURL(value) {
  try {const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;} catch{return null;}
}
export function encodeText(text) {
  const bytes=new TextEncoder().encode(String(text));
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
export function decodeText(encoded,maxBytes=32768) {
  if(typeof encoded!=='string'||encoded.length>Math.ceil(maxBytes*4/3)||!/^[A-Za-z0-9_-]*$/.test(encoded)||encoded.length%4===1) throw new Error('Invalid or oversized private link. Import a file or paste instead.');
  const binary=atob(encoded.replaceAll('-','+').replaceAll('_','/'));
  const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
  if(bytes.length>maxBytes)throw new Error('Private link is too large. Paste instead.');
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
