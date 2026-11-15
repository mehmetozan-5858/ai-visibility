import test from 'node:test';
import assert from 'node:assert/strict';
import {PILOT_LOCK_SQL,REPORT_LOCK_SQL,acquirePilotAdvisoryLockReview,withPilotWriteLockReview} from '../lib/portal-pilot-advisory-lock-review.mjs';
import {readFile} from 'node:fs/promises';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';

test('report and grant/revoke must derive the identical advisory lock namespace',()=>{
 assert.match(PILOT_LOCK_SQL,/pg_advisory_xact_lock/);
 assert.match(REPORT_LOCK_SQL,/pg_advisory_xact_lock/);
 assert.match(PILOT_LOCK_SQL,/portal-pilot-lock-v1:/);
 assert.match(REPORT_LOCK_SQL,/portal-pilot-lock-v1:/);
 assert.match(PILOT_LOCK_SQL,/hashtextextended\('portal-pilot-lock-v1:'\|\|\$1::uuid::text,0\)/);
 assert.match(REPORT_LOCK_SQL,/hashtextextended\('portal-pilot-lock-v1:'\|\|p_tenant::text,0\)/);
 assert.doesNotMatch(PILOT_LOCK_SQL,/pg_advisory_lock\(/);
 assert.doesNotMatch(PILOT_LOCK_SQL,/\bUPDATE\b|\bGRANT\b|\bINSERT\b/);
});

test('advisory lock helper binds only validated, normalized tenant UUIDs',async()=>{
 const calls=[];
 const tx={query:async(sql,args)=>{calls.push({sql,args});return {rows:[]}}};
 assert.equal(await acquirePilotAdvisoryLockReview(tx,A.toUpperCase()),A);
 assert.equal(await acquirePilotAdvisoryLockReview(tx,B),B);
 assert.deepEqual(calls,[{sql:PILOT_LOCK_SQL,args:[A]},{sql:PILOT_LOCK_SQL,args:[B]}]);
 for(const value of [null,'','invalid','11111111-1111-1111-1111-111111111111']){
  await assert.rejects(acquirePilotAdvisoryLockReview(tx,value),/pilot-lock-unavailable/);
 }
 assert.equal(calls.length,2,'invalid tenant must not touch SQL');
 await assert.rejects(acquirePilotAdvisoryLockReview(null,A),/pilot-lock-unavailable/);
});

test('pilot writers are connected but the report and account writers are not yet live-ready',async()=>{
 const migration=await readFile(new URL('../migrations/portal-one-time-signed-report-review.sql',import.meta.url),'utf8');
 const alt=await readFile(new URL('../migrations/portal-one-time-advisory-report-review.sql',import.meta.url),'utf8');
 const pilot=await readFile(new URL('../lib/pilot-access.js',import.meta.url),'utf8');
 assert.match(migration,/FOR SHARE/);
 assert.match(alt,/pg_advisory_xact_lock/);
 assert.match(pilot,/grantPilotWithLockReview\(await pool\(\),clientId,email,days,reason\)/);
 assert.match(pilot,/revokePilotWithLockReview\(await pool\(\),clientId\)/);
 // Pilot writes alone cannot protect an old live report reader or
 // legacy account status/payment/admin writers. Release is still HOLD.
});

test('pilot writer locks the verified tenant before mutation and commits on success',async()=>{
 const calls=[];let releases=0;
 const tx={query:async(sql,args)=>{calls.push({sql,args});return {rows:[]}},release:()=>{releases++}};
 const result=await withPilotWriteLockReview({connect:async()=>tx},A,async(conn,tenant)=>{
  assert.equal(conn,tx);
  assert.equal(tenant,A);
  assert.equal(calls[3].sql,PILOT_LOCK_SQL);
  await conn.query('UPDATE public.client_pilot_access SET revoked_at=clock_timestamp() WHERE client_id=$1',[tenant]);
  return 'review-ok';
 });
 assert.equal(result,'review-ok');
 assert.deepEqual(calls.map(x=>x.sql),[
  'BEGIN ISOLATION LEVEL READ COMMITTED',
  "SET LOCAL lock_timeout = '2500ms'",
  "SET LOCAL statement_timeout = '10000ms'",
  PILOT_LOCK_SQL,
  'UPDATE public.client_pilot_access SET revoked_at=clock_timestamp() WHERE client_id=$1',
  'COMMIT'
 ]);
 assert.deepEqual(calls[3].args,[A]);
 assert.equal(releases,1);
});

test('pilot writer lock errors and write errors roll back without COMMIT or leaked connection',async()=>{
 for(const stage of ['lock','write']){
  const calls=[];let releases=0;
  const tx={query:async(sql,args)=>{
   calls.push(sql);
   if(stage==='lock'&&sql===PILOT_LOCK_SQL)throw Object.assign(Error('lock timeout'),{code:'55P03'});
   return {rows:[]};
  },release:()=>{releases++}};
  await assert.rejects(
   withPilotWriteLockReview({connect:async()=>tx},A,async()=>{
    if(stage==='write')throw Error('audit transaction failed');
    throw Error('unexpected callback');
   }),stage==='lock'?/lock timeout/:/audit transaction failed/
  );
  assert.equal(calls.at(-1),'ROLLBACK');
  assert.equal(calls.includes('COMMIT'),false);
  assert.equal(releases,1);
 }
});

test('invalid identity or writer cannot acquire or mutate SQL connections',async()=>{
 let acquired=0;
 const pool={connect:async()=>{acquired++;throw Error('unexpected SQL')}};
 await assert.rejects(withPilotWriteLockReview(pool,'not-a-uuid',async()=>{}),/pilot-writer-tenant-invalid/);
 await assert.rejects(withPilotWriteLockReview(pool,A,null),/pilot-writer-transaction-unavailable/);
 assert.equal(acquired,0);
});
