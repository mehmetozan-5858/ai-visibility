import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {renderOrderGuideSocialDraft} from '../lib/order-guide-social.mjs';
import {outlineOrderGuideSocialSvg,exportOrderGuideSocialPng} from '../lib/order-guide-social-png.mjs';
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

test('German text becomes actual glyph outlines rather than font-dependent SVG text',()=>{
 const input={brand:'Müller & Co'};
 const svg=outlineOrderGuideSocialSvg(renderOrderGuideSocialDraft(input));
 assert.doesNotMatch(svg,/<text\b|font-family=/);
 assert.ok((svg.match(/<path\b/g)||[]).length>100);
 assert.notEqual(outlineOrderGuideSocialSvg(renderOrderGuideSocialDraft({brand:'Miller & Co'})),svg);
});
