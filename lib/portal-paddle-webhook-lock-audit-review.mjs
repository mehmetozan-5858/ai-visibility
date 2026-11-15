/**
 * REVIEW ONLY — source contract, never a provider acceptance certificate.
 * Fail-closed view of live webhook account mutations, signing, refund event
 * coverage and settlement proof. Static checks are non-exhaustive and never
 * authorize release, even if every known finding is resolved.
 */
export function auditPaddleWebhookLockReview(source){
 const findings=[];
 if(typeof source!=='string'||source.length<100){
  return {ready:false,findings:[{code:'webhook-source-unavailable'}]};
 }
 const section=(begin,end)=>{
  const a=source.indexOf(begin);
  const b=a<0?-1:(end?source.indexOf(end,a+begin.length):-1);
  return a<0?'':source.slice(a,b>a?b:undefined);
 };
 const transaction=section('async function applyTransaction(','async function applySubscriptionAccess(');
 const subscription=section('async function applySubscriptionAccess(','export async function recordPaddleLiveEvent(');
 const handler=section('export async function recordPaddleLiveEvent(','');
 for(const [method,body] of [['applyTransaction',transaction],['applySubscriptionAccess',subscription]]){
  if(!body)findings.push({code:'webhook-account-writer-unavailable',method});
  else if(/UPDATE clients SET/.test(body)&&!/pg_advisory_xact_lock|acquirePilotAdvisoryLockReview|withPilotWriteLockReview/.test(body))
   findings.push({code:'webhook-account-writer-unlocked',method});
 }
 if(!handler||!/await tx\.query\('BEGIN'\)/.test(handler))
  findings.push({code:'webhook-transaction-unverified'});
 else if(!/pg_advisory_xact_lock|acquirePilotAdvisoryLockReview|withPilotWriteLockReview/.test(handler))
  findings.push({code:'webhook-tenant-lock-missing'});
 const allowed=section('const ALLOWED_EVENTS=','const UUID=');
 if(!allowed||!/refund|adjustment/i.test(allowed))
  findings.push({code:'refund-reversal-event-coverage-unverified'});
 if(/UPDATE clients SET plan=\$2,status='active'/.test(transaction))
  findings.push({code:'transaction-completion-direct-activation'});
 if(/UPDATE clients SET status='active'/.test(subscription))
  findings.push({code:'subscription-direct-activation'});
 const proofAt=handler.indexOf('INSERT INTO public.verified_customer_settlements');
 const transactionAt=handler.indexOf('applyTransaction(tx,item)');
 if(proofAt<0||transactionAt<0||proofAt<transactionAt)
  findings.push({code:'webhook-settlement-proof-order-unverified'});
 return {
  ready:false, // Source-only checks NEVER certify trusted production ownership.
  reason:'provider-and-entitlement-writers-not-end-to-end-verified',
  findings,
  unresolvedExternal:['paddle-adjustment-signatures-and-reversals',
   'subscription-and-transaction-serialization',
   'manual-admin-account-writes','live-Paddle-and-Neon-E2E']
 };
}
