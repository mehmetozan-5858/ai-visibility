import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoredRevenuePreview} from '../lib/arge-report-repository.mjs';

// Synthetic pooled clients only: no database, credentials or external calls.
const request={
 session:{clientId:'tenant1',actorId:'tenant1',verified:true},accountClientId:'tenant1',
 requestId:'rollback-fixture',featureEnabled:true,globallyEnabled:true,
};
function fixture({failBegin=false,failRollbackCount=0}={}){
 const queries=[],releases=[];
 let rollbackAttempts=0;
 const client={
  async query(sql){
   queries.push(sql);
   if(sql==='BEGIN' && failBegin)throw Error('synthetic-begin-failure');
   if(sql==='ROLLBACK'){
    rollbackAttempts++;
    if(rollbackAttempts<=failRollbackCount)throw Error('synthetic-rollback-failure');
    return {rows:[]};
   }
   // An absent membership must deny before reading any tenant ledger.
   if(sql.includes('FROM arge_memberships') || sql.includes('FROM arge_entitlements'))
    return {rows:[]};
   if(sql==='BEGIN')return {rows:[]};
   throw Error('unexpected SQL in isolated rollback test');
  },
  release(discard){releases.push(discard);},
 };
 return {pool:{async connect(){return client;}},queries,releases,
  get rollbackAttempts(){return rollbackAttempts;}};
}

test('report preview discards a pooled client when error-path rollback fails',async()=>{
 const db=fixture({failBegin:true,failRollbackCount:1});
 await assert.rejects(createStoredRevenuePreview({...request,pool:db.pool}),
  /synthetic-begin-failure/);
 assert.deepEqual(db.queries,['BEGIN','ROLLBACK']);
 assert.equal(db.rollbackAttempts,1);
 assert.deepEqual(db.releases,[true]);
});

test('report preview returns a clean connection after successful error-path rollback',async()=>{
 const db=fixture({failBegin:true});
 await assert.rejects(createStoredRevenuePreview({...request,pool:db.pool}),
  /synthetic-begin-failure/);
 assert.deepEqual(db.queries,['BEGIN','ROLLBACK']);
 assert.deepEqual(db.releases,[undefined]);
});

test('early denial rollback failure cannot return a poisoned pooled connection',async()=>{
 const db=fixture({failRollbackCount:1});
 await assert.rejects(createStoredRevenuePreview({...request,pool:db.pool}),
  /synthetic-rollback-failure/);
 assert.equal(db.rollbackAttempts,2); // catch retries, but the connection stays discarded.
 assert.deepEqual(db.releases,[true]);
 assert.equal(db.queries.some(sql=>sql.includes('arge_revenue_ledger')),false);
});

test('successful authorization-denial rollback preserves normal pool reuse',async()=>{
 const db=fixture();
 const result=await createStoredRevenuePreview({...request,pool:db.pool});
 assert.deepEqual(result,{ok:false,reason:'unverified-membership'});
 assert.equal(db.rollbackAttempts,1);
 assert.deepEqual(db.releases,[undefined]);
 assert.equal(db.queries.some(sql=>sql.includes('arge_revenue_ledger')),false);
});
