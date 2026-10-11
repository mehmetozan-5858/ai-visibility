import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreSubjectAllocation,allocateScoreSubjectVariant} from '../lib/outreach-adaptive-experiment.js';
import {outreachSubject,scoreSubjectVariantFor} from '../lib/outreach-quality.js';

test('stays 50/50 until both experiment arms have enough evidence',()=>{
 const p=scoreSubjectAllocation({score_sent:19,score_replied:8,curiosity_sent:50,curiosity_replied:2});
 assert.equal(p.stage,'learning');assert.equal(p.scoreShare,0.5);assert.equal(p.curiosityShare,0.5);assert.equal(p.winner,'NONE');
});

test('moves to 70/30 when measured lift clears the threshold',()=>{
 const p=scoreSubjectAllocation({score_sent:30,score_replied:9,score_converted:1,curiosity_sent:30,curiosity_replied:3,curiosity_converted:0});
 assert.equal(p.stage,'adaptive-70-30');assert.equal(p.winner,'SCORE');assert.equal(p.scoreShare,0.7);assert.equal(p.curiosityShare,0.3);
});

test('moves to 80/20 only with a larger sample and strong lift',()=>{
 const p=scoreSubjectAllocation({score_sent:70,score_replied:28,score_converted:4,curiosity_sent:70,curiosity_replied:7,curiosity_converted:1});
 assert.equal(p.stage,'adaptive-80-20');assert.equal(p.winner,'SCORE');assert.equal(p.scoreShare,0.8);assert.equal(p.curiosityShare,0.2);
 const reverse=scoreSubjectAllocation({score_sent:70,score_replied:5,score_converted:0,curiosity_sent:70,curiosity_replied:25,curiosity_converted:3});
 assert.equal(reverse.winner,'CURIOSITY');assert.equal(reverse.scoreShare,0.2);assert.equal(reverse.curiosityShare,0.8);
});

test('weighted allocator is deterministic and never removes exploration arm',()=>{
 for(const share of [0.2,0.3,0.5,0.7,0.8]){
  const plan={scoreShare:share};let score=0,curiosity=0;
  for(let i=0;i<500;i++){const a=allocateScoreSubjectVariant(`company-${i}`,plan);assert.equal(a,allocateScoreSubjectVariant(`company-${i}`,plan));if(a==='SCORE')score++;else curiosity++;}
  assert.ok(score>0);assert.ok(curiosity>0);
 }
});

test('explicit adaptive arm controls subject while body evidence can remain unchanged',()=>{
 const base={id:'adaptive-company',name:'Örnek Makina',country:'Türkiye',sector:'CNC üretim',preliminaryScore:41};
 assert.equal(scoreSubjectVariantFor({...base,scoreSubjectVariantOverride:'SCORE'}),'SCORE');
 assert.match(outreachSubject({...base,scoreSubjectVariantOverride:'SCORE'}),/41\/100/);
 assert.equal(scoreSubjectVariantFor({...base,scoreSubjectVariantOverride:'CURIOSITY'}),'CURIOSITY');
 assert.doesNotMatch(outreachSubject({...base,scoreSubjectVariantOverride:'CURIOSITY'}),/41\/100/);
});
