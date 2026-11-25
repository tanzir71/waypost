import test from 'node:test';import assert from 'node:assert/strict';
import {reviewRewrite,rewriteRequest,applyRewrite,relayInput,providerText,aiEndpoint,aiKey} from '../core/ai/index.js';
import {settingsDefaults} from '../core/store/schema.js';
const before='We reduced latency by 18%. I would be delighted to discuss the role.',after='We reduced latency by 18%. I welcome a conversation about the role.';
test('AI is off by default; writing requests carry only selected text and bounded instructions',()=>{
 assert.equal(settingsDefaults().ai.provider,null);const request=rewriteRequest(before,'concise');assert.equal(request.input,before);assert.match(request.instructions,/VERBATIM/);const payload=relayInput({...request,model:'model-from-owner-account'});assert.equal(payload.store,false);assert.equal(payload.max_output_tokens,4096);assert.throws(()=>relayInput({...request,model:'test',tools:[]}));assert.throws(()=>rewriteRequest('a'.repeat(12001)));assert.throws(()=>rewriteRequest(before,'invent'));assert.throws(()=>aiKey('key\r\nheader'));assert.throws(()=>aiEndpoint('https://other.test/ai',{origin:'https://example.test'}));assert.throws(()=>aiEndpoint('http://example.test/ai',{origin:'https://example.test'}));
});
test('AI reviews preserve quantified sentences, reject new metrics and changed attribution/negation, and expose a complete diff',()=>{
 const review=reviewRewrite(before,after);assert.equal(review.changed,true);assert.equal(review.rows.filter(row=>row.type!=='added').map(row=>row.text).join('\n'),before);assert.equal(review.rows.filter(row=>row.type!=='removed').map(row=>row.text).join('\n'),after);
 for(const candidate of ['I reduced latency by 18%. I welcome a conversation.','We did not reduce latency by 18%. I welcome a conversation.','We reduced latency by 81%. I welcome a conversation.','I welcome a conversation.','We reduced latency by 18%. I doubled sales.','We reduced latency by 18%. I managed twenty people.','We reduced latency by 18%. I managed １０ people.','We reduced latency by 18%. I managed ১২ people.','We reduced latency by 18%. I saved a dozen hours.'])assert.throws(()=>reviewRewrite(before,candidate),/quantified/);
 const original='Start\n'+before+'\nEnd',snapshot={text:original,start:6,end:6+before.length};assert.equal(applyRewrite(original,snapshot,review),'Start\n'+after+'\nEnd');assert.throws(()=>applyRewrite(original+' edit',snapshot,review),/draft changed/);
});
test('large AI changes still expose all before/after text when word alignment is too large',()=>{
 const left='alpha '.repeat(1300),right='beta '.repeat(1300),review=reviewRewrite(left,right);assert.deepEqual(review.rows.map(row=>row.text),[left,right]);
});
test('raw OpenAI responses are parsed from assistant output_text and incomplete/refusal responses are rejected',()=>{
 const value={status:'completed',output:[{type:'reasoning',summary:[]},{type:'message',role:'assistant',content:[{type:'output_text',text:after}]}]};assert.equal(providerText(value),after);assert.throws(()=>providerText({...value,status:'incomplete'}));assert.throws(()=>providerText({...value,output:[{type:'message',role:'assistant',content:[{type:'refusal',refusal:'No'}]}]}));assert.throws(()=>providerText({...value,output:[]}));
});
