import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoredRevenuePreview} from '../lib/arge-report-repository.mjs';

// Synthetic SQL client; no live database, secrets, provider calls or customer data.
const base={session:{clientId:'tenant1'},accountClientId:'tenant1',
 requestId:'membership-gate-fixture',featureEnabled:true,globallyEnabled:true};
function fixture(member){
 const queries=[],releases=[];
 const client={
  async query(sql){
   queries.push(sql);
   if(sql==='BEGIN'||sql==='ROLLBACK')return {rows:[]};
   if(sql.includes('FROM arge_memberships'))return {rows:member?[member]:[]};
   if(sql.includes('FROM arge_entitlements'))return {rows:[]};
   throw Error('unexpected SQL after entitlement gate');
  },
  release(discard){releases.push(discard);}
 };
 return {pool:{async connect(){return client;}},queries,releases};
}
for(const [label,member,reason] of [
 ['missing membership',null,'unverified-membership'],
 ['disabled membership',{role:'owner',enabled:false},'unverified-membership'],
 ['viewer role',{role:'viewer',enabled:true},'insufficient-permission'],
 ['manager role',{role:'manager',enabled:true},'owner-required'],
 ['invalid role',{role:'superuser',enabled:true},'unverified-membership']
]){
 test(`report preview rejects ${label} before reading service grants`,async()=>{
  const db=fixture(member);
  const result=await createStoredRevenuePreview({...base,pool:db.pool});
  assert.deepEqual(result,{ok:false,reason});
  assert.equal(db.queries.filter(q=>q.includes('FROM arge_memberships')).length,1);
  assert.equal(db.queries.some(q=>q.includes('FROM arge_entitlements')),false);
  assert.equal(db.queries.some(q=>q.includes('arge_revenue_ledger')),false);
  assert.equal(db.queries.at(-1),'ROLLBACK');
  assert.deepEqual(db.releases,[undefined]);
 });
}
test('authorized owner still reaches stored entitlement gate',async()=>{
 const db=fixture({role:'owner',enabled:true});
 const result=await createStoredRevenuePreview({...base,pool:db.pool});
 assert.deepEqual(result,{ok:false,reason:'service-entitlement-required'});
 assert.equal(db.queries.filter(q=>q.includes('FROM arge_entitlements')).length,1);
 assert.equal(db.queries.some(q=>q.includes('arge_revenue_ledger')),false);
 assert.equal(db.queries.at(-1),'ROLLBACK');
 assert.deepEqual(db.releases,[undefined]);
});
