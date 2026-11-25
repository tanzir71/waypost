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
  get selected(){return this._selected??false;}set selected(value){this._selected=!!value;if(value&&this.parentNode?.tagName==='SELECT')for(const row of this.parentNode.options)if(row!==this)row._selected=false;}
  setAttribute(key,value){this.attributes[key]=String(value);if(key==='value')this.value=value;}
  getAttribute(key){return this.attributes[key]??null;}
  removeAttribute(key){delete this.attributes[key];}
  append(...nodes){for(let node of nodes){if(!(node instanceof Node))node=new Node('#text',String(node));if(node.parentNode)node.remove();node.parentNode=this;this.children.push(node);if(node.tagName==='OPTION'&&node.selected)node.selected=true;}}
  prepend(...nodes){const previous=[...this.children];this.replaceChildren(...nodes,...previous);}
  replaceChildren(...nodes){for(const node of this.children)node.parentNode=null;this.children=[];this._text='';this.append(...nodes);}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(row=>row!==this);this.parentNode=null;}}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
  removeEventListener(name,fn){this.listeners[name]=(this.listeners[name]??[]).filter(item=>item!==fn);}
  async fire(name,details={}){const event={preventDefault(){},target:this,currentTarget:this,...details};for(const fn of [...this.listeners[name]??[]])await fn(event);}
  reportValidity(){return true;}
  showModal(){this.open=true;}close(){if(this.open){this.open=false;return this.fire('close');}}focus(){}scrollIntoView(){}
  querySelectorAll(selector){return walk(this).filter(row=>selector.split(',').some(part=>matches(row,part.trim())));}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
}
const matches=(row,selector)=>selector.startsWith('#')?row.attributes.id===selector.slice(1):selector.startsWith('[')?(()=>{const match=selector.match(/^\[([^=\]]+)(?:="([^\"]*)")?\]$/);return match&&(match[2]===undefined?Object.hasOwn(row.attributes,match[1]):row.attributes[match[1]]===match[2]);})():row.tagName.toLowerCase()===selector;
export const walk=node=>node.children.flatMap(row=>[row,...walk(row)]);
export function fakeDOM(path='/waypost/app/gpa/'){const names=['Node','document','location','history','navigator','window'],previous=Object.fromEntries(names.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  let url=new URL(path,'https://example.test');const body=new Node('body'),heading=new Node('h1'),description=new Node('p'),result=new Node('script'),announcement=new Node('div'),view=new Node('div'),actions=new Node('div');result.setAttribute('id','result-data');announcement.setAttribute('id','announcement');body.append(heading,description,view,actions,result,announcement);
  const events=new Node('events'),document={body,documentElement:{dataset:{}},createElement:tag=>new Node(tag),createTextNode:text=>new Node('#text',text),querySelector:selector=>selector==='h1'?heading:selector==='.view-header .muted'?description:body.querySelector(selector),querySelectorAll:selector=>body.querySelectorAll(selector),getElementById:id=>body.querySelector('#'+id),addEventListener:(...args)=>events.addEventListener(...args),removeEventListener:(...args)=>events.removeEventListener(...args)};
  const location={get href(){return url.href;},set href(value){url=new URL(value,url);},get hash(){return url.hash;},get search(){return url.search;},get pathname(){return url.pathname;},get origin(){return url.origin;},get hostname(){return url.hostname;},assign(value){url=new URL(value,url);},reload(){}};
  const window={WAYPOST_CONFIG:{basePath:'/waypost/',mode:'pwa'},location,addEventListener:(...args)=>events.addEventListener(...args),removeEventListener:(...args)=>events.removeEventListener(...args),matchMedia:()=>({matches:false})};
  for(const [key,value] of Object.entries({Node,document,window,location,history:{replaceState:(_,title,value)=>{url=new URL(value,url);}},navigator:{clipboard:{writeText:async()=>{}}}}))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  return {view,actions,body,events,readResult:()=>JSON.parse(result.textContent),find:hook=>walk(body).filter(row=>row.attributes['data-testid']===hook),restore:()=>{for(const key of names)if(previous[key])Object.defineProperty(globalThis,key,previous[key]);else delete globalThis[key];}};
}
