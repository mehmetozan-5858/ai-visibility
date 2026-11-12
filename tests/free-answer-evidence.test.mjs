import test from 'node:test';
import assert from 'node:assert/strict';
import {freeMeasurementStatus,collectFreeAnswerEvidence} from '../lib/free-answer-evidence.mjs';
import {runFreeBridgeTask} from '../lib/ai-bridge-free-inference.mjs';
const entity={id:'test',name:'Acme Precision',domain:'acme.example',sector:'machining',country:'Türkiye'};
const env={APPLICANT_FREE_MEASUREMENT_ENABLED:'true',OPENROUTER_API_KEY:'synthetic-secret',OPENROUTER_FREE_MODEL:'test/model:free'};
const queries=['Türkiye bölgesinde hangi işleme firmaları var?','İşleme hizmeti sunan firmaları en fazla 80 kelimeyle önerin.'];
test('configuration status never exposes credentials or claims a verified price',()=>{
 const s=freeMeasurementStatus(env);assert.equal(s.ready,true);assert.equal(s.priceVerified,false);
 assert.ok(!JSON.stringify(s).includes('synthetic-secret'));
 for(const change of [{APPLICANT_FREE_MEASUREMENT_ENABLED:'false'},{OPENROUTER_API_KEY:''},{OPENROUTER_FREE_MODEL:'paid/model'}])assert.equal(freeMeasurementStatus({...env,...change}).ready,false);
});
test('disabled and branded requests never call an inference provider',async()=>{
 let calls=0;const deps={env:{},request:async()=>{calls++},recordCost:async()=>{}};
 await assert.rejects(()=>collectFreeAnswerEvidence(entity,{queries},deps),/not-configured/);
 await assert.rejects(()=>collectFreeAnswerEvidence(entity,{queries:['Tell me about Acme Precision.']},{...deps,env}),/neutral/);
 assert.equal(calls,0);
});
test('two real-shaped answers retain model, response ID, completeness, exact zero cost and one provider identity',async()=>{
 const calls=[],costs=[];
 const r=await collectFreeAnswerEvidence(entity,{queries},{env,request:async args=>{calls.push(args);return {ok:true,verifiedZeroPriceAtRequest:true,usage:{cost:0},modelId:env.OPENROUTER_FREE_MODEL,answer:'Other firms.',complete:calls.length===1,responseId:'local-'+calls.length}},recordCost:async c=>costs.push(c)});
 assert.equal(calls.length,2);assert.ok(calls.every(x=>x.enabled===true&&x.modelId.endsWith(':free')));
 assert.equal(r.summary.successful,2);assert.equal(r.summary.neutralComplete,1);assert.equal(r.observations[1].truncated,true);
 assert.equal(new Set(r.observations.map(x=>x.provider)).size,1);assert.equal(r.observations[0].responseId,'local-1');
 assert.ok(costs.every(x=>x.amount===0&&x.estimated===false));
});
test('failed, missing-cost and mismatched-model answers never become evidence or fall back',async()=>{
 for(const answer of [{ok:false},{ok:true,verifiedZeroPriceAtRequest:true,modelId:env.OPENROUTER_FREE_MODEL,usage:{}},{ok:true,verifiedZeroPriceAtRequest:true,modelId:'other/model:free',usage:{cost:0}}]){
  let calls=0,costs=0;
  const r=await collectFreeAnswerEvidence(entity,{queries:[queries[0]]},{env,request:async()=>{calls++;return answer},recordCost:async()=>{costs++}});
  assert.equal(calls,1);assert.equal(costs,0);assert.equal(r.observations.length,0);assert.equal(r.summary.failed,1);
 }
});
test('adapter marks length-limited and absent finish reasons incomplete, preserving exact response provenance',async()=>{
 for(const finish_reason of ['stop','length',undefined]){
  const fetcher=async url=>({ok:true,json:async()=>url.endsWith('/models')?{data:[{id:env.OPENROUTER_FREE_MODEL,pricing:{prompt:'0',completion:'0'}}]}:{id:'fixture-response',model:env.OPENROUTER_FREE_MODEL,choices:[{finish_reason,message:{content:'Test answer.'}}],usage:{cost:0}}});
  const r=await runFreeBridgeTask({enabled:true,apiKey:'synthetic',modelId:env.OPENROUTER_FREE_MODEL,prompt:'Neutral test question',fetcher});
  assert.equal(r.complete,finish_reason==='stop');assert.equal(r.responseId,'fixture-response');assert.deepEqual(r.usage,{cost:0});
 }
});
