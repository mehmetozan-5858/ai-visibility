import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const script=fileURLToPath(new URL('../scripts/settlement-rollout-preflight.mjs',import.meta.url));
const passing={legacyBankPaidClients:1,legacyClientsWithIndependentContinuity:1,bankProofReviewComplete:true,paddleProofTableReady:true,verifiedLinkedPaddleSettlement:true,nonzeroLinkedCompletedPaddleCount:1,liveCustomerLoginAccepted:true};
test('offline evidence CLI refuses missing, invented or contradictory rollout facts',async()=>{
 const d=await mkdtemp(join(tmpdir(),'payment-rollout-review-'));
 try{
  const run=(path)=>spawnSync(process.execPath,[script,...(path?[path]:[])],{encoding:'utf8',env:{...process.env,CUSTOMER_SETTLEMENT_PROOF_ENABLED:'true'}});
  const missing=run();assert.equal(missing.status,1);assert.deepEqual(JSON.parse(missing.stdout).blockers,['missing-or-invalid-review-manifest']);
  const path=join(d,'manifest.json');
  const write=async data=>writeFile(path,JSON.stringify(data));
  await write({...passing,legacyClientsWithIndependentContinuity:0,nonzeroLinkedCompletedPaddleCount:0,verifiedLinkedPaddleSettlement:false});
  const blocked=run(path);assert.equal(blocked.status,1);
  const blockers=JSON.parse(blocked.stdout).blockers;
  assert.ok(blockers.includes('legacy-paid-customer-access-at-risk'));
  assert.ok(blockers.includes('nonzero-completed-linked-paddle-payment-missing'));
  await write({...passing,unknown:true});assert.equal(run(path).status,1,'extra unreviewed claims must fail closed');
  await write({...passing,paddleProofTableReady:null});assert.equal(run(path).status,1);
  await write({...passing,legacyBankPaidClients:'1'});assert.equal(run(path).status,1);
  await write(passing);const positive=run(path);
  assert.equal(positive.status,0,positive.stderr);
  assert.equal(JSON.parse(positive.stdout).decision,'advisory-release-hold','passing manifest is not deployment authorization');
  assert.equal(JSON.parse(positive.stdout).ok,true);
 }finally{await rm(d,{recursive:true,force:true})}
});
