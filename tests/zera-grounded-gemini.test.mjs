import test from 'node:test';
import assert from 'node:assert/strict';
import {runGroundedZeraCheck} from '../pilot/zera-grounded-gemini.mjs';
test('provider is never invoked without a configured key',async()=>{
 let called=false;
 await assert.rejects(runGroundedZeraCheck({taskId:'brand-ai-de',fetchImpl:async()=>{called=true}}),/key/);
 assert.equal(called,false);
});
test('rejects uncited model text as audit evidence',async()=>{
 const fetchImpl=async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'ZERA found'}]},groundingMetadata:{}}]})});
 const result=await runGroundedZeraCheck({taskId:'brand-ai-de',key:'test-only',fetchImpl});
 assert.equal(result.status,'unverified');
});
test('only a grounded supported HTTPS segment qualifies as evidence',async()=>{
 const fetchImpl=async(url,options)=>{
  const body=JSON.parse(options.body);assert.deepEqual(body.tools,[{google_search:{}}]);
  return {ok:true,json:async()=>({candidates:[{groundingMetadata:{
   groundingChunks:[{web:{uri:'https://example.org/evidence'}}],
   groundingSupports:[{segment:{text:'A source-backed observation.'},groundingChunkIndices:[0]}]
  }}]})};
 };
 const result=await runGroundedZeraCheck({taskId:'brand-ai-de',key:'test-only',fetchImpl});
 assert.equal(result.status,'evidence_recorded');
 assert.equal(result.brandMention,'not-observed-in-supported-segment');
 assert.equal(result.result.evidence.sourceUrl,'https://example.org/evidence');
});

test('source citation with a ZERA mention only marks possible brand mention',async()=>{
 const fetchImpl=async()=>({ok:true,json:async()=>({candidates:[{groundingMetadata:{groundingChunks:[{web:{uri:'https://example.org/evidence'}}],groundingSupports:[{segment:{text:'ZERA Clothing may appear in this result.'},groundingChunkIndices:[0]}]}}]})});
 const result=await runGroundedZeraCheck({taskId:'brand-ai-de',key:'test-only',fetchImpl});
 assert.equal(result.brandMention,'possible-mention');
});
