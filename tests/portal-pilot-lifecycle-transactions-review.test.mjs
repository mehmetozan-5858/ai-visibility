import test from 'node:test';
import assert from 'node:assert/strict';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';
import {
 changePilotExpiryWithLockReview,
 suspendClientWithLockReview,
 suspendAndRevokeClientWithLockReview
} from '../lib/portal-pilot-writes-review.mjs';

// REVIEW ONLY: synthetic transaction harness; no Neon, production or customer rows.
const TENANT='11111111-1111-4111-8111-111111111111';
function fixture(respond=()=>({rows:[]})){
 const calls=[];let releases=0;let connects=0;
 const tx={
  async query(sql,args){calls.push({sql,args});return respond(sql,args,calls)},
  release(){releases++}
 };
 return {pool:{async connect(){connects++;return tx}},calls,
  get releases(){return releases},get connects(){return connects}};
}
function assertLockedTransaction(f){
 assert.deepEqual(f.calls.slice(0,4).map(x=>x.sql),[
  'BEGIN ISOLATION LEVEL READ COMMITTED',
  "SET LOCAL lock_timeout = '2500ms'",
  "SET LOCAL statement_timeout = '10000ms'",
  PILOT_LOCK_SQL
 ]);
 assert.deepEqual(f.calls[3].args,[TENANT]);
 assert.equal(f.calls.at(-1).sql,'COMMIT');
 assert.equal(f.calls.filter(c=>c.sql===PILOT_LOCK_SQL).length,1);
 assert.equal(f.releases,1);
}
test('expiry shortening serializes before SQL write and cannot revive a revoked pilot',async()=>{
 const until='2026-11-19T00:00:00.000Z';
 const f=fixture((sql)=>sql.includes('UPDATE public.client_pilot_access')
  ?{rows:[{expires_at:until}]}:{rows:[]});
 assert.deepEqual(await changePilotExpiryWithLockReview(f.pool,TENANT,until),{changed:true});
 assertLockedTransaction(f);
 const write=f.calls.find(x=>x.sql.includes('SET expires_at='));
 assert.deepEqual(write.args,[TENANT,until]);
 assert.match(write.sql,/revoked_at IS NULL/);
 assert.match(write.sql,/expires_at >= \$2::timestamptz/);
 const missing=fixture();
 assert.deepEqual(await changePilotExpiryWithLockReview(missing.pool,TENANT,until),{changed:false});
 assertLockedTransaction(missing);
 for(const invalid of ['not-a-date','2026-11-19T00:00:00Z','2026-02-30T00:00:00.000Z']){
  const rejected=fixture();
  await assert.rejects(changePilotExpiryWithLockReview(rejected.pool,TENANT,invalid),/review-pilot-expiry-invalid/);
  assert.equal(rejected.connects,0);
 }
});
test('trusted account suspension takes tenant lock and remains non-destructive',async()=>{
 const f=fixture(sql=>sql.includes('UPDATE public.clients')?{rows:[{id:TENANT}]}:{rows:[]});
 assert.deepEqual(await suspendClientWithLockReview(f.pool,TENANT),{suspended:true});
 assertLockedTransaction(f);
 const update=f.calls.find(x=>x.sql.includes('UPDATE public.clients'));
 assert.deepEqual(update.args,[TENANT]);
 assert.match(update.sql,/status='payment-review'/);
 assert.doesNotMatch(f.calls.map(x=>x.sql).join(' '),/\bDELETE\b|\bDROP\b/);
});
test('account retirement suspends and revokes under one lock and one commit',async()=>{
 const f=fixture(sql=>{
  if(sql.includes('UPDATE public.clients'))return {rows:[{id:TENANT}]};
  if(sql.includes('SELECT id FROM public.clients'))return {rows:[{id:TENANT}]};
  if(sql.includes('UPDATE public.client_pilot_access'))return {rows:[{client_id:TENANT}]};
  return {rows:[]};
 });
 assert.deepEqual(await suspendAndRevokeClientWithLockReview(f.pool,TENANT),
  {accountPresent:true,suspended:true,pilotRevoked:true});
 assertLockedTransaction(f);
 const sql=f.calls.map(x=>x.sql);
 const suspension=sql.findIndex(x=>x.includes('UPDATE public.clients'));
 const lookup=sql.findIndex(x=>x.includes('SELECT id FROM public.clients'));
 const revocation=sql.findIndex(x=>x.includes('UPDATE public.client_pilot_access'));
 assert.ok(suspension>3&&lookup>suspension&&revocation>lookup);
 assert.deepEqual(f.calls[revocation].args,[TENANT]);
 assert.match(sql[revocation],/revoked_at IS NULL/);
 assert.equal(sql.filter(x=>x==='COMMIT').length,1);
});
test('absent client never revokes entitlement; revocation failure rolls back',async()=>{
 const absent=fixture(()=>({rows:[]}));
 assert.deepEqual(await suspendAndRevokeClientWithLockReview(absent.pool,TENANT),
  {accountPresent:false,suspended:false,pilotRevoked:false});
 assertLockedTransaction(absent);
 assert.equal(absent.calls.some(x=>x.sql.includes('UPDATE public.client_pilot_access')),false);
 const broken=fixture(sql=>{
  if(sql.includes('SELECT id FROM public.clients'))return {rows:[{id:TENANT}]};
  if(sql.includes('UPDATE public.client_pilot_access'))throw Error('synthetic write failed');
  return {rows:[]};
 });
 await assert.rejects(suspendAndRevokeClientWithLockReview(broken.pool,TENANT),/synthetic write failed/);
 assert.equal(broken.calls.at(-1).sql,'ROLLBACK');
 assert.equal(broken.calls.some(x=>x.sql==='COMMIT'),false);
 assert.equal(broken.releases,1);
});
test('invalid tenant never acquires database connection on lifecycle writers',async()=>{
 const f=fixture();
 await assert.rejects(suspendClientWithLockReview(f.pool,'not-uuid'),/review-client-suspend-invalid/);
 await assert.rejects(suspendAndRevokeClientWithLockReview(f.pool,'not-uuid'),/review-client-retirement-invalid/);
 await assert.rejects(changePilotExpiryWithLockReview(f.pool,'not-uuid','2026-11-19T00:00:00.000Z'),/review-pilot-expiry-invalid/);
 assert.equal(f.connects,0);
});
