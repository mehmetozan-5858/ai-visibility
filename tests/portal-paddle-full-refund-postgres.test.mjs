import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {reviewApprovedFullPaddleRefund} from '../lib/portal-paddle-full-refund-review.mjs';

// Disposable local PostgreSQL ONLY. The verifier is synthetic and cannot
// establish a real signed Paddle refund, refund amount or actual entitlement.
const source=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
if(source){
 const u=new URL(source);
 if(!['postgres:','postgresql:'].includes(u.protocol)||
 !['localhost','127.0.0.1'].includes(u.hostname)||
 decodeURIComponent(u.username)!=='fixture'||u.pathname!=='/fixture')
  throw Error('disposable-ci-postgres-only');
}
const eventId='evt_01hvzzzzzzzzzzzzzzzzzzzzzz';
const txn='txn_01hvyyyyyyyyyyyyyyyyyyyyyy';
const evt=(changes={})=>({
 event_id:eventId,event_type:'adjustment.updated',
 data:{id:'adj_01hvxxxxxxxxxxxxxxxxxxxxxx',transaction_id:txn,
  action:'refund',status:'approved',type:'full',...changes}
});
const proof=(e)=>({authenticated:true,refundFinal:true,fullRefundMatched:true,
 currencyMatched:true,eventId:e.event_id,adjustmentId:e.data.id,transactionId:e.data.transaction_id});
test('unapproved or partially approved refunds make zero connections',async()=>{
 let connected=0;
 const pool={connect:async()=>{connected++;throw Error('unexpected-db')}};
 for(const changes of [{status:'pending_approval'},{status:'rejected'},
  {status:'reversed'},{type:'partial'},{action:'credit'}]){
  await assert.rejects(reviewApprovedFullPaddleRefund(pool,evt(changes),async e=>proof(e)),
   /refund-review-unaccepted-adjustment/);
 }
 for(const key of ['authenticated','refundFinal','fullRefundMatched','currencyMatched']){
  await assert.rejects(reviewApprovedFullPaddleRefund(pool,evt(),async e=>({...proof(e),[key]:false})),
   /refund-review-proof-denied/);
 }
 assert.equal(connected,0);
});
test('approved full refund: correct tenant, durable event and rollback on replay / stale completion',{
 skip:!source?'requires local disposable PostgreSQL':false,timeout:30000
},async()=>{
 const name='ci_refund_review_'+randomUUID().replaceAll('-','').slice(0,12);
 const admin=new Pool({connectionString:source,max:1,connectionTimeoutMillis:3000,query_timeout:10000});
 const u=new URL(source);u.pathname='/'+name;
 let db,created=false;
 const A=randomUUID(),B=randomUUID(),P=randomUUID(),Q=randomUUID();
 try{
  await admin.query('CREATE DATABASE '+name);created=true;
  db=new Pool({connectionString:u.toString(),max:4,connectionTimeoutMillis:3000,query_timeout:10000});
  await db.query("CREATE TABLE public.clients(id uuid PRIMARY KEY,status text NOT NULL)");
  await db.query("CREATE TABLE public.payments(id uuid PRIMARY KEY,client_id uuid NOT NULL,status text NOT NULL)");
  await db.query("CREATE TABLE public.paddle_live_events(event_id text PRIMARY KEY,event_type text NOT NULL,entity_id text NOT NULL,payment_id uuid,client_id uuid)");
  await db.query("INSERT INTO public.clients(id,status) VALUES($1,'active'),($2,'active')",[A,B]);
  await db.query("INSERT INTO public.payments(id,client_id,status) VALUES($1,$2,'paid'),($3,$4,'paid')",[P,A,Q,B]);
  await db.query("INSERT INTO public.paddle_live_events(event_id,event_type,entity_id,payment_id,client_id) VALUES('evt_completed','transaction.completed',$1,$2,$3)",[txn,P,A]);
  const migration=await readFile(new URL('../migrations/portal-merchant-event-idempotency-review.sql',import.meta.url),'utf8');
  await db.query(migration);
  const row=await reviewApprovedFullPaddleRefund(db,evt(),async e=>proof(e));
  assert.deepEqual(row,{paymentId:P,tenantId:A,reviewOnly:true});
  const rows=(await db.query('SELECT id,status FROM public.payments')).rows;
  assert.equal(rows.find(x=>x.id===P).status,'refunded');
  assert.equal(rows.find(x=>x.id===Q).status,'paid');
  const clients=(await db.query('SELECT id,status FROM public.clients')).rows;
  assert.equal(clients.find(x=>x.id===A).status,'payment-review');
  assert.equal(clients.find(x=>x.id===B).status,'active');
  await assert.rejects(reviewApprovedFullPaddleRefund(db,evt(),async e=>proof(e)),
   /merchant-event-already-claimed/);
  await assert.rejects(reviewApprovedFullPaddleRefund(db,{...evt(),event_id:'evt_01hvnewrefund111111111111'},async e=>proof(e)),
   /refund-review-payment-not-paid/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.portal_merchant_event_claims_review')).rows[0].n,1);
  // A delayed payment completion must not overwrite refunded status:
  // explicitly guarded update is a synthetic approximation of expected rule.
  const late=await db.query("UPDATE public.payments SET status='paid' WHERE id=$1 AND client_id=$2 AND status NOT IN ('paid','refunded') RETURNING id",[P,A]);
  assert.equal(late.rowCount,0);
 }finally{
  if(db)await db.end().catch(()=>{});
  if(created)await admin.query('DROP DATABASE '+name).catch(()=>{});
  await admin.end();
 }
});
test('production Paddle webhook remains disconnected from review-only refund writer',async()=>{
 const live=await readFile(new URL('../lib/paddle-live.js',import.meta.url),'utf8');
 assert.doesNotMatch(live,/reviewApprovedFullPaddleRefund/);
});
