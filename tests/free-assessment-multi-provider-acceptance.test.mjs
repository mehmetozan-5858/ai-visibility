import test from 'node:test';
import assert from 'node:assert/strict';
import {freeAssessmentEvidence} from '../lib/free-assessment-rules.js';

// Synthetic inputs only. These tests never contact AI providers or a database.
const now=Date.parse('2026-11-12T20:00:00.000Z');
const entity={id:'synthetic-prospect',domain:'example.test'};
const query=['Which local businesses provide clothing?','Where can I find quality apparel?','Which apparel stores serve my city?'];
const observation=(provider,q,brandMentioned=false)=>({
 provider,model:provider==='Gemini'?'synthetic-gemini':'synthetic-openrouter',
 mode:'api-no-search',query:q,text:'A neutral synthetic response',
 brandPrompted:false,truncated:false,brandMentioned
});
const run=(provider,queryIndex,at=now-60000,mention=false)=>({
 entityId:entity.id,entityType:'prospect',domain:entity.domain,createdAt:new Date(at).toISOString(),
 result:{observations:[observation(provider,query[queryIndex],mention)]}
});
test('two providers times two questions remains insufficient (four unique samples)',()=>{
 const runs=['OpenRouter','Gemini'].flatMap(p=>[0,1].map(i=>run(p,i)));
 const result=freeAssessmentEvidence(entity,runs,{now});
 assert.deepEqual([result.samples,result.providers,result.queries],[4,2,2]);
 assert.equal(result.status,'insufficient');assert.equal(result.score,null);
});
test('two independent providers times three neutral questions reaches six distinct samples',()=>{
 const runs=['OpenRouter','Gemini'].flatMap(p=>[0,1,2].map(i=>run(p,i,now-(i+1)*60000,i===0)));
 const result=freeAssessmentEvidence(entity,runs,{now});
 assert.deepEqual([result.samples,result.providers,result.queries],[6,2,3]);
 assert.equal(result.status,'ready');assert.equal(result.score,33);
});
test('repeat provider and question never creates extra eligible samples',()=>{
 const runs=['OpenRouter','Gemini'].flatMap(p=>[0,1].map(i=>run(p,i)));
 runs.push(run('OpenRouter',0,now-1000,true),run('Gemini',1,now-2000));
 const result=freeAssessmentEvidence(entity,runs,{now});
 assert.equal(result.samples,4);assert.equal(result.status,'insufficient');
});
test('stale, wrong tenant, future and incomplete responses do not unlock score',()=>{
 const valid=['OpenRouter','Gemini'].flatMap(p=>[0,1].map(i=>run(p,i)));
 const stale=run('Gemini',2,now-15*86400000);
 const foreign={...run('OpenRouter',2),entityId:'different-tenant'};
 const future=run('Gemini',2,now+1000);
 const incomplete=run('OpenRouter',2);incomplete.result.observations[0].truncated=true;
 const result=freeAssessmentEvidence(entity,[...valid,stale,foreign,future,incomplete],{now});
 assert.equal(result.samples,4);assert.equal(result.status,'insufficient');
 assert.equal(result.score,null);
});
