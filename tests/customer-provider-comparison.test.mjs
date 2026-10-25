import test from 'node:test';
import assert from 'node:assert/strict';
import {compareCustomerProviders} from '../lib/customer-provider-comparison.mjs';
const client={id:'customer-1',name:'Example Boutique'};
test('shared engine never calls network without configured keys',async()=>{
 let calls=0;const result=await compareCustomerProviders({client,query:'Boutiques nearby',fetchImpl:async()=>{calls++}});
 assert.equal(calls,0);assert.equal(result.results.length,3);assert.equal(result.visibilityScore,null);
 assert.equal(result.clientId,client.id);
});
test('configured test keys cannot bypass provider release hold',async()=>{
 let calls=0;
 const result=await compareCustomerProviders({
  client,query:'Boutiques nearby',
  keys:{gemini:'test-only',openai:'test-only',perplexity:'test-only'},
  fetchImpl:async()=>{calls++;throw Error('network should never be called')},
 });
 assert.equal(calls,0);
 assert.deepEqual(result.results.map(r=>r.status),[
  'provider-execution-paused','provider-execution-paused','provider-execution-paused'
 ]);
 assert.equal(result.verifiedCount,0);
 assert.equal(result.visibilityScore,null);
});
test('provider hold is not bypassed by environment flags',async()=>{
 let calls=0;
 const previous=process.env.ZERA_GEMINI_SEARCH_GROUNDING_ENABLED;
 try{
  process.env.ZERA_GEMINI_SEARCH_GROUNDING_ENABLED='true';
  const result=await compareCustomerProviders({
   client,query:'Boutiques nearby',providers:['gemini'],keys:{gemini:'test-only'},
   fetchImpl:async()=>{calls++;throw Error('network should never be called')},
  });
  assert.equal(calls,0);
  assert.equal(result.results[0].status,'provider-execution-paused');
 }finally{
  if(previous===undefined)delete process.env.ZERA_GEMINI_SEARCH_GROUNDING_ENABLED;
  else process.env.ZERA_GEMINI_SEARCH_GROUNDING_ENABLED=previous;
 }
});
test('rejects invalid or duplicate providers and oversized queries',async()=>{
 await assert.rejects(compareCustomerProviders({client,query:'test',providers:['gemini','gemini']}),/Invalid provider selection/);
 await assert.rejects(compareCustomerProviders({client,query:'x'.repeat(501)}),/Invalid query/);
});
