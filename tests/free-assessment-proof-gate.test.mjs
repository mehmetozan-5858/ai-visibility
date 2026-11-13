import test from 'node:test';
import assert from 'node:assert/strict';
import {freeAssessmentEvidence} from '../lib/free-assessment-rules.js';

const now=Date.parse('2026-11-13T15:00:00.000Z');
const entity={id:'e123',domain:'example.com'};
const queries=['Which businesses sell precision tools?','Who supplies precision equipment?'];
const providers=['OpenRouter','Gemini','Perplexity'];
const observation=(provider,query,opts={})=>({
 provider,query,model:'test-model',mode:'api-no-search',
 text:'Source-grounded synthetic fixture',brandPrompted:false,truncated:false,
 brandMentioned:false,responseId:'synthetic-'+provider+'-'+query,checkedAt:'2026-11-13T14:59:00.000Z',...opts
});
const fixture=(observations,createdAt='2026-11-13T14:59:10.000Z')=>[{
 entityId:entity.id,entityType:'prospect',domain:entity.domain,createdAt,
 result:{observations}
}];
test('six independent identifiable fresh responses can pass original 6/2/2 gate',()=>{
 const obs=providers.flatMap(p=>queries.map(q=>observation(p,q)));
 const r=freeAssessmentEvidence(entity,fixture(obs),{now});
 assert.equal(r.status,'ready');assert.equal(r.samples,6);
 assert.equal(r.providers,3);assert.equal(r.queries,2);assert.equal(r.score,0);
});
test('missing provider response identity cannot fabricate a ready assessment',()=>{
 const obs=providers.flatMap(p=>queries.map(q=>observation(p,q)));
 obs[0].responseId='';
 const r=freeAssessmentEvidence(entity,fixture(obs),{now});
 assert.equal(r.status,'insufficient');assert.equal(r.samples,5);assert.equal(r.score,null);
});
test('stale, future and run-date-inconsistent observations cannot be refreshed by a new run',()=>{
 const invalid=['2026-10-01T10:00:00.000Z','2026-11-14T12:00:00.000Z','2026-11-13T16:00:00.000Z'];
 for(const checkedAt of invalid){
  const obs=providers.flatMap(p=>queries.map(q=>observation(p,q)));
  obs[0].checkedAt=checkedAt;
  const r=freeAssessmentEvidence(entity,fixture(obs),{now});
  assert.equal(r.status,'insufficient',checkedAt);
  assert.equal(r.samples,5,checkedAt);
 }
});
test('one free-only provider and duplicate responses cannot satisfy multi-provider requirements',()=>{
 const obs=[...queries.map(q=>observation('OpenRouter',q)),...queries.map(q=>observation('OpenRouter',q))];
 const r=freeAssessmentEvidence(entity,fixture(obs),{now});
 assert.equal(r.status,'insufficient');assert.equal(r.samples,2);
 assert.equal(r.providers,1);assert.equal(r.score,null);
});

test('case and surrounding whitespace never create a second distinct neutral question',()=>{
 const r=freeAssessmentEvidence(entity,fixture([
  observation('OpenRouter','  WHICH BUSINESSES SELL PRECISION TOOLS?  '),
  observation('Gemini','which businesses sell precision tools?'),
  observation('Perplexity','Which Businesses Sell Precision Tools?')
 ]),{now});
 assert.equal(r.queries,1);
 assert.equal(r.samples,3);
 assert.equal(r.status,'insufficient');
 assert.equal(r.score,null);
});
