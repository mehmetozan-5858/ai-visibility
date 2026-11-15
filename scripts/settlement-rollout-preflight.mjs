#!/usr/bin/env node
/**
 * Offline release evidence gate. Reads a locally reviewed JSON manifest only.
 * Never contacts Paddle, Neon, Vercel, or customers, and never grants access.
 * Operator attestations are NOT independent proof: keep supporting bank, auth,
 * signed webhook and live Vercel evidence outside this script.
 */
import {readFileSync} from 'node:fs';
import {assessSettlementRollout} from '../lib/settlement-rollout-readiness.mjs';

const file=process.argv[2];
let evidence=null;
if(file&&process.argv.length===3){
 try{
  const data=readFileSync(file,'utf8');
  if(Buffer.byteLength(data,'utf8')<=16384)evidence=JSON.parse(data);
 }catch{}
}
const expectedKeys=['legacyBankPaidClients','legacyClientsWithIndependentContinuity','bankProofReviewComplete','paddleProofTableReady','verifiedLinkedPaddleSettlement','nonzeroLinkedCompletedPaddleCount','liveCustomerLoginAccepted'];
const strictShape=evidence&&typeof evidence==='object'&&!Array.isArray(evidence)
 &&Object.keys(evidence).sort().join('|')===expectedKeys.slice().sort().join('|');
const result=strictShape?assessSettlementRollout(evidence):{ready:false,blockers:['missing-or-invalid-review-manifest']};
process.stdout.write(JSON.stringify({ok:result.ready,decision:'advisory-release-hold',blockers:result.blockers})+'\n');
if(!result.ready)process.exitCode=1;
