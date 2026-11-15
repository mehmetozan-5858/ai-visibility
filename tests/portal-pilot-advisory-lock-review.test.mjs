import test from 'node:test';
import assert from 'node:assert/strict';
import {PILOT_LOCK_SQL,REPORT_LOCK_SQL,acquirePilotAdvisoryLockReview} from '../lib/portal-pilot-advisory-lock-review.mjs';
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

test('advisory-lock alternate design is explicitly unwired until every writer is audited',async()=>{
 const migration=await readFile(new URL('../migrations/portal-one-time-signed-report-review.sql',import.meta.url),'utf8');
 const pilot=await readFile(new URL('../lib/pilot-access.js',import.meta.url),'utf8');
 assert.match(migration,/FOR SHARE/);
 assert.doesNotMatch(pilot,/acquirePilotAdvisoryLockReview/);
 // Keeping the original draft and grant/revoke code unchanged here is deliberate:
 // an advisory lock on only one side creates false confidence and is NOT safe.
});
