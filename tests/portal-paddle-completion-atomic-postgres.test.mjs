import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {
 READ_OWNED_PAYMENT_FOR_COMPLETION_SQL,MARK_VERIFIED_PADDLE_PAYMENT_SQL,
 INSERT_VERIFIED_PADDLE_PROOF_SQL
} from '../lib/portal-paddle-completion-write-review.mjs';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';

// REVIEW ONLY: disposable isolated CI PG schema, no actual Paddle charges
// and no production/Neon data. Provider HMAC validation is tested separately.
const url=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
const schema='ci_paddle_completion_atomic_review';
const sql=s=>s.replaceAll('public.',schema+'.');
const A='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222';
test('real PostgreSQL reverts paid state when durable settlement proof insert fails',{
 skip:!url?'disposable PostgreSQL CI only':false,timeout:25000
},async()=>{
 const pool=new Pool({connectionString:url,max:2,connectionTimeoutMillis:2500});
 const conn=await pool.connect();
 try{
  await conn.query('CREATE SCHEMA '+schema);
  await conn.query('CREATE TABLE '+schema+'.payments(id uuid PRIMARY KEY,client_id uuid NOT NULL,status text NOT NULL,method text,paid_at timestamptz,currency text NOT NULL,setup_amount integer NOT NULL,monthly_amount integer NOT NULL)');
  await conn.query('CREATE TABLE '+schema+".verified_customer_settlements(payment_id uuid PRIMARY KEY,client_id uuid NOT NULL,paddle_event_id text NOT NULL,transaction_id text NOT NULL,CONSTRAINT deliberate_review_proof_rejection CHECK (paddle_event_id<>'evt_blocked'))");
  await conn.query('INSERT INTO '+schema+".payments(id,client_id,status,currency,setup_amount,monthly_amount) VALUES ($1,$2,'customer-reported','EUR',120,49)",[P,A]);
  await conn.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  try{
   await conn.query(PILOT_LOCK_SQL,[A]);
   assert.equal((await conn.query(sql(READ_OWNED_PAYMENT_FOR_COMPLETION_SQL),[P,A])).rows[0].status,'customer-reported');
   assert.equal((await conn.query(sql(MARK_VERIFIED_PADDLE_PAYMENT_SQL),[P,A,'2026-11-15T11:00:00Z'])).rowCount,1);
   await assert.rejects(conn.query(sql(INSERT_VERIFIED_PADDLE_PROOF_SQL),[P,A,'evt_blocked','txn_test123']),/check constraint/);
   await conn.query('ROLLBACK');
  }catch(e){await conn.query('ROLLBACK').catch(()=>{});throw e}
  assert.equal((await conn.query('SELECT status FROM '+schema+'.payments WHERE id=$1',[P])).rows[0].status,'customer-reported');
  assert.equal((await conn.query('SELECT count(*)::int AS n FROM '+schema+'.verified_customer_settlements')).rows[0].n,0);
  await conn.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  try{
   await conn.query(PILOT_LOCK_SQL,[A]);
   await conn.query(sql(READ_OWNED_PAYMENT_FOR_COMPLETION_SQL),[P,A]);
   assert.equal((await conn.query(sql(MARK_VERIFIED_PADDLE_PAYMENT_SQL),[P,A,'2026-11-15T11:00:00Z'])).rowCount,1);
   assert.equal((await conn.query(sql(INSERT_VERIFIED_PADDLE_PROOF_SQL),[P,A,'evt_test123','txn_test123'])).rowCount,1);
   await conn.query('COMMIT');
  }catch(e){await conn.query('ROLLBACK').catch(()=>{});throw e}
  assert.equal((await conn.query('SELECT status FROM '+schema+'.payments WHERE id=$1',[P])).rows[0].status,'paid');
  assert.equal((await conn.query('SELECT count(*)::int AS n FROM '+schema+'.verified_customer_settlements')).rows[0].n,1);
  await conn.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  try{
   await conn.query(PILOT_LOCK_SQL,[A]);
   assert.equal((await conn.query(sql(MARK_VERIFIED_PADDLE_PAYMENT_SQL),[P,A,'2026-11-15T11:00:00Z'])).rowCount,0,'already paid event cannot rewrite');
   assert.equal((await conn.query(sql(INSERT_VERIFIED_PADDLE_PROOF_SQL),[P,A,'evt_test123','txn_test123'])).rowCount,0,'proof replay does not duplicate');
   await conn.query('ROLLBACK');
  }catch(e){await conn.query('ROLLBACK').catch(()=>{});throw e}
  // Negative real-SQL guards: historical failed or bank-transfer records
  // cannot be reclassified as Paddle settlements, even with a signed event.
  for(const [status,method] of [
   ['failed','paddle'],['canceled','paddle'],
   ['pending','bank-transfer'],['customer-reported','manual']
  ]){
   await conn.query('UPDATE '+schema+'.payments SET status=$2, method=$3 WHERE id=$1',
    [P,status,method]);
   const denied=await conn.query(sql(MARK_VERIFIED_PADDLE_PAYMENT_SQL),
    [P,A,'2026-11-15T11:00:00Z']);
   assert.equal(denied.rowCount,0,
    'ineligible previous status or method must never create paid evidence');
   const current=(await conn.query('SELECT status,method FROM '+schema+
    '.payments WHERE id=$1',[P])).rows[0];
   assert.equal(current.status,status);
   assert.equal(current.method,method);
  }
 }finally{
  await conn.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE').catch(()=>{});
  conn.release();await pool.end();
 }
});
