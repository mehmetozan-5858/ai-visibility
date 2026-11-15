import test from 'node:test';
import assert from 'node:assert/strict';
import {PILOT_LOCK_SQL,withPilotWriteLockReview} from '../lib/portal-pilot-advisory-lock-review.mjs';

const tenant='11111111-1111-4111-8111-111111111111';

function harness({failOn,callbackFails=false}={}){
 const calls=[];
 let released=0;
 const tx={
  query:async(sql,params=[])=>{
   calls.push({sql,params});
   if(sql===failOn)throw Object.assign(Error('synthetic-lock-timeout'),{code:'55P03'});
   return {rows:[]};
  },
  release:()=>{released++}
 };
 const pool={connect:async()=>tx};
 const write=async(client,id)=>{
  assert.equal(client,tx);
  assert.equal(id,tenant);
  calls.push({sql:'TRUSTED_PILOT_UPDATE',params:[id]});
  if(callbackFails)throw Error('synthetic-writer-rejected');
  return {revoked:true};
 };
 return {pool,write,calls,get releases(){return released}};
}

test('cooperative pilot transaction pins one connection and locks before trusted write',async()=>{
 const h=harness();
 assert.deepEqual(await withPilotWriteLockReview(h.pool,tenant.toUpperCase(),h.write),{revoked:true});
 assert.deepEqual(h.calls.map(x=>x.sql),[
  'BEGIN ISOLATION LEVEL READ COMMITTED',
  "SET LOCAL lock_timeout = '2500ms'",
  "SET LOCAL statement_timeout = '10000ms'",
  PILOT_LOCK_SQL,
  'TRUSTED_PILOT_UPDATE','COMMIT'
 ]);
 assert.deepEqual(h.calls[3].params,[tenant]);
 assert.equal(h.releases,1);
});

test('advisory lock timeout rejects writer and always rolls back/releases',async()=>{
 const h=harness({failOn:PILOT_LOCK_SQL});
 await assert.rejects(withPilotWriteLockReview(h.pool,tenant,h.write),e=>e.code==='55P03');
 assert.equal(h.calls.some(x=>x.sql==='TRUSTED_PILOT_UPDATE'),false);
 assert.equal(h.calls.at(-1).sql,'ROLLBACK');
 assert.equal(h.releases,1);
});

test('writer error causes rollback without returning an access grant',async()=>{
 const h=harness({callbackFails:true});
 await assert.rejects(withPilotWriteLockReview(h.pool,tenant,h.write),/synthetic-writer-rejected/);
 assert.deepEqual(h.calls.slice(-2).map(x=>x.sql),['TRUSTED_PILOT_UPDATE','ROLLBACK']);
 assert.equal(h.releases,1);
});

test('invalid tenant is rejected before SQL pool acquisition',async()=>{
 let acquisitions=0;
 const pool={connect:async()=>{acquisitions++;throw Error('unexpected SQL')}};
 for(const bad of ['',null,'not-a-uuid','11111111-1111-1111-1111-111111111111']){
  await assert.rejects(withPilotWriteLockReview(pool,bad,async()=>{}),/pilot-writer-tenant-invalid/);
 }
 assert.equal(acquisitions,0);
});

test('missing query-capable connection is rejected and released',async()=>{
 let released=0;
 await assert.rejects(withPilotWriteLockReview({
  connect:async()=>({release(){released++}})
 },tenant,async()=>{}),/pilot-writer-connection-invalid/);
 assert.equal(released,1);
});
