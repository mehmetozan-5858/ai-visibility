/**
 * REVIEW ONLY. Fail closed on contradictory Paddle lifecycle type/status.
 * Unlike the legacy permissive mapper, the trusted callback must never
 * convert subscription.resumed(status=canceled) to active or
 * subscription.canceled(status=active) to suspended.
 *
 * This classification does not establish signature authenticity, tenant
 * ownership, event freshness or refund completion.
 */
const statuses=new Map([
 ['subscription.activated','active'],
 ['subscription.resumed','active'],
 ['subscription.paused','paused'],
 ['subscription.canceled','canceled'],
 ['subscription.past_due','past_due']
]);
export function strictPaddleSubscriptionStateReview(event){
 const type=event?.type,status=event?.status;
 if(typeof type!=='string'||typeof status!=='string')return null;
 if(type==='subscription.updated'){
  if(status==='active')return 'active';
  if(['paused','canceled','past_due'].includes(status))return 'payment-review';
  return null;
 }
 const expected=statuses.get(type);
 if(!expected||status!==expected)return null;
 return expected==='active'?'active':'payment-review';
}
