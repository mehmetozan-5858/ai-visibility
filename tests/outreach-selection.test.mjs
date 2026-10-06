import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateOutreachPool} from '../lib/outreach-selection.js';
const ready=(id,score=80)=>({id:String(id),domain:`company${id}.com`,contactEmail:`info@company${id}.com`,contactSourceUrl:`https://company${id}.com/contact`,contactStatus:'verified',qualificationScore:80,communicationStatus:'ready-for-review',outreachStatus:'drafted',proposalStatus:'drafted',scanScore:score,scanProvider:'Perplexity',scanFindings:['Product pages need clear structured technical descriptions.'],scanRecommendations:['Add product schema and buyer questions to product pages.']});
test('all 500 candidates are compared before selecting strongest 50, independent of input order',()=>{
 const rows=Array.from({length:500},(_,i)=>ready(i,i>=450?20:80));
 const a=evaluateOutreachPool(rows),b=evaluateOutreachPool([...rows].reverse());
 assert.equal(a.evaluated,500);assert.equal(a.selected.length,50);assert.ok(a.selected.every(x=>Number(x.id)>=450));assert.deepEqual(a.selected.map(x=>x.id),b.selected.map(x=>x.id));
});
test('discovery scores cannot substitute for actual analysis and actionable recommendations',()=>{
 const rows=[{...ready(1),scanScore:null},{...ready(2),scanProvider:'Test Provider'},{...ready(3),scanRecommendations:[]},{...ready(4),qualificationScore:100,scanFindings:[]},{...ready(5),selectionBlocked:'email-business-mismatch'},ready(6)];
 const r=evaluateOutreachPool(rows);assert.deepEqual(r.selected.map(x=>x.id),['6']);assert.equal(r.awaitingAnalysis,4);
});
test('same business or address is shortlisted once and prior contacts/replies/customers excluded',()=>{
 const x=ready(1);const r=evaluateOutreachPool([x,{...x,id:'duplicate'},{...ready(2),replyStatus:'replied'},{...ready(3),clientId:'paid-customer'},{...ready(4),communicationStatus:'sent'}]);
 assert.equal(r.selected.length,1);assert.equal(r.excluded.length,4);
});
test('shortlist adapts to remaining daily capacity and never pads a sparse pool',()=>{
 assert.equal(evaluateOutreachPool([ready(1),ready(2)],{limit:50}).selected.length,2);
 assert.equal(evaluateOutreachPool([ready(1),ready(2)],{limit:1}).selected.length,1);
 assert.equal(evaluateOutreachPool([ready(1)],{limit:0}).selected.length,0);
});
