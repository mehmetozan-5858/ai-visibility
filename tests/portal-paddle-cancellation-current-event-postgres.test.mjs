import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {CANCEL_OWNED_ACCESS_SQL} from '../lib/portal-paddle-cancellation-write-review.mjs';

// Review-only real SQL acceptance using the disposable GitHub Actions PG service.
// Public tables are synthetic fixtures; never execute against production/Neon.
const url=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const P='33333333-3333-4333-8333-333333333333';
const schema='ci_paddle_current_event_review';
const sql=CANCEL_OWNED_ACCESS_SQL.replaceAll('public.',schema+'.');
test('actual SQL denies stale Paddle cancellations and enforces exact current event ownership',{
 skip:!url?'disposable CI PostgreSQL service required':false,timeout:20000
},async()=>{
 const pool=new Pool({connectionString:url,max:2,connectionTimeoutMillis:2500});
 try{
  await pool.query('CREATE SCHEMA '+schema);
  await pool.query('CREATE TABLE '+schema+'.clients(id uuid PRIMARY KEY,status text NOT NULL)');
  await pool.query('CREATE TABLE '+schema+'.payments(id uuid PRIMARY KEY,client_id uuid NOT NULL)');
  await pool.query('CREATE TABLE '+schema+'.paddle_live_subscription_links(subscription_id text PRIMARY KEY,payment_id uuid NOT NULL,client_id uuid NOT NULL)');
  await pool.query('CREATE TABLE '+schema+'.paddle_live_entities(entity_id text PRIMARY KEY,event_id text NOT NULL,occurred_at timestamptz NOT NULL,event_type text NOT NULL,status text NOT NULL,client_id uuid NOT NULL,payment_id uuid NOT NULL)');
  await pool.query("INSERT INTO "+schema+".clients VALUES($1,'active'),($2,'active')",[A,B]);
  await pool.query('INSERT INTO '+schema+'.payments VALUES($1,$2)',[P,A]);
  await pool.query("INSERT INTO "+schema+".paddle_live_subscription_links VALUES('sub_review123',$1,$2)",[P,A]);
  await pool.query("INSERT INTO "+schema+".paddle_live_entities VALUES('sub_review123','evt_recentresume','2026-11-15T12:00:00Z','subscription.resumed','active',$1,$2)",[A,P]);
  const cancelArgs=[A,P,'sub_review123','evt_oldcancel','2026-11-15T11:00:00Z'];
  assert.equal((await pool.query(sql,cancelArgs)).rowCount,0,'stale cancellation must not close access');
  assert.equal((await pool.query('SELECT status FROM '+schema+'.clients WHERE id=$1',[A])).rows[0].status,'active');
  await pool.query("UPDATE "+schema+".paddle_live_entities SET event_id='evt_freshcancel',occurred_at='2026-11-15T13:00:00Z',event_type='subscription.canceled',status='canceled'");
  assert.equal((await pool.query(sql,cancelArgs)).rowCount,0,'wrong event id must not update');
  assert.equal((await pool.query(sql,[B,P,'sub_review123','evt_freshcancel','2026-11-15T13:00:00Z'])).rowCount,0,'wrong tenant must not update');
  assert.equal((await pool.query(sql,[A,P,'sub_wrong','evt_freshcancel','2026-11-15T13:00:00Z'])).rowCount,0,'wrong subscription must not update');
  assert.equal((await pool.query(sql,[A,P,'sub_review123','evt_freshcancel','2026-11-15T13:00:00Z'])).rowCount,1,'current cancellation closes owned access');
  assert.equal((await pool.query('SELECT status FROM '+schema+'.clients WHERE id=$1',[A])).rows[0].status,'payment-review');
  assert.equal((await pool.query(sql,[A,P,'sub_review123','evt_freshcancel','2026-11-15T13:00:00Z'])).rowCount,0,'repeat must be idempotent');
  assert.equal((await pool.query('SELECT status FROM '+schema+'.clients WHERE id=$1',[B])).rows[0].status,'active');
 }finally{
  await pool.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE').catch(()=>{});
  await pool.end();
 }
});
