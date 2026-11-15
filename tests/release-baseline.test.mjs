import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {releaseBaselineDecision} from '../lib/release-baseline.mjs';
const old='a'.repeat(40),next='b'.repeat(40),moved='c'.repeat(40);
const base={observedProductionSha:old,expectedProductionSha:old,candidateSha:next,productionIsAncestor:true};
test('release preflight only approves matching observed live ancestor, never claims release readiness',()=>{
 assert.deepEqual(releaseBaselineDecision(base),{ok:true,reason:'ancestry-ok-not-release-approval'});
 assert.equal(releaseBaselineDecision({...base,observedProductionSha:moved}).reason,'production-moved-recheck-required');
 assert.equal(releaseBaselineDecision({...base,candidateSha:old}).reason,'candidate-equals-production-no-change');
 assert.equal(releaseBaselineDecision({...base,productionIsAncestor:false}).reason,'candidate-not-descended-from-production');
 for(const k of ['observedProductionSha','expectedProductionSha','candidateSha'])
  assert.equal(releaseBaselineDecision({...base,[k]:'main'}).reason,'invalid-'+k);
});
test('release preflight is an explicitly manual, non-deploying, fail-closed Git ancestry check',async()=>{
 const source=await readFile(new URL('../scripts/release-baseline-preflight.mjs',import.meta.url),'utf8');
 assert.match(source,/process\.env\.OBSERVED_PRODUCTION_SHA/);
 assert.match(source,/process\.env\.EXPECTED_PRODUCTION_SHA/);
 assert.match(source,/merge-base/);assert.match(source,/--is-ancestor/);
 assert.match(source,/if\(!result\.ok\)process\.exitCode=1/);
 assert.doesNotMatch(source,/vercel deploy|deployments\.create|git push|git reset/);
});
