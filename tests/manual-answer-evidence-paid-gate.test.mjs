import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../app/api/answer-evidence/route.js',import.meta.url),'utf8'))
 .replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
const id='12345678-1234-4234-8234-123456789012';
function endpoint(env={},overrides={}){
 const state={writes:0,requests:0};
 const deps={
  requireAdmin:async()=>null,enforceSameOrigin:()=>null,checkRateLimit:(_req,options)=>{assert.equal(options.bucket,'manual-answer-evidence');assert.equal(options.limit,6);return overrides.limited?Response.json({error:'limited'},{status:429}):null}, getProspect:async()=>({id,name:'Synthetic',domain:'example.org',sector:'Industry',city:'Ankara'}),
  getClient:async()=>null,getClientProfile:async()=>null,freeMeasurementStatus:()=>({ready:true}),
  evidenceQueries:(_e,q)=>q.map(query=>({query})),clientBaselineOptions:()=>{throw Error('not-used')},
  answerProviders:()=>['Perplexity'],getAnswerEvidenceRun:async()=>null,repeatEvidenceOptions:()=>{throw Error('not-used')},
  measureAnswerEvidence:async()=>{state.requests++;return {id:'synthetic',result:{summary:{successful:0}}}},
  collectFreeAnswerEvidence:async()=>{},listAnswerEvidence:async()=>[],answerEvidenceStatus:async()=>({}),
 };
 const factory=new Function(...Object.keys(deps),'process',source+'\nreturn POST;');
 return {POST:factory(...Object.values(deps),{env}),state};
}
const req=body=>new Request('https://example.invalid/api/answer-evidence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entityType:'prospect',entityId:id,queries:['Who supplies precision equipment?'],...body})});
test('manual paid-capable answer evidence rejects absent and false freeOnly without provider calls',async()=>{
 const {POST,state}=endpoint({});
 for(const body of [{},{freeOnly:false}]){
  const r=await POST(req(body));
  assert.equal(r.status,403);
  assert.equal(state.requests,0);
 }
});
test('manual freeOnly=true still follows zero-price-only collector path',async()=>{
 const {POST,state}=endpoint({});
 assert.equal((await POST(req({freeOnly:true}))).status,200);
 assert.equal(state.requests,1);
});
test('paid-capable path needs separately explicit review opt-in',async()=>{
 const {POST,state}=endpoint({PAID_ANSWER_EVIDENCE_ENABLED:'true'});
 assert.equal((await POST(req({freeOnly:false}))).status,200);
 assert.equal(state.requests,1);
});

test('shared admin manual rate limit rejects before body parsing, database and provider access',async()=>{
 const {POST,state}=endpoint({}, {limited:true});
 const response=await POST(new Request('https://example.invalid/api/answer-evidence',{method:'POST',body:'invalid-json'}));
 assert.equal(response.status,429);
 assert.equal(state.requests,0);
});
