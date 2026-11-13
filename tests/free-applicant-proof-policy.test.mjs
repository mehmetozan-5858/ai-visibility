import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleFreeApplicantEvidence} from '../lib/free-applicant-proof-policy.mjs';
const tenantId='tenant-synthetic-1',domain='example.test';
const observation={provider:'Gemini',tenantId,domain,responseId:'response-1',model:'gemini-3.5-flash-lite',
 query:'Which apparel stores serve this city?',text:'Synthetic response',brandPrompted:false,
 truncated:false,brandMentioned:false};
const receipt={id:'receipt-1',provider:'Gemini',tenantId,domain,responseId:'response-1',
 model:'gemini-3.5-flash-lite',query:observation.query,persisted:true,
 verifiedZeroPriceAtRequest:true,estimated:false,amount:0,currency:'USD',
 operation:'answer-evidence',responseComplete:true,verifiedModelIdentity:true};
const evaluate=(o=observation,r=receipt)=>eligibleFreeApplicantEvidence(o,r,{tenantId,domain});
test('valid synthetic independent proof shape can be admitted, without any network call',()=>{
 assert.equal(evaluate(),true);
 assert.equal(evaluate({...observation,provider:'OpenRouter'},{...receipt,provider:'OpenRouter'}),true);
});
test('missing identity, invalid/estimated or unpersisted cost fails closed',()=>{
 for(const field of ['id','responseId','persisted','verifiedZeroPriceAtRequest','estimated',
   'amount','currency','operation','responseComplete','verifiedModelIdentity']){
  const damaged={...receipt};delete damaged[field];
  assert.equal(evaluate(observation,damaged),false,field);
 }
 for(const amount of [0.001,-1,'0',null])assert.equal(evaluate(observation,{...receipt,amount}),false);
 assert.equal(evaluate(observation,{...receipt,estimated:true}),false);
});
test('cross-tenant, mismatched provider and fabricated response cannot count',()=>{
 const failures=[
  [{...observation,tenantId:'other'},receipt],
  [observation,{...receipt,tenantId:'other'}],
  [{...observation,provider:'OpenRouter'},receipt],
  [{...observation,responseId:'fabricated'},receipt],
  [{...observation,model:'another'},receipt],
  [{...observation,domain:'other.test'},receipt],
  [observation,{...receipt,query:'another question'}],
  [{...observation,truncated:true},receipt],
  [{...observation,brandPrompted:true},receipt],
  [observation,{...receipt,responseComplete:false}],
  [observation,{...receipt,provider:'Perplexity'}]
 ];
 for(const [o,r] of failures)assert.equal(evaluate(o,r),false);
});
test('no proof, no outcome; does not accept client-only zero-cost flags',()=>{
 assert.equal(evaluate(observation,null),false);
 assert.equal(evaluate(null,receipt),false);
 assert.equal(evaluate({...observation,verifiedZeroPriceAtRequest:true},{}),false);
 assert.equal(eligibleFreeApplicantEvidence(observation,receipt,{}),false);
});
