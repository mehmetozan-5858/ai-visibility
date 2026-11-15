import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {confirmCardPaymentLockedReview} from '../lib/portal-card-activation-transaction-review.mjs';

// REVIEW ONLY: self-contained disposable PostgreSQL CI database.
// Never connect to Neon, staging or production. No card gateway calls.
const source=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
if(source){
 const u=new URL(source);
 if(!['postgres:','postgresql:'].includes(u.protocol)||
  !['localhost','127.0.0.1'].includes(u.hostname)||
  u.pathname!=='/fixture'||decodeURIComponent(u.username)!=='fixture')
  throw Error('disposable-ci-postgres-only');
}
const dbName='ci_card_locked_atomic_review';
const A='11111111-1111-4111-8111-111111111111';
const P='22222222-2222-4222-8222-222222222222';
const OID='cardlockedreview001';

test('real PostgreSQL rolls back card paid state if account activation fails',{
 skip:!source?'requires disposable local PostgreSQL CI service':false,
 timeout:30000
},async()=>{
 const admin=new Pool({connectionString:source,max:1,connectionTimeoutMillis:2500});
 const target=new URL(source);target.pathname='/'+dbName;
 let created=false,db;
 try{
  await admin.query('CREATE DATABASE '+dbName);created=true;
  db=new Pool({connectionString:target.toString(),max:3,connectionTimeoutMillis:2500,query_timeout:8000});
  await db.query('CREATE TABLE public.clients(id uuid PRIMARY KEY,plan text,status text NOT NULL)');
  await db.query(`CREATE TABLE public.payments(
   id uuid PRIMARY KEY, client_id uuid NOT NULL, reference_code text NOT NULL,
   method text,status text NOT NULL,plan text,currency text,
   setup_amount numeric DEFAULT 0,monthly_amount numeric DEFAULT 0,
   created_at timestamptz DEFAULT now(),reported_at timestamptz,paid_at timestamptz)`);
  await db.query("INSERT INTO public.clients(id,status) VALUES($1,'payment-review')",[A]);
  await db.query(`INSERT INTO public.payments(id,client_id,reference_code,method,status,plan,currency)
   VALUES($1,$2,$3,'card','pending','Starter','EUR')`,[P,A,OID]);

  // A failing account trigger forces the second write to fail after payment
  // was marked paid. The pinned transaction must roll BOTH writes back.
  await db.query(`CREATE FUNCTION public.reject_card_activation_review()
   RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN IF NEW.status='active' THEN
    RAISE EXCEPTION 'synthetic-account-activation-denied';
   END IF; RETURN NEW; END $$`);
  await db.query(`CREATE TRIGGER reject_review BEFORE UPDATE ON public.clients
   FOR EACH ROW EXECUTE FUNCTION public.reject_card_activation_review()`);
  await assert.rejects(confirmCardPaymentLockedReview(db,OID),/synthetic-account-activation-denied/);
  let payment=(await db.query('SELECT status FROM public.payments WHERE id=$1',[P])).rows[0];
  let client=(await db.query('SELECT status FROM public.clients WHERE id=$1',[A])).rows[0];
  assert.equal(payment.status,'pending','payment must roll back');
  assert.equal(client.status,'payment-review','account must remain unchanged');

  await db.query('DROP TRIGGER reject_review ON public.clients');
  const first=await confirmCardPaymentLockedReview(db,OID);
  assert.equal(first?.status,'paid');
  payment=(await db.query('SELECT status FROM public.payments WHERE id=$1',[P])).rows[0];
  client=(await db.query('SELECT status FROM public.clients WHERE id=$1',[A])).rows[0];
  assert.equal(payment.status,'paid');
  assert.equal(client.status,'active');

  // A repeat cannot create another activation or alter the saved payment.
  const repeat=await confirmCardPaymentLockedReview(db,OID);
  assert.equal(repeat?.id,P);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.payments')).rows[0].n,1);
  // Duplicate merchant IDs across tenants must deny without cross-tenant writes.
  const B='33333333-3333-4333-8333-333333333333';
  const P2='44444444-4444-4444-8444-444444444444';
  await db.query("INSERT INTO public.clients(id,status) VALUES($1,'payment-review')",[B]);
  await db.query(`INSERT INTO public.payments(id,client_id,reference_code,method,status,plan,currency)
   VALUES($1,$2,$3,'card','pending','Starter','EUR')`,[P2,B,OID]);
  await assert.rejects(confirmCardPaymentLockedReview(db,OID),/review-card-payment-unresolved/);
  assert.equal((await db.query('SELECT status FROM public.clients WHERE id=$1',[B])).rows[0].status,
   'payment-review');
  assert.equal((await db.query('SELECT status FROM public.payments WHERE id=$1',[P2])).rows[0].status,
   'pending');
  await assert.rejects(confirmCardPaymentLockedReview(db,'bad!'),/review-card-confirmation-invalid/);
 }finally{
  if(db)await db.end().catch(()=>{});
  if(created)await admin.query('DROP DATABASE '+dbName).catch(()=>{});
  await admin.end();
 }
});
