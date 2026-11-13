import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {persistVerifiedFreeApplicantPair} from '../lib/free-applicant-atomic-store.mjs';

const scope={tenantId:'synthetic-tenant',domain:'example.test'};
const observation={tenantId:scope.tenantId,domain:scope.domain,provider:'Gemini',
 model:'gemini-3.5-flash-lite',responseId:'synthetic-response-1',
 query:'Which businesses sell clothing in this city?',text:'Synthetic neutral answer',
 brandPrompted:false,truncated:false,brandMentioned:false,
 mode:'api-no-search',recordedAt:'2026-11-13T07:00:00.000Z'};
const receipt={id:'synthetic-receipt-1',tenantId:scope.tenantId,domain:scope.domain,
 provider:'Gemini',model:observation.model,responseId:observation.responseId,
 query:observation.query,persisted:true,verifiedZeroPriceAtRequest:true,estimated:false,
 amount:0,currency:'USD',operation:'answer-evidence',responseComplete:true,
 verifiedModelIdentity:true};
const schema=`
 CREATE TABLE free_applicant_verified_receipts(
  id text PRIMARY KEY,tenant_id text NOT NULL,domain text NOT NULL,
  provider text NOT NULL,model text NOT NULL,response_id text NOT NULL,
  query_text text NOT NULL,amount numeric NOT NULL CHECK(amount=0),
  currency text NOT NULL CHECK(currency='USD'),estimated boolean NOT NULL CHECK(NOT estimated),
  operation text NOT NULL CHECK(operation='answer-evidence'),
  verified_zero_price boolean NOT NULL CHECK(verified_zero_price),
  response_complete boolean NOT NULL CHECK(response_complete),
  verified_model_identity boolean NOT NULL CHECK(verified_model_identity),
  UNIQUE(tenant_id,provider,response_id),
  UNIQUE(id,tenant_id,domain,provider,model,response_id,query_text)
 );
 CREATE TABLE free_applicant_verified_observations(
  receipt_id text PRIMARY KEY,
  tenant_id text NOT NULL,domain text NOT NULL,provider text NOT NULL,
  model text NOT NULL,response_id text NOT NULL,query_text text NOT NULL,
  result_text text NOT NULL,brand_mentioned boolean NOT NULL,
  brand_prompted boolean NOT NULL CHECK(NOT brand_prompted),
  truncated boolean NOT NULL CHECK(NOT truncated),mode text NOT NULL,
  recorded_at timestamptz NOT NULL,
  FOREIGN KEY(receipt_id,tenant_id,domain,provider,model,response_id,query_text)
   REFERENCES free_applicant_verified_receipts(id,tenant_id,domain,provider,model,response_id,query_text)
 );`;
const poolFor=db=>({connect:async()=>({query:(...args)=>db.query(...args),release(){}})});
test('prototype commits response and proof together in isolated PGlite',async()=>{
 const db=new PGlite();
 try{
  await db.exec(schema);
  assert.equal((await persistVerifiedFreeApplicantPair({pool:poolFor(db),observation,receipt,scope})).stored,true);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM free_applicant_verified_receipts')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM free_applicant_verified_observations')).rows[0].n,1);
 }finally{await db.close();}
});
test('duplicate request rolls back both inserts, preserving original pair',async()=>{
 const db=new PGlite();
 try{
  await db.exec(schema);
  const pool=poolFor(db);
  assert.equal((await persistVerifiedFreeApplicantPair({pool,observation,receipt,scope})).stored,true);
  assert.equal((await persistVerifiedFreeApplicantPair({pool,observation,receipt,scope})).stored,false);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM free_applicant_verified_receipts')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM free_applicant_verified_observations')).rows[0].n,1);
 }finally{await db.close();}
});
test('second insert error rolls back the first insert',async()=>{
 const db=new PGlite();
 try{
  await db.exec(schema);
  await db.query('DROP TABLE free_applicant_verified_observations');
  const r=await persistVerifiedFreeApplicantPair({pool:poolFor(db),observation,receipt,scope});
  assert.equal(r.stored,false);
  assert.equal(r.reason,'transaction-failed');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM free_applicant_verified_receipts')).rows[0].n,0);
 }finally{await db.close();}
});
test('missing, paid or cross-tenant proof stops before starting transaction',async()=>{
 const pool={connect:async()=>{throw Error('must not connect')}};
 for(const x of [
  {observation,receipt:{...receipt,amount:1},scope},
  {observation,receipt:{...receipt,tenantId:'other'},scope},
  {observation,receipt:{...receipt,responseId:'other'},scope},
  {observation,receipt:null,scope}
 ])assert.deepEqual(await persistVerifiedFreeApplicantPair({pool,...x}),{stored:false,reason:'unverified-proof'});
});

test('database itself rejects forged tenant and response links even with valid receipt ID',async()=>{
 const db=new PGlite();
 try{
  await db.exec(schema);
  await db.query(`INSERT INTO free_applicant_verified_receipts
   (id,tenant_id,domain,provider,model,response_id,query_text,amount,currency,estimated,operation,verified_zero_price,response_complete,verified_model_identity)
   VALUES($1,$2,$3,$4,$5,$6,$7,0,'USD',false,'answer-evidence',true,true,true)`,
   [receipt.id,scope.tenantId,scope.domain,receipt.provider,receipt.model,receipt.responseId,receipt.query]);
  for(const [tenant,model,responseId] of [
   ['forged-tenant',observation.model,observation.responseId],
   [scope.tenantId,'forged-model',observation.responseId],
   [scope.tenantId,observation.model,'forged-response']
  ]){
   await assert.rejects(db.query(`INSERT INTO free_applicant_verified_observations
    (receipt_id,tenant_id,domain,provider,model,response_id,query_text,result_text,brand_mentioned,brand_prompted,truncated,mode,recorded_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,false,false,false,'api-no-search',NOW())`,
    [receipt.id,tenant,scope.domain,observation.provider,model,responseId,observation.query,observation.text]));
  }
  assert.equal((await db.query('SELECT count(*)::int AS n FROM free_applicant_verified_observations')).rows[0].n,0);
 }finally{await db.close();}
});

test('prototype stores proof flags and scoring input fields rather than dropping them',async()=>{
 const db=new PGlite();
 try{
  await db.exec(schema);
  assert.equal((await persistVerifiedFreeApplicantPair({pool:poolFor(db),observation,receipt,scope})).stored,true);
  const proof=(await db.query('SELECT operation,verified_zero_price,response_complete,verified_model_identity FROM free_applicant_verified_receipts')).rows[0];
  const sample=(await db.query('SELECT mode,recorded_at,brand_prompted,truncated FROM free_applicant_verified_observations')).rows[0];
  assert.equal(proof.operation,'answer-evidence');
  assert.equal(proof.verified_zero_price,true);
  assert.equal(proof.response_complete,true);
  assert.equal(proof.verified_model_identity,true);
  assert.equal(sample.mode,'api-no-search');
  assert.equal(sample.brand_prompted,false);
  assert.equal(sample.truncated,false);
  assert.ok(Number.isFinite(Date.parse(String(sample.recorded_at))));
 }finally{await db.close();}
});
test('missing acquisition mode or timestamp refuses transaction',async()=>{
 const pool={connect:async()=>{throw Error('no database write allowed')}};
 for(const o of [{...observation,mode:undefined},{...observation,recordedAt:'invalid'},
   {...observation,mode:'synthetic-demo'}]){
  assert.deepEqual(await persistVerifiedFreeApplicantPair({pool,observation:o,receipt,scope}),
    {stored:false,reason:'unverified-proof'});
 }
});
