import {aiEndpoint,aiKey,relayInput,reviewRewrite,rewriteRequest} from '../core/ai/index.js';
import {boundedJSON} from '../core/ai/transport.js';
async function privateAI(store){
 const settings=await store.all('settings'),preferences=settings.find(row=>row.key==='preferences')?.value,connection=settings.find(row=>row.key==='ai-connection')?.value??{};
 let provider=preferences?.ai?.provider??null;if(!['chrome-builtin','byok'].includes(provider)||provider==='byok'&&window.WAYPOST_CONFIG.mode==='demo')provider=null;
 return {connection,configuration:{provider,model:connection.model??'',endpoint:connection.endpoint??'',hasKey:!!connection.key}};
}
export async function readAI(store){return (await privateAI(store)).configuration;}
export async function saveAI(store,{provider=null,model='',endpoint='',key='',forget=false}){
 if(![null,'chrome-builtin','byok'].includes(provider))throw new Error('Choose an AI provider.');
 const previous=(await store.setting('ai-connection'))?.value??{},preferences=(await store.setting('preferences')).value;
 let connection=forget?{}:previous;
 if(provider==='byok'){
  if(window.WAYPOST_CONFIG.mode==='demo')throw new Error('BYOK needs a self-hosted same-origin relay.');
  connection={model:relayInput({model,input:'Validate settings',instructions:'Validate settings'}).model,endpoint:aiEndpoint(endpoint,{origin:location.origin}),key:aiKey(key||connection.key)};
 }
 // Internal settings never enter backups or encrypted sync projections.
 await store.setSetting('ai-connection',connection);
 await store.setSetting('preferences',{...preferences,ai:{provider,byokVendor:provider==='byok'?'openai':null}});
 return readAI(store);
}
export async function builtinAvailability(model=globalThis.LanguageModel){
 if(!model?.availability||!model?.create)return 'unavailable';
 try{return await model.availability({expectedInputs:[{type:'text',languages:['en']}],expectedOutputs:[{type:'text',languages:['en']}]});}catch{return 'unavailable';}
}
export async function suggestRewrite(store,text,goal,{signal,expected,model=globalThis.LanguageModel,fetcher=globalThis.fetch}={}){
 const {configuration,connection}=await privateAI(store),request=rewriteRequest(text,goal);signal?.throwIfAborted();let after;
 if(expected&&['provider','model','endpoint'].some(key=>expected[key]!==configuration[key]))throw new Error('AI settings changed. Close this review and request a new one.');
 if(configuration.provider==='chrome-builtin'){
  if(await builtinAvailability(model)!=='available')throw new Error('Chrome’s on-device English model is not ready. Prepare it in Settings before rewriting.');
  let session;try{session=await model.create({signal,expectedInputs:[{type:'text',languages:['en']}],expectedOutputs:[{type:'text',languages:['en']}],initialPrompts:[{role:'system',content:request.instructions}]});signal?.throwIfAborted();after=await session.prompt(request.input,{signal});}catch(error){if(signal?.aborted)throw error;throw new Error('The on-device model could not finish. Your draft is unchanged.');}finally{session?.destroy();}
 }else if(configuration.provider==='byok'){
  const endpoint=aiEndpoint(connection.endpoint,{origin:location.origin}),key=aiKey(connection.key),payload=relayInput({...request,model:connection.model});
  let response;try{response=await fetcher(endpoint,{method:'POST',mode:'same-origin',credentials:'omit',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json','X-Waypost-AI-Key':key},body:JSON.stringify({model:payload.model,input:payload.input,instructions:payload.instructions}),signal});}catch(error){if(signal?.aborted)throw error;throw new Error('The AI relay could not be reached. Your draft is unchanged.');}
  if(!response.ok)throw new Error(response.status===429?'AI rate limit reached. Try again later.':response.status===401?'Provider rejected the API key. Update it in Settings.':'The AI relay could not complete this request. Your draft is unchanged.');
  const value=await boundedJSON(response);after=value.text;if(typeof after==='string'&&after.includes(key))throw new Error('AI response was rejected. Your draft is unchanged.');
 }else throw new Error('AI is off. Enable an optional provider in Settings first.');
 signal?.throwIfAborted();return reviewRewrite(text,after);
}
