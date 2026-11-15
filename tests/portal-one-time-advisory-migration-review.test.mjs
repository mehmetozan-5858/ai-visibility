import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PILOT_LOCK_SQL,REPORT_LOCK_SQL,withPilotWriteLockReview}
 from '../lib/portal-pilot-advisory-lock-review.mjs';
const read=()=>readFile(new URL('../migrations/portal-one-time-advisory-report-review.sql',import.meta.url),'utf8');

test('unwired advisory report takes the SAME tenant-scoped lock before entitlement and nonce',async()=>{
 const s=await read();
 const fn=s.slice(s.indexOf('CREATE OR REPLACE FUNCTION'));
 const lock=fn.indexOf('pg_catalog.pg_advisory_xact_lock(');
 const status=fn.indexOf("c.status='active'");
 const pilot=fn.indexOf('public.client_pilot_access pilot');
 const nonce=fn.indexOf('INSERT INTO portal_authz.consumed_claims');
 assert.ok(lock>=0&&status>lock&&pilot>lock&&nonce>pilot);
 assert.match(fn,/hashtextextended\('portal-pilot-lock-v1:'\|\|p_tenant::text,0\)/);
 assert.match(REPORT_LOCK_SQL,/hashtextextended\('portal-pilot-lock-v1:'\|\|p_tenant::text,0\)/);
 assert.match(PILOT_LOCK_SQL,/hashtextextended\('portal-pilot-lock-v1:'\|\|\$1::uuid::text,0\)/);
 assert.match(fn,/pilot\.revoked_at IS NULL/);
 assert.match(fn,/pilot\.expires_at>clock_timestamp\(\)/);
 assert.doesNotMatch(fn,/FOR SHARE|FOR UPDATE|FOR KEY SHARE/);
 assert.match(fn,/ON CONFLICT\(claim_id\) DO NOTHING/);
 assert.match(fn,/WHERE c\.client_id=p_tenant/);
});

test('alternative remains fail-closed and neither auto-grants nor activates a paid path',async()=>{
 const s=await read();
 assert.match(s,/REVIEW ONLY/);
 assert.match(s,/NEVER AUTO-APPLY/);
 assert.match(s,/SECURITY DEFINER SET search_path=pg_catalog/);
 assert.match(s,/REVOKE ALL ON FUNCTION public\.portal_verified_one_time_advisory_report/);
 assert.doesNotMatch(s,/^\s*GRANT\s+EXECUTE/mi);
 assert.doesNotMatch(s,/^\s*CREATE\s+ROLE|^\s*ALTER\s+ROLE|^\s*CREATE\s+EXTENSION/mi);
 assert.doesNotMatch(s,/\bFROM\s+public\.payments\b|\bFROM\s+public\.verified_customer_settlements\b/i);
 assert.match(s,/all grant\/revoke\/account-state writers to use same lock/i);
});

test('writer lock helper uses one pinned transaction and rollback after failure',async()=>{
 let released=0;const seen=[];
 const tx={query:async(sql,args)=>{seen.push({sql,args});if(sql==='synthetic-failure')throw Error('synthetic');return {rows:[]}},release(){released++}};
 await assert.rejects(withPilotWriteLockReview({connect:async()=>tx},'11111111-1111-4111-8111-111111111111',
  async c=>c.query('synthetic-failure')),/synthetic/);
 assert.deepEqual(seen.map(x=>x.sql),[
  'BEGIN ISOLATION LEVEL READ COMMITTED',
  "SET LOCAL lock_timeout = '2500ms'",
  "SET LOCAL statement_timeout = '10000ms'",
  PILOT_LOCK_SQL,'synthetic-failure','ROLLBACK'
 ]);
 assert.equal(released,1);
});
