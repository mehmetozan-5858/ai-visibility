import test from 'node:test';
import assert from 'node:assert/strict';
import {readVerifiedFreeApplicantAssessment} from '../lib/free-applicant-verified-db-read.mjs';

const entity={id:'550e8400-e29b-41d4-a716-446655440000',domain:'example.test'};
const now=Date.parse('2026-11-13T08:00:00Z');
const questions=['Which local clothing stores do you recommend?',
 'Where can I find affordable apparel in this city?',
 'Which apparel businesses serve this region?'];
const row=(provider,i)=>({
 receiptId:provider+'-receipt-'+i,tenantId:entity.id,domain:entity.domain,
 provider,model:provider==='Gemini'?'gemini-3.5-flash-lite':'google/gemma-4-31b-it:free',
 responseId:provider+'-response-'+i,query:questions[i],text:'Synthetic neutral answer',
 brandMentioned:i===0,brandPrompted:false,truncated:false,mode:'api-no-search',
 recordedAt:new Date(now-(i+1)*60000).toISOString(),
 proofId:provider+'-receipt-'+i,proofTenantId:entity.id,proofDomain:entity.domain,
 proofProvider:provider,proofModel:provider==='Gemini'?'gemini-3.5-flash-lite':'google/gemma-4-31b-it:free',
 proofResponseId:provider+'-response-'+i,proofQuery:questions[i],
 amount:'0.000000',currency:'USD',estimated:false,operation:'answer-evidence',
 verifiedZeroPriceAtRequest:true,responseComplete:true,verifiedModelIdentity:true
});
const records=['OpenRouter','Gemini'].flatMap(p=>[0,1,2].map(i=>row(p,i)));
const mocked=(rows,onQuery=()=>{})=>({query:async(sql,args)=>{onQuery(sql,args);return {rows};}});
test('read-only bound query plus six receipt-linked samples',async()=>{
 let reads=0;
 const result=await readVerifiedFreeApplicantAssessment(mocked(records,(sql,args)=>{
   reads++;assert.match(sql,/INNER JOIN free_applicant_verified_receipts/);
   assert.match(sql,/o\.tenant_id=\$1 AND o\.domain=\$2/);
   assert.match(sql,/INTERVAL '14 days'/);
   assert.deepEqual(args,[entity.id,entity.domain]);
 }),entity,{now});
 assert.equal(reads,1);assert.equal(result.status,'ready');
 assert.equal(result.score,33);assert.equal(result.samples,6);
 assert.equal(result.proofPolicy,'linked-receipt-only-v1');
});
test('wrong tenant and unknown/paid price do not count',async()=>{
 const compromised=records.map(x=>({...x}));
 compromised[0].proofTenantId='another';
 compromised[1].amount='0.1';
 compromised[2].amount='unknown';
 compromised[3].responseComplete=false;
 const result=await readVerifiedFreeApplicantAssessment(mocked(compromised),entity,{now});
 assert.equal(result.status,'insufficient');assert.equal(result.samples,2);
 assert.equal(result.score,null);
});
test('unknown schema or unavailable database fails closed without revealing SQL error',async()=>{
 const pool={query:async()=>{throw Error('private database details')}};
 const result=await readVerifiedFreeApplicantAssessment(pool,entity,{now});
 assert.deepEqual(result,{status:'unavailable',score:null,reason:'trusted-proof-read-unavailable'});
});
test('invalid or missing server-authorized scope makes zero database calls',async()=>{
 const pool={query:async()=>{throw Error('query-not-allowed')}};
 assert.equal((await readVerifiedFreeApplicantAssessment(pool,{id:'other',domain:'example.test'})).status,'unavailable');
 assert.equal((await readVerifiedFreeApplicantAssessment(pool,null)).status,'unavailable');
 for(const domain of ['https://example.test','example.test/path','EXAMPLE.TEST','example.test:443','*.example.test','localhost','example..test'])
   assert.equal((await readVerifiedFreeApplicantAssessment(pool,{...entity,domain})).status,'unavailable');
 for(const id of ['00000000-0000-0000-0000-000000000000','abcd----abcd-1234-1234-abcdefabcde0'])
   assert.equal((await readVerifiedFreeApplicantAssessment(pool,{...entity,id})).status,'unavailable');
});
test('no legacy fallback when trusted receipt query returns nothing',async()=>{
 const result=await readVerifiedFreeApplicantAssessment(mocked([]),entity,{now});
 assert.equal(result.status,'insufficient');assert.equal(result.score,null);
 assert.equal(result.samples,0);
});
