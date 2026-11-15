import test from 'node:test';
import assert from 'node:assert/strict';
import {changePilotExpiryWithLockReview} from '../lib/portal-pilot-writes-review.mjs';

const tenant='11111111-1111-4111-8111-111111111111';
const expiry='2026-12-01T12:00:00.000Z';

test('trusted pilot expiry edit holds same transaction-scoped lock before update',async()=>{
 const calls=[];
 const pool={connect:async()=>({
  query:async(sql,args=[])=>{
   calls.push({sql,args});
   if(sql.includes('RETURNING expires_at'))return {rows:[{expires_at:expiry}]};
   return {rows:[]};
  },
  release:()=>calls.push({sql:'RELEASE'})
 })};
 assert.deepEqual(await changePilotExpiryWithLockReview(pool,tenant,expiry),{changed:true});
 const statements=calls.map(x=>x.sql);
 const begin=statements.findIndex(x=>x.startsWith('BEGIN'));
 const lock=statements.findIndex(x=>x.includes('pg_advisory_xact_lock'));
 const update=statements.findIndex(x=>x.includes('UPDATE public.client_pilot_access'));
 const commit=statements.indexOf('COMMIT');
 assert.ok(begin>=0&&begin<lock&&lock<update&&update<commit);
 assert.ok(statements[update].includes('revoked_at IS NULL'),
  'changing expiration must not resurrect a revoked tenant');
 assert.deepEqual(calls[update].args,[tenant,expiry]);
 assert.equal(statements.at(-1),'RELEASE');
});

test('invalid expiry input rejects before connecting',async()=>{
 let connections=0;
 const pool={connect:async()=>{connections++;throw Error('unexpected db access')}};
 for(const invalid of ['tomorrow','2026-11-31T12:00:00Z','2026-12-01',null,''])await assert.rejects(
  changePilotExpiryWithLockReview(pool,tenant,invalid),/review-pilot-expiry-invalid/);
 assert.equal(connections,0);
});

test('expired / revoked row is not re-granted, SQL failure rolls back and releases',async()=>{
 let updated=false,fail=false;
 const calls=[];
 const pool={connect:async()=>({
  query:async(sql)=>{
   calls.push(sql);
   if(sql.includes('UPDATE public.client_pilot_access')){
    if(fail)throw Error('simulated SQL failure');
    return {rows:updated?[{expires_at:expiry}]:[]};
   }
   return {rows:[]};
  },
  release:()=>calls.push('RELEASE')
 })};
 assert.deepEqual(await changePilotExpiryWithLockReview(pool,tenant,expiry),{changed:false});
 assert.ok(calls.includes('COMMIT'));
 calls.length=0;fail=true;
 await assert.rejects(changePilotExpiryWithLockReview(pool,tenant,expiry),/simulated SQL failure/);
 assert.ok(calls.includes('ROLLBACK'));
 assert.equal(calls.at(-1),'RELEASE');
});
