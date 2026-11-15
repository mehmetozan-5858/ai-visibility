import test from 'node:test';
import assert from 'node:assert/strict';
import {openRouterFreeConfig,runOpenRouterFreeReview} from '../lib/openrouter-free-provider-review.mjs';
const key='synthetic-only-openrouter-key-1234567890';
const enabled={OPENROUTER_FREE_ENABLED:'true',OPENROUTER_API_KEY:key,
 OPENROUTER_FREE_MODEL:'openrouter/free'};
test('opt-in mandatory and any paid/ambiguous model fails before network',async()=>{
 let called=0;const fetcher=async()=>{called++;throw Error('unexpected')};
 for(const env of [
  {...enabled,OPENROUTER_FREE_ENABLED:'false'},
  {...enabled,OPENROUTER_FREE_MODEL:'openai/gpt-4.1-mini'},
  {...enabled,OPENROUTER_FREE_MODEL:'anthropic/something'},
  {...enabled,OPENROUTER_API_KEY:''}
 ]){
  assert.equal(openRouterFreeConfig(env).ready,false);
  await assert.rejects(runOpenRouterFreeReview('Synthetic prompt',{env,fetcher}),/openrouter-free-/);
 }
 assert.equal(called,0);
});
test('free-only exact request and provider receipt parsing are synthetic',async()=>{
 let calls=0;
 const result=await runOpenRouterFreeReview('Synthetic analysis',{env:enabled,fetcher:async(url,opts)=>{
  calls++;assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(opts.method,'POST');assert.equal(opts.headers.authorization,'Bearer '+key);
  assert.equal(opts.cache,'no-store');assert.equal(opts.redirect,'error');
  const body=JSON.parse(opts.body);
  assert.equal(body.model,'openrouter/free');
  assert.equal(body.stream,false);
  assert.ok(body.max_tokens<=900);
  assert.deepEqual(body.messages,[{role:'user',content:'Synthetic analysis'}]);
  return {ok:true,json:async()=>({id:'synthetic-generation-id',
   model:'example/free-model:free',usage:{cost:0},
   choices:[{finish_reason:'stop',message:{content:'{"score":48}'}}]})};
 }});
 assert.equal(calls,1);assert.equal(result.costVerified,true);
 assert.equal(result.receiptId,'synthetic-generation-id');
 assert.equal(result.content,'{"score":48}');
 assert.ok(!JSON.stringify(result).includes(key));
});
test('missing model proof, billed responses, truncation and provider outages fail closed',async()=>{
 const reply=(payload,ok=true)=>async()=>({ok,json:async()=>payload});
 const base={model:'example/model:free',usage:{cost:0},
  choices:[{finish_reason:'stop',message:{content:'{"score":48}'}}]};
 for(const payload of [
  {...base,model:'example/paid-model'},
  {...base,usage:{cost:0.01}},
  {...base,choices:[{finish_reason:'length',message:{content:'{"score":48}'}}]},
  {...base,choices:[{finish_reason:'stop',message:{content:''}}]},
  {...base,error:{message:'synthetic error'}}
 ])await assert.rejects(runOpenRouterFreeReview('Synthetic prompt',{env:enabled,fetcher:reply(payload)}));
 await assert.rejects(runOpenRouterFreeReview('Synthetic prompt',{env:enabled,fetcher:reply({},false)}));
 await assert.rejects(runOpenRouterFreeReview('Synthetic prompt',{env:enabled,fetcher:async()=>{throw Error('secret '+key)}}),
  /openrouter-free-network-failed/);
});
