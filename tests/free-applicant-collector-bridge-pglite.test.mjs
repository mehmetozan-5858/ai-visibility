import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {collectAndPersistVerifiedFreeApplicant} from '../lib/free-applicant-collector-bridge.mjs';
import {readVerifiedFreeApplicantAssessment} from '../lib/free-applicant-verified-db-read.mjs';

const entity={id:'550e8400-e29b-41d4-a716-446655440000',
  name:'Neutral Example',domain:'example.test',entityType:'prospect',sector:'Retail',
  country:'Türkiye'};
const env={APPLICANT_FREE_MEASUREMENT_ENABLED:'true',
  OPENROUTER_API_KEY:'synthetic-only',OPENROUTER_FREE_MODEL:'test/model:free'};
const queries=['Which local stores sell outdoor clothing?',
  'Where can buyers find quality running gear?'];
const poolFor=db=>({query:(...args)=>db.query(...args),
  connect:async()=>({query:(...args)=>db.query(...args),release(){}})});
const trustedReceipt=(i,query)=>({id:'receipt-'+i,tenantId:entity.id,domain:entity.domain,
 provider:'OpenRouter',model:env.OPENROUTER_FREE_MODEL,responseId:'synthetic-provider-'+i,
 query,amount:0,currency:'USD',estimated:false,operation:'answer-evidence',
 verifiedZeroPriceAtRequest:true,responseComplete:true,verifiedModelIdentity:true});
const trustedLedger=(specific=null)=>({
 findTrustedReceipt:async ({responseId,query})=>({id:specific?.id||'receipt-'+responseId.split('-').at(-1)}),
 readTrustedReceipt:async (id)=>specific||trustedReceipt(Number(id.split('-').at(-1)),
  id==='receipt-2'?queries[1]:queries[0])
});
const fake=(i=0,patch={})=>({ok:true,complete:true,
  verifiedZeroPriceAtRequest:true,modelId:env.OPENROUTER_FREE_MODEL,
  usage:{cost:0},responseId:'synthetic-provider-'+i,
  answer:'This synthetic answer has no brand match.',...patch});
async function schema(db){
 await db.exec(await readFile(new URL('../migrations/free-applicant-verified-proof-review.sql',import.meta.url),'utf8'));
}
test('trusted isolated flow writes actual receipt and observation; no public score after one provider',async()=>{
 const db=new PGlite();
 try{
  await schema(db);let calls=0;
  const result=await collectAndPersistVerifiedFreeApplicant({
   pool:poolFor(db),entity,env,queries,consentVerified:true,tenantAuthorized:true,
   request:async()=>fake(++calls),...trustedLedger()});
  assert.equal(result.accepted,2);
  assert.equal(result.customerAcceptance,false);
  assert.equal(calls,2);
  const records=await db.query('SELECT count(*)::int AS n FROM free_applicant_verified_observations');
  assert.equal(records.rows[0].n,2);
  const proof=await readVerifiedFreeApplicantAssessment(poolFor(db),entity);
  assert.equal(proof.status,'insufficient');
  assert.equal(proof.samples,2);
  assert.equal(proof.score,null);
 }finally{await db.close();}
});
test('missing consent, tenant authorization, or storage prevents any provider calls',async()=>{
 const db=new PGlite();
 try{
  let calls=0;
  for(const flags of [{consentVerified:false,tenantAuthorized:true},
    {consentVerified:true,tenantAuthorized:false},
    {consentVerified:true,tenantAuthorized:true}]){
   const result=await collectAndPersistVerifiedFreeApplicant({
    pool:poolFor(db),entity,env,queries,...flags,
    request:async()=>{calls++;return fake(calls)},...trustedLedger()});
   assert.equal(result.accepted,0);
   assert.equal(result.customerAcceptance,false);
  }
  assert.equal(calls,0);
 }finally{await db.close();}
});
test('paid, incomplete, replayed, or provider-mismatched responses are rejected without fake receipts',async()=>{
 for(const patch of [
  {usage:{cost:0.01}},
  {complete:false},
  {verifiedZeroPriceAtRequest:false},
  {modelId:'other/model:free'},
  {responseId:''},
  {answer:'x'.repeat(501)}
 ]){
  const db=new PGlite();
  try{
   await schema(db);
   const result=await collectAndPersistVerifiedFreeApplicant({
    pool:poolFor(db),entity,env,queries:[queries[0]],
    consentVerified:true,tenantAuthorized:true,
    request:async()=>fake(1,patch),...trustedLedger()});
   assert.equal(result.accepted,0);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM free_applicant_verified_receipts')).rows[0].n,0);
  }finally{await db.close();}
 }
});
test('same response identity cannot be stored twice even on retry, and database prevents duplicate',async()=>{
 const db=new PGlite();
 try{
  await schema(db);
  const result=await collectAndPersistVerifiedFreeApplicant({
   pool:poolFor(db),entity,env,queries,consentVerified:true,tenantAuthorized:true,
   request:async()=>fake(1),...trustedLedger()});
  assert.equal(result.accepted,1);
  assert.equal(result.attempted,2);
  assert.equal(result.reason,'partial-or-rejected');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM free_applicant_verified_receipts')).rows[0].n,1);
 }finally{await db.close();}
});

test('untrusted provider self-reported zero cannot stand in for independent receipt verification',async()=>{
 const db=new PGlite();
 try{
  await schema(db);let calls=0;
  const result=await collectAndPersistVerifiedFreeApplicant({
   pool:poolFor(db),entity,env,queries,consentVerified:true,tenantAuthorized:true,
   request:async()=>{calls++;return fake(1)}});
  assert.equal(calls,0);
  assert.equal(result.reason,'independent-cost-proof-unavailable');
  const missing=await collectAndPersistVerifiedFreeApplicant({
   pool:poolFor(db),entity,env,queries:[queries[0]],
   consentVerified:true,tenantAuthorized:true,
   request:async()=>{calls++;return fake(1)},
   findTrustedReceipt:async()=>null,readTrustedReceipt:async()=>null});
  assert.equal(missing.accepted,0);
  assert.equal(calls,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM free_applicant_verified_receipts')).rows[0].n,0);
  const incorrect=await collectAndPersistVerifiedFreeApplicant({
   pool:poolFor(db),entity,env,queries:[queries[0]],
   consentVerified:true,tenantAuthorized:true,
   request:async()=>fake(1),
   findTrustedReceipt:async()=>({id:'receipt-1'}),
   readTrustedReceipt:async()=>({...trustedReceipt(1,queries[0]),amount:0.5})});
  assert.equal(incorrect.accepted,0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM free_applicant_verified_receipts')).rows[0].n,0);
 }finally{await db.close()}
});
