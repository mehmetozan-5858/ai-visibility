import {verifyPaddleLiveSignature,normalizePaddleLiveEvent}
 from './paddle-live.js';
import {withPilotWriteLockReview} from './portal-pilot-advisory-lock-review.mjs';

/**
 * REVIEW ONLY; not connected to any live HTTP route or existing webhook.
 * Trust boundary: verify the raw signed Paddle message BEFORE any DB
 * connection; require an exact tenant UUID (no inferred fallback).
 * An internal server-only callback performs the actual audited mutation
 * on the pinned transaction AFTER the shared tenant advisory lock.
 *
 * Not an accepted settlement handler. All events without a secure tenant
 * binding, including some subscription.created, must fail closed or use
 * a separately reviewed exact subscription/payment lookup.
 */
const TENANT=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUTHZ_EVENTS=new Set([
 'transaction.completed','transaction.payment_failed',
 'subscription.activated','subscription.resumed',
 'subscription.updated','subscription.paused','subscription.past_due',
 'subscription.canceled'
]);

export async function dispatchSignedPaddleEventWithTenantLockReview({
 pool,raw,header,secret,write
}={}){
 if(typeof raw!=='string'||typeof header!=='string'||
  typeof secret!=='string'||secret.length<16||
  typeof write!=='function')
  throw Error('review-webhook-not-configured');
 if(!verifyPaddleLiveSignature(raw,header,secret))
  throw Error('review-webhook-signature-required');
 let parsed;
 try{parsed=JSON.parse(raw)}
 catch{throw Error('review-webhook-json-invalid')}
 const event=normalizePaddleLiveEvent(parsed);
 if(!event||!AUTHZ_EVENTS.has(event.type))
  throw Error('review-webhook-event-not-authorized');
 if(!TENANT.test(event.clientId)||!TENANT.test(event.paymentId))
  throw Error('review-webhook-tenant-link-required');
 return withPilotWriteLockReview(pool,event.clientId,
  async(tx,tenant)=>write(tx,{...event,clientId:tenant}));
}
