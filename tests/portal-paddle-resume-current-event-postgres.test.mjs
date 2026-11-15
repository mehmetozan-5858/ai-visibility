import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {RESUME_OWNED_ACCESS_SQL} from '../lib/portal-paddle-resume-write-review.mjs';

// Synthetic isolated schema in ephemeral GitHub CI PostgreSQL service ONLY.
// Not evidence of live Paddle receipts, real Neon privileges, or deployment.
const url=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
const schema='ci_paddle_resume_current_review';
const sql=RESUME_OWNED_ACCESS_SQL.replaceAll('public.',schema+'.');
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const P='33333333-3333-4333-8333-333333333333';
const args=(id='evt_recentresume',time='2026-11-15T12:00:00Z',client=A)=>
 [client,P,'sub_review123',id,time];

test('real SQL resumes only current owned subscription with durable signed settlement',{
 skip:!url?'disposable CI PostgreSQL only':false,timeout:25000
},async()=>{
 const pool=new Pool({connectionString:url,max:2,connectionTimeoutMillis:2500});
 try{
  await pool.query('CREATE SCHEMA '+schema);
  await pool.query('CREATE TABLE '+schema+'.clients(id uuid PRIMARY KEY,status text NOT NULL)');
  await pool.query('CREATE TABLE '+schema+'.payments(id uuid PRIMARY KEY,client_id uuid NOT NULL,status text NOT NULL,method text NOT NULL)');
  await pool.query('CREATE TABLE '+schema+'.verified_customer_settlements(payment_id uuid PRIMARY KEY,client_id uuid NOT NULL)');
  await pool.query('CREATE TABLE '+schema+'.paddle_live_subscription_links(subscription_id text PRIMARY KEY,payment_id uuid NOT NULL,client_id uuid NOT NULL)');
  await pool.query('CREATE TABLE '+schema+'.paddle_live_entities(entity_id text PRIMARY KEY,event_id text NOT NULL,occurred_at timestamptz NOT NULL,event_type text NOT NULL,status text NOT NULL,client_id uuid NOT NULL,payment_id uuid NOT NULL)');
  await pool.query("INSERT INTO "+schema+".clients VALUES($1,'payment-review'),($2,'payment-review')",[A,B]);
  await pool.query("INSERT INTO "+schema+".payments VALUES($1,$2,'paid','paddle')",[P,A]);
  await pool.query("INSERT INTO "+schema+".paddle_live_subscription_links VALUES('sub_review123',$1,$2)",[P,A]);
  await pool.query("INSERT INTO "+schema+".paddle_live_entities VALUES('sub_review123','evt_recentresume','2026-11-15T12:00:00Z','subscription.resumed','active',$1,$2)",[A,P]);

  assert.equal((await pool.query(sql,args())).rowCount,0,'historical paid label without verified settlement is insufficient');
  await pool.query('INSERT INTO '+schema+'.verified_customer_settlements VALUES($1,$2)',[P,A]);
  assert.equal((await pool.query(sql,args('evt_oldresume','2026-11-15T10:00:00Z'))).rowCount,0,'stale resume denied');
  assert.equal((await pool.query(sql,args('evt_recentresume','2026-11-15T12:00:00Z',B))).rowCount,0,'foreign tenant denied');
  await pool.query("UPDATE "+schema+".paddle_live_entities SET event_id='evt_recentcancel',occurred_at='2026-11-15T13:00:00Z',event_type='subscription.canceled',status='canceled'");
  assert.equal((await pool.query(sql,args())).rowCount,0,'old resume after cancellation denied');
  await pool.query("UPDATE "+schema+".paddle_live_entities SET event_id='evt_recentresume2',occurred_at='2026-11-15T14:00:00Z',event_type='subscription.resumed',status='active'");
  await pool.query("UPDATE "+schema+".payments SET status='refunded'");
  assert.equal((await pool.query(sql,args('evt_recentresume2','2026-11-15T14:00:00Z'))).rowCount,0,'refunded payment cannot restore');
  await pool.query("UPDATE "+schema+".payments SET status='paid',method='card'");
  assert.equal((await pool.query(sql,args('evt_recentresume2','2026-11-15T14:00:00Z'))).rowCount,0,'card label cannot replace Paddle');
  await pool.query("UPDATE "+schema+".payments SET method='paddle'");
  assert.equal((await pool.query(sql,args('evt_recentresume2','2026-11-15T14:00:00Z'))).rowCount,1,'current owned resume with settlement can restore');
  assert.equal((await pool.query(sql,args('evt_recentresume2','2026-11-15T14:00:00Z'))).rowCount,0,'repeat remains idempotent');
  assert.equal((await pool.query('SELECT status FROM '+schema+'.clients WHERE id=$1',[A])).rows[0].status,'active');
  assert.equal((await pool.query('SELECT status FROM '+schema+'.clients WHERE id=$1',[B])).rows[0].status,'payment-review');
 }finally{
  await pool.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE').catch(()=>{});
  await pool.end();
 }
});
