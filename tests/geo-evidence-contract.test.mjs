import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAnswerEvidence} from '../lib/geo-evidence-contract.js';
const base={provider:'Gemini',model:'example-model',query:'Best local suppliers?',answer:'Recorded answer',observedAt:'2026-11-06T10:00:00Z'};
test('records provenance but never claims citation verification',()=>{
 const x=normalizeAnswerEvidence({...base,citations:['https://example.org/source','javascript:alert(1)','https://user:pass@example.org/private']});
 assert.equal(x.status,'recorded');assert.equal(x.citations.length,1);
 assert.equal(x.citationStatus,'links-recorded-not-verified');
});
test('fails closed on demo, errors, missing provenance and truncated answers',()=>{
 for(const x of [null,{}, {...base,demo:true},{...base,synthetic:true},{...base,answer:''},{...base,observedAt:'invalid'},{...base,truncated:true},{...base,providerFailed:true}])
  assert.equal(normalizeAnswerEvidence(x).status,'unverified');
});
test('no citation is not fabricated as evidence',()=>{
 const x=normalizeAnswerEvidence(base);assert.equal(x.citationStatus,'no-citations');assert.deepEqual(x.citations,[]);
});
