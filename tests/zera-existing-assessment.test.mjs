import test from 'node:test';import assert from 'node:assert/strict';
import {runZeraExistingAssessment} from '../pilot/zera-existing-assessment.mjs';
test('not invoked without owner approval',async()=>{
 let called=0;
 await assert.rejects(runZeraExistingAssessment({invoke:async()=>{called++}}),/approval/);
 assert.equal(called,0);
});
test('integration uses brand/context but never invents official domain or citation counts',async()=>{
 const output=await runZeraExistingAssessment({approved:true,invoke:async(profile,language)=>{
  assert.equal(profile.domain,'');assert.equal(profile.city,'Wetzlar');assert.equal(language,'en');
  return {results:[{provider:'TEST',score:48,summary:'synthetic fixture'}],errors:[]};
 }});
 assert.equal(output.completed,true);assert.equal(output.measuredSearchPresence,false);
 assert.equal(output.verifiedCitationCount,null);
});
test('unavailable providers yield no false results',async()=>{
 const x=await runZeraExistingAssessment({approved:true,invoke:async()=>({results:[],errors:[{provider:'Gemini',error:'key-missing'}]})});
 assert.equal(x.completed,false);assert.equal(x.results.length,0);
});
