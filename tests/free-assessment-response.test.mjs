import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validFreeAssessmentResponse} from '../lib/free-assessment-response.mjs';
const valid=()=>({business:{name:'Example business'},assessment:{status:'insufficient',score:null,samples:0,providers:0,queries:0},plans:[{code:'business-diagnosis',name:'Initial assessment',amount:119,currency:'EUR',kind:'one-time',href:'/yeni-musteri?service=business-diagnosis'}]});
test('expected free assessment envelope remains renderable',()=>assert.equal(validFreeAssessmentResponse(valid()),true));
test('partial or malformed API responses never reach customer render path',()=>{
 for(const payload of [null,{}, {...valid(),business:null},{...valid(),assessment:null},{...valid(),assessment:{...valid().assessment,samples:null}},{...valid(),assessment:{...valid().assessment,score:NaN}},{...valid(),plans:null},{...valid(),plans:[{...valid().plans[0],amount:Infinity}]},{...valid(),plans:[{...valid().plans[0],href:'https://untrusted.example/pay'}]}])
  assert.equal(validFreeAssessmentResponse(payload),false);
});
test('public UI gates setData on the strict envelope predicate',async()=>{
 const source=await readFile(new URL('../components/FreeAssessment.js',import.meta.url),'utf8');
 assert.match(source,/validFreeAssessmentResponse\(d\)/);
 assert.match(source,/throw Error\('Ön değerlendirme verisi eksik veya geçersiz\.'/);
});
