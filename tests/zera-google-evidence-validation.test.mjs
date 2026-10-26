import test from 'node:test';
import assert from 'node:assert/strict';
import {ZERA_TASKS} from '../lib/zera-evidence-orchestrator.mjs';
import {validateZeraGoogleEvidence} from '../lib/zera-google-evidence-validation.mjs';

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

test('review candidates stay unverified and cannot masquerade as completed evidence',()=>{
 const candidate=validateZeraGoogleEvidence({...base,verified:false},{requireVerified:false});
 assert.equal(candidate.ok,true);
 assert.equal(candidate.evidence.verified,false);
 assert.equal(candidate.evidence.status,'pending-review');
 assert.equal(validateZeraGoogleEvidence(base,{requireVerified:false}).ok,false);
});

test('private and numeric source hosts cannot be staged as evidence',()=>{
 for(const sourceUrl of ['https://127.0.0.1/private','https://192.168.1.3/','https://10.0.0.4/','https://service.internal/','https://host.local/','https://[::1]/']){
  const result=validateZeraGoogleEvidence({...base,sourceUrl,verified:false},{requireVerified:false});
  assert.equal(result.ok,false,sourceUrl);
 }
});
