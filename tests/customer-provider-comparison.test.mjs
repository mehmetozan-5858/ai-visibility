import test from 'node:test';
import assert from 'node:assert/strict';
import {compareCustomerProviders} from '../lib/customer-provider-comparison.mjs';
const client={id:'customer-1',name:'Example Boutique'};
test('shared engine never calls network without configured keys',async()=>{
 let calls=0;const result=await compareCustomerProviders({client,query:'Boutiques nearby',fetchImpl:async()=>{calls++}});
 assert.equal(calls,0);assert.equal(result.results.length,3);assert.equal(result.visibilityScore,null);
 assert.equal(result.clientId,client.id);
});
test('customer response does not mistake uncited AI mention for verified rank',async()=>{
 const result=await compareCustomerProviders({client,query:'Boutiques nearby',providers:['openai'],keys:{openai:'test'},fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'Example Boutique in town'}}]})})});
 assert.equal(result.verifiedCount,0);assert.equal(result.results[0].brandMention,'possible-mention');
 assert.equal(result.results[0].verified,false);
});
test('rejects invalid or duplicate providers and oversized queries',async()=>{
 await assert.rejects(compareCustomerProviders({client,query:'test',providers:['gemini','gemini']}),/Invalid provider selection/);
 await assert.rejects(compareCustomerProviders({client,query:'x'.repeat(501)}),/Invalid query/);
});
test('grounding without a matching visible answer cannot become verified evidence',async()=>{
 for(const [answer,observation,url,expected] of [
  ['', 'A cited passage','https://example.test/source',false],
  ['Unrelated answer','A cited passage','https://example.test/source',false],
  ['A cited passage','A cited passage','https://user:password@example.test/source',false],
  ['A cited passage','A cited passage','https://example.test/source',true]
 ]){
  const response={candidates:[{content:{parts:[{text:answer}]},groundingMetadata:{groundingChunks:[{web:{uri:url}}],groundingSupports:[{segment:{text:observation},groundingChunkIndices:[0]}]}}]};
  const result=await compareCustomerProviders({client,query:'Boutiques nearby',providers:['gemini'],keys:{gemini:'synthetic'},fetchImpl:async()=>({ok:true,json:async()=>response})});
  assert.equal(result.results[0].verified,expected);
  assert.equal(result.verifiedCount,expected?1:0);
  assert.equal(result.results[0].evidence!==null,expected);
 }
});
test('provider exceptions never expose raw network or credential details',async()=>{
 const result=await compareCustomerProviders({client,query:'test',providers:['gemini'],keys:{gemini:'synthetic'},fetchImpl:async()=>{throw Error('private-key-and-request-url')}});
 assert.equal(result.results[0].reason,'provider-request-failed');
});
