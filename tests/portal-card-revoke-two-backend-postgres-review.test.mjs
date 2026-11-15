import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';
import {confirmCardPaymentLockedReview} from '../lib/portal-card-activation-transaction-review.mjs';

// REVIEW ONLY. Only the disposable local PostgreSQL 16 CI fixture may run this.
// Never point schema/database creation at a Neon, customer or remote endpoint.
const url=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
if(url){
 const u=new URL(url);
 if(!['postgres:','postgresql:'].includes(u.protocol)||
    !['localhost','127.0.0.1'].includes(u.hostname)||
    u.port!=='5432'||u.pathname!=='/fixture'||
    decodeURIComponent(u.username)!=='fixture')
  throw Error('disposable-ci-postgres-only');
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('actual PostgreSQL card activation waits behind committed tenant pilot revocation',{
 skip:!url?'requires disposable CI PostgreSQL service':false,timeout:30000
},async()=>{
 // A per-test temporary DB prevents collisions with other public-table tests.
 const admin=new Pool({connectionString:url,max:2,connectionTimeoutMillis:2500});
 const name='ci_card_'+randomUUID().replaceAll('-','');
 let created=false,db=null,writer=null,observer=null,writerOpen=false,pending=null;
 try{
  await admin.query('CREATE DATABASE "'+name+'"');created=true;
  const u=new URL(url);u.pathname='/'+name;
  db=new Pool({connectionString:u.toString(),max:4,connectionTimeoutMillis:2500});
  const tenant=randomUUID(),paymentId=randomUUID(),oid='cardreview987654';
  await db.query('CREATE TABLE public.clients(id uuid PRIMARY KEY,status text NOT NULL,plan text)');
  await db.query(`CREATE TABLE public.payments(
    id uuid PRIMARY KEY,client_id uuid NOT NULL REFERENCES public.clients(id),
    reference_code text NOT NULL,status text NOT NULL,method text NOT NULL,
    paid_at timestamptz,plan text,currency text,setup_amount numeric,
    monthly_amount numeric,created_at timestamptz DEFAULT now(),
    reported_at timestamptz)`);
  await db.query(`CREATE TABLE public.client_pilot_access(
    client_id uuid PRIMARY KEY REFERENCES public.clients(id),
    revoked_at timestamptz,expires_at timestamptz)`);
  await db.query("INSERT INTO public.clients(id,status,plan) VALUES($1,'payment-review','none')",[tenant]);
  await db.query(`INSERT INTO public.payments
    (id,client_id,reference_code,status,method,plan,currency,setup_amount,monthly_amount)
    VALUES($1,$2,$3,'pending','card','Starter','EUR',10,0)`,[paymentId,tenant,oid]);
  await db.query("INSERT INTO public.client_pilot_access(client_id,expires_at) VALUES($1,now()+interval '7 days')",[tenant]);

  writer=await db.connect();observer=await db.connect();
  const writerPid=(await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  await writer.query('BEGIN ISOLATION LEVEL READ COMMITTED');writerOpen=true;
  await writer.query(PILOT_LOCK_SQL,[tenant]);
  await writer.query('UPDATE public.client_pilot_access SET revoked_at=clock_timestamp() WHERE client_id=$1',[tenant]);
  let cardPid=null;
  const trackedPool={
   query:(...args)=>db.query(...args),
   async connect(){
    const tx=await db.connect();
    cardPid=(await tx.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    return tx;
   }
  };
  // Capture the result rather than allowing a rejected pending Promise to leak.
  pending=confirmCardPaymentLockedReview(trackedPool,oid)
   .then(value=>({ok:true,value}),error=>({ok:false,error}));
  let observed=false;
  for(let i=0;i<160;i++){
   if(cardPid){
    const rows=(await observer.query(
      'SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[cardPid])).rows;
    if(rows[0]?.wait_event_type==='Lock'){observed=true;break;}
   }
   await pause(25);
  }
  // Unblock the pending card callback even when observation failed.
  await writer.query('COMMIT');writerOpen=false;
  const result=await pending;pending=null;
  assert.equal(observed,true,'independent card connection must wait for tenant lock');
  assert.notEqual(cardPid,writerPid,'must exercise two PostgreSQL backends');
  if(!result.ok)throw result.error;
  assert.equal(result.value.status,'paid');
  const state=(await observer.query(`SELECT
    (SELECT revoked_at IS NOT NULL FROM public.client_pilot_access WHERE client_id=$1) AS revoked,
    (SELECT status FROM public.payments WHERE id=$2) AS payment_status,
    (SELECT status FROM public.clients WHERE id=$1) AS account_status`,[tenant,paymentId])).rows[0];
  assert.equal(state.revoked,true,'payment callback cannot silently regrant a revoked pilot');
  assert.equal(state.payment_status,'paid');
  assert.equal(state.account_status,'active');
 }finally{
  if(writerOpen)await writer.query('ROLLBACK').catch(()=>{});
  if(pending)await pending.catch(()=>{});
  observer?.release();writer?.release();
  // Do not FORCE-terminate PostgreSQL backends: parallel CI teardown can
  // otherwise emit an uncaught 57P01 error after node:test has finished.
  // All pending callbacks, pinned clients and pooled clients must drain first.
  if(db)await db.end();
  if(created)await admin.query('DROP DATABASE IF EXISTS "'+name+'"');
  await admin.end();
 }
});

test('reverse order: committed card activation releases lock before revocation',{
 skip:!url?'requires disposable CI PostgreSQL service':false,timeout:30000
},async()=>{
 const admin=new Pool({connectionString:url,max:2,connectionTimeoutMillis:2500});
 const name='ci_card_'+randomUUID().replaceAll('-','');
 let created=false,db=null,revoker=null,observer=null,revokerOpen=false;
 let releaseCard;
 const cardBarrier=new Promise(resolve=>{releaseCard=resolve;});
 let cardStarted;
 const cardAtUpdate=new Promise(resolve=>{cardStarted=resolve;});
 let pendingCard=null,pendingRevoke=null;
 try{
  await admin.query('CREATE DATABASE "'+name+'"');created=true;
  const target=new URL(url);target.pathname='/'+name;
  db=new Pool({connectionString:target.toString(),max:4,connectionTimeoutMillis:2500});
  const tenant=randomUUID(),paymentId=randomUUID(),oid='cardreverse98765';
  await db.query("CREATE TABLE public.clients(id uuid PRIMARY KEY,status text NOT NULL,plan text)");
  await db.query(`CREATE TABLE public.payments(
    id uuid PRIMARY KEY,client_id uuid NOT NULL REFERENCES public.clients(id),
    reference_code text NOT NULL,status text NOT NULL,method text NOT NULL,
    paid_at timestamptz,plan text,currency text,setup_amount numeric,
    monthly_amount numeric,created_at timestamptz DEFAULT now(),
    reported_at timestamptz)`);
  await db.query(`CREATE TABLE public.client_pilot_access(
    client_id uuid PRIMARY KEY REFERENCES public.clients(id),
    revoked_at timestamptz,expires_at timestamptz)`);
  await db.query("INSERT INTO public.clients(id,status,plan) VALUES($1,'payment-review','none')",[tenant]);
  await db.query(`INSERT INTO public.payments
    (id,client_id,reference_code,status,method,plan,currency,setup_amount,monthly_amount)
    VALUES($1,$2,$3,'pending','card','Starter','EUR',10,0)`,[paymentId,tenant,oid]);
  await db.query("INSERT INTO public.client_pilot_access(client_id,expires_at) VALUES($1,now()+interval '7 days')",[tenant]);

  let cardPid;
  const pool={
   query:(...args)=>db.query(...args),
   async connect(){
    const actual=await db.connect();
    cardPid=(await actual.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    return {
     release:()=>actual.release(),
     async query(sql,args){
      // The card transaction holds its advisory lock until released here.
      if(sql.includes('UPDATE public.payments')){
       cardStarted();
       await cardBarrier;
      }
      return actual.query(sql,args);
     }
    };
   }
  };
  pendingCard=confirmCardPaymentLockedReview(pool,oid)
   .then(value=>({ok:true,value}),error=>({ok:false,error}));
  // Bounded wait to avoid hanging on a broken precondition.
  await Promise.race([cardAtUpdate,new Promise((_,reject)=>setTimeout(
   ()=>reject(Error('card-did-not-reach-locked-update')),4500))]);
  revoker=await db.connect();observer=await db.connect();
  const revokerPid=(await revoker.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  assert.notEqual(revokerPid,cardPid);
  await revoker.query('BEGIN ISOLATION LEVEL READ COMMITTED');revokerOpen=true;
  await revoker.query("SET LOCAL lock_timeout = '5000ms'");
  pendingRevoke=(async()=>{
   await revoker.query(PILOT_LOCK_SQL,[tenant]);
   await revoker.query('UPDATE public.client_pilot_access SET revoked_at=clock_timestamp() WHERE client_id=$1',[tenant]);
   await revoker.query('COMMIT');revokerOpen=false;
  })().then(()=>({ok:true}),error=>({ok:false,error}));
  let observed=false;
  for(let i=0;i<160;i++){
   const rows=(await observer.query(
    'SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[revokerPid])).rows;
   if(rows[0]?.wait_event_type==='Lock'){observed=true;break;}
   await pause(25);
  }
  releaseCard();
  const cardResult=await pendingCard;pendingCard=null;
  if(!cardResult.ok)throw cardResult.error;
  const revokeResult=await pendingRevoke;pendingRevoke=null;
  if(!revokeResult.ok)throw revokeResult.error;
  assert.equal(observed,true,'revoker must wait for card-held tenant lock');
  assert.equal(cardResult.value.status,'paid');
  const final=(await observer.query(`SELECT
    (SELECT revoked_at IS NOT NULL FROM public.client_pilot_access WHERE client_id=$1) AS revoked,
    (SELECT status FROM public.clients WHERE id=$1) AS account_status`,[tenant])).rows[0];
  assert.equal(final.revoked,true);
  assert.equal(final.account_status,'active');
 }finally{
  releaseCard();
  if(pendingCard)await pendingCard.catch(()=>{});
  if(pendingRevoke)await pendingRevoke.catch(()=>{});
  if(revokerOpen)await revoker.query('ROLLBACK').catch(()=>{});
  observer?.release();revoker?.release();
  // Close every tracked connection before dropping the disposable DB.
  // FORCE can asynchronously terminate a still-running client and emit
  // uncaught PostgreSQL 57P01 in this or another concurrently running test.
  if(db)await db.end();
  if(created)await admin.query('DROP DATABASE IF EXISTS "'+name+'"');
  await admin.end();
 }
});
