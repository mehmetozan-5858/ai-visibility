import test from 'node:test';
import assert from 'node:assert/strict';
import {storeClaimedCustomerComparison,storeSingleScanComparison} from '../lib/customer-comparison-storage.mjs';
const clientId='11111111-1111-4111-8111-111111111111';
const comparison={clientId,query:'Synthetic query',results:[{provider:'gemini',status:'answer-received-unverified',verified:false}]};
for(const [name,store] of [['task',storeClaimedCustomerComparison],['single',storeSingleScanComparison]]){
 for(const failAt of ['INSERT','COMMIT']){
  for(const rollbackFails of [false,true]){
   test(`${name}: ${failAt} failure preserves original error and ${rollbackFails?'discards':'reuses'} connection`,async()=>{
    const original=Error('original storage failure');const released=[];const queries=[];
    const pool={connect:async()=>({
     query:async(sql)=>{
      queries.push(sql);
      if(sql.startsWith(failAt))throw original;
      if(sql==='ROLLBACK'&&rollbackFails)throw Error('rollback failure');
      if(sql.startsWith('SELECT'))return {rows:[{status:'started',comparison_id:null}]};
      if(sql.startsWith('UPDATE'))return {rows:[{task_id:'synthetic',id:'first-free-gemini'}]};
      return {rows:[]};
     },release:(...args)=>released.push(args),
    })};
    await assert.rejects(store({pool,clientId,taskId:'synthetic',comparison}),error=>error===original);
    assert.deepEqual(released,rollbackFails?[[true]]:[[]]);
    assert.equal(queries.filter(q=>q==='ROLLBACK').length,1);
   });
  }
 }
 test(`${name}: successful storage returns a reusable connection`,async()=>{
  const released=[];
  const pool={connect:async()=>({query:async(sql)=>({rows:sql.startsWith('SELECT')?[{status:'started'}]:sql.startsWith('UPDATE')?[{id:'synthetic',task_id:'synthetic'}]:[]}),release:(...args)=>released.push(args)})};
  const result=await store({pool,clientId,taskId:'synthetic',comparison});
  assert.equal(result.stored,true);assert.deepEqual(released,[[]]);
 });
}
