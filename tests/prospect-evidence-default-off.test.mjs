import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const whole=(await readFile(new URL('../lib/answer-evidence-store.js',import.meta.url),'utf8'));
const marker='export async function measureProspectAnswerEvidence(';
assert.equal(whole.split(marker).length,2,'legacy helper must exist exactly once');
const source='async function measureProspectAnswerEvidence('+whole.split(marker)[1];
function helper(env){
 const state={providers:0,measurements:0};
 const providerList=()=>{state.providers++;return ['Perplexity']};
 const measure=async(entity,options)=>{state.measurements++;return {entity,options}};
 const run=new Function('answerProviders','measureAnswerEvidence','process',
  source+'\nreturn measureProspectAnswerEvidence;')(providerList,measure,{env});
 return {run,state};
}
const prospect={id:'synthetic',name:'Demo',domain:'demo.invalid',sector:'Machining',city:'Berlin'};
test('legacy prospect helper never accesses paid-capable providers when automatic policy is absent or off',async()=>{
 for(const env of [{},{AUTOMATIC_ANSWER_EVIDENCE_ENABLED:'false'}]){
  const {run,state}=helper(env);
  assert.deepEqual(await run(prospect),{skipped:'automatic-evidence-disabled'});
  assert.equal(state.providers,0);
  assert.equal(state.measurements,0);
 }
});
test('legacy helper requires explicit automatic opt-in before provider selection',async()=>{
 const {run,state}=helper({AUTOMATIC_ANSWER_EVIDENCE_ENABLED:'true'});
 const result=await run(prospect);
 assert.equal(state.providers,1);
 assert.equal(state.measurements,1);
 assert.deepEqual(result.options.providers,['Perplexity']);
 assert.equal(result.entity.entityType,'prospect');
});
