import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
const script=fileURLToPath(new URL('../scripts/release-baseline-preflight.mjs',import.meta.url));
function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()}
test('CLI proves actual ancestry; refuses moved, divergent and missing live baseline',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'review-release-ancestry-'));
 try{
  git(dir,'init','-q');git(dir,'config','user.name','Synthetic CI');git(dir,'config','user.email','ci@example.invalid');
  await writeFile(join(dir,'a.txt'),'baseline');
  git(dir,'add','.');git(dir,'commit','-qm','baseline');
  const observed=git(dir,'rev-parse','HEAD');
  await writeFile(join(dir,'a.txt'),'candidate');
  git(dir,'add','.');git(dir,'commit','-qm','candidate');
  const candidate=git(dir,'rev-parse','HEAD');
  function run(env){return spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8',env:{...process.env,OBSERVED_PRODUCTION_SHA:observed,EXPECTED_PRODUCTION_SHA:observed,...env}})}
  const good=run({});assert.equal(good.status,0,good.stderr);assert.deepEqual(JSON.parse(good.stdout),{ok:true,reason:'ancestry-ok-not-release-approval',candidateSha:candidate});
  const moved=run({OBSERVED_PRODUCTION_SHA:candidate});assert.equal(moved.status,1);assert.equal(JSON.parse(moved.stdout).reason,'production-moved-recheck-required');
  const invalid=run({EXPECTED_PRODUCTION_SHA:''});assert.equal(invalid.status,1);assert.equal(JSON.parse(invalid.stdout).reason,'invalid-expectedProductionSha');
  // Put the observed release commit on a disjoint root in the same repo.
  git(dir,'checkout','--orphan','disjoint');
  await rm(join(dir,'a.txt'));await writeFile(join(dir,'different.txt'),'not descendant');
  git(dir,'add','-A');git(dir,'commit','-qm','unrelated');
  const diverged=run({});assert.equal(diverged.status,1);assert.equal(JSON.parse(diverged.stdout).reason,'candidate-not-descended-from-production');
 }finally{await rm(dir,{recursive:true,force:true})}
});
