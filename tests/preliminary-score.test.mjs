import test from 'node:test';
import assert from 'node:assert/strict';
import {permissionEnquiry,outreachSubject,safeFirstContact} from '../lib/outreach-quality.js';

const base={id:'score-test',name:'Örnek Makina',country:'Türkiye',city:'Bursa',sector:'CNC / Hassas Talaşlı İmalat'};

test('evidence-backed preliminary score is labelled as an estimate, not a definitive audit',()=>{
 const x={...base,preliminaryScore:38};
 const text=permissionEnquiry(x);
 assert.match(text,/38\/100/);
 assert.match(text,/ön tahmin/);
 assert.match(text,/kesin bir AI sıralaması veya satış performansı ölçümü değildir/);
 assert.match(outreachSubject(x),/38\/100/);
 assert.equal(safeFirstContact({...x,outreachDraft:text}),true);
});

test('missing or invalid score never invents a numeric visibility result',()=>{
 for(const preliminaryScore of [undefined,null,-1,101,'not-a-score']){
  const x={...base,preliminaryScore};
  const text=permissionEnquiry(x);
  assert.doesNotMatch(text,/\b\d{1,3}\/100\b/);
  assert.equal(safeFirstContact({...x,outreachDraft:text}),true);
 }
});
