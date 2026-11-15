import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {withVerifiedMerchantPaymentTransactionReview} from '../lib/portal-merchant-atomic-evidence-review.mjs';

// REVIEW CI ONLY. Fake verifier is NOT provider-signature validation.
// Database must be throwaway locally hosted PostgreSQL, never Neon.
const source=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
if(source){
 const u=new URL(source);
 if(!['postgres:','postgresql:'].includes(u.protocol)||
  !['localhost','127.0.0.1'].includes(u.hostname)||
  u.pathname!=='/fixture'||decodeURIComponent(u.username)!=='fixture')
  throw Error('disposable-postgres-only');
}
test('provider proof -> exclusive tenant lock -> event claim -> exact payment: one transaction, replay and rollback',{
 skip:!source?'disposable PostgreSQL fixture required':false,timeout:30000
},async()=>{
 const name='ci_event_atomic_'+randomUUID().replaceAll('-','').slice(0,12);
 const admin=new Pool({connectionString:source,max:1,connectionTimeoutMillis:3000,query_timeout:10000});
 const u=new URL(source);u.pathname='/'+name;
 let pool,created=false;
 const A=randomUUID(),B=randomUUID(),P=randomUUID(),Q=randomUUID();
 const oid='REVIEW12345678',eventId='evt_'+randomUUID(),rawEvent={type:'synthetic'};
 const proof={authenticated:true,amountMatched:true,currencyMatched:true,
  eventNotReplayed:true,reference:oid,provider:'review',eventId};
 const verify=async()=>proof;
 try{
  await admin.query('CREATE DATABASE '+name);created=true;
  pool=new Pool({connectionString:u.toString(),max:4,connectionTimeoutMillis:3000,query_timeout:10000});
  await pool.query(`CREATE TABLE public.payments(
   id uuid PRIMARY KEY,client_id uuid NOT NULL,reference_code text UNIQUE NOT NULL,
   status text NOT NULL CHECK(status IN ('pending','paid')),method text,paid_at timestamptz)`);
  await pool.query(`INSERT INTO public.payments(id,client_id,reference_code,status)
   VALUES($1,$2,'RE-VIEW12345678','pending'),($3,$4,'OTHER12345678','pending')`,
   [P,A,Q,B]);
  for(const file of ['portal-merchant-reference-unique-index-review.sql',
   'portal-merchant-event-idempotency-review.sql']){
   const sql=await readFile(new URL('../migrations/'+file,import.meta.url),'utf8');
   await pool.query(sql);
  }
  // Proof denial must occur before opening a connection.
  let connects=0;
  await assert.rejects(withVerifiedMerchantPaymentTransactionReview({
    connect:async()=>{connects++;throw Error('must-not-connect')}
   },oid,rawEvent,async()=>({...proof,amountMatched:false})),
   /merchant-transaction-proof-denied/);
  assert.equal(connects,0);
  const first=await withVerifiedMerchantPaymentTransactionReview(pool,oid,rawEvent,verify);
  assert.deepEqual(first,{paymentId:P,tenantId:A,reviewOnly:true});
  assert.equal((await pool.query('SELECT status FROM public.payments WHERE id=$1',[P])).rows[0].status,'paid');
  assert.equal((await pool.query('SELECT status FROM public.payments WHERE id=$1',[Q])).rows[0].status,'pending');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM public.portal_merchant_event_claims_review')).rows[0].n,1);
  await assert.rejects(withVerifiedMerchantPaymentTransactionReview(pool,oid,rawEvent,verify),
   /merchant-event-already-claimed/);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM public.portal_merchant_event_claims_review')).rows[0].n,1);
  // Another signed event ID against the same already-paid payment fails,
  // and cannot persist a consumed claim when payment transition rejects.
  await assert.rejects(withVerifiedMerchantPaymentTransactionReview(pool,oid,rawEvent,
   async()=>({...proof,eventId:'evt_'+randomUUID()})),/merchant-payment-not-transitioned/);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM public.portal_merchant_event_claims_review')).rows[0].n,1);
  await assert.rejects(pool.query(`INSERT INTO public.payments(id,client_id,reference_code,status)
   VALUES($1,$2,'REV-IEW12345678','pending')`,[randomUUID(),B]),e=>e.code==='23505');
 }finally{
  if(pool)await pool.end().catch(()=>{});
  if(created)await admin.query('DROP DATABASE '+name).catch(()=>{});
  await admin.end();
 }
});
test('proof failure and invalid data fail closed before a connection',async()=>{
 let calls=0;
 const pool={connect:async()=>{calls++;throw Error('unexpected SQL')}};
 const raw={type:'synthetic'},oid='REVIEW12345678';
 const complete={authenticated:true,amountMatched:true,currencyMatched:true,
  eventNotReplayed:true,reference:oid,provider:'review',eventId:'evt_123456789'};
 for(const key of ['authenticated','amountMatched','currencyMatched','eventNotReplayed']){
  await assert.rejects(withVerifiedMerchantPaymentTransactionReview(pool,oid,raw,
   async()=>({...complete,[key]:false})),/merchant-transaction-proof-denied/);
 }
 await assert.rejects(withVerifiedMerchantPaymentTransactionReview(pool,oid,raw,
  async()=>({...complete,reference:'WRONG12345678'})),/merchant-transaction-proof-denied/);
 assert.equal(calls,0);
});
test('live repository remains disconnected from isolated review transaction',async()=>{
 const source=await readFile(new URL('../lib/repository.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/withVerifiedMerchantPaymentTransactionReview/);
});
