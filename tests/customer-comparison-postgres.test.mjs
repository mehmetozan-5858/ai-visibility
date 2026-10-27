import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readCustomerComparisons} from '../lib/customer-comparison-reader.mjs';
import {LAUNCH_SERVICES} from '../lib/ai-visibility-launch-services.mjs';
const zera='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
let db,pool;
before(async()=>{
 db=new PGlite();pool={query:(q,p)=>{assert.match(q.trim(),/^SELECT\b/i);return db.query(q,p);}};
 await db.exec('CREATE TABLE ai_provider_comparisons(id UUID PRIMARY KEY,client_id UUID NOT NULL,query TEXT,results JSONB,created_at TIMESTAMPTZ DEFAULT NOW())');
 for(const [client,id,query] of [[zera,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ZERA customer query'],[other,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Other customer private query']]){
  await db.query('INSERT INTO ai_provider_comparisons(id,client_id,query,results) VALUES($1,$2,$3,$4::jsonb)',[id,client,query,JSON.stringify([
   {provider:'gemini',status:'answer-received-unverified',verified:false,answer:query,internalSecret:'not-public'},
   {provider:'openai',status:'provider-execution-paused',verified:false}
  ])]);
 }
});
after(async()=>db?.close());
test('ZERA is a scoped customer; the common reader never returns another customer data',async()=>{
 const result=await readCustomerComparisons({pool,clientId:zera});
 assert.equal(result.comparisons.length,1);assert.equal(result.comparisons[0].query,'ZERA customer query');
 assert.equal(JSON.stringify(result).includes('Other customer'),false);assert.equal(JSON.stringify(result).includes('internalSecret'),false);
 assert.equal(result.visibilityScore,null);assert.equal(result.sourceSupportedCount,0);
 assert.equal(result.comparisons[0].results[1].status,'provider-execution-paused');
 const second=await readCustomerComparisons({pool,clientId:other});assert.equal(second.comparisons[0].query,'Other customer private query');
});
test('unknown customer has no recorded results, never another customer fallback',async()=>{
 const result=await readCustomerComparisons({pool,clientId:'33333333-3333-4333-8333-333333333333'});
 assert.deepEqual(result.comparisons,[]);assert.equal(result.state,'no-recorded-results');assert.equal(result.visibilityScore,null);
});
test('invalid customer IDs and unbounded limits are rejected before querying',async()=>{
 const never={query(){throw Error('must-not-query');}};
 for(const args of [{clientId:"' OR 1=1 --"},{clientId:zera,limit:1000},{clientId:null}])
  await assert.rejects(readCustomerComparisons({pool:never,...args}),/invalid-customer-scope/);
});
test('storage errors remain errors rather than fabricated empty or completed scans',async()=>{
 await assert.rejects(readCustomerComparisons({pool:{query:async()=>{throw Error('storage-failed');}},clientId:zera}),/storage-failed/);
});
test('customer names never become service catalogue entries or authorization roles',()=>{
 assert.equal(LAUNCH_SERVICES.some(service=>/zera/i.test(service.id+' '+service.name)),false);
});
