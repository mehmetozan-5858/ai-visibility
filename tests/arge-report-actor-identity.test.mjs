import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoredRevenuePreview} from '../lib/arge-report-repository.mjs';

// No live database, secrets, provider calls or real customer records.
const request={accountClientId:'tenant1',requestId:'actor-boundary-fixture',
 featureEnabled:true,globallyEnabled:true};
const noConnect={connect(){throw Error('unexpected-database-access');}};

for(const [name,session] of [
 ['tenant-only session',{clientId:'tenant1',verified:true}],
 ['unverified actor',{clientId:'tenant1',actorId:'actor_a'}],
 ['explicitly unverified actor',{clientId:'tenant1',actorId:'actor_a',verified:false}],
 ['invalid actor',{clientId:'tenant1',actorId:'../actor',verified:true}],
 ['empty actor',{clientId:'tenant1',actorId:'',verified:true}],
 ['missing tenant',{actorId:'actor_a',verified:true}],
 ['cross-tenant session',{clientId:'tenant2',actorId:'actor_a',verified:true}]
]){
 test(`stored revenue preview rejects ${name} before any database access`,async()=>{
  const result=await createStoredRevenuePreview({...request,session,pool:noConnect});
  assert.deepEqual(result,{ok:false,reason:'invalid-session-or-request'});
 });
}

test('stored revenue preview resolves membership using verified actor, never tenant ID',async()=>{
 const queries=[];
 const client={
  async query(sql,params){
   queries.push({sql,params});
   if(sql==='BEGIN'||sql==='ROLLBACK')return {rows:[]};
   if(sql.includes('FROM arge_memberships'))return {rows:[{role:'owner',enabled:true}]};
   if(sql.includes('FROM arge_entitlements'))return {rows:[]};
   throw Error('unexpected SQL after missing entitlement');
  },
  release(){}
 };
 const result=await createStoredRevenuePreview({...request,
  session:{clientId:'tenant1',actorId:'actor_a',verified:true},
  pool:{async connect(){return client;}}});
 assert.deepEqual(result,{ok:false,reason:'service-entitlement-required'});
 const member=queries.find(q=>q.sql.includes('FROM arge_memberships'));
 assert.deepEqual(member.params,['tenant1','actor_a']);
 assert.equal(queries.some(q=>q.sql.includes('arge_revenue_ledger')),false);
 assert.equal(queries.at(-1).sql,'ROLLBACK');
});
