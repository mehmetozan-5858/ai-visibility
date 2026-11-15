import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {withPaddleEntitlementWriterLockReview} from '../lib/portal-paddle-writer-lock-review.mjs';
import {acquirePilotAdvisoryLockReview} from '../lib/portal-pilot-advisory-lock-review.mjs';

// REVIEW ONLY. A two-backend disposable PostgreSQL acceptance test; no Neon,
// Paddle webhook, customer credentials, provider secrets or production writes.
const source=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
if(source){
 const u=new URL(source);
 if(!['postgres:','postgresql:'].includes(u.protocol)||
    !['localhost','127.0.0.1'].includes(u.hostname)||
    decodeURIComponent(u.username)!=='fixture'||u.pathname!=='/fixture')
  throw Error('disposable-local-postgres-only');
}
test('Paddle suspension waits for report tenant lock, then commits only the bound tenant; writer error rolls back',{
 skip:!source?'disposable local PostgreSQL fixture required':false,timeout:30000
},async()=>{
 const dbname='ci_paddle_lock_'+randomUUID().replaceAll('-','').slice(0,12);
 const admin=new Pool({connectionString:source,max:1,connectionTimeoutMillis:4000,query_timeout:12000});
 const u=new URL(source);u.pathname='/'+dbname;
 let db,created=false;
 const A=randomUUID(),B=randomUUID(),P=randomUUID(),Q=randomUUID();
 try{
  await admin.query('CREATE DATABASE '+dbname);created=true;
  db=new Pool({connectionString:u.toString(),max:4,connectionTimeoutMillis:4000,query_timeout:12000});
  await db.query('CREATE TABLE public.payments(id uuid PRIMARY KEY,client_id uuid NOT NULL)');
  await db.query("CREATE TABLE public.clients(id uuid PRIMARY KEY,status text NOT NULL)");
  await db.query("INSERT INTO public.clients(id,status) VALUES($1,'active'),($2,'active')",[A,B]);
  await db.query('INSERT INTO public.payments(id,client_id) VALUES($1,$2),($3,$4)',[P,A,Q,B]);

  // Simulate the report RPC retaining the same advisory key on backend 1.
  const report=await db.connect();
  let released=false;
  try{
   await report.query('BEGIN');
   await acquirePilotAdvisoryLockReview(report,A);
   let enteredCallback=false;
   const writer=withPaddleEntitlementWriterLockReview(db,P,async(tx,identity)=>{
    enteredCallback=true;
    assert.equal(identity.tenantId,A);
    const rows=(await tx.query('SELECT id FROM public.payments WHERE id=$1 AND client_id=$2 FOR UPDATE',[P,A])).rows;
    assert.equal(rows.length,1);
    await tx.query("UPDATE public.clients SET status='payment-review' WHERE id=$1",[A]);
    return 'suspended';
   });
   // A separate backend must remain blocked until report transaction ends.
   await new Promise(resolve=>setTimeout(resolve,150));
   assert.equal(enteredCallback,false,'writer callback may not overtake the report lock');
   await report.query('COMMIT');released=true;
   assert.equal(await writer,'suspended');
  }finally{
   if(!released)await report.query('ROLLBACK').catch(()=>{});
   report.release();
  }
  const status=(await db.query('SELECT id,status FROM public.clients')).rows;
  assert.equal(status.find(r=>r.id===A).status,'payment-review');
  assert.equal(status.find(r=>r.id===B).status,'active');

  // A failed lifecycle operation must revert both client and payment writes.
  await assert.rejects(withPaddleEntitlementWriterLockReview(db,P,async(tx)=>{
   await tx.query("UPDATE public.clients SET status='active' WHERE id=$1",[A]);
   throw Error('synthetic-subscription-reversal-failure');
  }),/synthetic-subscription-reversal-failure/);
  assert.equal((await db.query('SELECT status FROM public.clients WHERE id=$1',[A])).rows[0].status,'payment-review');
  await assert.rejects(withPaddleEntitlementWriterLockReview(db,Q,async(tx,identity)=>{
   assert.equal(identity.tenantId,B);
   throw Error('synthetic-tenant-B-reversal-denied');
  }),/synthetic-tenant-B-reversal-denied/);
  assert.equal((await db.query('SELECT status FROM public.clients WHERE id=$1',[B])).rows[0].status,'active');
 }finally{
  if(db)await db.end().catch(()=>{});
  if(created)await admin.query('DROP DATABASE '+dbname).catch(()=>{});
  await admin.end();
 }
});
