import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreLead,rankLeads} from '../lib/precision-sales.mjs';
const ev=(confidence=1)=>({url:'https://example.org/evidence',observedAt:'2026-10-08',note:'Public evidence',confidence});
test('no evidence earns zero',()=>{assert.equal(scoreLead({}).total,0);assert.equal(scoreLead({}).tier,'hold');});
test('fully evidenced lead scores 100 but never auto authorizes outreach',()=>{const evidence=Object.fromEntries(['problem','intent','capacity','contact','fit'].map(k=>[k,ev()]));const result=scoreLead({evidence});assert.equal(result.total,100);assert.equal(result.readyForOutreach,false);});
test('invalid evidence earns zero',()=>{assert.equal(scoreLead({evidence:{problem:{...ev(),url:'not-a-url'}}}).total,0);});
test('rank is descending',()=>{assert.equal(rankLeads([{name:'low'},{name:'high',evidence:{problem:ev()}}])[0].name,'high');});
