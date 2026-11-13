import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedFreeApplicantAssessment} from '../lib/free-applicant-verified-read.mjs';
const now=Date.parse('2026-11-13T06:00:00Z');
const entity={id:'tenant-synthetic-1',domain:'example.test'};
const questions=['Which shops sell clothes nearby?','Where can I buy quality apparel?','Which local clothing stores are recommended?'];
const pair=(provider,index)=>{
 const responseId=provider+'-response-'+index,receiptId=provider+'-receipt-'+index;
 const observation={tenantId:entity.id,domain:entity.domain,provider,model:provider==='Gemini'?'gemini-3.5-flash-lite':'google/gemma-4-31b-it:free',
  responseId,receiptId,query:questions[index],text:'Synthetic neutral answer',
  brandPrompted:false,truncated:false,brandMentioned:index===0,
  recordedAt:new Date(now-(index+1)*60000).toISOString()};
 const receipt={id:receiptId,tenantId:entity.id,domain:entity.domain,
  provider,model:observation.model,responseId,query:observation.query,
  persisted:true,verifiedZeroPriceAtRequest:true,amount:0,currency:'USD',
  estimated:false,operation:'answer-evidence',responseComplete:true,verifiedModelIdentity:true};
 return {observation,receipt};
};
const sample=['OpenRouter','Gemini'].flatMap(p=>[0,1,2].map(i=>pair(p,i)));
const run=(observations,receipts)=>verifiedFreeApplicantAssessment(entity,{observations,receipts},{now});
test('six independently receipt-linked samples yield scoped score',()=>{
 const r=run(sample.map(x=>x.observation),sample.map(x=>x.receipt));
 assert.equal(r.status,'ready');assert.equal(r.score,33);
 assert.equal(r.samples,6);assert.equal(r.providers,2);assert.equal(r.queries,3);
 assert.equal(r.proofPolicy,'linked-receipt-only-v1');
});
test('unlinked historic observations never count, even if six exist',()=>{
 const r=run(sample.map(x=>x.observation),[]);
 assert.equal(r.status,'insufficient');assert.equal(r.score,null);assert.equal(r.samples,0);
});
test('missing, paid, estimated, wrong-tenant or mismatched proof is rejected',()=>{
 const damaged=sample.map(x=>({...x.receipt}));
 damaged[0].amount=0.01;damaged[1].estimated=true;
 damaged[2].tenantId='other';damaged[3].responseId='fabricated';
 const r=run(sample.map(x=>x.observation),damaged);
 assert.equal(r.status,'insufficient');assert.equal(r.score,null);assert.equal(r.samples,2);
});
test('duplicate receipt identifiers are ambiguous and rejected',()=>{
 const receipts=sample.map(x=>x.receipt);
 const r=run(sample.map(x=>x.observation),[...receipts,receipts[0]]);
 assert.equal(r.samples,5);assert.equal(r.status,'insufficient');
});
test('duplicate provider/query cannot increase sample count',()=>{
 const extra=pair('Gemini',0);
 extra.observation.receiptId='new-receipt';extra.receipt.id='new-receipt';
 extra.observation.responseId='new-response';extra.receipt.responseId='new-response';
 const r=run([...sample.map(x=>x.observation),extra.observation],
  [...sample.map(x=>x.receipt),extra.receipt]);
 assert.equal(r.samples,6);assert.equal(r.providers,2);
});
test('malformed, wrong tenant and stale rows never produce a score',()=>{
 const old=sample.map(x=>({...x.observation,recordedAt:new Date(now-16*86400000).toISOString()}));
 const r=run(old,sample.map(x=>x.receipt));
 assert.equal(r.status,'insufficient');assert.equal(r.samples,0);
 const malformed=verifiedFreeApplicantAssessment(null,{observations:sample.map(x=>x.observation)},{now});
 assert.equal(malformed.status,'insufficient');
});
