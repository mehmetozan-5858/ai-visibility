import test from 'node:test';
import assert from 'node:assert/strict';
import {collectFreeAnswerEvidence} from '../lib/free-answer-evidence.mjs';

const entity={id:'00000000-0000-0000-0000-000000000001',name:'Synthetic Co',domain:'synthetic.example',sector:'industrial fittings',city:'Example City'};
const env={APPLICANT_FREE_MEASUREMENT_ENABLED:'true',OPENROUTER_API_KEY:'fixture-only-key',OPENROUTER_FREE_MODEL:'google/gemma-4-31b-it:free'};
const query='Which businesses supply industrial fittings in Example City?';
const valid={ok:true,verifiedZeroPriceAtRequest:true,usage:{cost:0},modelId:env.OPENROUTER_FREE_MODEL,answer:'An independent example manufacturer appears in this answer.',responseId:'synthetic-id-123',complete:true};
async function invoke(reply){
 let recordings=0;
 const result=await collectFreeAnswerEvidence(entity,{queries:[query]},{
  env,request:async()=>reply,
  recordCost:async()=>{recordings++;return{id:'synthetic-cost-id'}}
 });
 return {result,recordings};
}
test('free evidence rejects missing or whitespace response identity before persisting cost',async()=>{
 for(const responseId of ['', '   ',null]){
  const {result,recordings}=await invoke({...valid,responseId});
  assert.equal(recordings,0);assert.equal(result.observations.length,0);
  assert.equal(result.errors.length,1);
  assert.equal(result.errors[0].reason,'answer-verification-failed');
 }
});
test('free evidence rejects incomplete or blank answers before persisting cost',async()=>{
 for(const answer of [{...valid,complete:false},{...valid,answer:'   '} ,{...valid,answer:null}]){
  const {result,recordings}=await invoke(answer);
  assert.equal(recordings,0);assert.equal(result.observations.length,0);
  assert.equal(result.errors[0].reason,'answer-verification-failed');
 }
});
test('valid fully identified complete zero-cost free reply still yields one eligible observation',async()=>{
 const {result,recordings}=await invoke(valid);
 assert.equal(recordings,1);assert.equal(result.observations.length,1);
 assert.equal(result.errors.length,0);
 assert.equal(result.observations[0].responseId,valid.responseId);
 assert.equal(result.observations[0].truncated,false);
 assert.equal(result.measurementPolicy,'verified-zero-price-only');
});
