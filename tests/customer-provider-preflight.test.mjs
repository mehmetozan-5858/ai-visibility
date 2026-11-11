import test from 'node:test';
import assert from 'node:assert/strict';
import {readGeminiModelAccess} from '../lib/customer-provider-preflight.mjs';
const env={GEMINI_API_KEY:'fixture-secret'};
test('metadata checks the exact model without inference or arbitrary destinations',async()=>{
 const result=await readGeminiModelAccess({env,fetchImpl:async(url,options)=>{
  assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash');assert.equal(options.method,'GET');assert.equal(options.body,undefined);assert.equal(options.redirect,'error');
  return Response.json({name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent'],privateField:'private-response'});
 }});
 assert.equal(result.accessible,true);assert.equal(result.inferenceRequests,0);assert.equal(result.quotaVerified,false);assert.equal(result.freeTierVerified,false);
 assert.doesNotMatch(JSON.stringify(result),/fixture-secret|private-response/);
});
test('configuration, response and access failures remain unverified with no raw payload leakage',async()=>{
 let calls=0;const fail=async()=>{calls++;throw Error('secret-driver')};
 assert.equal((await readGeminiModelAccess({fetchImpl:fail})).state,'not-configured');
 assert.equal((await readGeminiModelAccess({env:{...env,ZERA_GEMINI_MODEL:'../private'},fetchImpl:fail})).state,'invalid-model-setting');assert.equal(calls,0);
 for(const response of [Response.json({private:'secret'}, {status:403}),Response.json({name:'models/other',supportedGenerationMethods:['generateContent']}),new Response('not-json'),new Response('x'.repeat(65537))]){
  const result=await readGeminiModelAccess({env,fetchImpl:async()=>response});assert.equal(result.accessible,false);assert.doesNotMatch(JSON.stringify(result),/secret/);
 }
 assert.equal((await readGeminiModelAccess({env,fetchImpl:fail})).state,'provider-unavailable');
});

test('admin endpoint rejects unauthenticated and selector-bearing requests before metadata lookup',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=(await readFile(new URL('../app/api/admin/provider-preflight/route.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
 let calls=0;
 const endpoint=denied=>new Function('requireAdmin','checkRateLimit','readGeminiModelAccess','process',source+';return GET;')(async()=>denied,()=>null,async()=>{calls++;return {inferenceRequests:0}},{env:{}});
 assert.equal((await endpoint(new Response(null,{status:401}))(new Request('https://example.invalid/api/admin/provider-preflight'))).status,401);
 assert.equal((await endpoint(null)(new Request('https://example.invalid/api/admin/provider-preflight?model=other'))).status,400);assert.equal(calls,0);
 const response=await endpoint(null)(new Request('https://example.invalid/api/admin/provider-preflight'));assert.equal(response.status,200);assert.equal(calls,1);assert.match(response.headers.get('cache-control'),/private.*no-store/);
});
