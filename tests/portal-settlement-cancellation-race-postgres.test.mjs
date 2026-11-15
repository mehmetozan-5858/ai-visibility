import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';

// REVIEW ONLY — disposable GitHub CI PostgreSQL service. This verifies the
// cooperative transaction ordering model, NOT signed Paddle webhook validity,
// production privileges or the actual customer/payment schema.
const url=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
const A='11111111-1111-4111-8111-111111111111';
const fixture='ci_portal_settlement_race_fixture_20261115';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitForLock(observer,pid,limit=4000){
 const started=Date.now();
 while(Date.now()-started<limit){
  const state=(await observer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0];
  if(state?.wait_event_type==='Lock')return;
  await sleep(25);
 }
 throw Error('settlement-race-lock-wait-not-observed');
}
test('two real SQL connections serialize signed-settlement activation versus cancellation',{
 skip:!url?'disposable PostgreSQL CI only':false,timeout:25000
},async()=>{
 const pool=new Pool({connectionString:url,max:3,connectionTimeoutMillis:2500});
 const a=await pool.connect(),b=await pool.connect(),observer=await pool.connect();
 let aOpen=false,bOpen=false;
 const beginA=async()=>{await a.query('BEGIN ISOLATION LEVEL READ COMMITTED');aOpen=true;await a.query("SET LOCAL lock_timeout = '7000ms'");};
 const beginB=async()=>{await b.query('BEGIN ISOLATION LEVEL READ COMMITTED');bOpen=true;await b.query("SET LOCAL lock_timeout = '7000ms'");};
 const endA=async()=>{await a.query('COMMIT');aOpen=false;};
 const endB=async()=>{await b.query('COMMIT');bOpen=false;};
 const lock=(conn)=>conn.query(PILOT_LOCK_SQL,[A]);
 const state=conn=>conn.query(`SELECT verified,active FROM public.${fixture} WHERE tenant_id=$1`,[A]);
 try{
  await observer.query(`CREATE TABLE public.${fixture}
    (tenant_id uuid PRIMARY KEY,verified boolean NOT NULL,active boolean NOT NULL)`);
  await observer.query(`INSERT INTO public.${fixture}(tenant_id,verified,active) VALUES($1,true,false)`,[A]);
  const aPid=(await a.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const bPid=(await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  assert.notEqual(aPid,bPid);

  // Cancellation wins first: activation must see committed invalidation.
  await beginB();await lock(b);
  await b.query(`UPDATE public.${fixture} SET verified=false,active=false WHERE tenant_id=$1`,[A]);
  await beginA();const pendingActivationLock=lock(a);
  await waitForLock(observer,aPid);
  await endB();await pendingActivationLock;
  const denied=(await state(a)).rows[0];
  assert.deepEqual(denied,{verified:false,active:false});
  await endA();

  // Activation wins first: the cancellation cannot complete while a read
  // holds the tenant advisory lock; after COMMIT cancellation closes access.
  await observer.query(`UPDATE public.${fixture} SET verified=true,active=false WHERE tenant_id=$1`,[A]);
  await beginA();await lock(a);
  assert.equal((await state(a)).rows[0].verified,true);
  await a.query(`UPDATE public.${fixture} SET active=true WHERE tenant_id=$1 AND verified=true`,[A]);
  await beginB();
  const pendingCancellation=(async()=>{
   await lock(b);
   await b.query(`UPDATE public.${fixture} SET verified=false,active=false WHERE tenant_id=$1`,[A]);
   await endB();
  })();
  await waitForLock(observer,bPid);
  assert.equal((await state(a)).rows[0].active,true);
  await endA();await pendingCancellation;
  assert.deepEqual((await state(observer)).rows[0],{verified:false,active:false});
 }finally{
  if(aOpen)await a.query('ROLLBACK').catch(()=>{});
  if(bOpen)await b.query('ROLLBACK').catch(()=>{});
  await observer.query(`DROP TABLE IF EXISTS public.${fixture}`).catch(()=>{});
  observer.release();a.release();b.release();await pool.end();
 }
});
