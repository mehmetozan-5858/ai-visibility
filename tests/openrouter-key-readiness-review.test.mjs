import test from 'node:test';
import assert from 'node:assert/strict';
import {checkOpenRouterKeyReadiness} from '../lib/openrouter-key-readiness-review.mjs';
const secret='synthetic-openrouter-token-never-log';
test('missing key does not contact provider',async()=>{
 let called=0;
 const r=await checkOpenRouterKeyReadiness({key:'',fetcher:async()=>{called++;throw Error('unexpected')}});
 assert.equal(r.status,'disabled');assert.equal(called,0);assert.equal(r.modelVerified,false);
});
test('successful key endpoint is NOT proof of model response or paid inference',async()=>{
 let calls=0;
 const r=await checkOpenRouterKeyReadiness({key:secret,fetcher:async(url,opts)=>{
  calls++;assert.equal(url,'https://openrouter.ai/api/v1/key');
  assert.equal(opts.method,'GET');assert.equal(opts.headers.authorization,'Bearer '+secret);
  assert.equal(opts.redirect,'error');assert.equal(opts.cache,'no-store');assert.equal(opts.body,undefined);
  return {status:200,json:async()=>({data:{label:'never-expose-id',limit_remaining:5}})};
 }});
 assert.equal(calls,1);
 assert.deepEqual(r,{status:'recent-evidence',reason:'openrouter-key-endpoint-authenticated',
  authenticated:true,modelVerified:false});
 assert.ok(!JSON.stringify(r).includes('never-expose-id'));
 assert.ok(!JSON.stringify(r).includes(secret));
});
test('auth failure, malformed response, rate limit and network error fail closed',async()=>{
 for(const [status,expect] of [[401,'blocked'],[403,'blocked'],[429,'blocked'],[500,'error']]){
  const r=await checkOpenRouterKeyReadiness({key:secret,fetcher:async()=>({status})});
  assert.equal(r.status,expect);assert.equal(r.authenticated,false);
 }
 const malformed=await checkOpenRouterKeyReadiness({key:secret,fetcher:async()=>({status:200,json:async()=>({data:null})})});
 assert.equal(malformed.status,'error');
 const offline=await checkOpenRouterKeyReadiness({key:secret,fetcher:async()=>{throw Error('private token '+secret)}});
 assert.equal(offline.status,'error');assert.ok(!JSON.stringify(offline).includes(secret));
});
