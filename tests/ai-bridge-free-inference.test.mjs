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


test("catalog zero price requires explicit numeric or canonical zero-string values",()=>{
 for (const bad of ["", " ", " 0", "0 ", false, true, null, [], {}, "unknown", "-0.00", "0.0001"]) {
   assert.equal(selectFreeModel([{...model,pricing:{prompt:bad,completion:"0"}}],id),null,String(bad));
   assert.equal(selectFreeModel([{...model,pricing:{prompt:"0",completion:bad}}],id),null,String(bad));
 }
 for (const good of [0,"0","0.0","0.000","0e-8"]) {
   assert.deepEqual(selectFreeModel([{...model,pricing:{prompt:good,completion:"0"}}],id),{id});
 }
});
test("additional catalog charge dimensions must also be explicitly zero",()=>{
 for (const extra of [{request:"0.01"},{image:1},{audio:"unknown"},{input_cache_read:null},{web_search:" "}]){
   assert.equal(selectFreeModel([{...model,pricing:{...model.pricing,...extra}}],id),null,JSON.stringify(extra));
 }
 assert.deepEqual(selectFreeModel([{...model,pricing:{...model.pricing,request:"0",image:0}}],id),{id});
});
test("invalid catalog prices block inference before a completion request",async()=>{
 const calls=[];
 const fetcher=async url=>{
   calls.push(url);
   return {ok:true,json:async()=>({data:[{...model,pricing:{prompt:"",completion:"0"}}]})};
 };
 const r=await runFreeBridgeTask({modelId:id,prompt:"test",apiKey:"test",enabled:true,fetcher});
 assert.equal(r.reason,"model-not-verified-free");
 assert.equal(calls.length,1);
});
test("ambiguous reported provider cost is not accepted as free",async()=>{
 for (const cost of ["", " ", false, [], {}, "0 ", "0.01"]) {
   const fetcher=async url=>url.endsWith("/models")?
     {ok:true,json:async()=>({data:[model]})}:
     {ok:true,json:async()=>({model:id,choices:[{message:{content:"ok"}}],usage:{cost}})};
   const r=await runFreeBridgeTask({modelId:id,prompt:"test",apiKey:"test",enabled:true,fetcher});
   assert.equal(r.reason,"nonzero-cost-reported",String(cost));
 }
});

test("only boolean true can enable inference; malformed flags make no requests",async()=>{
 for(const enabled of ["false","true",1,0,null,{},[]]){
  const calls=[];
  const r=await runFreeBridgeTask({modelId:id,prompt:"Review",apiKey:"test",enabled,fetcher:mock(calls)});
  assert.equal(r.reason,"inference-disabled",String(enabled));
  assert.equal(calls.length,0,String(enabled));
 }
});
test("duplicate catalog identities fail closed even if one record is free",async()=>{
 const paid={...model,pricing:{prompt:"0.01",completion:"0"}};
 assert.equal(selectFreeModel([model,paid],id),null);
 assert.equal(selectFreeModel([paid,model],id),null);
 assert.equal(selectFreeModel([model,model],id),null);
 const calls=[];
 const fetcher=async url=>{
  calls.push(url);
  return {ok:true,json:async()=>({data:[model,paid]})};
 };
 const r=await runFreeBridgeTask({modelId:id,prompt:"Review",apiKey:"test",enabled:true,fetcher});
 assert.equal(r.reason,"model-not-verified-free");
 assert.equal(calls.length,1);
});
