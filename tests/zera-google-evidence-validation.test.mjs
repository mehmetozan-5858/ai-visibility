import test from 'node:test';
import assert from 'node:assert/strict';
import {ZERA_TASKS} from '../lib/zera-evidence-orchestrator.mjs';
import {validateZeraGoogleEvidence,validateZeraGoogleCandidate} from '../lib/zera-google-evidence-validation.mjs';

const base={taskId:'brand-google-de',query:'ZERA Clothing Wetzlar',sourceUrl:'https://example.org/page',observation:'A direct source mentions a relevant result.',verified:true};
test('all five configured Google tasks accept properly matched evidence',()=>{
 for(const task of ZERA_TASKS.filter(t=>t.channel==='google')){
  assert.equal(validateZeraGoogleEvidence({...base,taskId:task.id,query:task.query}).ok,true);
 }
});
test('AI tasks and mismatched queries cannot count as Google evidence',()=>{
 assert.equal(validateZeraGoogleEvidence({...base,taskId:'brand-ai-de'}).ok,false);
 assert.equal(validateZeraGoogleEvidence({...base,query:'arbitrary'}).ok,false);
});
test('unverified observations, insecure URLs and empty evidence are rejected',()=>{
 for(const data of [{verified:false},{sourceUrl:'http://example.org'},{sourceUrl:'https://localhost/private'},{sourceUrl:'https://user:pass@example.org'},{observation:'   '}])
  assert.equal(validateZeraGoogleEvidence({...base,...data}).ok,false);
});

test('similarly named third-party businesses cannot prove the ZERA pilot identity',()=>{
 assert.equal(validateZeraGoogleEvidence({...base,claimsZeraIdentity:true}).ok,false);
 assert.equal(validateZeraGoogleEvidence({...base,claimsZeraIdentity:true,sourceUrl:'https://ze-ra.de/'}).ok,true);
});

test('unverified review candidates never receive a verified evidence envelope',()=>{
 for(const task of ZERA_TASKS.filter(t=>t.channel==='google')){
  const input={...base,taskId:task.id,query:task.query,verified:false};
  const candidate=validateZeraGoogleCandidate(input);
  assert.equal(candidate.ok,true);
  assert.equal(candidate.evidence.verified,false);
  assert.equal(candidate.evidence.status,'pending-review');
  assert.equal(validateZeraGoogleCandidate({...input,verified:true}).ok,false);
 }
});
test('candidate validation rejects forged verification and invalid evidence without promotion',()=>{
 for(const value of [true,'true',1,null])
  assert.equal(validateZeraGoogleCandidate({...base,verified:value}).ok,false);
 for(const data of [{query:'arbitrary'},{sourceUrl:'http://example.org'},{observation:'  '},{taskId:'brand-ai-de'}])
  assert.equal(validateZeraGoogleCandidate({...base,verified:false,...data}).ok,false);
 assert.equal(validateZeraGoogleCandidate({...base,verified:undefined}).evidence.verified,false);
 assert.equal(validateZeraGoogleCandidate({...base,verified:false,claimsZeraIdentity:true}).ok,false);
 assert.equal(validateZeraGoogleCandidate({...base,verified:false,claimsZeraIdentity:true,sourceUrl:'https://ze-ra.de/'}).ok,true);
});
