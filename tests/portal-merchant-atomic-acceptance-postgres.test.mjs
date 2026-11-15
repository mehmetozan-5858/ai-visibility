import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {
 resolveUniqueMerchantPaymentWithLockReview,
 updateSingleMerchantPaymentReview
} from '../lib/portal-merchant-reference-uniqueness-review.mjs';

// REVIEW ONLY. Disposal is mandatory; this never runs on Neon or real payments.
// A trusted server-side caller must independently verify provider signatures,
// exact currency/amount and idempotent event before a real money transition.
const source=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
if(source){
 const u=new URL(source);
 if(!['postgres:','postgresql:'].includes(u.protocol)||
  !['localhost','127.0.0.1'].includes(u.hostname)||
  u.pathname!=='/fixture'||decodeURIComponent(u.username)!=='fixture')
  throw Error('disposable-ci-db-only');
}
test('unique normalized merchant ID, tenant lock and id-scoped payment transition are atomic',{
 skip:!source?'requires local disposable postgres':false,timeout:25000
},async()=>{
 const dbname='ci_merchant_atomic_'+randomUUID().replaceAll('-','').slice(0,12);
 const u=new URL(source),admin=new Pool({connectionString:source,max:1,connectionTimeoutMillis:3000,query_timeout:10000});
 u.pathname='/'+dbname;
 let db,created=false;
 const A=randomUUID(),B=randomUUID(),P=randomUUID(),Q=randomUUID(),oid='ABCDEF12345678';
 try{
  await admin.query('CREATE DATABASE '+dbname);created=true;
  db=new Pool({connectionString:u.toString(),max:4,connectionTimeoutMillis:3000,query_timeout:10000});
  await db.query(`CREATE TABLE public.payments (
    id uuid PRIMARY KEY, client_id uuid NOT NULL,
    reference_code text UNIQUE NOT NULL,
    status text NOT NULL CHECK(status IN ('pending','paid')),
    method text, paid_at timestamptz)`);
  await db.query(`INSERT INTO public.payments(id,client_id,reference_code,status)
    VALUES($1,$2,$3,'pending'),($4,$5,$6,'pending')`,
    [P,A,'AB-CDEF12345678',Q,B,'OTHER12345678']);
  const migration=await readFile(
   new URL('../migrations/portal-merchant-reference-unique-index-review.sql',import.meta.url),'utf8');
  await db.query(migration);
  const tx=await db.connect();
  try{
   await tx.query('BEGIN ISOLATION LEVEL READ COMMITTED');
   const identity=await resolveUniqueMerchantPaymentWithLockReview(tx,oid);
   assert.deepEqual(identity,{paymentId:P,tenantId:A});
   assert.equal((await updateSingleMerchantPaymentReview(tx,identity)).status,'paid');
   await tx.query('COMMIT');
  }finally{tx.release()}
  const outcome=(await db.query('SELECT id,client_id,status FROM public.payments')).rows;
  assert.equal(outcome.find(x=>x.id===P).status,'paid');
  assert.equal(outcome.find(x=>x.id===Q).status,'pending');
  const repeat=await db.connect();
  try{
   await repeat.query('BEGIN ISOLATION LEVEL READ COMMITTED');
   const identity=await resolveUniqueMerchantPaymentWithLockReview(repeat,oid);
   await assert.rejects(updateSingleMerchantPaymentReview(repeat,identity),
    /merchant-payment-not-transitioned/,'replayed callback cannot settle again');
   await repeat.query('ROLLBACK');
  }finally{repeat.release()}
  await assert.rejects(db.query('INSERT INTO public.payments(id,client_id,reference_code,status) VALUES($1,$2,$3,$4)',
   [randomUUID(),B,'ABC-DEF12345678','pending']),e=>e.code==='23505',
   'different raw reference cannot imitate existing normalized merchant OID');
 }finally{
  if(db)await db.end().catch(()=>{});
  if(created)await admin.query('DROP DATABASE '+dbname).catch(()=>{});
  await admin.end();
 }
});
