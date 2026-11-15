import test from 'node:test';
import assert from 'node:assert/strict';
import {runLocalizedProviderChecks} from '../lib/localized-ai.js';

const KEYS=['OPENROUTER_FREE_ENABLED','OPENROUTER_API_KEY','OPENROUTER_FREE_MODEL',
 'GEMINI_API_KEY','PERPLEXITY_API_KEY','OPENAI_API_KEY','AI_PROVIDER_API_KEY',
 'AI_GATEWAY_API_KEY','VERCEL_OIDC_TOKEN','VERCEL'];
async function withEnv(set,fn){
 const old=Object.fromEntries(KEYS.map(k=>[k,process.env[k]]));
 const originalFetch=globalThis.fetch;
 try{
  for(const k of KEYS)delete process.env[k];
  Object.assign(process.env,set);
  return await fn();
 }finally{
  globalThis.fetch=originalFetch;
  for(const k of KEYS){
   if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];
  }
 }
}
const business={name:'Synthetic Business',domain:'synthetic.example.test',
 sector:'test',city:'Sivas',country:'Türkiye'};
const report={score:61,summary:'Synthetic source-only overview',
 findings:['Synthetic evidence gap'],recommendations:['Check schema'],
 reason:'Synthetic test',visibility:{confidence:20}};
test('OpenRouter is disabled by default even if a key exists',async()=>{
 await withEnv({OPENROUTER_API_KEY:'synthetic-placeholder-key-longer-than-20',
  OPENROUTER_FREE_MODEL:'openrouter/free'},async()=>{
  globalThis.fetch=async()=>{throw Error('unapproved provider call')};
  const response=await runLocalizedProviderChecks(business,'tr');
  assert.deepEqual(response.results,[]);
  assert.deepEqual(response.errors,[]);
 });
});
test('only explicitly enabled free OpenRouter path returns labeled synthetic provider result',async()=>{
 await withEnv({OPENROUTER_FREE_ENABLED:'true',
  OPENROUTER_API_KEY:'synthetic-placeholder-key-longer-than-20',
  OPENROUTER_FREE_MODEL:'openrouter/free'},async()=>{
  let calls=0;
  globalThis.fetch=async (url,opts)=>{
   calls++;assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');
   assert.equal(JSON.parse(opts.body).model,'openrouter/free');
   return {ok:true,json:async()=>({
    id:'synthetic-completion-only',model:'synthetic/model:free',
    usage:{cost:0},
    choices:[{finish_reason:'stop',message:{content:JSON.stringify(report)}}]
   })};
  };
  const response=await runLocalizedProviderChecks(business,'tr');
  assert.equal(calls,1);
  assert.equal(response.results.length,1);
  assert.equal(response.results[0].provider,'OpenRouter');
  assert.equal(response.results[0].score,61);
  assert.equal(response.results[0].providerEvidence.status,'receipt-cost-zero');
  assert.equal(response.errors.length,0);
 });
});
test('paid model configuration cannot trigger a remote call and becomes failed evidence',async()=>{
 await withEnv({OPENROUTER_FREE_ENABLED:'true',
  OPENROUTER_API_KEY:'synthetic-placeholder-key-longer-than-20',
  OPENROUTER_FREE_MODEL:'openai/paid-model'},async()=>{
  let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error('unexpected')};
  const result=await runLocalizedProviderChecks(business,'tr');
  assert.equal(calls,0);
  assert.equal(result.results.length,0);
  assert.equal(result.errors.length,1);
  assert.equal(result.errors[0].provider,'OpenRouter');
 });
});
