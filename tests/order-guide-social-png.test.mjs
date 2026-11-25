import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {exportOrderGuideSocialPng} from '../lib/order-guide-social-png.mjs';
test('exports valid PNG in both social formats',async()=>{
 for(const [format,height] of [['post',1350],['story',1920]]){
  const png=await exportOrderGuideSocialPng({brand:'Example'},{format});
  const meta=await sharp(png).metadata();
  assert.equal(meta.format,'png');
  assert.equal(meta.width,1080);
  assert.equal(meta.height,height);
  assert.ok(png.length>1000);
 }
});
test('rejects unsafe inputs',async()=>{
 await assert.rejects(exportOrderGuideSocialPng({brand:'<script>'}));
 await assert.rejects(exportOrderGuideSocialPng({brand:'Example'},{format:'unknown'}));
});
