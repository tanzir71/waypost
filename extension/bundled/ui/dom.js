export function el(tag,attrs={},...children) {
  const node=document.createElement(tag);
  for(const [key,value] of Object.entries(attrs)) {
    if(value===false||value===undefined||value===null) continue;
    if(key==='class') node.className=value;
    else if(key==='text') node.textContent=value;
    else if(key==='checked'||key==='disabled'||key==='hidden'||key==='selected') node[key]=Boolean(value);
    else if(key.startsWith('on')&&typeof value==='function') node.addEventListener(key.slice(2),value);
    else node.setAttribute(key,String(value));
  }
  for(const child of children.flat(Infinity)) if(child!==null&&child!==undefined) node.append(child instanceof Node?child:document.createTextNode(String(child)));
  return node;
}
export const button=(text,action,testid,attrs={})=>el('button',{type:'button',text,'data-testid':testid,onclick:action,...attrs});
export const field=(label,id,control)=>el('div',{class:'field'},el('label',{for:id,text:label}),control);
export function result(value) {document.querySelector('#result-data').textContent=JSON.stringify(value);}
export function announce(text) {document.querySelector('#announcement').textContent=text;}
export function localDay(date=new Date()) {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function download(name,text,mime='application/json') {
  const url=URL.createObjectURL(new Blob([text],{type:mime}));
  const link=el('a',{href:url,download:name});link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function copyJSON(value) {
  try {await navigator.clipboard.writeText(JSON.stringify(value,null,2));announce('JSON copied.');}
  catch {announce('Clipboard unavailable. Use Download JSON to save the result.');}
}
export {httpURL as safeURL} from '../core/links/index.js';
export function dialog(title,content) {
  const node=el('dialog',{'aria-label':title,'data-testid':'edit-dialog'},el('div',{class:'dialog-heading'},el('h2',{text:title}),button('Close',()=>node.close(),'dialog-close',{class:'ghost'})),content);
  node.addEventListener('close',()=>node.remove(),{once:true});document.body.append(node);node.showModal();return node;
}
