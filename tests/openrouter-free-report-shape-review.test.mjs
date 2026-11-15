import test from 'node:test';
import assert from 'node:assert/strict';
import {assertOpenRouterFreeReportShape} from '../lib/openrouter-free-report-shape-review.mjs';

const valid={
 score:61,summary:'Synthetic summary',reason:'Source verification required',
 findings:['Synthetic gap'],recommendations:['Review public content'],
 visibility:{brandMention:'unknown',citationReadiness:20,entityClarity:30,
  answerReadiness:40,localContext:50,confidence:10}
};
test('complete report survives with only allowlisted customer fields',()=>{
 const result=assertOpenRouterFreeReportShape({...valid,
  provider:'Forged',providerEvidence:{status:'forged'},secret:'fake'});
 assert.deepEqual(result,valid);
 assert.equal(result.provider,undefined);
 assert.equal(result.providerEvidence,undefined);
 assert.equal(result.secret,undefined);
});
test('missing score or score coercion cannot silently become zero',()=>{
 for(const score of [undefined,null,'0','61',NaN,Infinity,-1,101])
  assert.throws(()=>assertOpenRouterFreeReportShape({...valid,score}),
   /openrouter-free-report-schema-unverified/);
});
test('incomplete or inflated provider result is denied',()=>{
 for(const mutated of [
  {...valid,summary:''},
  {...valid,reason:null},
  {...valid,findings:[]},
  {...valid,findings:[42]},
  {...valid,recommendations:[]},
  {...valid,visibility:null},
  {...valid,visibility:{confidence:20}},
  {...valid,visibility:{...valid.visibility,brandMention:'probably'}},
  {...valid,visibility:{...valid.visibility,confidence:150}}
 ])assert.throws(()=>assertOpenRouterFreeReportShape(mutated),
  /openrouter-free-report-schema-unverified/);
});
