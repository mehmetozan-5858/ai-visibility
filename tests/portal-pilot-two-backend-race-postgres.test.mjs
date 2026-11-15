import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';

// Live two-backend contention only against the disposable PostgreSQL CI
// service. No Neon, production/customer URLs, secrets or external DB writes.
const url=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
// Only the disposable local GitHub CI PostgreSQL service is eligible.
// A misconfigured Neon/customer/production URL must fail before any SQL.
if(url){
 const target=new URL(url);
 if(!['postgres:','postgresql:'].includes(target.protocol)||
  !['localhost','127.0.0.1'].includes(target.hostname)||
  target.pathname!=='/fixture'||decodeURIComponent(target.username)!=='fixture')
  throw Error('disposable-ci-postgres-only');
}
// Avoid shared advisory-lock keys when GitHub runs multiple CI tests in parallel.
const A=randomUUID();
const B=randomUUID();
const fixture='ci_portal_pilot_lock_fixture';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitUntilLockWait(observer,pid,limitMs=4000){
 const started=Date.now();
 while(Date.now()-started<limitMs){
  const {rows}=await observer.query(`SELECT wait_event_type,wait_event,state
    FROM pg_stat_activity WHERE pid=$1`,[pid]);
  if(rows[0]?.wait_event_type==='Lock')return rows[0];
  await pause(25);
 }
 throw Error('independent-backend-contention-not-observed');
}

test('two independent PostgreSQL backends serialize revocation and report reads', {
 skip:!url?'requires isolated disposable CI postgres':false,timeout:25000
},async()=>{
 const pool=new Pool({connectionString:url,max:4,connectionTimeoutMillis:2500});
 const writer=await pool.connect();
 const reader=await pool.connect();
 const observer=await pool.connect();
 let writerOpen=false,readerOpen=false;
 const beginWriter=async()=>{await writer.query('BEGIN ISOLATION LEVEL READ COMMITTED');writerOpen=true;};
 const beginReader=async()=>{await reader.query('BEGIN ISOLATION LEVEL READ COMMITTED');readerOpen=true;};
 const endWriter=async(command='COMMIT')=>{await writer.query(command);writerOpen=false;};
 const endReader=async(command='COMMIT')=>{await reader.query(command);readerOpen=false;};
 const take=(client,id)=>client.query(PILOT_LOCK_SQL,[id]);
 const state=(client,id)=>client.query(`SELECT revoked FROM public.${fixture} WHERE client_id=$1`,[id]);
 try{
  const writerPid=(await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  const readerPid=(await reader.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  assert.notEqual(writerPid,readerPid,'real independent server backends required');
  await observer.query(`CREATE TABLE public.${fixture}
    (client_id uuid PRIMARY KEY,revoked boolean NOT NULL DEFAULT false)`);
  await observer.query(`INSERT INTO public.${fixture}(client_id) VALUES($1),($2)`,[A,B]);

  // A: revocation acquires lock first. A report must wait, then see
  // committed revocation instead of granting stale access.
  await beginWriter();
  await take(writer,A);
  await writer.query(`UPDATE public.${fixture} SET revoked=true WHERE client_id=$1`,[A]);
  await beginReader();
  await reader.query("SET LOCAL lock_timeout = '5000ms'");
  const pendingReport=take(reader,A);
  await waitUntilLockWait(observer,readerPid);
  await endWriter();
  await pendingReport;
  assert.equal((await state(reader,A)).rows[0].revoked,true);
  await endReader();

  // B: report locks before revocation, reads active entitlement, and
  // the revoker cannot complete until the report commits.
  await observer.query(`UPDATE public.${fixture} SET revoked=false WHERE client_id=$1`,[A]);
  await beginReader();
  await take(reader,A);
  assert.equal((await state(reader,A)).rows[0].revoked,false);
  await beginWriter();
  await writer.query("SET LOCAL lock_timeout = '5000ms'");
  const pendingRevoke=(async()=>{
   await take(writer,A);
   await writer.query(`UPDATE public.${fixture} SET revoked=true WHERE client_id=$1`,[A]);
   await endWriter();
  })();
  await waitUntilLockWait(observer,writerPid);
  assert.equal((await observer.query(`SELECT revoked FROM public.${fixture} WHERE client_id=$1`,[A])).rows[0].revoked,false);
  await endReader();
  await pendingRevoke;
  assert.equal((await observer.query(`SELECT revoked FROM public.${fixture} WHERE client_id=$1`,[A])).rows[0].revoked,true);

  // C: a rolled-back revocation must not affect the waiting reader.
  await observer.query(`UPDATE public.${fixture} SET revoked=false WHERE client_id=$1`,[A]);
  await beginWriter();
  await take(writer,A);
  await writer.query(`UPDATE public.${fixture} SET revoked=true WHERE client_id=$1`,[A]);
  await beginReader();
  await reader.query("SET LOCAL lock_timeout = '5000ms'");
  const pendingRollbackRead=take(reader,A);
  await waitUntilLockWait(observer,readerPid);
  await endWriter('ROLLBACK');
  await pendingRollbackRead;
  assert.equal((await state(reader,A)).rows[0].revoked,false);
  await endReader();

  // D: a different tenant key doesn't contend. Lock timeouts must
  // reject/rollback, and neither connection may retain transaction locks.
  await beginWriter();
  await take(writer,A);
  await beginReader();
  const other=await reader.query(`SELECT pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended('portal-pilot-lock-v1:'||$1::uuid::text,0)) AS acquired`,[B]);
  assert.equal(other.rows[0].acquired,true);
  await reader.query("SET LOCAL lock_timeout = '150ms'");
  await assert.rejects(take(reader,A),err=>err.code==='55P03');
  await endReader('ROLLBACK');
  await endWriter();
  await beginReader();
  await take(reader,A);
  await endReader();
 }finally{
  if(readerOpen)await reader.query('ROLLBACK').catch(()=>{});
  if(writerOpen)await writer.query('ROLLBACK').catch(()=>{});
  await observer.query(`DROP TABLE IF EXISTS public.${fixture}`).catch(()=>{});
  observer.release();reader.release();writer.release();
  await pool.end();
 }
});
