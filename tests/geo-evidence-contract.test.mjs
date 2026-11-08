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

test('rejects oversized evidence instead of silently cutting its content',()=>{
 for(const [field,limit] of [['provider',100],['model',150],['query',1000],['answer',12000]]) {
  assert.equal(normalizeAnswerEvidence({...base,[field]:'x'.repeat(limit)}).status,'recorded');
  assert.equal(normalizeAnswerEvidence({...base,[field]:'x'.repeat(limit+1)}).status,'unverified');
 }
 assert.equal(normalizeAnswerEvidence({...base,citations:Array(101).fill('https://example.org')}).status,'unverified');
 assert.equal(normalizeAnswerEvidence({...base,citations:Array(100).fill('https://example.org')}).citations.length,100);
});
test('requires explicit timezone and rejects normalized invalid calendar dates',()=>{
 for(const observedAt of ['2026-11-06','2026-11-06T10:00:00','2026-02-30T10:00:00Z','2026-02-29T10:00:00Z','2026-11-06T24:00:00Z','2026-11-06T10:00:00+24:00']) {
  assert.equal(normalizeAnswerEvidence({...base,observedAt}).status,'unverified',observedAt);
 }
 for(const observedAt of ['2024-02-29T10:00:00Z','2026-11-06T13:00:00+03:00','2026-11-06T10:00:00.123Z']) {
  assert.equal(normalizeAnswerEvidence({...base,observedAt}).status,'recorded',observedAt);
 }
});
