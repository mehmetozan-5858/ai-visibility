import test from 'node:test';
import assert from 'node:assert/strict';
import {projectZeraResults} from '../lib/zera-results-view.mjs';
const result={provider:'gemini',status:'source-supported-answer',verified:true,answer:'A source-backed passage',
 evidence:{sourceUrl:'https://ze-ra.de/',observation:'A source-backed passage'}};
const view=v=>projectZeraResults([{id:'comparison-1',results:[v]}])[0].results[0];
test('only boolean verification plus a supported answer and source can count',()=>{
 assert.equal(view(result).verified,true);
 for(const verified of ['false','true',1,{},null,undefined])assert.equal(view({...result,verified}).verified,false);
 for(const status of ['failed','answer-received-unverified','empty-answer'])assert.equal(view({...result,status}).verified,false);
 assert.equal(view({...result,answer:''}).verified,false);
 assert.equal(view({...result,evidence:{sourceUrl:'https://ze-ra.de/'}}).verified,false);
});
test('untrusted source schemes and credentials never reach report links',()=>{
 for(const sourceUrl of ['javascript:alert(1)','http://ze-ra.de','https://user:password@example.com','invalid',
  'https://localhost/','https://127.0.0.1/','https://[::1]/','https://service.internal/']){
  const projected=view({...result,evidence:{sourceUrl,observation:'Observation'}});
  assert.equal(projected.verified,false);assert.equal(projected.sourceUrl,null);
 }
});
test('malformed stored values cannot crash read-only results',()=>{
 assert.deepEqual(projectZeraResults(null),[]);
 assert.deepEqual(projectZeraResults([null,{results:[null,'junk',{provider:'other'}]}])[0].results,[]);
});
test('raw provider errors and arbitrary stored columns are never returned',()=>{
 const rows=projectZeraResults([{secret:'private',results:[{...result,status:'failed',reason:'token=private',secret:'private'}]}]);
 assert.equal(rows[0].results[0].reason,'provider-failure-undetermined');
 assert.equal(JSON.stringify(rows).includes('private'),false);
});
test('duplicate providers cannot inflate verified counts or retain an unsupported label',()=>{
 const projected=projectZeraResults([{results:[result,result]}])[0].results;
 assert.equal(projected.length,1);
 assert.equal(view({...result,verified:'false'}).status,'answer-received-unverified');
});
