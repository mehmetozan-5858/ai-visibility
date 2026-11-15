import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {updateSingleMerchantPaymentReview} from '../lib/portal-merchant-reference-uniqueness-review.mjs';

// Disposable CI Postgres ONLY. No Neon, production or real payment API access.
// This tests SQL row isolation and replay; NOT provider signatures or entitlements.
const source=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
if(source){
 const u=new URL(source);
 if(!['postgres:','postgresql:'].includes(u.protocol)||
    !['localhost','127.0.0.1'].includes(u.hostname)||
    u.pathname!=='/fixture'||decodeURIComponent(u.username)!=='fixture')
  throw Error('disposable-postgres-fixture-only');
}
test('id+tenant payment transition updates one row, preserves other tenant and denies replay',{
 skip:!source?'requires disposable local PostgreSQL fixture':false,timeout:20000
},async()=>{
 const dbname='ci_merchant_transition_'+randomUUID().replaceAll('-','').slice(0,12);
 const admin=new Pool({connectionString:source,max:1,connectionTimeoutMillis:3000,query_timeout:8000});
 const u=new URL(source);u.pathname='/'+dbname;
 let pool,created=false;
 const tenantA=randomUUID(),tenantB=randomUUID(),idA=randomUUID(),idB=randomUUID();
 try{
  await admin.query('CREATE DATABASE '+dbname);created=true;
  pool=new Pool({connectionString:u.toString(),max:2,connectionTimeoutMillis:3000,query_timeout:8000});
  await pool.query(`CREATE TABLE public.payments (
   id uuid PRIMARY KEY, client_id uuid NOT NULL,
   status text NOT NULL CHECK(status IN ('pending','paid')),
   method text, paid_at timestamptz)`);
  await pool.query(`INSERT INTO public.payments(id,client_id,status)
   VALUES($1,$2,'pending'),($3,$4,'pending')`,[idA,tenantA,idB,tenantB]);
  const tx=await pool.connect();
  try{
   await tx.query('BEGIN ISOLATION LEVEL READ COMMITTED');
   const approved=await updateSingleMerchantPaymentReview(tx,{paymentId:idA,tenantId:tenantA});
   assert.equal(approved.id,idA);assert.equal(approved.clientId,tenantA);
   await tx.query('COMMIT');
  }finally{tx.release()}
  const rows=(await pool.query('SELECT id,client_id,status FROM public.payments ORDER BY id')).rows;
  assert.equal(rows.find(r=>r.id===idA).status,'paid');
  assert.equal(rows.find(r=>r.id===idB).status,'pending');
  const retry=await pool.connect();
  try{
   await retry.query('BEGIN');
   await assert.rejects(updateSingleMerchantPaymentReview(retry,{paymentId:idA,tenantId:tenantA}),
     /merchant-payment-not-transitioned/,'one-time state transition cannot pay same row again');
   await retry.query('ROLLBACK');
  }finally{retry.release()}
  const wrong=await pool.connect();
  try{
   await wrong.query('BEGIN');
   await assert.rejects(updateSingleMerchantPaymentReview(wrong,{paymentId:idB,tenantId:tenantA}),
    /merchant-payment-not-transitioned/,'wrong tenant cannot update someone else payment');
   await wrong.query('ROLLBACK');
  }finally{wrong.release()}
  const final=(await pool.query('SELECT id,status FROM public.payments')).rows;
  assert.equal(final.find(r=>r.id===idA).status,'paid');
  assert.equal(final.find(r=>r.id===idB).status,'pending');
 }finally{
  if(pool)await pool.end().catch(()=>{});
  if(created)await admin.query('DROP DATABASE '+dbname).catch(()=>{});
  await admin.end();
 }
});
