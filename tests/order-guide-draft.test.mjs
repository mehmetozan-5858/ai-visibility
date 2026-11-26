import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOrderGuideDraft} from '../lib/order-guide-draft.mjs';

test('missing facts stay missing and draft is not approved',()=>{
 const d=buildOrderGuideDraft({brand:'Example'});
 assert.equal(d.language,'de');
 assert.equal(d.status,'draft');
 assert.equal(d.publicationApproved,false);
 assert.equal(d.whatsappUrl,null);
 assert.deepEqual(d.missing,['whatsappUrl','code','sizes','price','delivery']);
 assert.equal(d.steps.length,4);
});
test('complete example remains a draft',()=>{
 const d=buildOrderGuideDraft({brand:'Example',whatsappUrl:'https://wa.me/491234567890',article:{code:'EXAMPLE',sizes:'S',price:'10 EUR',delivery:'Example only'}});
 assert.deepEqual(d.missing,[]);
 assert.equal(d.publicationApproved,false);
});
test('reject noncanonical and unsafe links',()=>{
 for(const whatsappUrl of ['http://wa.me/491234567890','https://wa.me.evil.example/491234567890','https://evil.example/491234567890','https://wa.me/abc','https://x@wa.me/491234567890','https://wa.me/491234567890?text=x','https://wa.me/491234567890#x']){
  assert.throws(()=>buildOrderGuideDraft({brand:'Example',whatsappUrl}));
 }
});
test('reject missing and markup brand',()=>{
 for(const brand of [undefined,'','<script>','x\ny'])assert.throws(()=>buildOrderGuideDraft({brand}));
});
