import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyProviderEvidence} from '../lib/daily-provider-evidence.mjs';
test('unavailable data is unknown for all providers',()=>{const rows=dailyProviderEvidence({available:false});assert.equal(rows.length,3);assert.ok(rows.every(x=>x.status==='unknown'&&x.successful===null))});
test('no rows on an available day means no recorded measurement, not inactive provider',()=>{const rows=dailyProviderEvidence({available:true,providers:[]});assert.ok(rows.every(x=>x.status==='no-measurement'));assert.ok(rows.every(x=>x.failed===0))});
test('recorded answer and failed attempt are separate',()=>{const rows=dailyProviderEvidence({available:true,providers:[{provider:'Gemini',successful:2,failed:1},{provider:'ChatGPT',successful:0,failed:3}]});assert.equal(rows[0].status,'recorded-answers');assert.equal(rows[0].failed,1);assert.equal(rows[1].status,'failed-attempts');assert.equal(rows[2].status,'no-measurement')});
test('bad or incomplete provider counts are never presented as zero',()=>{const rows=dailyProviderEvidence({available:true,providers:[{provider:'Gemini',successful:-1,failed:0},{provider:'ChatGPT',successful:4}]});assert.equal(rows[0].status,'unknown');assert.equal(rows[1].status,'unknown')});

test('duplicate provider rows cannot be misreported as successful measurements',()=>{
 const rows=dailyProviderEvidence({available:true,providers:[
  {provider:'Gemini',successful:4,failed:0},
  {provider:'Gemini',successful:0,failed:4},
  {provider:'ChatGPT',successful:1,failed:0}
 ]});
 assert.deepEqual(rows[0],{provider:'Gemini',status:'unknown',successful:null,failed:null});
 assert.equal(rows[1].status,'recorded-answers');
 assert.equal(rows[2].status,'no-measurement');
});
