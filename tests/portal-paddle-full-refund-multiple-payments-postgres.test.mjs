import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {reviewApprovedFullPaddleRefund} from '../lib/portal-paddle-full-refund-review.mjs';

// Only an isolated local PostgreSQL fixture. No real Paddle, Neon, or money.
const source=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
if(source){const u=new URL(source);if(!['postgres:','postgresql:'].includes(u.protocol)||
 !['localhost','127.0.0.1'].includes(u.hostname)||u.pathname!=='/fixture'||
 decodeURIComponent(u.username)!=='fixture')throw Error('disposable-fixture-only');}
test('duplicate webhook receipts for one transaction do not imply different payments; other paid entitlements stay active',{
 skip:!source?'requires disposable PostgreSQL':false,timeout:30000
},async()=>{
 const name='ci_refund_multipay_'+randomUUID().replaceAll('-','').slice(0,12);
 const admin=new Pool({connectionString:source,max:1,connectionTimeoutMillis:3000,query_timeout:10000});
 const u=new URL(source);u.pathname='/'+name;
 let db,created=false;
 const tenant=randomUUID(),anotherTenant=randomUUID(),target=randomUUID(),otherPaid=randomUUID(),foreign=randomUUID();
 const transaction='txn_01hvyyyyyyyyyyyyyyyyyyyyyy';
 const event={event_id:'evt_01hvzzzzzzzzzzzzzzzzzzzzzz',event_type:'adjustment.updated',
  data:{id:'adj_01hvxxxxxxxxxxxxxxxxxxxxxx',transaction_id:transaction,action:'refund',
  type:'full',status:'approved'}};
 const verify=async e=>({authenticated:true,refundFinal:true,fullRefundMatched:true,currencyMatched:true,
  eventId:e.event_id,adjustmentId:e.data.id,transactionId:e.data.transaction_id});
 try{
  await admin.query('CREATE DATABASE '+name);created=true;
  db=new Pool({connectionString:u.toString(),max:3,connectionTimeoutMillis:3000,query_timeout:10000});
  await db.query('CREATE TABLE public.clients(id uuid PRIMARY KEY,status text NOT NULL)');
  await db.query('CREATE TABLE public.payments(id uuid PRIMARY KEY,client_id uuid NOT NULL,status text NOT NULL)');
  await db.query('CREATE TABLE public.paddle_live_events(event_id text PRIMARY KEY,event_type text NOT NULL,entity_id text NOT NULL,payment_id uuid,client_id uuid)');
  await db.query("INSERT INTO public.clients(id,status) VALUES($1,'active'),($2,'active')",[tenant,anotherTenant]);
  await db.query("INSERT INTO public.payments(id,client_id,status) VALUES($1,$2,'paid'),($3,$2,'paid'),($4,$5,'paid')",
   [target,tenant,otherPaid,foreign,anotherTenant]);
  await db.query(`INSERT INTO public.paddle_live_events(event_id,event_type,entity_id,payment_id,client_id)
   VALUES('evt_original_1','transaction.completed',$1,$2,$3),
   ('evt_original_2','transaction.completed',$1,$2,$3)`,[transaction,target,tenant]);
  await db.query(await readFile(new URL('../migrations/portal-merchant-event-idempotency-review.sql',import.meta.url),'utf8'));
  const done=await reviewApprovedFullPaddleRefund(db,event,verify);
  assert.equal(done.paymentId,target);assert.equal(done.tenantId,tenant);
  const pays=(await db.query('SELECT id,status FROM public.payments')).rows;
  assert.equal(pays.find(r=>r.id===target).status,'refunded');
  assert.equal(pays.find(r=>r.id===otherPaid).status,'paid');
  assert.equal(pays.find(r=>r.id===foreign).status,'paid');
  const clients=(await db.query('SELECT id,status FROM public.clients')).rows;
  assert.equal(clients.find(r=>r.id===tenant).status,'active','another paid subscription must not be blanket-suspended');
  assert.equal(clients.find(r=>r.id===anotherTenant).status,'active');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.portal_merchant_event_claims_review')).rows[0].n,1);
 }finally{
  if(db)await db.end().catch(()=>{});
  if(created)await admin.query('DROP DATABASE '+name).catch(()=>{});
  await admin.end();
 }
});
