import test from 'node:test';
import assert from 'node:assert/strict';
import {compareZeraProviders} from '../pilot/zera-three-providers.mjs';
test('no configured providers means no network calls',async()=>{
 let count=0;const result=await compareZeraProviders({taskId:'brand-ai-de',fetchImpl:async()=>{count++;throw Error('network called')}});
 assert.equal(count,0);assert.equal(result.results.length,3);assert.equal(result.verifiedCount,0);
});
test('uncited OpenAI and Perplexity responses are not verified audits',async()=>{
 let count=0;
 const fetchImpl=async()=>{count++;return {ok:true,json:async()=>({choices:[{message:{content:'ZERA Clothing mentioned'}}]})}};
 const result=await compareZeraProviders({taskId:'brand-ai-de',providers:['openai','perplexity'],keys:{openai:'test',perplexity:'test'},fetchImpl});
 assert.equal(count,2);assert.equal(result.verifiedCount,0);
 assert.ok(result.results.every(r=>r.verified===false&&r.brandMention==='possible-mention'));
});
test('invalid task/provider refuses to call network',async()=>{
 await assert.rejects(compareZeraProviders({taskId:'other'}),/Unknown audit task/);
 await assert.rejects(compareZeraProviders({taskId:'brand-ai-de',providers:['gemini','gemini']}),/Invalid providers/);
});
