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
