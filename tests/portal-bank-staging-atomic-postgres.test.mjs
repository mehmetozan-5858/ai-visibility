import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {stageBankConfirmationLockedReview} from '../lib/portal-bank-confirmation-staging-review.mjs';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';

// REVIEW ONLY: disposable local PostgreSQL CI. No Neon, real bank or Paddle.
const source=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
if(source){
 const u=new URL(source);
 if(!['postgres:','postgresql:'].includes(u.protocol)||
   !['localhost','127.0.0.1'].includes(u.hostname)||
   u.pathname!=='/fixture'||decodeURIComponent(u.username)!=='fixture')
  throw Error('disposable-ci-postgres-only');
}
const dbName='ci_bank_staging_atomic_review';
const tenant='11111111-1111-4111-8111-111111111111';
const payment='22222222-2222-4222-8222-222222222222';
const evidence={confirmed:true,amount:'10.00',currency:'EUR',
 invoiceReference:'INV-REVIEW-001',bankReference:'BANK-REVIEW-000001',
 valueDate:'2026-11-14'};

test('actual PostgreSQL bank staging rolls back failed audit and never enables access',{
 skip:!source?'disposable PostgreSQL CI required':false,timeout:30000
},async()=>{
 const admin=new Pool({connectionString:source,max:1,connectionTimeoutMillis:2500});
 const target=new URL(source);target.pathname='/'+dbName;
 let created=false,db;
 try{
  await admin.query('CREATE DATABASE '+dbName);created=true;
  db=new Pool({connectionString:target.toString(),max:3,connectionTimeoutMillis:2500,query_timeout:8000});
  await db.query('CREATE TABLE public.clients(id uuid PRIMARY KEY,status text NOT NULL)');
  await db.query(`CREATE TABLE public.payments(
    id uuid PRIMARY KEY,client_id uuid NOT NULL,reference_code text NOT NULL,
    method text NOT NULL,status text NOT NULL,currency text NOT NULL,
    setup_amount numeric NOT NULL,monthly_amount numeric NOT NULL)`);
  await db.query(`CREATE TABLE public.bank_confirmations(
    id uuid PRIMARY KEY,payment_id uuid NOT NULL,currency text NOT NULL,
    bank_reference text NOT NULL,amount_minor bigint NOT NULL,value_date date NOT NULL,
    invoice_reference text NOT NULL,UNIQUE(currency,bank_reference))`);
  await db.query("INSERT INTO public.clients VALUES($1,'payment-review')",[tenant]);
  await db.query(`INSERT INTO public.payments VALUES
   ($1,$2,$3,'bank-transfer','customer-reported','EUR',10,0)`,
   [payment,tenant,evidence.invoiceReference]);

  await db.query(`CREATE FUNCTION public.reject_bank_stage_review()
   RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN RAISE EXCEPTION 'synthetic-bank-stage-denied'; END $$`);
  await db.query(`CREATE TRIGGER reject_review BEFORE INSERT ON public.bank_confirmations
   FOR EACH ROW EXECUTE FUNCTION public.reject_bank_stage_review()`);
  await assert.rejects(stageBankConfirmationLockedReview(db,payment,evidence),
   /synthetic-bank-stage-denied/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.bank_confirmations')).rows[0].n,0);
  await db.query('DROP TRIGGER reject_review ON public.bank_confirmations');
  const first=await stageBankConfirmationLockedReview(db,payment,evidence);
  assert.deepEqual(first,{staged:true,alreadyStaged:false,verifiedSettlement:false,activated:false});
  const repeat=await stageBankConfirmationLockedReview(db,payment,evidence);
  assert.equal(repeat.alreadyStaged,true);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.bank_confirmations')).rows[0].n,1);
  await assert.rejects(
   stageBankConfirmationLockedReview(db,payment,{...evidence,valueDate:'2026-11-13'}),
   /review-bank-staging-reference-conflict/);
  assert.equal((await db.query('SELECT value_date::text AS d FROM public.bank_confirmations')).rows[0].d,
   evidence.valueDate);
  // Two independent PostgreSQL connections must honor the same lock.
  // This must fail CLOSED, without changing the existing bank confirmation.
  const holder=await db.connect();
  try{
   await holder.query('BEGIN ISOLATION LEVEL READ COMMITTED');
   await holder.query(PILOT_LOCK_SQL,[tenant]);
   await assert.rejects(stageBankConfirmationLockedReview(db,payment,evidence),
    error=>error?.code==='55P03',
    'locked concurrent bank staging must reject on timeout');
  }finally{
   await holder.query('ROLLBACK').catch(()=>{});
   holder.release();
  }
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.bank_confirmations')).rows[0].n,1);
  assert.equal((await db.query('SELECT 1 AS n')).rows[0].n,1,'pool remains usable');
  assert.equal((await db.query('SELECT status FROM public.clients WHERE id=$1',[tenant])).rows[0].status,
   'payment-review');
  assert.equal((await db.query('SELECT status FROM public.payments WHERE id=$1',[payment])).rows[0].status,
   'customer-reported');
 }finally{
  if(db)await db.end().catch(()=>{});
  if(created)await admin.query('DROP DATABASE '+dbName).catch(()=>{});
  await admin.end();
 }
});
