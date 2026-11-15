import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';

// Disposable PostgreSQL CI ONLY. The fixture intentionally does NOT call the
// live report RPC: this verifies the required lock + entitlement SQL semantics,
// NOT a signed production customer session or SECURITY DEFINER acceptance.
const url=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
if(url){
 const target=new URL(url);
 if(!['postgres:','postgresql:'].includes(target.protocol)||
  !['localhost','127.0.0.1'].includes(target.hostname)||
  target.pathname!=='/fixture'||decodeURIComponent(target.username)!=='fixture')
  throw Error('disposable-ci-postgres-only');
}
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const table='ci_portal_report_entitlement_state_fixture';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function check(tx,tenant){
 await tx.query(PILOT_LOCK_SQL,[tenant]);
 const {rows}=await tx.query(`SELECT account_active AND revoked_at IS NULL
   AND expires_at>clock_timestamp() AS allowed
   FROM public.${table} WHERE client_id=$1`,[tenant]);
 return rows[0]?.allowed===true;
}
test('isolated PostgreSQL report gate rejects revocation, expiry and suspension after lock',{
 skip:!url?'requires disposable CI PostgreSQL':false,timeout:25000
},async()=>{
 const pool=new Pool({connectionString:url,max:4,connectionTimeoutMillis:2500});
 const reader=await pool.connect(),writer=await pool.connect(),observer=await pool.connect();
 let reading=false,writing=false;
 const begin=async(tx)=>tx.query('BEGIN ISOLATION LEVEL READ COMMITTED');
 try{
  assert.notEqual((await reader.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
   (await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
  await observer.query(`CREATE TABLE public.${table} (
   client_id uuid PRIMARY KEY,account_active boolean NOT NULL,
   expires_at timestamptz NOT NULL,revoked_at timestamptz)`);
  await observer.query(`INSERT INTO public.${table}
   (client_id,account_active,expires_at) VALUES
   ($1,true,clock_timestamp()+interval '1 hour'),
   ($2,true,clock_timestamp()-interval '1 second')`,[A,B]);

  // A verified session from yesterday cannot override CURRENT expired pilot.
  await begin(reader);reading=true;
  assert.equal(await check(reader,B),false);
  await reader.query('COMMIT');reading=false;
  // Suspend account: even an unexpired pilot must deny.
  await observer.query(`UPDATE public.${table} SET account_active=false WHERE client_id=$1`,[A]);
  await begin(reader);reading=true;
  assert.equal(await check(reader,A),false);
  await reader.query('COMMIT');reading=false;
  await observer.query(`UPDATE public.${table} SET account_active=true WHERE client_id=$1`,[A]);
  // Writer commits revocation while reader blocks on the SAME advisory lock.
  await begin(writer);writing=true;
  await writer.query(PILOT_LOCK_SQL,[A]);
  await writer.query(`UPDATE public.${table} SET revoked_at=clock_timestamp() WHERE client_id=$1`,[A]);
  await begin(reader);reading=true;
  await reader.query("SET LOCAL lock_timeout = '5000ms'");
  const pending=check(reader,A);
  const pid=(await observer.query("SELECT pid FROM pg_stat_activity WHERE query ILIKE '%pg_advisory_xact_lock%' AND wait_event_type='Lock' LIMIT 1")).rows;
  // Wait for genuine server-side contention, not timing alone.
  let observed=pid.length>0;
  const started=Date.now();
  while(!observed&&Date.now()-started<3000){
   observed=(await observer.query(`SELECT 1 FROM pg_stat_activity
    WHERE wait_event_type='Lock' AND query ILIKE '%pg_advisory_xact_lock%' LIMIT 1`)).rows.length>0;
   if(!observed)await pause(25);
  }
  assert.equal(observed,true,'reader must genuinely wait for revocation');
  await writer.query('COMMIT');writing=false;
  assert.equal(await pending,false);
  await reader.query('COMMIT');reading=false;
  // Re-grant is a distinct future event, not recovery of a revoked session.
  assert.equal((await observer.query(`SELECT revoked_at IS NOT NULL AS revoked
   FROM public.${table} WHERE client_id=$1`,[A])).rows[0].revoked,true);
 }finally{
  if(reading)await reader.query('ROLLBACK').catch(()=>{});
  if(writing)await writer.query('ROLLBACK').catch(()=>{});
  await observer.query(`DROP TABLE IF EXISTS public.${table}`).catch(()=>{});
  reader.release();writer.release();observer.release();await pool.end();
 }
});
