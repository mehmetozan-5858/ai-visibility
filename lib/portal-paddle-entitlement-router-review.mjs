import {dispatchSignedPaddleEventWithTenantLockReview}
 from './portal-paddle-locked-dispatch-review.mjs';
import {applyOwnedPaddleCompletionReview}
 from './portal-paddle-completion-write-review.mjs';
import {applyOwnedPaddleSubscriptionTransitionReview}
 from './portal-paddle-subscription-transition-review.mjs';

/**
 * REVIEW ONLY — not wired to the live Paddle webhook.
 *
 * The trusted callback is selected AFTER raw HMAC verification and a shared
 * tenant transaction lock, never by an unsigned user-supplied callback.
 * Signed final payment only creates verified payment proof; it never grants
 * account access. Subscription access changes separately require the
 * newest tenant-owned subscription event and independent settlement proof.
 *
 * Payment failure, refunds, adjustments, subscription.created, unbound
 * events and unknown types are intentionally not supported. Missing refund
 * processing is a release BLOCKER, not evidence the lifecycle is complete.
 */
const SUBSCRIPTION_TRANSITIONS=new Set([
 'subscription.activated','subscription.resumed','subscription.updated',
 'subscription.paused','subscription.past_due','subscription.canceled'
]);

export async function routeSignedPaddleEntitlementReview({
 pool,raw,header,secret
}={}){
 return dispatchSignedPaddleEventWithTenantLockReview({
  pool,raw,header,secret,
  write:(tx,event)=>{
   if(event.type==='transaction.completed')
    return applyOwnedPaddleCompletionReview(tx,event);
   if(SUBSCRIPTION_TRANSITIONS.has(event.type))
    return applyOwnedPaddleSubscriptionTransitionReview(tx,event);
   throw Error('review-entitlement-event-not-implemented');
  }
 });
}
