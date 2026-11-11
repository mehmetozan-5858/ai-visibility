import test from 'node:test';
import assert from 'node:assert/strict';
import {freeAssessmentPresentation} from '../lib/free-assessment-presentation.mjs';
const min={samples:6,providers:2,queries:2};
test('valid ready sample exposes only limited evidence score',()=>{const x=freeAssessmentPresentation({status:'ready',score:50,samples:6,providers:2,queries:2,minimum:min});assert.equal(x.showScore,true);assert.equal(x.evidenceState,'eligible-sample')});
test('missing provider coverage never displays a score',()=>{const x=freeAssessmentPresentation({status:'ready',score:80,samples:8,providers:1,queries:3,minimum:min});assert.equal(x.showScore,false);assert.equal(x.missing.providers,1)});
test('unknown, malformed, or insufficient sample never becomes zero score',()=>{for(const a of [null,{status:'ready',score:0,samples:null,providers:2,queries:2},{status:'insufficient',score:0,samples:3,providers:1,queries:1}])assert.equal(freeAssessmentPresentation(a).showScore,false)});
test('ready score must be bounded',()=>{for(const score of [-1,101,NaN])assert.equal(freeAssessmentPresentation({status:'ready',score,samples:6,providers:2,queries:2}).showScore,false)});
