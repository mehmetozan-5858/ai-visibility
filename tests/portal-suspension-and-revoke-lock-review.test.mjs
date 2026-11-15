import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {suspendClientWithLockReview,revokePilotWithLockReview} from '../lib/portal-pilot-writes-review.mjs';

const tenant='11111111-1111-4111-8111-111111111111';
const fixture=({throwOnUpdate=false,found=true}={})=>{
 const calls=[];
 const pool={connect:async()=>({
  query:async(sql,args=[])=>{
   calls.push({sql,args});
   if(throwOnUpdate&&sql.includes('UPDATE public.clients'))throw Error('synthetic-failure');
   if(sql.includes('UPDATE public.clients'))return {rows:found?[{id:tenant}]:[]};
   if(sql.includes('UPDATE public.client_pilot_access'))return {rows:found?[{expires_at:new Date()}]:[]};
   return {rows:[]};
  },
  release:()=>calls.push({sql:'RELEASE'})
 })};
 return {pool,calls};
};

test('review suspension uses transaction tenant lock before deny state',async()=>{
 const {pool,calls}=fixture();
 assert.deepEqual(await suspendClientWithLockReview(pool,tenant),{suspended:true});
 const values=calls.map(c=>c.sql);
 const begin=values.findIndex(x=>x.startsWith('BEGIN'));
 const lock=values.findIndex(x=>x.includes('pg_advisory_xact_lock'));
 const change=values.findIndex(x=>x.includes('UPDATE public.clients'));
 const commit=values.indexOf('COMMIT');
 assert.ok(begin>=0&&begin<lock&&lock<change&&change<commit);
 assert.match(values[change],/status='payment-review'/);
 assert.deepEqual(calls[change].args,[tenant]);
 assert.equal(values.at(-1),'RELEASE');
});

test('review suspension is idempotent and rolls back failed update',async()=>{
 const f=fixture({found:false});
 assert.deepEqual(await suspendClientWithLockReview(f.pool,tenant),{suspended:false});
 const broken=fixture({throwOnUpdate:true});
 await assert.rejects(suspendClientWithLockReview(broken.pool,tenant),/synthetic-failure/);
 assert.ok(broken.calls.some(c=>c.sql==='ROLLBACK'));
 assert.equal(broken.calls.at(-1).sql,'RELEASE');
 let connects=0;
 await assert.rejects(suspendClientWithLockReview({connect:async()=>{connects++}},'invalid'),
  /review-client-suspend-invalid/);
 assert.equal(connects,0);
});

test('pilot revoke SQL binds exactly the parameters it uses',async()=>{
 const {pool,calls}=fixture({found:false});
 assert.deepEqual(await revokePilotWithLockReview(pool,tenant),{revoked:false});
 const statement=calls.find(c=>c.sql.includes('UPDATE public.client_pilot_access'));
 assert.ok(statement);
 assert.deepEqual(statement.args,[tenant]);
 assert.match(statement.sql,/client_id=\$1/);
 assert.doesNotMatch(statement.sql,/\$2\b/,'unbound placeholder must never recur');
});
