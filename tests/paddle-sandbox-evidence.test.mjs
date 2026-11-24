import {createHmac} from 'node:crypto';
import {verifyPaddleLiveSignature} from '../lib/paddle-live.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSandboxEvidence, recordSandboxEvidence, auditSandboxCompletedEntities, auditSandboxEventIdentityClasses} from '../lib/paddle-sandbox-evidence.js';

function event(overrides={}) {
  return {event_id:'evt_abc123',event_type:'transaction.completed',
    occurred_at:'2026-11-23T08:00:00Z',
    data:{id:'txn_abc123',customer_id:'ctm_abc123',status:'completed',items:[{price:{id:'pri_abc123'}}]},
    ...overrides};
}
test('sandbox normalization accepts signed-provider-shaped evidence but not entitlement',()=>{
  assert.deepEqual(normalizeSandboxEvidence(event()).priceIds,['pri_abc123']);
  for(const bad of [
    event({event_id:'bad'}), event({event_type:'unknown.event'}),
    event({data:{id:'sub_abc123'}}), event({occurred_at:'not-a-date'}),
    event({data:{id:'txn_abc123',customer_id:'ctm_other',status:'pending'}}),
    event({data:{id:'txn_abc123',status:'completed'}}),
    event({occurred_at:'Nov 23 2026 08:00:00 UTC'}),
    event({occurred_at:'2026-11-23 08:00:00Z'})
  ]) assert.throws(()=>normalizeSandboxEvidence(bad),/invalid-sandbox-evidence/);
});
function mockPool(duplicate=false, linked=true) {
  const queries=[];
  let released=false;
  const client={query:async(sql,args)=>{
    queries.push({sql,args});
    if(sql.startsWith('SELECT i.id FROM public.paddle_sandbox_checkout_intents')) return {rows:linked?[{id:'synthetic-intent'}]:[]};
    if(sql.startsWith('INSERT INTO public.paddle_sandbox_events'))
      return {rows:duplicate?[]:[{event_id:'evt_abc123'}]};
    return {rows:[]};
  }, release:()=>{released=true;}};
  return {pool:{connect:async()=>client},queries,get released(){return released;}};
}
test('sandbox receipt writes only isolated ledgers and never entitles customer',async()=>{
  const m=mockPool();
  const result=await recordSandboxEvidence(event(),{databaseUrl:'isolated',pool:m.pool});
  assert.deepEqual(result,{recorded:true,checkoutLinked:true,entitlementGranted:false});
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

test('completed provider event without matching intent, tenant or price fails closed',async()=>{
  const m=mockPool(false,false);
  await assert.rejects(
    recordSandboxEvidence(event(),{databaseUrl:'isolated',pool:m.pool}),
    /sandbox-checkout-link-unverified/
  );
  assert.ok(m.queries.some(q=>q.sql==='ROLLBACK'));
  assert.equal(m.queries.some(q=>q.sql.includes('INSERT INTO public.paddle_sandbox_entities')),false);
  assert.equal(m.released,true);
});
test('checkout validation binds exact transaction and advertised catalog price',async()=>{
  const m=mockPool();
  await recordSandboxEvidence(event(),{databaseUrl:'isolated',pool:m.pool});
  const check=m.queries.find(q=>q.sql.startsWith('SELECT i.id FROM public.paddle_sandbox_checkout_intents'));
  assert.deepEqual(check.args[0],'txn_abc123');
  assert.deepEqual(check.args[1],['pri_abc123']);
  assert.equal(check.args[3],'ctm_abc123');
  assert.match(check.sql,/i\.paddle_customer_id=\$4/);
  assert.match(check.sql,/c\.client_id=i\.client_id/);
  assert.match(check.sql,/i\.expires_at/);
  assert.match(check.sql,/i\.created_at <= \$3::timestamptz/);
});

test('aggregate historical sandbox ledger never claims provider authenticity or paid entitlement',async()=>{
  const queries=[];
  const pool={query:async sql=>{
    queries.push(sql);
    return {rows:[{completed_entities:9,linked_entities:4,unlinked_entities:5}]};
  }};
  const result=await auditSandboxCompletedEntities({databaseUrl:'isolated',pool});
  assert.deepEqual(result,{completedEntities:9,linkedEntities:4,unlinkedEntities:5,
    entitlementGranted:false,providerAuthenticated:false});
  assert.match(queries[0],/paddle_sandbox_checkout_intents/);
  assert.match(queries[0],/i\.created_at <= e\.occurred_at/);
  assert.match(queries[0],/paddle_sandbox_customers/);
  assert.doesNotMatch(queries[0],/\b(INSERT|UPDATE|DELETE)\b/i);
});

test('sandbox HMAC acceptance rejects altered payloads, expired timestamps and wrong secret',()=>{
  const secret='sandbox-test-secret-not-live';
  const raw=JSON.stringify(event());
  const ts=1700000000;
  const now=ts*1000;
  const sign=(body,key=secret)=>
    'ts='+ts+';h1='+createHmac('sha256',key).update(ts+':'+body).digest('hex');
  assert.equal(verifyPaddleLiveSignature(raw,sign(raw),secret,{now}),true);
  assert.equal(verifyPaddleLiveSignature(raw+' ',sign(raw),secret,{now}),false);
  assert.equal(verifyPaddleLiveSignature(raw,sign(raw,'wrong-secret'),secret,{now}),false);
  assert.equal(verifyPaddleLiveSignature(raw,sign(raw),secret,{now:now+301000}),false);
  assert.equal(verifyPaddleLiveSignature(raw,sign(raw)+';ts='+ts,secret,{now}),false);
});

test('sandbox ID classes never assert provider signing from an evt_ prefix',async()=>{
  const queries=[];
  const pool={query:async sql=>{
    queries.push(sql);
    return {rows:[{total_events:39,explicitly_synthetic:15,
      provider_shaped_unverified:24,synthetic_completions:4}]};
  }};
  const result=await auditSandboxEventIdentityClasses({databaseUrl:'isolated',pool});
  assert.deepEqual(result,{
    totalEvents:39,explicitlySynthetic:15,providerShapedUnverified:24,
    syntheticCompletions:4,signedProviderDeliveryVerified:false,
    entitlementsGranted:false
  });
  assert.match(queries[0],/paddle_sandbox_events/);
  assert.doesNotMatch(queries[0],/\\b(?:INSERT|UPDATE|DELETE)\\b/i);
});
