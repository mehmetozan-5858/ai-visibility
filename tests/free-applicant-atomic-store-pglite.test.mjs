import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {persistVerifiedFreeApplicantPair} from '../lib/free-applicant-atomic-store.mjs';

const scope={tenantId:'synthetic-tenant',domain:'example.test'};
const observation={tenantId:scope.tenantId,domain:scope.domain,provider:'Gemini',
 model:'gemini-3.5-flash-lite',responseId:'synthetic-response-1',
 query:'Which businesses sell clothing in this city?',text:'Synthetic neutral answer',
 brandPrompted:false,truncated:false,brandMentioned:false};
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
  UNIQUE(tenant_id,provider,response_id)
 );
 CREATE TABLE free_applicant_verified_observations(
  receipt_id text PRIMARY KEY REFERENCES free_applicant_verified_receipts(id),
  tenant_id text NOT NULL,domain text NOT NULL,provider text NOT NULL,
  model text NOT NULL,response_id text NOT NULL,query_text text NOT NULL,
  result_text text NOT NULL,brand_mentioned boolean NOT NULL
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
