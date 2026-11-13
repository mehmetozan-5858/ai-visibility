import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {persistVerifiedFreeApplicantPair} from '../lib/free-applicant-atomic-store.mjs';
import {readVerifiedFreeApplicantAssessment} from '../lib/free-applicant-verified-db-read.mjs';
const entity={id:'550e8400-e29b-41d4-a716-446655440000',domain:'example.test'};
const schema=[
'CREATE TABLE free_applicant_verified_receipts(id text PRIMARY KEY,tenant_id text NOT NULL,domain text NOT NULL,provider text NOT NULL,model text NOT NULL,response_id text NOT NULL,query_text text NOT NULL,amount numeric NOT NULL CHECK(amount=0),currency text NOT NULL CHECK(currency=\'USD\'),estimated boolean NOT NULL CHECK(NOT estimated),operation text NOT NULL,verified_zero_price boolean NOT NULL,response_complete boolean NOT NULL,verified_model_identity boolean NOT NULL,UNIQUE(id,tenant_id,domain,provider,model,response_id,query_text));',
'CREATE TABLE free_applicant_verified_observations(receipt_id text PRIMARY KEY,tenant_id text NOT NULL,domain text NOT NULL,provider text NOT NULL,model text NOT NULL,response_id text NOT NULL,query_text text NOT NULL,result_text text NOT NULL,brand_mentioned boolean NOT NULL,brand_prompted boolean NOT NULL,truncated boolean NOT NULL,mode text NOT NULL,recorded_at timestamptz NOT NULL,FOREIGN KEY(receipt_id,tenant_id,domain,provider,model,response_id,query_text) REFERENCES free_applicant_verified_receipts(id,tenant_id,domain,provider,model,response_id,query_text));'
].join('\n');
const poolFor=db=>({query:(...a)=>db.query(...a),connect:async()=>({query:(...a)=>db.query(...a),release(){}})});
const questions=['Which apparel retailers serve this city?','Where to buy quality clothing locally?','Which local stores sell everyday garments?'];
const pair=(provider,i,recordedAt)=>{
 const model=provider==='Gemini'?'synthetic-gemini-model':'synthetic-openrouter-model';
 const responseId=provider+'-response-'+i,query=questions[i];
 const observation={tenantId:entity.id,domain:entity.domain,provider,model,responseId,query,
  text:'Synthetic neutral answer',brandPrompted:false,truncated:false,brandMentioned:i===0,mode:'api-no-search',recordedAt};
 const receipt={id:provider+'-receipt-'+i,tenantId:entity.id,domain:entity.domain,provider,model,responseId,query,
  persisted:true,verifiedZeroPriceAtRequest:true,estimated:false,amount:0,currency:'USD',operation:'answer-evidence',
  responseComplete:true,verifiedModelIdentity:true};
 return {observation,receipt};
};
test('six synthetic atomic writes flow through actual SQL join into scoped score',async()=>{
 const db=new PGlite();
 try{
  await db.exec(schema);
  const pool=poolFor(db),now=Date.now();
  for(const provider of ['OpenRouter','Gemini'])for(let i=0;i<3;i++){
   const item=pair(provider,i,new Date(now-(i+1)*60000).toISOString());
   assert.equal((await persistVerifiedFreeApplicantPair({pool,scope:{tenantId:entity.id,domain:entity.domain},...item})).stored,true);
  }
  const measured=await readVerifiedFreeApplicantAssessment(pool,entity,{now});
  assert.equal(measured.status,'ready');assert.equal(measured.samples,6);assert.equal(measured.score,33);
  const stranger=await readVerifiedFreeApplicantAssessment(pool,{...entity,id:'123e4567-e89b-42d3-a456-426614174000'},{now});
  assert.equal(stranger.status,'insufficient');assert.equal(stranger.score,null);
  await db.query('DELETE FROM free_applicant_verified_observations WHERE receipt_id=$1',['Gemini-receipt-0']);
  const incomplete=await readVerifiedFreeApplicantAssessment(pool,entity,{now});
  assert.equal(incomplete.status,'insufficient');assert.equal(incomplete.samples,5);assert.equal(incomplete.score,null);
 }finally{await db.close();}
});
test('no proof schema is unavailable rather than silently scoring legacy rows',async()=>{
 const db=new PGlite();
 try{
  assert.deepEqual(await readVerifiedFreeApplicantAssessment(poolFor(db),entity),
   {status:'unavailable',score:null,reason:'trusted-proof-read-unavailable'});
 }finally{await db.close();}
});

test('actual SQL join cannot promote duplicate provider response with alternate receipt',async()=>{
 const db=new PGlite();
 try{
  await db.exec(schema);
  const pool=poolFor(db),now=Date.now();
  for(const provider of ['OpenRouter','Gemini'])for(let i=0;i<3;i++){
   const item=pair(provider,i,new Date(now-(i+1)*60000).toISOString());
   assert.equal((await persistVerifiedFreeApplicantPair({pool,scope:{tenantId:entity.id,domain:entity.domain},...item})).stored,true);
  }
  // The draft fixture intentionally lacks a unique(provider,response_id) key:
  // read side must independently fail closed even on such a legacy schema.
  const duplicate=pair('Gemini',0,new Date(now-60000).toISOString());
  duplicate.receipt.id='Gemini-alternate-receipt-0';
  duplicate.observation.text='Conflicting provider answer';
  assert.equal((await persistVerifiedFreeApplicantPair({pool,scope:{tenantId:entity.id,domain:entity.domain},...duplicate})).stored,true);
  const verdict=await readVerifiedFreeApplicantAssessment(pool,entity,{now});
  assert.equal(verdict.status,'insufficient');
  assert.equal(verdict.samples,5);
  assert.equal(verdict.score,null);
 }finally{await db.close();}
});
