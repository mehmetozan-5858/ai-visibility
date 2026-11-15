import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';
import {UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL} from '../lib/portal-paddle-subscription-transition-review.mjs';
import {CANCEL_OWNED_ACCESS_SQL} from '../lib/portal-paddle-cancellation-write-review.mjs';

// REVIEW ONLY. Disposable PG service only, no customer data, no actual Paddle.
// The webhook and tenant owner/permission acceptance are still separate HOLD.
const url=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
const schema='ci_paddle_atomic_rollback_review';
const replace=sql=>sql.replaceAll('public.',schema+'.');
const upsert=replace(UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL);
const cancel=replace(CANCEL_OWNED_ACCESS_SQL);
const A='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222';
const eventArgs=[A,P,'sub_review123','subscription.canceled','canceled','2026-11-15T12:00:00Z','evt_cancelaudit123'];
const accessArgs=[A,P,'sub_review123','evt_cancelaudit123','2026-11-15T12:00:00Z'];

test('real pinned transaction rolls back current event and account after audit failure',{
 skip:!url?'disposable PostgreSQL CI required':false,timeout:25000
},async()=>{
 const pool=new Pool({connectionString:url,max:2,connectionTimeoutMillis:2500});
 const setup=await pool.connect();
 try{
  await setup.query('CREATE SCHEMA '+schema);
  await setup.query('CREATE TABLE '+schema+'.clients(id uuid PRIMARY KEY,status text NOT NULL)');
  await setup.query('CREATE TABLE '+schema+'.payments(id uuid PRIMARY KEY,client_id uuid NOT NULL)');
  await setup.query('CREATE TABLE '+schema+'.paddle_live_subscription_links(subscription_id text PRIMARY KEY,payment_id uuid NOT NULL,client_id uuid NOT NULL)');
  await setup.query('CREATE TABLE '+schema+'.paddle_live_entities(entity_id text PRIMARY KEY,event_type text NOT NULL,status text NOT NULL,payment_id uuid NOT NULL,client_id uuid NOT NULL,occurred_at timestamptz NOT NULL,event_id text NOT NULL,updated_at timestamptz DEFAULT NOW())');
  await setup.query('CREATE TABLE '+schema+'.audit(id integer PRIMARY KEY,client_id uuid NOT NULL,CONSTRAINT block_review_audit CHECK(id<0))');
  await setup.query("INSERT INTO "+schema+".clients VALUES($1,'active')",[A]);
  await setup.query('INSERT INTO '+schema+'.payments VALUES($1,$2)',[P,A]);
  await setup.query("INSERT INTO "+schema+".paddle_live_subscription_links VALUES('sub_review123',$1,$2)",[P,A]);
  const tx=await pool.connect();
  try{
   await tx.query('BEGIN ISOLATION LEVEL READ COMMITTED');
   await tx.query(PILOT_LOCK_SQL,[A]);
   assert.equal((await tx.query(upsert,eventArgs)).rowCount,1);
   assert.equal((await tx.query(cancel,accessArgs)).rowCount,1);
   await assert.rejects(tx.query('INSERT INTO '+schema+'.audit VALUES(1,$1)',[A]),/check constraint/);
   await tx.query('ROLLBACK');
  }finally{tx.release();}
  assert.equal((await setup.query('SELECT status FROM '+schema+'.clients WHERE id=$1',[A])).rows[0].status,'active','account update rolled back');
  assert.equal((await setup.query('SELECT count(*)::int AS n FROM '+schema+'.paddle_live_entities')).rows[0].n,0,'event upsert rolled back');
  await setup.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  try{
   await setup.query(PILOT_LOCK_SQL,[A]);
   assert.equal((await setup.query(upsert,eventArgs)).rowCount,1);
   assert.equal((await setup.query(cancel,accessArgs)).rowCount,1);
   await setup.query('ROLLBACK'); // fixture never persists an account mutation
  }catch(e){await setup.query('ROLLBACK').catch(()=>{});throw e}
 }finally{
  await setup.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE').catch(()=>{});
  setup.release();
  await pool.end();
 }
});
