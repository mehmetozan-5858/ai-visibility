// REVIEW ONLY. Pure classification, NO database writes or access changes.
// Paddle Billing refunds are adjustment.created / adjustment.updated events,
// not transaction.refunded. Valid HMAC/authenticated delivery is required
// upstream; these shape checks do not verify the signature or ownership.
// Never automatically revoke all service for a partial refund.
const ALLOWED_EVENTS=new Set(['adjustment.created','adjustment.updated']);
const ACTIONS=new Set(['refund','credit','chargeback','chargeback_warning','chargeback_reverse','credit_reverse']);
const STATES=new Set(['pending_approval','approved','rejected','reversed']);
export function classifyPaddleAdjustmentReview(event){
 if(!event||typeof event!=='object'||Array.isArray(event)||
   !ALLOWED_EVENTS.has(event.event_type)||
   !/^evt_[a-z\d]+$/i.test(String(event.event_id||'')))return {decision:'deny',reason:'invalid-event'};
 const a=event.data;
 if(!a||typeof a!=='object'||Array.isArray(a)||
  !/^adj_[a-z\d]+$/i.test(String(a.id||''))||
  !/^txn_[a-z\d]+$/i.test(String(a.transaction_id||''))||
  !ACTIONS.has(a.action)||!STATES.has(a.status))
  return {decision:'deny',reason:'invalid-adjustment'};
 if(a.action!=='refund')return {decision:'manual-review',reason:'non-refund-adjustment'};
 if(a.status==='pending_approval')return {decision:'hold',reason:'refund-awaits-approval'};
 if(a.status==='rejected')return {decision:'no-revocation',reason:'refund-rejected'};
 if(a.status==='reversed')return {decision:'manual-review',reason:'refund-reversed'};
 // approved refund. Full vs partial MUST come from Paddle's explicit type.
 // It is not safe to assume any amount alone proves a full refund.
 if(a.type==='full')
  return {decision:'verified-refund-needs-ownership',reason:'full-refund-verify-tenant-and-payment'};
 if(a.type==='partial')
  return {decision:'manual-review',reason:'partial-refund-needs-entitlement-policy'};
 return {decision:'deny',reason:'refund-type-unverified'};
}
