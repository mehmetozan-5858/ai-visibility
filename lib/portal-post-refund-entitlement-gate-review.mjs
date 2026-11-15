// REVIEW ONLY. A paid-row count cannot prove that some other payment grants
// current entitlement. The gate is a conservative decision aide only:
// provider finality, subscription freshness, refund reversal, cancellation,
// tenant ownership and signed receipt must be independently demonstrated.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function evaluatePostRefundEntitlementReview({
 tenantId,refundedPaymentId,remainingPayments,verifiedSettlementIds,
 activeSubscriptionPaymentIds
}={}){
 if(!UUID.test(String(tenantId||''))||!UUID.test(String(refundedPaymentId||''))||
    !Array.isArray(remainingPayments)||!Array.isArray(verifiedSettlementIds)||
    !Array.isArray(activeSubscriptionPaymentIds))
  return {decision:'hold',reason:'entitlement-evidence-incomplete'};
 const receiptValues=verifiedSettlementIds.map(id=>typeof id==='string'?id.toLowerCase():id);
 const subscriptionValues=activeSubscriptionPaymentIds.map(id=>typeof id==='string'?id.toLowerCase():id);
 const receipts=new Set(receiptValues);
 const subscriptions=new Set(subscriptionValues);
 if(![...receipts,...subscriptions].every(id=>typeof id==='string'&&UUID.test(id)))
  return {decision:'hold',reason:'entitlement-evidence-invalid'};
 const seen=new Set();
 for(const p of remainingPayments){
  if(!p||typeof p!=='object'||!UUID.test(String(p.id||''))||
     !UUID.test(String(p.tenantId||''))||typeof p.status!=='string'||
     p.tenantId.toLowerCase()!==tenantId.toLowerCase()||
     p.id.toLowerCase()===refundedPaymentId.toLowerCase()||
     seen.has(p.id.toLowerCase()))
   return {decision:'hold',reason:'payment-ownership-unverified'};
  seen.add(p.id.toLowerCase());
 }
 // Proof rows must not silently refer to a deleted, refunded, unrelated or
 // unknown payment. Unexpected evidence is a safety failure, not proof.
 if([...receipts,...subscriptions].some(id=>!seen.has(id)))
  return {decision:'hold',reason:'entitlement-evidence-unowned'};
 const eligible=remainingPayments.filter(p=>p.status==='paid'&&
    receipts.has(p.id.toLowerCase())&&subscriptions.has(p.id.toLowerCase()));
 if(eligible.length)
  // An evidence candidate is not a GO; current signed subscription state,
  // scope, dates and report entitlement still need independent acceptance.
  return {decision:'manual-review',reason:'independent-entitlement-candidate'};
 if(remainingPayments.some(p=>p.status==='paid'))
  return {decision:'hold',reason:'paid-row-without-current-entitlement-evidence'};
 // No paid rows is not sufficient to revoke access: separately granted free
 // pilots may still be valid, and changes need shared tenant lock.
 return {decision:'manual-review',reason:'check-free-pilot-before-suspension'};
}
