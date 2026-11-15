import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {withPaymentAccountLockReview} from '../lib/portal-payment-account-lock-review.mjs';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';

// DISPOSABLE LOCAL POSTGRES CI ONLY. No Neon/staging/production writes.
const source=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
if(source){
 const u=new URL(source);
 if(!['postgres:','postgresql:'].includes(u.protocol)||
  !['localhost','127.0.0.1'].includes(u.hostname)||
  u.pathname!=='/fixture'||decodeURIComponent(u.username)!=='fixture')
  throw Error('disposable-ci-postgres-only');
}
const databaseName='ci_portal_payment_tenant_race';
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const pause=ms=>new Promise(done=>setTimeout(done,ms));
test('payment tenant re-assignment while waiting on advisory lock denies without account mutation',{
 skip:!source?'requires disposable localhost PostgreSQL':false,timeout:30000
},async()=>{
 const admin=new Pool({connectionString:source,max:1,connectionTimeoutMillis:2500,query_timeout:7000});
 const url=new URL(source);url.pathname='/'+databaseName;
 const paymentId=randomUUID();
 let db,created=false,writer,writing=false;
 try{
  await admin.query('CREATE DATABASE '+databaseName);created=true;
  db=new Pool({connectionString:url.toString(),max:5,connectionTimeoutMillis:2500,query_timeout:7000});
  await db.query('CREATE TABLE public.payments(id uuid PRIMARY KEY,client_id uuid NOT NULL)');
  await db.query('CREATE TABLE public.clients(id uuid PRIMARY KEY,status text NOT NULL)');
  await db.query('INSERT INTO public.clients(id,status) VALUES($1,$2),($3,$4)',[A,'inactive',B,'inactive']);
  await db.query('INSERT INTO public.payments(id,client_id) VALUES($1,$2)',[paymentId,A]);
  // Reader starts while writer holds the same tenant lock. The writer can
  // re-assign its payment before commit; reader MUST re-query after waiting.
  writer=await db.connect();
  await writer.query('BEGIN ISOLATION LEVEL READ COMMITTED');writing=true;
  await writer.query(PILOT_LOCK_SQL,[A]);
  await writer.query('UPDATE public.payments SET client_id=$2 WHERE id=$1',[paymentId,B]);
  let updates=0;
  const pending=withPaymentAccountLockReview(db,{paymentId},async(tx,tenant)=>{
   updates++;
   await tx.query("UPDATE public.clients SET status='active' WHERE id=$1",[tenant]);
  });
  pending.catch(()=>{});
  // Validate the second query uses the A advisory lock and is blocked on it.
  // Observe the lock via backend activity rather than arbitrary sleep.
  let waiting=false;
  for(let i=0;i<100;i++){
   const active=await writer.query(
    "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%'");
   if(active.rows[0].n>0){waiting=true;break}
   await pause(25);
  }
  assert.equal(waiting,true,'request must genuinely wait for tenant advisory lock');
  await writer.query('COMMIT');writing=false;
  await assert.rejects(pending,/payment-lock-tenant-changed/);
  assert.equal(updates,0,'changed payment tenant must never reach a write callback');
  const state=(await db.query('SELECT id,status FROM public.clients ORDER BY id')).rows;
  assert.deepEqual(state.map(x=>x.status),['inactive','inactive']);
  assert.equal((await db.query('SELECT client_id FROM public.payments WHERE id=$1',[paymentId])).rows[0].client_id,B);
 }finally{
  if(writing)await writer.query('ROLLBACK').catch(()=>{});
  if(writer)writer.release();
  if(db)await db.end().catch(()=>{});
  if(created)await admin.query('DROP DATABASE '+databaseName).catch(()=>{});
  await admin.end();
 }
});
