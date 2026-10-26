import test from "node:test";
import assert from "node:assert/strict";
import {runFreeBridgeTask,selectFreeModel} from "../lib/ai-bridge-free-inference.mjs";

const id="cohere/north-mini-code:free";
const model={id,pricing:{prompt:"0",completion:"0"}};
const denied={ok:false,reason:"inference-release-not-approved"};

test("adapter denies inference by default before any network access",async()=>{
  const calls=[];
  const fetcher=async (...args)=>{calls.push(args);throw new Error("network must remain disabled")};
  assert.deepEqual(await runFreeBridgeTask({modelId:id,prompt:"Review",apiKey:"fake",fetcher}),denied);
  assert.equal(calls.length,0);
});

test("direct adapter callers cannot bypass hold with enablement, credentials or transport",async()=>{
  const calls=[];
  const fetcher=async (...args)=>{calls.push(args);return {ok:true,json:async()=>({data:[model]})}};
  for(const options of [
    {enabled:true,modelId:id,prompt:"Review",apiKey:"fake",fetcher},
    {enabled:true,modelId:id,prompt:"Review",apiKey:"fake",fetcher,timeoutMs:100},
    {enabled:true,modelId:id,prompt:"Review",apiKey:"fake",fetcher,timeoutMs:20000},
    {enabled:true,modelId:id,prompt:"Review",apiKey:"fake",fetcher,timeoutMs:999999},
    {enabled:true,modelId:"paid/model",prompt:"Review",apiKey:"fake",fetcher},
    {enabled:true,modelId:id,prompt:"Review",fetcher},
  ]) assert.deepEqual(await runFreeBridgeTask(options),denied);
  assert.equal(calls.length,0,"no model catalog or completion request may be attempted");
});

test("environment flags cannot release the direct adapter",async()=>{
  const old=process.env.AI_BRIDGE_INFERENCE_ENABLED;
  try{
    process.env.AI_BRIDGE_INFERENCE_ENABLED="true";
    let calls=0;
    const result=await runFreeBridgeTask({
      enabled:true,modelId:id,prompt:"Review",apiKey:"fake",
      fetcher:async()=>{calls++;throw Error("network request blocked")},
    });
    assert.deepEqual(result,denied);
    assert.equal(calls,0);
  } finally {
    if(old===undefined) delete process.env.AI_BRIDGE_INFERENCE_ENABLED;
    else process.env.AI_BRIDGE_INFERENCE_ENABLED=old;
  }
});

test("free-model selection remains a pure catalog check, not permission to execute",()=>{
  assert.deepEqual(selectFreeModel([model],id),{id});
  assert.equal(selectFreeModel([{...model,pricing:{prompt:"0.1",completion:"0"}}],id),null);
  assert.equal(selectFreeModel([{...model,pricing:{prompt:"0",completion:"0.1"}}],id),null);
  assert.equal(selectFreeModel([{...model,pricing:{prompt:"0",completion:"NaN"}}],id),null);
  assert.equal(selectFreeModel([{...model,pricing:{prompt:"0"}}],id),null);
  assert.equal(selectFreeModel([model],"paid/model"),null);
  assert.equal(selectFreeModel(null,id),null);
});

test("even a catalog-verified free model cannot trigger inference",async()=>{
  let calls=0;
  const result=await runFreeBridgeTask({
    modelId:selectFreeModel([model],id).id,
    prompt:"Review this test",apiKey:"fake",enabled:true,
    fetcher:async()=>{calls++;return {ok:true,json:async()=>({data:[model]})}},
  });
  assert.deepEqual(result,denied);
  assert.equal(calls,0);
});
