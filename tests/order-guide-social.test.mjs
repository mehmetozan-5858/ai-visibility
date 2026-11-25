import test from 'node:test';
import assert from 'node:assert/strict';
import {renderOrderGuideSocialDraft} from '../lib/order-guide-social.mjs';
test('post and story use expected canvas and draft warning',()=>{
 for(const [format,height] of [['post',1350],['story',1920]]){
 const svg=renderOrderGuideSocialDraft({brand:'Example & Co'},{format});
 assert.match(svg,new RegExp('width="1080" height="'+height+'"'));
 assert.ok(svg.includes('Example &amp; Co'));
 assert.ok(svg.includes('NICHT VERÖFFENTLICHEN'));
 assert.ok(svg.includes('WhatsApp-Link noch zu bestätigen'));
 assert.doesNotMatch(svg,/<script|<image|<a\s/i);
 }
});
test('invalid formats and unsafe inputs are rejected',()=>{
 assert.throws(()=>renderOrderGuideSocialDraft({brand:'Example'},{format:'other'}));
 assert.throws(()=>renderOrderGuideSocialDraft({brand:'<script>'}));
 assert.throws(()=>renderOrderGuideSocialDraft({brand:'Example',whatsappUrl:'https://example.org/123'}));
});
