#!/usr/bin/env node
/**
 * Read-only local/manual release-preflight. Does not call Vercel or deploy.
 * The operator must first independently read the CURRENT live deployment SHA,
 * enter it as OBSERVED_PRODUCTION_SHA, and re-verify before any actual release.
 */
import {execFileSync} from 'node:child_process';
import {releaseBaselineDecision} from '../lib/release-baseline.mjs';
function git(...args){return execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()}
const sha=/^[0-9a-f]{40}$/i;
const observed=process.env.OBSERVED_PRODUCTION_SHA||'';
const expected=process.env.EXPECTED_PRODUCTION_SHA||'';
let candidate='';
let ancestry=false;
try {
 candidate=git('rev-parse','HEAD');
 if(sha.test(observed)&&sha.test(expected)&&sha.test(candidate)){
  // No ref rewriting and no network operations. A shallow checkout cannot
  // prove ancestry and will fail closed until full history is available.
  execFileSync('git',['merge-base','--is-ancestor',observed,candidate],{stdio:'ignore'});
  ancestry=true;
 }
}catch{}
const result=releaseBaselineDecision({observedProductionSha:observed,expectedProductionSha:expected,candidateSha:candidate,productionIsAncestor:ancestry});
process.stdout.write(JSON.stringify({ok:result.ok,reason:result.reason,candidateSha:sha.test(candidate)?candidate:null})+'\n');
if(!result.ok)process.exitCode=1;
