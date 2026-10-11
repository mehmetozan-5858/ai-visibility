import test from 'node:test';
import assert from 'node:assert/strict';
import {permissionEnquiry,outreachSubject,safeFirstContact,scoreSubjectExperimentVariant} from '../lib/outreach-quality.js';

const base={id:'score-test',name:'Örnek Makina',country:'Türkiye',city:'Bursa',sector:'CNC / Hassas Talaşlı İmalat'};
const idFor=arm=>{for(let i=0;i<1000;i++){const id=`score-arm-${i}`;if(scoreSubjectExperimentVariant(id)===arm)return id}throw Error('arm-not-found')};

test('evidence-backed preliminary score is labelled as an estimate, not a definitive audit',()=>{
 const x={...base,id:idFor('SCORE'),preliminaryScore:38};
 const text=permissionEnquiry(x);
 assert.match(text,/38\/100/);
 assert.match(text,/ön tahmin/);
 assert.match(text,/kesin bir AI sıralaması veya satış performansı ölçümü değildir/);
 assert.match(outreachSubject(x),/38\/100/);
 assert.equal(safeFirstContact({...x,outreachDraft:text}),true);
});

test('curiosity arm keeps the numeric evidence in the body but not in the subject',()=>{
 const x={...base,id:idFor('CURIOSITY'),preliminaryScore:38};
 assert.match(permissionEnquiry(x),/38\/100/);
 assert.doesNotMatch(outreachSubject(x),/38\/100/);
 assert.match(outreachSubject(x),/doğru alıcı/);
});

test('score subject experiment is deterministic and exposes both arms',()=>{
 const score=idFor('SCORE'),curiosity=idFor('CURIOSITY');
 assert.equal(scoreSubjectExperimentVariant(score),'SCORE');
 assert.equal(scoreSubjectExperimentVariant(score),'SCORE');
 assert.equal(scoreSubjectExperimentVariant(curiosity),'CURIOSITY');
});

test('missing or invalid score never invents a numeric visibility result',()=>{
 for(const preliminaryScore of [undefined,null,-1,101,'not-a-score']){
  const x={...base,preliminaryScore};
  const text=permissionEnquiry(x);
  assert.doesNotMatch(text,/\b\d{1,3}\/100\b/);
  assert.equal(safeFirstContact({...x,outreachDraft:text}),true);
 }
});
