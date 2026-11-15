import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {grantPilotWithLockReview,revokePilotWithLockReview} from '../lib/portal-pilot-writes-review.mjs';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';

// Integration evidence, disposable PostgreSQL CI only. No production or Neon
// connections; table name is intentionally unique to this fixture.
const url=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const txTable='ci_portal_pilot_access_review';
const activityTable='ci_portal_pilot_activity_review';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('review-only locked grant/revoke maintain atomic SQL and real two-backend contention',{
 skip:!url?'requires disposable PostgreSQL CI':false,timeout:30000
},async()=>{
 const pool=new Pool({connectionString:url,max:5,connectionTimeoutMillis:2500});
 const reader=await pool.connect(),monitor=await pool.connect();
 let reading=false;
 try{
  // Use temporary isolated schemas by setting search_path on the writer
  // connections? Review functions schema-qualify public, so use their exact
  // fixture table names via a transaction-local shadow? Instead create
  // disposable public tables matching the review-only SQL. No other tests
  // use these names in the CI database.
  await monitor.query(`CREATE TABLE public.client_pilot_access(
   client_id uuid PRIMARY KEY,email text NOT NULL,reason text NOT NULL,
   expires_at timestamptz NOT NULL,revoked_at timestamptz)`);
  await monitor.query(`CREATE TABLE public.client_activity(
   id uuid PRIMARY KEY,client_id uuid,event_type text,title text,
   detail text,metadata jsonb)`);
  assert.deepEqual(await grantPilotWithLockReview(pool,A,'a@example.test',7,'Synthetic integration reason'),{granted:true});
  assert.equal((await monitor.query('SELECT count(*)::int AS n FROM public.client_pilot_access')).rows[0].n,1);
  assert.equal((await monitor.query('SELECT count(*)::int AS n FROM public.client_activity WHERE event_type=$1',['pilot-granted'])).rows[0].n,1);

  // Two independent backends. The report-side connection takes the shared
  // lock first; the trusted revoke writer must block until that transaction ends.
  const readerPid=(await reader.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  await reader.query('BEGIN ISOLATION LEVEL READ COMMITTED');reading=true;
  await reader.query(PILOT_LOCK_SQL,[A]);
  let revokeCompleted=false;
  const pending=revokePilotWithLockReview(pool,A).then(r=>{revokeCompleted=true;return r});
  let sawLock=false;
  const started=Date.now();
  while(Date.now()-started<4000){
   const {rows}=await monitor.query(`SELECT pid,wait_event_type FROM pg_stat_activity
     WHERE pid<>$1 AND wait_event_type='Lock' AND query ILIKE '%pg_advisory_xact_lock%'`,[readerPid]);
   if(rows.length){sawLock=true;break}
   await wait(25);
  }
  assert.equal(sawLock,true,'actual independent writer lock wait was not observed');
  assert.equal(revokeCompleted,false);
  assert.equal((await reader.query('SELECT revoked_at IS NOT NULL AS revoked FROM public.client_pilot_access WHERE client_id=$1',[A])).rows[0].revoked,false);
  await reader.query('COMMIT');reading=false;
  assert.deepEqual(await pending,{revoked:true});
  assert.equal((await monitor.query('SELECT revoked_at IS NOT NULL AS revoked FROM public.client_pilot_access WHERE client_id=$1',[A])).rows[0].revoked,true);
  assert.equal((await monitor.query('SELECT count(*)::int AS n FROM public.client_activity WHERE event_type=$1',['pilot-revoked'])).rows[0].n,1);

  // Force an audit failure in the same transaction: pilot mutation must roll back.
  await monitor.query(`ALTER TABLE public.client_activity
     ADD CONSTRAINT ci_review_reject_grants CHECK (event_type <> 'pilot-granted')`);
  await assert.rejects(grantPilotWithLockReview(pool,B,'b@example.test',7,'Synthetic integration reason'),
   e=>e.code==='23514');
  assert.equal((await monitor.query('SELECT count(*)::int AS n FROM public.client_pilot_access WHERE client_id=$1',[B])).rows[0].n,0,
   'failed audit must roll back pilot grant');
  assert.equal((await monitor.query('SELECT count(*)::int AS n FROM public.client_activity WHERE client_id=$1',[B])).rows[0].n,0);

  // A no-op revoke must not fabricate an activity entry.
  assert.deepEqual(await revokePilotWithLockReview(pool,A),{revoked:false});
  assert.equal((await monitor.query('SELECT count(*)::int AS n FROM public.client_activity WHERE event_type=$1',['pilot-revoked'])).rows[0].n,1);
 }finally{
  if(reading)await reader.query('ROLLBACK').catch(()=>{});
  await monitor.query('DROP TABLE IF EXISTS public.client_activity').catch(()=>{});
  await monitor.query('DROP TABLE IF EXISTS public.client_pilot_access').catch(()=>{});
  monitor.release();reader.release();await pool.end();
 }
});
