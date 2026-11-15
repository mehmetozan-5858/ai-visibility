import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';
import {READ_OWNED_PAYMENT_FOR_COMPLETION_SQL,
 MARK_VERIFIED_PADDLE_PAYMENT_SQL,INSERT_VERIFIED_PADDLE_PROOF_SQL}
 from '../lib/portal-paddle-completion-write-review.mjs';
import {UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL}
 from '../lib/portal-paddle-subscription-transition-review.mjs';
import {CANCEL_OWNED_ACCESS_SQL}
 from '../lib/portal-paddle-cancellation-write-review.mjs';
import {RESUME_OWNED_ACCESS_SQL}
 from '../lib/portal-paddle-resume-write-review.mjs';

// REVIEW ONLY — exact SQL statements against synthetic data in the
// disposable GitHub CI PostgreSQL fixture, never live Paddle or Neon.
// All actual provider signature and amount checks are separate tests.
// This integrates persistence/ordering/entitlement effects in real SQL.
const url=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
const schema='ci_paddle_entitlement_e2e_review';
const sql=s=>s.replaceAll('public.',schema+'.');
const A='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222';
const occurrence=(kind,status,at,id)=>[A,P,'sub_review123',kind,status,at,id];
const access=(at,id)=>[A,P,'sub_review123',id,at];

test('paid proof alone cannot activate; latest resume grants; cancel and refund block stale restoration',{
 skip:!url?'disposable GitHub CI PostgreSQL required':false,timeout:25000
},async()=>{
 const pool=new Pool({connectionString:url,max:2,connectionTimeoutMillis:2500});
 const setup=await pool.connect();
 try{
  await setup.query('CREATE SCHEMA '+schema);
  await setup.query('CREATE TABLE '+schema+'.clients(id uuid PRIMARY KEY,status text NOT NULL)');
  await setup.query('CREATE TABLE '+schema+'.payments(id uuid PRIMARY KEY,client_id uuid NOT NULL,status text NOT NULL,method text,paid_at timestamptz,currency text NOT NULL,setup_amount integer NOT NULL,monthly_amount integer NOT NULL)');
  await setup.query('CREATE TABLE '+schema+'.verified_customer_settlements(payment_id uuid PRIMARY KEY,client_id uuid NOT NULL,paddle_event_id text UNIQUE NOT NULL,transaction_id text UNIQUE NOT NULL)');
  await setup.query('CREATE TABLE '+schema+'.paddle_live_subscription_links(subscription_id text PRIMARY KEY,payment_id uuid NOT NULL,client_id uuid NOT NULL)');
  await setup.query('CREATE TABLE '+schema+'.paddle_live_entities(entity_id text PRIMARY KEY,event_type text NOT NULL,status text NOT NULL,payment_id uuid NOT NULL,client_id uuid NOT NULL,occurred_at timestamptz NOT NULL,event_id text NOT NULL,updated_at timestamptz DEFAULT NOW())');
  await setup.query("INSERT INTO "+schema+".clients VALUES($1,'payment-review')",[A]);
  await setup.query("INSERT INTO "+schema+".payments(id,client_id,status,currency,setup_amount,monthly_amount) VALUES($1,$2,'pending','EUR',120,49)",[P,A]);
  await setup.query("INSERT INTO "+schema+".paddle_live_subscription_links VALUES('sub_review123',$1,$2)",[P,A]);
  const tx=await pool.connect();
  try{
   const locked=async write=>{
    await tx.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    try{
     await tx.query(PILOT_LOCK_SQL,[A]);
     const result=await write();
     await tx.query('COMMIT');
     return result;
    }catch(err){await tx.query('ROLLBACK').catch(()=>{});throw err}
   };
   const customer=async()=> (await setup.query('SELECT status FROM '+schema+'.clients WHERE id=$1',[A])).rows[0].status;
   await locked(async()=>{
    assert.equal((await tx.query(sql(READ_OWNED_PAYMENT_FOR_COMPLETION_SQL),[P,A])).rows[0].status,'pending');
    assert.equal((await tx.query(sql(MARK_VERIFIED_PADDLE_PAYMENT_SQL),[P,A,'2026-11-15T10:00:00Z'])).rowCount,1);
    assert.equal((await tx.query(sql(INSERT_VERIFIED_PADDLE_PROOF_SQL),[P,A,'evt_settle123','txn_settle123'])).rowCount,1);
   });
   assert.equal(await customer(),'payment-review','even an atomic signed settlement proof cannot activate customer automatically');

   await locked(async()=>{
    assert.equal((await tx.query(sql(UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL),
     occurrence('subscription.resumed','active','2026-11-15T11:00:00Z','evt_resume1'))).rowCount,1);
    assert.equal((await tx.query(sql(RESUME_OWNED_ACCESS_SQL),access('2026-11-15T11:00:00Z','evt_resume1'))).rowCount,1);
   });
   assert.equal(await customer(),'active');

   await locked(async()=>{
    assert.equal((await tx.query(sql(UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL),
     occurrence('subscription.canceled','canceled','2026-11-15T12:00:00Z','evt_cancel2'))).rowCount,1);
    assert.equal((await tx.query(sql(CANCEL_OWNED_ACCESS_SQL),access('2026-11-15T12:00:00Z','evt_cancel2'))).rowCount,1);
   });
   assert.equal(await customer(),'payment-review');
   await locked(async()=>{
    assert.equal((await tx.query(sql(UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL),
     occurrence('subscription.resumed','active','2026-11-15T11:30:00Z','evt_oldresume'))).rowCount,0);
    assert.equal((await tx.query(sql(RESUME_OWNED_ACCESS_SQL),access('2026-11-15T11:30:00Z','evt_oldresume'))).rowCount,0);
   });
   assert.equal(await customer(),'payment-review','old resume cannot regrant access after cancellation');

   await setup.query("UPDATE "+schema+".payments SET status='refunded' WHERE id=$1",[P]);
   await locked(async()=>{
    assert.equal((await tx.query(sql(UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL),
     occurrence('subscription.resumed','active','2026-11-15T13:00:00Z','evt_resume3'))).rowCount,1);
    assert.equal((await tx.query(sql(RESUME_OWNED_ACCESS_SQL),access('2026-11-15T13:00:00Z','evt_resume3'))).rowCount,0);
   });
   assert.equal(await customer(),'payment-review','refunded payment prevents restoration even with older stored proof');
  }finally{tx.release()}
 }finally{
  await setup.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE').catch(()=>{});
  setup.release();await pool.end();
 }
});
