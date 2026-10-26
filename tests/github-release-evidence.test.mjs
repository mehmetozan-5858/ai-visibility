import test from 'node:test';
import assert from 'node:assert/strict';
import {collectAiVisibilityRelease} from '../lib/github-release-evidence.mjs';
const targetSha='a'.repeat(40),rollbackSha='b'.repeat(40);
const check=(name,id,extra={})=>({name,id,head_sha:targetSha,status:'completed',conclusion:'success',app:{id:15368,slug:'github-actions'},...extra});
const response=(data,headers={})=>Response.json(data,{headers});
function source(checks,extra={}){return async(url,options)=>{
 assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,undefined);
 assert.match(url,/^https:\/\/api.github.com\/repos\/mehmetozan-5858\/ai-visibility\//);
 return url.includes('check-runs')?response({total_count:checks.length,check_runs:checks,...extra}):response({sha:rollbackSha});
};}
test('real GitHub response contract maps exact commit checks without authorizing deployment',async()=>{
 const r=await collectAiVisibilityRelease({targetSha,rollbackSha,fetchImpl:source([check('build',1),check('web-mobile-smoke',2)])});
 assert.equal(r.assessment.state,'checks-verified');assert.equal(r.deploymentAuthorized,false);
 assert.equal(r.provenance.repository,'mehmetozan-5858/ai-visibility');
});
test('latest failed rerun supersedes an earlier successful run',async()=>{
 const r=await collectAiVisibilityRelease({targetSha,rollbackSha,fetchImpl:source([check('build',1),check('build',3,{conclusion:'failure'}),check('web-mobile-smoke',2)])});
 assert.equal(r.assessment.state,'blocked');
});
test('wrong commit, foreign app and absent checks do not establish CI',async()=>{
 for(const bad of [check('build',1,{head_sha:rollbackSha}),check('build',1,{app:{id:1,slug:'other'}})]){
  const r=await collectAiVisibilityRelease({targetSha,rollbackSha,fetchImpl:source([bad,check('web-mobile-smoke',2)])});
  assert.equal(r.assessment.state,'blocked');
 }
});
test('partial pagination and inconsistent totals are rejected',async()=>{
 await assert.rejects(collectAiVisibilityRelease({targetSha,rollbackSha,fetchImpl:source([],{total_count:10})}),/incomplete/);
 await assert.rejects(collectAiVisibilityRelease({targetSha,rollbackSha,fetchImpl:async()=>response({}, {link:'<https://api.github.com/next>; rel="next"'})}),/truncated/);
});
test('rollback mismatch and non-JSON/error responses fail closed',async()=>{
 await assert.rejects(collectAiVisibilityRelease({targetSha,rollbackSha,fetchImpl:async url=>url.includes('check-runs')?response({total_count:0,check_runs:[]}):response({sha:targetSha})}),/rollback-source-mismatch/);
 await assert.rejects(collectAiVisibilityRelease({targetSha,rollbackSha,fetchImpl:async()=>new Response('not json')}),/invalid-github-response/);
 await assert.rejects(collectAiVisibilityRelease({targetSha,rollbackSha,fetchImpl:async()=>new Response('private remote error',{status:429})}),/github-source-http-429/);
});
