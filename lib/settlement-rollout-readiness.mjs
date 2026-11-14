/** Read-only rollout readiness decision. Never treats an internal paid flag as bank proof. */
export function assessSettlementRollout({legacyBankPaidClients,legacyClientsWithIndependentContinuity,paddleProofTableReady,bankProofReviewComplete,verifiedLinkedPaddleSettlement,nonzeroLinkedCompletedPaddleCount,liveCustomerLoginAccepted}={}){
 const numbers=[legacyBankPaidClients,legacyClientsWithIndependentContinuity,nonzeroLinkedCompletedPaddleCount];
 if(numbers.some(x=>!Number.isSafeInteger(x)||x<0)||legacyClientsWithIndependentContinuity>legacyBankPaidClients)
  return {ready:false,blockers:['invalid-audit-counts']};
 const blockers=[];
 if(legacyBankPaidClients>legacyClientsWithIndependentContinuity)blockers.push('legacy-paid-customer-access-at-risk');
 if(bankProofReviewComplete!==true)blockers.push('independent-bank-proof-review-incomplete');
 if(paddleProofTableReady!==true)blockers.push('paddle-settlement-table-not-verified');
 if(verifiedLinkedPaddleSettlement!==true)blockers.push('exact-tenant-paddle-completion-not-verified');
 if(nonzeroLinkedCompletedPaddleCount<1)blockers.push('nonzero-completed-linked-paddle-payment-missing');
 if(liveCustomerLoginAccepted!==true)blockers.push('real-customer-login-not-accepted');
 return {ready:blockers.length===0,blockers};
}
