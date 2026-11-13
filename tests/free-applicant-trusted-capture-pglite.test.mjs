import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {persistTrustedFreeApplicantAnswer} from '../lib/free-applicant-trusted-capture.mjs';
import {readVerifiedFreeApplicantAssessment} from '../lib/free-applicant-verified-db-read.mjs';

const prospect={id:'550e8400-e29b-41d4-a716-446655440000',name:'Acme Apparel',domain:'acme.example'};
const query='Which clothing shops serve customers in London?';
const answer={ok:true,complete:true,verifiedZeroPriceAtRequest:true,usage:{cost:0},
 modelId:'synthetic/model:free',responseId:'provider-response-123',
 answer:'Other apparel companies may serve London.'};
const receipt={id:'trusted-cost-row-1',tenantId:prospect.id,domain:prospect.domain,
 provider:'OpenRouter',model:answer.modelId,responseId:answer.responseId,query,
 amount:0,currency:'USD',estimated:false,verifiedZeroPriceAtRequest:true,
 responseComplete:true,verifiedModelIdentity:true,operation:'answer-evidence'};
const poolFor=db=>({query:(...args)=>db.query(...args),
 connect:async()=>({query:(...args)=>db.query(...args),release(){}})});

test('trusted separate cost record links to provider response through actual SQL',async()=>{
 const db=new PGlite();
 try{
  await db.exec(await readFile(new URL('../migrations/free-applicant-verified-proof-review.sql',import.meta.url),'utf8'));
  const args={pool:poolFor(db),prospect,providerAnswer:answer,query,costReceipt:{id:receipt.id},
    trustedCostRead:async(id,tenant)=>id===receipt.id&&tenant===prospect.id?receipt:null};
  assert.equal((await persistTrustedFreeApplicantAnswer(args)).stored,true);
  const assessment=await readVerifiedFreeApplicantAssessment(args.pool,prospect);
  assert.equal(assessment.status,'insufficient');
  assert.equal(assessment.samples,1);
  assert.equal(assessment.score,null);
  assert.equal((await persistTrustedFreeApplicantAnswer(args)).stored,false);
  const count=await db.query('SELECT count(*)::int AS n FROM free_applicant_verified_receipts');
  assert.equal(count.rows[0].n,1);
 }finally{await db.close()}
});
test('unverified cost, wrong tenant, brand-prompted, partial answer or missing trusted read refuses a write',async()=>{
 const noWrites={connect:async()=>{throw Error('no DB writes allowed')}};
 const cases=[
  {providerAnswer:{...answer,complete:false}},
  {providerAnswer:{...answer,usage:{cost:0.001}}},
  {query:'Tell me about Acme Apparel in London?'},
  {trustedCostRead:undefined},
  {trustedCostRead:async()=>({...receipt,tenantId:'123e4567-e89b-42d3-a456-426614174000'})},
  {trustedCostRead:async()=>({...receipt,amount:0.1})},
  {trustedCostRead:async()=>({...receipt,verifiedZeroPriceAtRequest:false})},
  {trustedCostRead:async()=>{throw Error('private database error')}}
 ];
 for(const variant of cases){
  const base={pool:noWrites,prospect,providerAnswer:answer,query,
   costReceipt:{id:receipt.id},trustedCostRead:async()=>receipt};
  const result=await persistTrustedFreeApplicantAnswer({...base,...variant});
  assert.equal(result.stored,false);
  assert.doesNotMatch(JSON.stringify(result),/private database error/);
 }
});
