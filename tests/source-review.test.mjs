import test from 'node:test';import assert from 'node:assert/strict';
import {reviewInput,verifySourceReview,visibleText,reviewedGuidance} from '../lib/source-review.js';
const id='12345678-1234-1234-1234-123456789abc',fact={sourceUrl:'https://company.com/services',excerpt:'We manufacture industrial packaging equipment.'};
test('source import retains only bounded excerpts, never model scores or findings',()=>{const r=reviewInput({reviews:[{id,score:10,findings:['unverified'],facts:[fact]}]});assert.equal(r[0].score,undefined);assert.deepEqual(r[0].facts,[fact]);assert.throws(()=>reviewInput({reviews:Array.from({length:11},()=>({id,facts:[fact]}))}));assert.throws(()=>reviewInput({reviews:[{id,facts:[fact]},{id,facts:[fact]}]}))});
test('official excerpts are checked against current page; no invented deficiency import',async()=>{const review=await verifySourceReview({id,facts:[fact]},{domain:'company.com'},{read:async()=>({html:'<html><p>'+fact.excerpt+'</p></html>'})});assert.equal(review.facts.length,1);assert.equal(review.score,undefined);await assert.rejects(()=>verifySourceReview({id,facts:[fact]},{domain:'company.com'},{read:async()=>({html:'Different text'})}),/excerpt-not-on-official-page/);let calls=0;await assert.rejects(()=>verifySourceReview({id,facts:[{...fact,sourceUrl:'https://evil.org'}]},{domain:'company.com'},{read:async()=>{calls++}}));assert.equal(calls,0)});
test('script and comment content cannot serve as published source facts',()=>assert.equal(visibleText('<script>hidden</script><!-- hidden --><p>Published facts</p>'),'Published facts'));

const assessment={decision:'needs-review',findings:[{text:'Commercial fit requires review.',factIndexes:[0]}],actions:[{text:'Check the service buyer before preparation.',factIndexes:[0]}],uncertainties:['No provider visibility measurement available.']};
test('reviewer judgement stays separate and must cite verified facts',async()=>{
 const input=reviewInput({reviews:[{id,facts:[fact],assessment:{...assessment,score:90}}]})[0];
 assert.equal(input.assessment.score,undefined);assert.equal(input.assessment.findings[0].kind,'reviewer-inference');
 const review=await verifySourceReview(input,{domain:'company.com'},{read:async()=>({html:fact.excerpt})});
 assert.equal(review.method,'manual-source-review-v2');assert.equal(reviewedGuidance(review).decision,'needs-review');assert.equal(review.score,undefined);
 for(const invalid of [{...assessment,decision:'send'},{...assessment,findings:[{text:'Uncited possible opportunity',factIndexes:[1]}]},{...assessment,uncertainties:['short']}])assert.throws(()=>reviewInput({reviews:[{id,facts:[fact],assessment:invalid}]}));
 assert.equal(reviewedGuidance({method:'manual-source-review-v1',facts:[fact],assessment}),null);
});
