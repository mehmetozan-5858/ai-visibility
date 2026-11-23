import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSandboxEvidence, recordSandboxEvidence} from '../lib/paddle-sandbox-evidence.js';

function event(overrides={}) {
  return {event_id:'evt_abc123',event_type:'transaction.completed',
    occurred_at:'2026-11-23T08:00:00Z',
    data:{id:'txn_abc123',status:'completed',items:[{price:{id:'pri_abc123'}}]},
    ...overrides};
}
test('sandbox normalization accepts signed-provider-shaped evidence but not entitlement',()=>{
  assert.deepEqual(normalizeSandboxEvidence(event()).priceIds,['pri_abc123']);
  for(const bad of [
    event({event_id:'bad'}), event({event_type:'unknown.event'}),
    event({data:{id:'sub_abc123'}}), event({occurred_at:'not-a-date'})
  ]) assert.throws(()=>normalizeSandboxEvidence(bad),/invalid-sandbox-evidence/);
});
function mockPool(duplicate=false) {
  const queries=[];
  let released=false;
  const client={query:async(sql,args)=>{
    queries.push({sql,args});
    if(sql.startsWith('INSERT INTO public.paddle_sandbox_events'))
      return {rows:duplicate?[]:[{event_id:'evt_abc123'}]};
    return {rows:[]};
  }, release:()=>{released=true;}};
  return {pool:{connect:async()=>client},queries,get released(){return released;}};
}
test('sandbox receipt writes only isolated ledgers and never entitles customer',async()=>{
  const m=mockPool();
  const result=await recordSandboxEvidence(event(),{databaseUrl:'isolated',pool:m.pool});
  assert.deepEqual(result,{recorded:true,entitlementGranted:false});
  assert.equal(m.released,true);
  const sql=m.queries.map(q=>q.sql).join('\n');
  assert.match(sql,/paddle_sandbox_events/);
  assert.match(sql,/paddle_sandbox_entities/);
  assert.doesNotMatch(sql,/UPDATE clients|UPDATE payments|paddle_live_/i);
});
test('replayed webhook id is idempotent and never writes entities',async()=>{
  const m=mockPool(true);
  const result=await recordSandboxEvidence(event(),{databaseUrl:'isolated',pool:m.pool});
  assert.deepEqual(result,{duplicate:true,entitlementGranted:false});
  assert.equal(m.queries.filter(q=>q.sql.includes('paddle_sandbox_entities')).length,0);
  assert.equal(m.released,true);
});
