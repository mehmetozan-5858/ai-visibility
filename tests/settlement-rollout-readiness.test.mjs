import test from 'node:test';
import assert from 'node:assert/strict';
import {assessSettlementRollout} from '../lib/settlement-rollout-readiness.mjs';
const all={legacyBankPaidClients:1,legacyClientsWithIndependentContinuity:1,paddleProofTableReady:true,bankProofReviewComplete:true,verifiedLinkedPaddleSettlement:true,liveCustomerLoginAccepted:true};
test('strict settlement switch requires independent legacy bank continuity and live customer acceptance',()=>{
 assert.deepEqual(assessSettlementRollout(all),{ready:true,blockers:[]});
 const atRisk=assessSettlementRollout({...all,legacyClientsWithIndependentContinuity:0});
 assert.equal(atRisk.ready,false);
 assert.ok(atRisk.blockers.includes('legacy-paid-customer-access-at-risk'));
 for(const key of ['paddleProofTableReady','bankProofReviewComplete','verifiedLinkedPaddleSettlement','liveCustomerLoginAccepted']){
  const result=assessSettlementRollout({...all,[key]:false});
  assert.equal(result.ready,false,key);
 }
});
test('unknown, invalid or contradictory counts fail closed rather than assume customer continuity',()=>{
 for(const counts of [{legacyBankPaidClients:undefined,legacyClientsWithIndependentContinuity:undefined},{legacyBankPaidClients:1,legacyClientsWithIndependentContinuity:2},{legacyBankPaidClients:-1,legacyClientsWithIndependentContinuity:0}]){
  const result=assessSettlementRollout({...all,...counts});
  assert.equal(result.ready,false);
  assert.deepEqual(result.blockers,['invalid-audit-counts']);
 }
 assert.equal(assessSettlementRollout({...all,legacyBankPaidClients:17,legacyClientsWithIndependentContinuity:0}).ready,false);
});
