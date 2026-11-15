import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {Pool} from 'pg';
import {dispatchSignedPaddleEventWithTenantLockReview}
 from '../lib/portal-paddle-locked-dispatch-review.mjs';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';

// REVIEW ONLY. Only disposable localhost PostgreSQL, synthetic signature,
// synthetic tenant and writer. No Neon, customer data or live Paddle.
const source=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
if(source){
 const u=new URL(source);
 if(!['postgres:','postgresql:'].includes(u.protocol)||
  !['localhost','127.0.0.1'].includes(u.hostname)||
  u.pathname!=='/fixture'||decodeURIComponent(u.username)!=='fixture')
  throw Error('disposable-ci-postgres-only');
}
const A='11111111-1111-4111-8111-111111111111';
const P='22222222-2222-4222-8222-222222222222';
const secret='synthetic-only-paddle-review-secret-1234';
const name='ci_paddle_dispatch_lock_review';
function signed(){
 const raw=JSON.stringify({event_id:'evt_lockreview123',
  event_type:'subscription.canceled',occurred_at:'2026-11-15T08:00:00Z',
  data:{id:'sub_lockreview123',status:'canceled',
   custom_data:{client_id:A,payment_id:P}}});
 const timestamp=String(Math.floor(Date.now()/1000));
 const h1=createHmac('sha256',secret).update(timestamp+':'+raw).digest('hex');
 return {raw,header:'ts='+timestamp+';h1='+h1,secret};
}
test('real PostgreSQL webhook writer waits on tenant lock, then rolls back on timeout',{
 skip:!source?'requires disposable CI PostgreSQL':false,timeout:30000
},async()=>{
 const admin=new Pool({connectionString:source,max:1,connectionTimeoutMillis:2500});
 const target=new URL(source);target.pathname='/'+name;
 let created=false,db;
 try{
  await admin.query('CREATE DATABASE '+name);created=true;
  db=new Pool({connectionString:target.toString(),max:3,connectionTimeoutMillis:2500,query_timeout:8000});
  await db.query('CREATE TABLE public.review_access(client_id uuid PRIMARY KEY,status text NOT NULL)');
  await db.query("INSERT INTO public.review_access VALUES($1,'active')",[A]);
  let writes=0;
  const dispatch=({header,...rest}=signed())=>dispatchSignedPaddleEventWithTenantLockReview({
   pool:db,header,...rest,write:async(tx,event)=>{
    writes++;
    assert.equal(event.clientId,A);
    await tx.query("UPDATE public.review_access SET status='payment-review' WHERE client_id=$1",[A]);
    return {reviewOnly:true};
   }
  });
  // Authentication failures cannot acquire a database connection or mutate.
  await assert.rejects(dispatch({raw:signed().raw,header:'ts=1;h1='+('0'.repeat(64)),secret}),
   /review-webhook-signature-required/);
  assert.equal(writes,0);
  const holder=await db.connect();
  try{
   await holder.query('BEGIN ISOLATION LEVEL READ COMMITTED');
   await holder.query(PILOT_LOCK_SQL,[A]);
   await assert.rejects(dispatch(),e=>e?.code==='55P03');
   assert.equal(writes,0,'writer never executes before successful tenant lock');
  }finally{
   await holder.query('ROLLBACK').catch(()=>{});
   holder.release();
  }
  assert.equal((await db.query('SELECT status FROM public.review_access WHERE client_id=$1',[A])).rows[0].status,'active');
  assert.deepEqual(await dispatch(),{reviewOnly:true});
  assert.equal(writes,1);
  assert.equal((await db.query('SELECT status FROM public.review_access WHERE client_id=$1',[A])).rows[0].status,'payment-review');
  assert.equal((await db.query('SELECT 1 AS n')).rows[0].n,1);
 }finally{
  if(db)await db.end().catch(()=>{});
  if(created)await admin.query('DROP DATABASE '+name).catch(()=>{});
  await admin.end();
 }
});
