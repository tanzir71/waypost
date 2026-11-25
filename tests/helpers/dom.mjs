// Minimal native-element contract for view integration tests, not a browser or
// layout engine. Exercises real view code, IDB adapter and pure calculations.
class Node {
  constructor(tag='#text',text=''){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.attributes={};this.listeners={};this._text=text;this._value='';this.checked=false;this.selected=false;this.disabled=false;this.hidden=false;}
  get classList(){return {add:(...values)=>{this.className=[this.className,...values].filter(Boolean).join(' ');}};}
  get dataset(){return Object.fromEntries(Object.entries(this.attributes).filter(([key])=>key.startsWith('data-')).map(([key,value])=>[key.slice(5).replace(/-([a-z])/g,(_,s)=>s.toUpperCase()),value]));}
  set className(value){this.attributes.class=value;}get className(){return this.attributes.class??'';}
  set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(row=>row.textContent).join('');}
  set value(value){if(this.tagName==='SELECT'){for(const row of this.options)row.selected=row.value===String(value);}this._value=String(value);}
  get value(){if(this.tagName==='SELECT')return (this.options.find(row=>row.selected)??this.options[0])?.value??'';return this._value;}
  get options(){return this.tagName==='SELECT'?this.children.filter(row=>row.tagName==='OPTION'):[];}
  get tBodies(){return this.children.filter(row=>row.tagName==='TBODY');}
  setAttribute(key,value){this.attributes[key]=String(value);if(key==='value')this.value=value;}
  getAttribute(key){return this.attributes[key]??null;}
  append(...nodes){for(let node of nodes){if(!(node instanceof Node))node=new Node('#text',String(node));if(node.parentNode)node.remove();node.parentNode=this;this.children.push(node);}}
  replaceChildren(...nodes){for(const node of this.children)node.parentNode=null;this.children=[];this._text='';this.append(...nodes);}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(row=>row!==this);this.parentNode=null;}}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
  async fire(name){const event={preventDefault(){},target:this};for(const fn of this.listeners[name]??[])await fn(event);}
  reportValidity(){return true;}
  showModal(){}close(){this.fire('close');}focus(){}
  querySelector(selector){return walk(this).find(row=>selector.startsWith('#')?row.attributes.id===selector.slice(1):row.tagName.toLowerCase()===selector)??null;}
}
export const walk=node=>node.children.flatMap(row=>[row,...walk(row)]);
export function fakeDOM(path='/waypost/app/gpa/'){const names=['Node','document','location','history','navigator'],previous=Object.fromEntries(names.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  let url=new URL(path,'https://example.test');const body=new Node('body'),heading=new Node('h1'),description=new Node('p'),result=new Node('script'),announcement=new Node('div'),view=new Node('div'),actions=new Node('div');result.setAttribute('id','result-data');announcement.setAttribute('id','announcement');body.append(heading,description,view,actions,result,announcement);
  const document={body,createElement:tag=>new Node(tag),createTextNode:text=>new Node('#text',text),querySelector:selector=>selector==='h1'?heading:selector==='.view-header .muted'?description:body.querySelector(selector)};
  const location={get href(){return url.href;},set href(value){url=new URL(value,url);},get hash(){return url.hash;},get pathname(){return url.pathname;},reload(){}};
  for(const [key,value] of Object.entries({Node,document,location,history:{replaceState:(_,title,value)=>{url=new URL(value,url);}},navigator:{clipboard:{writeText:async()=>{}}}}))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  return {view,actions,body,readResult:()=>JSON.parse(result.textContent),find:hook=>walk(body).filter(row=>row.attributes['data-testid']===hook),restore:()=>{for(const key of names)if(previous[key])Object.defineProperty(globalThis,key,previous[key]);else delete globalThis[key];}};
}
