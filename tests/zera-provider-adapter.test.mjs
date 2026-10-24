import test from 'node:test';
import assert from 'node:assert/strict';
import {createVerifiedPublicProviderAdapter,executeZeraPilotWithProvider} from '../pilot/zera-provider-adapter.mjs';
test('provider is dependency-injected and never called before approval',async()=>{
 let count=0; const search=async()=>{count++;return {}};
 await assert.rejects(executeZeraPilotWithProvider({search,approved:false}),/approval/);
 assert.equal(count,0);
});
test('valid provider evidence can be recorded',async()=>{
 const search=async({query})=>({sourceUrl:'https://example.org/public',observedAt:'2026-10-24T18:00:00Z',observation:'TEST FIXTURE '+query});
 const run=await executeZeraPilotWithProvider({search,approved:true,maxTasks:1});
 assert.equal(run.verifiedResults,1);
});
test('unverified provider data cannot be reported as completed',async()=>{
 const run=await executeZeraPilotWithProvider({search:async()=>({observation:'missing source'}),approved:true,maxTasks:1});
 assert.equal(run.verifiedResults,0);
});
test('unsupported channel is blocked',async()=>{
 const adapter=createVerifiedPublicProviderAdapter({search:async()=>({}),allowedChannels:['google']});
 await assert.rejects(adapter({channel:'ai-answer',locale:'de-DE',query:'x',id:'x'}),/unavailable/);
});
