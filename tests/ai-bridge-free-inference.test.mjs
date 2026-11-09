import test from "node:test";
import assert from "node:assert/strict";
import {runFreeBridgeTask,selectFreeModel} from "../lib/ai-bridge-free-inference.mjs";
const id="cohere/north-mini-code:free";
const model={id,pricing:{prompt:"0",completion:"0"}};
const mock=(calls)=>(async (url,opts)=>{
  calls.push({url,opts});
  return url.endsWith("/models")?{ok:true,json:async()=>({data:[model]})}:
    {ok:true,json:async()=>({model:id,choices:[{message:{content:"Reviewed safely."}}],usage:{cost:0}})};
});
test("disabled by default makes no network requests",async()=>{
 const calls=[];const r=await runFreeBridgeTask({modelId:id,prompt:"hi",apiKey:"test",fetcher:mock(calls)});
 assert.equal(r.reason,"inference-disabled");assert.equal(calls.length,0);
});
test("only catalog-verified free models accepted",()=>{
 assert.deepEqual(selectFreeModel([model],id),{id});
 assert.equal(selectFreeModel([{...model,pricing:{prompt:"0.1",completion:"0"}}],id),null);
 assert.equal(selectFreeModel([model],"paid/model"),null);
});
test("successful request uses verified catalog and exactly one inference call",async()=>{
 const calls=[];
 const r=await runFreeBridgeTask({modelId:id,prompt:"Review this test",apiKey:"test",enabled:true,fetcher:mock(calls)});
 assert.equal(r.ok,true);assert.equal(calls.length,2);
 assert.equal(calls[1].opts.method,"POST");
 assert.equal(JSON.parse(calls[1].opts.body).max_tokens,350);
});
test("free suffix does not bypass nonzero pricing",async()=>{
 const calls=[];
 const f=async url=>url.endsWith("/models")?{ok:true,json:async()=>({data:[{...model,pricing:{prompt:"1",completion:"0"}}]})}:{ok:true};
 const r=await runFreeBridgeTask({modelId:id,prompt:"Review",apiKey:"test",enabled:true,fetcher:f});
 assert.equal(r.reason,"model-not-verified-free");
});
test("reject unauthorized or invalid request without network",async()=>{
 const calls=[];const f=mock(calls);
 assert.equal((await runFreeBridgeTask({modelId:"paid/model",prompt:"test",apiKey:"test",enabled:true,fetcher:f})).reason,"non-free-model-denied");
 assert.equal((await runFreeBridgeTask({modelId:id,prompt:"test",enabled:true,fetcher:f})).reason,"missing-server-key");
 assert.equal(calls.length,0);
});
test("provider claims a paid completion -> no successful output",async()=>{
 const f=async url=>url.endsWith("/models")?{ok:true,json:async()=>({data:[model]})}:
 {ok:true,json:async()=>({model:id,choices:[{message:{content:"Hi"}}],usage:{cost:0.1}})};
 const r=await runFreeBridgeTask({modelId:id,prompt:"test",apiKey:"test",enabled:true,fetcher:f});
 assert.equal(r.reason,"nonzero-cost-reported");
});

test("provider routing permits only zero-priced requests and disables fallbacks",async()=>{
 const calls=[];const r=await runFreeBridgeTask({modelId:id,prompt:"Review",apiKey:"test",enabled:true,fetcher:mock(calls)});
 assert.equal(r.ok,true);
 const body=JSON.parse(calls[1].opts.body);
 assert.equal(body.provider.allow_fallbacks,false);
 assert.deepEqual(body.provider.max_price,{prompt:0,completion:0,request:0,image:0,audio:0});
});
test("missing provider cost cannot be classified as free",async()=>{
 const fetcher=async url=>url.endsWith("/models")?{ok:true,json:async()=>({data:[model]})}:
 {ok:true,json:async()=>({model:id,choices:[{message:{content:"ok"}}],usage:{}})};
 const r=await runFreeBridgeTask({modelId:id,prompt:"Review",apiKey:"test",enabled:true,fetcher});
 assert.equal(r.reason,"nonzero-cost-reported");
});
test("missing returned model identity fails closed",async()=>{
 const fetcher=async url=>url.endsWith("/models")?{ok:true,json:async()=>({data:[model]})}:
 {ok:true,json:async()=>({choices:[{message:{content:"ok"}}],usage:{cost:0}})};
 const r=await runFreeBridgeTask({modelId:id,prompt:"Review",apiKey:"test",enabled:true,fetcher});
 assert.equal(r.reason,"unexpected-model");
});

test("malformed or coercible catalog prices never count as verified free",()=>{
 for(const bad of ["","  ",false,null,[],{},"0x0","0b0","-0","NaN"]){
  const candidate={...model,pricing:{prompt:bad,completion:"0"}};
  assert.equal(selectFreeModel([candidate],id),null,`unexpected free price: ${JSON.stringify(bad)}`);
 }
 assert.deepEqual(selectFreeModel([{...model,pricing:{prompt:"0.000",completion:0}}],id),{id});
});
test("malformed completion costs fail closed without real provider calls",async()=>{
 for(const cost of [""," ",false,null,[],"0x0"]){
  const calls=[];
  const fetcher=async url=>{
   calls.push(url);
   return url.endsWith("/models")?{ok:true,json:async()=>({data:[model]})}:
    {ok:true,json:async()=>({model:id,choices:[{message:{content:"mock only"}}],usage:{cost}})};
  };
  const result=await runFreeBridgeTask({modelId:id,prompt:"offline fixture",apiKey:"synthetic",enabled:true,fetcher});
  assert.equal(result.reason,"nonzero-cost-reported",`cost: ${JSON.stringify(cost)}`);
  assert.equal(calls.length,2);
 }
});

test("non-token catalog charges block free-model selection",()=>{
 for(const field of ["request","image","audio","web_search","input_cache_read","input_cache_write"]){
  const candidate={...model,pricing:{...model.pricing,[field]:"0.00001"}};
  assert.equal(selectFreeModel([candidate],id),null,`unexpected free price field: ${field}`);
 }
 assert.equal(selectFreeModel([{...model,pricing:{...model.pricing,request:"0",image:0}}],id)?.id,id);
 assert.equal(selectFreeModel([{...model,pricing:{...model.pricing,request:null}}],id),null);
});
test("a paid request fee prevents completion calls even with free tokens",async()=>{
 const calls=[];
 const fetcher=async url=>{
  calls.push(url);
  if(url.endsWith("/models"))return {ok:true,json:async()=>({data:[{...model,pricing:{...model.pricing,request:"0.02"}}]})};
  throw Error("completion request must not be sent");
 };
 const result=await runFreeBridgeTask({modelId:id,prompt:"synthetic offline test",apiKey:"synthetic",enabled:true,fetcher});
 assert.equal(result.reason,"model-not-verified-free");
 assert.equal(calls.length,1);
});
