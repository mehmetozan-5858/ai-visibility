/** Read two public GitHub endpoints for an already-tested, explicitly named SHA. */
import assert from 'node:assert/strict';
import {collectAiVisibilityRelease} from '../lib/github-release-evidence.mjs';
const [targetSha,rollbackSha]=process.argv.slice(2);
const result=await collectAiVisibilityRelease({targetSha,rollbackSha});
assert.equal(result.provenance.repository,'mehmetozan-5858/ai-visibility');
assert.equal(result.assessment.targetSha,targetSha);assert.equal(result.assessment.rollbackSha,rollbackSha);
assert.equal(result.assessment.state,'checks-verified','The named prior candidate must have successful exact-SHA checks');
assert.equal(result.deploymentAuthorized,false);
console.log(JSON.stringify({ok:true,scope:'live-public-github-source',subjectSha:targetSha,rollbackSha,
 checks:result.assessment.checks,capturedAt:result.provenance.capturedAt,deploymentAuthorized:false,
 currentRunnerReleaseAuthorized:false}));
