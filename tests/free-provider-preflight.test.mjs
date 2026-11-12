import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFreeProviderAccess} from '../lib/free-provider-preflight.mjs';
const env={APPLICANT_FREE_MEASUREMENT_ENABLED:'true',OPENROUTER_API_KEY:'synthetic-secret',OPENROUTER_FREE_MODEL:'test/model:free'};
test('read-only preflight makes two fixed GETs and reveals no account payload or key',async()=>{
 const calls=[];const result=await readFreeProviderAccess({env,fetchImpl:async(url,opts)=>{
  calls.push(url);assert.equal(opts.method,'GET');assert.equal(opts.body,undefined);assert.equal(opts.redirect,'error');
  if(url.endsWith('/key')){assert.equal(opts.headers.Authorization,'Bearer synthetic-secret');return Response.json({data:{label:'private-account',limit:123}})}
  assert.equal(opts.headers.Authorization,undefined);
  return Response.json({data:[{id:env.OPENROUTER_FREE_MODEL,pricing:{prompt:'0',completion:'0'}}]});
 }});
 assert.deepEqual(calls.sort(),['https://openrouter.ai/api/v1/key','https://openrouter.ai/api/v1/models']);
 assert.equal(result.state,'credential-and-price-confirmed');assert.equal(result.inferenceRequests,0);assert.equal(result.quotaVerified,false);
 assert.doesNotMatch(JSON.stringify(result),/synthetic-secret|private-account|123/);
});
test('missing configuration does not call the network',async()=>{
 const r=await readFreeProviderAccess({fetchImpl:async()=>{throw Error('must not call')}});assert.equal(r.state,'not-configured');
});
test('credential rejection is distinguished from price and transport failure without raw errors',async()=>{
 for(const status of [401,403]){
  const r=await readFreeProviderAccess({env,fetchImpl:async()=>new Response('private-payload',{status})});
  assert.equal(r.state,'credential-rejected');assert.equal(r.providerStatus,status);assert.doesNotMatch(JSON.stringify(r),/private/);
 }
 const paid=await readFreeProviderAccess({env,fetchImpl:async url=>url.endsWith('/key')?new Response('private'):Response.json({data:[{id:env.OPENROUTER_FREE_MODEL,pricing:{prompt:'1',completion:'0'}}]})});
 assert.equal(paid.state,'model-not-verified-free');assert.equal(paid.credentialAccepted,true);assert.equal(paid.modelFree,false);
 const failed=await readFreeProviderAccess({env,fetchImpl:async()=>{throw Error('secret failure')}});assert.equal(failed.state,'credential-check-unavailable');
});
test('admin endpoint rejects unauthenticated, limited and caller-selected destinations before checks',async()=>{
 const source=(await readFile(new URL('../app/api/admin/free-provider-preflight/route.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').replace(/export /g,'');let calls=0;
 const endpoint=(denied,limited)=>new Function('requireAdmin','checkRateLimit','readFreeProviderAccess','process',source+';return GET;')(async()=>denied,()=>limited,async()=>{calls++;return {inferenceRequests:0}},{env:{}});
 const req=new Request('https://example.invalid/api/admin/free-provider-preflight');
 assert.equal((await endpoint(new Response(null,{status:401}))(req)).status,401);
 assert.equal((await endpoint(null,new Response(null,{status:429}))(req)).status,429);
 assert.equal((await endpoint(null)(new Request(req.url+'?url=https://evil.invalid'))).status,400);assert.equal(calls,0);
 const r=await endpoint(null)(req);assert.equal(r.status,200);assert.equal(calls,1);assert.match(r.headers.get('cache-control'),/private.*no-store/);
});
