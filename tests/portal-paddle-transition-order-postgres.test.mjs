import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL}
 from '../lib/portal-paddle-subscription-transition-review.mjs';
import {CANCEL_OWNED_ACCESS_SQL}
 from '../lib/portal-paddle-cancellation-write-review.mjs';
import {RESUME_OWNED_ACCESS_SQL}
 from '../lib/portal-paddle-resume-write-review.mjs';

// REVIEW ONLY — isolated schema in disposable GitHub CI PostgreSQL.
// Not real Paddle signatures, actual Neon roles, refund or production acceptance.
const url=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
const schema='ci_paddle_transition_order_review';
const replace=sql=>sql.replaceAll('public.',schema+'.');
const upsert=replace(UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL);
const cancel=replace(CANCEL_OWNED_ACCESS_SQL);
const resume=replace(RESUME_OWNED_ACCESS_SQL);
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const P='33333333-3333-4333-8333-333333333333';
const event=(type,status,time,id)=>[A,P,'sub_review123',type,status,time,id];
const access=(time,id)=>[A,P,'sub_review123',id,time];
test('real SQL accepts only newer owned events and never restores without proof',{
 skip:!url?'requires disposable PostgreSQL CI service':false,timeout:25000
},async()=>{
 const pool=new Pool({connectionString:url,max:2,connectionTimeoutMillis:2500});
 try{
  await pool.query('CREATE SCHEMA '+schema);
  await pool.query('CREATE TABLE '+schema+'.clients (id uuid PRIMARY KEY,status text NOT NULL)');
  await pool.query('CREATE TABLE '+schema+'.payments (id uuid PRIMARY KEY,client_id uuid NOT NULL,status text NOT NULL,method text NOT NULL)');
  await pool.query('CREATE TABLE '+schema+'.verified_customer_settlements (payment_id uuid PRIMARY KEY,client_id uuid NOT NULL)');
  await pool.query('CREATE TABLE '+schema+'.paddle_live_subscription_links (subscription_id text PRIMARY KEY,payment_id uuid NOT NULL,client_id uuid NOT NULL)');
  await pool.query('CREATE TABLE '+schema+'.paddle_live_entities (entity_id text PRIMARY KEY,event_type text NOT NULL,status text NOT NULL,payment_id uuid NOT NULL,client_id uuid NOT NULL,occurred_at timestamptz NOT NULL,event_id text NOT NULL,updated_at timestamptz NOT NULL DEFAULT NOW())');
  await pool.query("INSERT INTO "+schema+".clients VALUES($1,'active'),($2,'active')",[A,B]);
  await pool.query("INSERT INTO "+schema+".payments VALUES($1,$2,'paid','paddle')",[P,A]);
  await pool.query("INSERT INTO "+schema+".paddle_live_subscription_links VALUES('sub_review123',$1,$2)",[P,A]);
  await pool.query('INSERT INTO '+schema+'.verified_customer_settlements VALUES($1,$2)',[P,A]);
  assert.equal((await pool.query(upsert,event('subscription.canceled','canceled','2026-11-15T10:00:00Z','evt_cancel1'))).rowCount,1);
  assert.equal((await pool.query(cancel,access('2026-11-15T10:00:00Z','evt_cancel1'))).rowCount,1);
  assert.equal((await pool.query(upsert,event('subscription.resumed','active','2026-11-15T11:00:00Z','evt_resume1'))).rowCount,1);
  assert.equal((await pool.query(resume,access('2026-11-15T11:00:00Z','evt_resume1'))).rowCount,1);
  assert.equal((await pool.query(upsert,event('subscription.canceled','canceled','2026-11-15T10:30:00Z','evt_oldcancel'))).rowCount,0,'older cancellation rejected');
  assert.equal((await pool.query(cancel,access('2026-11-15T10:30:00Z','evt_oldcancel'))).rowCount,0,'old cancellation cannot close resumed access');
  assert.equal((await pool.query(upsert,event('subscription.canceled','canceled','2026-11-15T11:00:00Z','evt_equalconflict'))).rowCount,0,'equal timestamp conflict fails closed');
  assert.equal((await pool.query(upsert,event('subscription.resumed','active','2026-11-15T11:00:00Z','evt_resume1'))).rowCount,0,'replayed event ignored');
  assert.equal((await pool.query('SELECT status FROM '+schema+'.clients WHERE id=$1',[A])).rows[0].status,'active');
  assert.equal((await pool.query(upsert,[B,P,'sub_review123','subscription.canceled','canceled','2026-11-15T12:00:00Z','evt_foreign'])) .rowCount,0,'foreign tenant cannot advance event');
  assert.equal((await pool.query(upsert,event('subscription.canceled','canceled','2026-11-15T12:00:00Z','evt_cancel2'))).rowCount,1);
  assert.equal((await pool.query(cancel,access('2026-11-15T12:00:00Z','evt_cancel2'))).rowCount,1);
  await pool.query("UPDATE "+schema+".payments SET status='refunded'");
  assert.equal((await pool.query(upsert,event('subscription.resumed','active','2026-11-15T13:00:00Z','evt_resume2'))).rowCount,1);
  assert.equal((await pool.query(resume,access('2026-11-15T13:00:00Z','evt_resume2'))).rowCount,0,'refunded payment cannot restore access');
  assert.equal((await pool.query('SELECT status FROM '+schema+'.clients WHERE id=$1',[A])).rows[0].status,'payment-review');
 }finally{
  await pool.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE').catch(()=>{});
  await pool.end();
 }
});
