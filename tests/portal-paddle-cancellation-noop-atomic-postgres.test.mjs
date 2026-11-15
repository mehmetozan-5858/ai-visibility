import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {withPilotWriteLockReview} from '../lib/portal-pilot-advisory-lock-review.mjs';
import {applyOwnedPaddleSubscriptionTransitionReview}
 from '../lib/portal-paddle-subscription-transition-review.mjs';

// Disposable GitHub Actions PostgreSQL ONLY. No Neon or customer database.
// Exercise the actual review callback with SQL redirected to a temporary schema.
const url=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
if(url){
 const u=new URL(url);
 if(!['postgres:','postgresql:'].includes(u.protocol)||
    !['localhost','127.0.0.1'].includes(u.hostname)||
    u.pathname!=='/fixture'||decodeURIComponent(u.username)!=='fixture')
  throw Error('disposable-ci-postgres-only');
}
const schema='ci_paddle_cancel_noop_atomic_review';
const A='11111111-1111-4111-8111-111111111111';
const P='22222222-2222-4222-8222-222222222222';
const event={
 type:'subscription.canceled',status:'canceled',
 id:'evt_syntheticcancel123',entityId:'sub_review123',
 clientId:A,paymentId:P,occurredAt:'2026-11-15T13:00:00Z'
};
test('real PostgreSQL rolls back unaccepted cancellation, but commits already-suspended no-op',{
 skip:!url?'requires disposable PostgreSQL CI only':false,timeout:25000
},async()=>{
 const pool=new Pool({connectionString:url,max:2,connectionTimeoutMillis:2500});
 const admin=await pool.connect();
 try{
  await admin.query('CREATE SCHEMA '+schema);
  await admin.query('CREATE TABLE '+schema+'.clients(id uuid PRIMARY KEY,status text NOT NULL)');
  await admin.query('CREATE TABLE '+schema+'.payments(id uuid PRIMARY KEY,client_id uuid NOT NULL)');
  await admin.query('CREATE TABLE '+schema+'.paddle_live_subscription_links(subscription_id text PRIMARY KEY,payment_id uuid NOT NULL,client_id uuid NOT NULL)');
  await admin.query('CREATE TABLE '+schema+'.paddle_live_entities(entity_id text PRIMARY KEY,event_type text NOT NULL,status text NOT NULL,payment_id uuid NOT NULL,client_id uuid NOT NULL,occurred_at timestamptz NOT NULL,event_id text NOT NULL,updated_at timestamptz NOT NULL DEFAULT NOW())');
  await admin.query('CREATE TABLE '+schema+'.client_activity(id uuid PRIMARY KEY,client_id uuid,event_type text,title text,detail text,metadata jsonb)');
  await admin.query('INSERT INTO '+schema+'.payments VALUES($1,$2)',[P,A]);
  await admin.query("INSERT INTO "+schema+".paddle_live_subscription_links VALUES('sub_review123',$1,$2)",[P,A]);
  // Preserve the real helper transaction and advisory locking, but use
  // the isolated schema instead of any public application table.
  const wrapper={
   async connect(){
    const c=await pool.connect();
    return {query:(sql,args)=>c.query(sql.replaceAll('public.',schema+'.'),args),
     release:()=>c.release()};
   }
  };
  const transition=()=>withPilotWriteLockReview(wrapper,A,tx=>
   applyOwnedPaddleSubscriptionTransitionReview(tx,event));
  const current=async()=>admin.query('SELECT event_id FROM '+schema+'.paddle_live_entities');

  // A linked payment without a customer row is an inconsistent state.
  // Accepting a zero-row UPDATE would consume the cancellation event.
  await assert.rejects(transition(),/review-cancellation-unaccepted-rollback-current-event/);
  assert.equal((await current()).rowCount,0,'event must roll back if customer is missing');

  await admin.query("INSERT INTO "+schema+".clients VALUES($1,'payment-review')",[A]);
  const already=await transition();
  assert.deepEqual(already,{accessChanged:false,entityAdvanced:true});
  assert.equal((await current()).rows[0].event_id,event.id);
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM '+schema+'.client_activity')).rows[0].n,0,
   'already-suspended account must not gain duplicate activity');
  assert.equal((await admin.query('SELECT status FROM '+schema+'.clients WHERE id=$1',[A])).rows[0].status,'payment-review');

  // A newer cancellation of an active account must actually suspend it.
  await admin.query("UPDATE "+schema+".clients SET status='active' WHERE id=$1",[A]);
  const next={...event,id:'evt_syntheticcancelnew456',occurredAt:'2026-11-15T14:00:00Z'};
  const updated=await withPilotWriteLockReview(wrapper,A,tx=>
   applyOwnedPaddleSubscriptionTransitionReview(tx,next));
  assert.deepEqual(updated,{accessChanged:true,clientStatus:'payment-review',entityAdvanced:true});
  assert.equal((await current()).rows[0].event_id,next.id);
  assert.equal((await admin.query('SELECT status FROM '+schema+'.clients WHERE id=$1',[A])).rows[0].status,'payment-review');
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM '+schema+'.client_activity')).rows[0].n,1);
 }finally{
  await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE').catch(()=>{});
  admin.release();await pool.end();
 }
});
